import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, BookOpen, Clock, Pencil, Plus } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import SessionCreateTrigger from '@/components/professor/SessionCreateTrigger'
import SessionEditTrigger from '@/components/professor/SessionEditTrigger'

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

  // Run auth check, course fetch, and sessions fetch concurrently
  const [user, { data: course }, { data: rawSessions }] = await Promise.all([
    getCurrentUser(),
    supabase
      .from('courses')
      .select('id, nombre, imagen_url, profesor_id')
      .eq('id', id)
      .single(),
    supabase
      .from('sessions')
      .select(
        `id, nombre, tipo, fecha_liberacion, orden,
         activities ( id, titulo, orden )`
      )
      .eq('curso_id', id)
      .order('orden', { ascending: true }),
  ])

  if (!user) redirect('/')
  if (!course) notFound()
  if (course.profesor_id !== user.id) redirect('/profesor')

  const sessions: Session[] = (rawSessions ?? []).map((s) => ({
    ...s,
    activities: (s.activities as Activity[]) ?? [],
  }))

  const claseSessions = sessions.filter((s) => s.tipo === 'clase')
  const repasoSessions = sessions.filter((s) => s.tipo === 'repaso')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / breadcrumb */}
      <header className="border-b border-zinc-200 bg-white px-4 sm:px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-zinc-500">
            <Link href="/profesor" className="hover:text-zinc-900 transition-colors">
              Mis cursos
            </Link>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
            <span className="font-medium text-zinc-900 truncate max-w-[160px] sm:max-w-xs">
              {course.nombre}
            </span>
          </nav>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">{course.nombre}</h1>
            <Link
              href={`/curso/${id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-zinc-300 bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 transition"
            >
              Ver vista pública del curso ↗
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 sm:space-y-10 px-4 sm:px-6 py-6 sm:py-8">
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
              <SessionRow key={session.id} session={session} cursoId={id} />
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
              <SessionRow key={session.id} session={session} cursoId={id} />
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

function SessionRow({ session, cursoId }: { session: Session; cursoId: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-zinc-900 text-base">{session.nombre}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {session.fecha_liberacion
              ? `Liberación: ${formatDate(session.fecha_liberacion)}`
              : 'Disponible inmediatamente'}
            {' · '}
            {session.activities.length} actividad
            {session.activities.length !== 1 ? 'es' : ''}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <SessionEditTrigger
            cursoId={cursoId}
            session={{
              id: session.id,
              nombre: session.nombre,
              tipo: session.tipo,
              fecha_liberacion: session.fecha_liberacion,
              activitiesCount: session.activities.length,
            }}
          />
          {session.activities.length > 0 && (
            <Link
              href={`/actividad/${session.activities[0].id}`}
              target="_blank"
              className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
            >
              Vista alumno ↗
            </Link>
          )}
        </div>
      </div>

      {/* Activities list chips */}
      {session.activities.length > 0 ? (
        <div className="mt-1 pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Actividades:</span>
          {session.activities.map((act, index) => (
            <Link
              key={act.id}
              href={`/profesor/actividad/${act.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-400 text-zinc-800 text-xs font-medium transition"
            >
              <Pencil className="w-3 h-3 text-zinc-500" />
              <span>Actividad {index + 1}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-zinc-400 italic">No hay actividades creadas en esta sesión.</p>
      )}
    </div>
  )
}
