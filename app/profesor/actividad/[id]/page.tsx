import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ActivityBuilder from '@/components/professor/ActivityBuilder'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityNav = {
  id: string
  titulo: string
  orden: number
}

type ActivityDetail = {
  id: string
  titulo: string
  enunciado: string | null
  resultado_esperado: string | null
  orden: number
  session_id: string
  sessions: {
    id: string
    nombre: string
    courses: {
      id: string
      nombre: string
    }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfesorActividadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Fetch the activity with its session and course
  const { data: activity } = await supabase
    .from('activities')
    .select(
      `id, titulo, enunciado, resultado_esperado, orden, session_id,
       sessions ( id, nombre, courses ( id, nombre ) )`
    )
    .eq('id', id)
    .single()

  if (!activity) notFound()

  const activityData = activity as unknown as ActivityDetail
  const session = activityData.sessions
  const course = session.courses

  // Fetch ALL activities in the same session (for nav chips)
  const { data: sessionActivities } = await supabase
    .from('activities')
    .select('id, titulo, orden')
    .eq('session_id', session.id)
    .order('orden', { ascending: true })

  const navActivities: ActivityNav[] = sessionActivities ?? []

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-500">
            <Link href="/profesor" className="hover:text-zinc-900 transition-colors">
              Mis cursos
            </Link>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
            <Link
              href={`/profesor/curso/${course.id}`}
              className="hover:text-zinc-900 transition-colors truncate max-w-[160px]"
            >
              {course.nombre}
            </Link>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
            <span className="truncate max-w-[160px] text-zinc-700">
              {session.nombre}
            </span>
          </nav>
          <h1 className="mt-1 text-xl font-bold text-zinc-900">
            {activityData.titulo}
          </h1>
        </div>
      </header>

      {/* Horizontal scrollable nav chips */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-none">
            {navActivities.map((act, index) => {
              const isActive = act.id === id
              return (
                <Link
                  key={act.id}
                  href={`/profesor/actividad/${act.id}`}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-sm'
                      : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Actividad {index + 1}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Activity builder — client component */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <ActivityBuilder
          activityId={id}
          initialActivity={{
            id: activityData.id,
            titulo: activityData.titulo,
            enunciado: activityData.enunciado,
            resultado_esperado: activityData.resultado_esperado,
            orden: activityData.orden,
            session_id: activityData.session_id,
          }}
        />
      </main>
    </div>
  )
}
