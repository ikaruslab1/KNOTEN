import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen } from 'lucide-react'
import { createClient, getCurrentProfile } from '@/lib/supabase/server'
import CreateCourseModalTrigger from '@/components/professor/CreateCourseModalTrigger'
import EditCourseModalTrigger from '@/components/professor/EditCourseModalTrigger'

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = {
  id: string
  nombre: string
  imagen_url: string | null
  profesor_id: string
  created_at: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfesorDashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.rol !== 'profesor') redirect('/')

  const supabase = await createClient()
  const { data: courses } = await supabase
    .from('courses')
    .select('id, nombre, imagen_url, profesor_id, created_at')
    .eq('profesor_id', profile.id)
    .order('created_at', { ascending: false })

  const courseList: Course[] = courses ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis cursos</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Bienvenido, {profile.nombre} {profile.apellido_paterno}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* ── Create card (rendered as a client wrapper for modal) ───────── */}
          <CreateCourseModalTrigger />

          {/* ── Existing course cards ──────────────────────────────────────── */}
          {courseList.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        {courseList.length === 0 && (
          <p className="mt-16 text-center text-sm text-gray-400">
            Aún no tienes cursos. ¡Crea tu primer curso!
          </p>
        )}
      </main>
    </div>
  )
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseCard({ course }: { course: Course }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Cover image */}
      <div className="relative h-40 w-full bg-zinc-900 overflow-hidden">
        {course.imagen_url ? (
          <Image
            src={course.imagen_url}
            alt={course.nombre}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
            <BookOpen className="h-10 w-10 text-zinc-600" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h2 className="line-clamp-2 text-base font-semibold text-zinc-900 leading-snug">
          {course.nombre}
        </h2>

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          <Link
            href={`/profesor/curso/${course.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Ver sesiones
          </Link>
          <EditCourseModalTrigger course={course} />
        </div>
      </div>
    </article>
  )
}
