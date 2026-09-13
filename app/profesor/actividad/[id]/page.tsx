import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ActivityBuilder from '@/components/professor/ActivityBuilder'
import DeleteActivityTrigger from '@/components/professor/DeleteActivityTrigger'

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
  blocks?: Array<{
    id: string
    tipo: 'codigo' | 'indentacion' | 'sticker'
    contenido: string | null
    orden_correcto: number
    indent_level: number
    posicion_x: number
    posicion_y: number
  }>
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

  // Fetch the activity with its session, course, and existing blocks
  const { data: activity } = await supabase
    .from('activities')
    .select(
      `id, titulo, enunciado, resultado_esperado, orden, session_id,
       blocks ( id, tipo, contenido, orden_correcto, indent_level, posicion_x, posicion_y ),
       sessions ( id, nombre, courses ( id, nombre ) )`
    )
    .eq('id', id)
    .maybeSingle()

  if (!activity) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <header className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="mx-auto max-w-5xl">
            <nav className="flex items-center gap-1 text-sm text-zinc-500">
              <Link href="/profesor" className="hover:text-zinc-900 transition-colors">
                Mis cursos
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm text-center">
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Actividad no encontrada</h2>
            <p className="text-sm text-zinc-500 mb-6">
              La actividad que buscas no existe o ha sido eliminada.
            </p>
            <Link
              href="/profesor"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition"
            >
              Volver a Mis Cursos
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const activityData = activity as unknown as ActivityDetail
  const session = activityData.sessions
  const course = session.courses
  const blocks = (activityData.blocks ?? []).sort((a, b) => a.orden_correcto - b.orden_correcto)

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
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-xl font-bold text-zinc-900">
              {activityData.titulo}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/actividad/${id}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 transition"
                title="Abrir en el lienzo como lo verá el estudiante"
              >
                Probar en el lienzo ↗
              </Link>
              <DeleteActivityTrigger
                activityId={id}
                activityTitle={activityData.titulo}
                redirectTo={`/profesor/curso/${course.id}`}
                variant="header"
              />
            </div>
          </div>
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
          initialBlocks={blocks.map((b) => ({
            tipo: b.tipo,
            contenido: b.contenido ?? '',
            orden_correcto: b.orden_correcto,
            indent_level: b.indent_level,
          }))}
        />
      </main>
    </div>
  )
}
