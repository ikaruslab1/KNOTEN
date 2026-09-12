import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, BookOpen, Clock, Pencil, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import SessionCreateTrigger from '@/components/professor/SessionCreateTrigger'

// ─── Types ────────────────────────────────────────────────────────────────────

type Activity = {
  id: string
  titulo: string
  orden: number
}

type Session = {
  id: string
  nombre: string
  tipo: 'clase' | 'repaso'
  fecha_liberacion: string | null
  orden: number
  activities: Activity[]
}

type Course = {
  id: string
  nombre: string
  imagen_url: string | null
  profesor_id: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfesorCursoPage({
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

  // Fetch course + verify ownership
  const { data: course } = await supabase
    .from('courses')
    .select('id, nombre, imagen_url, profesor_id')
    .eq('id', id)
    .single()

  if (!course) notFound()
  if (course.profesor_id !== user.id) redirect('/profesor')

  // Fetch sessions with activities (count via nested select)
  const { data: rawSessions } = await supabase
    .from('sessions')
    .select(
      `id, nombre, tipo, fecha_liberacion, orden,
       activities ( id, titulo, orden )`
    )
    .eq('curso_id', id)
    .order('orden', { ascending: true })

  const sessions: Session[] = (rawSessions ?? []).map((s) => ({
    ...s,
    activities: (s.activities as Activity[]) ?? [],
  }))

  const claseSessions = sessions.filter((s) => s.tipo === 'clase')
  const repasoSessions = sessions.filter((s) => s.tipo === 'repaso')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / breadcrumb */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <nav className="flex items-center gap-1.5 text-sm text-gray-500">
            <Link href="/profesor" className="hover:text-blue-600 transition-colors">
              Mis cursos
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900 truncate max-w-xs">
              {course.nombre}
            </span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{course.nombre}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        {/* ── En clase ─────────────────────────────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-zinc-800" />
            <h2 className="text-lg font-semibold text-zinc-900">En clase</h2>
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
              {claseSessions.length}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {claseSessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}

            {/* Create session card */}
            <SessionCreateTrigger cursoId={id} tipo="clase" />
          </div>
        </section>

        {/* ── Repaso ───────────────────────────────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Repaso</h2>
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
              {repasoSessions.length}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {repasoSessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}

            {/* Create session card */}
            <SessionCreateTrigger cursoId={id} tipo="repaso" />
          </div>
        </section>
      </main>
    </div>
  )
}

// ─── Session Row ──────────────────────────────────────────────────────────────

function SessionRow({ session }: { session: Session }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-zinc-900 truncate">{session.nombre}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {session.fecha_liberacion
            ? `Liberación: ${formatDate(session.fecha_liberacion)}`
            : 'Sin fecha de liberación'}
          {' · '}
          {session.activities.length} actividad
          {session.activities.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-2">
        <Link
          href={`/profesor/actividad/${session.activities[0]?.id ?? '#'}`}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:pointer-events-none disabled:opacity-50"
          aria-disabled={session.activities.length === 0}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar actividades
        </Link>
      </div>
    </div>
  )
}
