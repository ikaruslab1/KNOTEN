import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import MetricsTable from '@/components/professor/MetricsTable'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricsRow = {
  student_id: string
  nombre: string
  carrera: string | null
  actividad_titulo: string
  actividad_id: string
  intentos: number
  completado: boolean
  fecha_completado: string | null
  course_id: string
  course_nombre: string
}

type Course = {
  id: string
  nombre: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfesorMetricasPage() {
  const [user, supabase] = await Promise.all([
    getCurrentUser(),
    createClient(),
  ])
  if (!user) redirect('/')

  // Professor's courses
  const { data: courses } = await supabase
    .from('courses')
    .select('id, nombre')
    .eq('profesor_id', user.id)
    .order('created_at', { ascending: false })

  const courseList: Course[] = courses ?? []

  if (courseList.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <p className="text-gray-500">No tienes cursos todavía.</p>
      </div>
    )
  }

  // For each course, fetch metrics concurrently
  const rowsPerCourse = await Promise.all(
    courseList.map(async (course) => {
      const rows: MetricsRow[] = []
      // Fetch enrollments and sessions in parallel for this course
      const [{ data: enrollments }, { data: sessions }] = await Promise.all([
        supabase
          .from('enrollments')
          .select(
            `student_id,
             profiles ( nombre, apellido_paterno, carrera )`
          )
          .eq('course_id', course.id),
        supabase
          .from('sessions')
          .select('id')
          .eq('curso_id', course.id),
      ])

      const enrolled = enrollments ?? []
      const sessionIds = (sessions ?? []).map((s) => s.id)
      if (sessionIds.length === 0 || enrolled.length === 0) return rows

      const { data: activities } = await supabase
        .from('activities')
        .select('id, titulo, orden')
        .in('session_id', sessionIds)
        .order('orden', { ascending: true })

      const activityList = activities ?? []
      const studentIds = enrolled.map((e) => e.student_id)
      if (activityList.length === 0) return rows

      const { data: progressList } = await supabase
        .from('progress')
        .select('student_id, activity_id, intentos, completado, fecha_completado')
        .in('student_id', studentIds)
        .in('activity_id', activityList.map((a) => a.id))

      type ProgressItem = {
        student_id: string
        activity_id: string
        intentos: number
        completado: boolean
        fecha_completado: string | null
      }

      const progressMap = new Map<string, ProgressItem>()
      for (const p of (progressList ?? []) as ProgressItem[]) {
        progressMap.set(`${p.student_id}:${p.activity_id}`, p)
      }

      for (const enrollment of enrolled) {
        const profile = enrollment.profiles as unknown as {
          nombre: string
          apellido_paterno: string
          carrera: string | null
        } | null
        if (!profile) continue

        const fullName = `${profile.nombre} ${profile.apellido_paterno}`.trim()
        for (const activity of activityList) {
          const key = `${enrollment.student_id}:${activity.id}`
          const prog = progressMap.get(key)
          rows.push({
            student_id: enrollment.student_id,
            nombre: fullName,
            carrera: profile.carrera ?? null,
            actividad_titulo: activity.titulo,
            actividad_id: activity.id,
            intentos: prog?.intentos ?? 0,
            completado: prog?.completado ?? false,
            fecha_completado: prog?.fecha_completado ?? null,
            course_id: course.id,
            course_nombre: course.nombre,
          })
        }
      }
      return rows
    })
  )

  const allRows: MetricsRow[] = rowsPerCourse.flat()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900">Métricas de alumnos</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Datos actualizados en tiempo real
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <MetricsTable rows={allRows} courses={courseList} />
      </main>
    </div>
  )
}
