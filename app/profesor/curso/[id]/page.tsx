import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, BookOpen, Clock, Pencil } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import SessionCreateTrigger from '@/components/professor/SessionCreateTrigger'
import SessionEditTrigger from '@/components/professor/SessionEditTrigger'
import SessionOrderControls from '@/components/professor/SessionOrderControls'
import DeleteCourseTrigger from '@/components/professor/DeleteCourseTrigger'
import DeleteSessionTrigger from '@/components/professor/DeleteSessionTrigger'
import DeleteActivityTrigger from '@/components/professor/DeleteActivityTrigger'

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
  created_at?: string
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
        `id, nombre, tipo, fecha_liberacion, orden, created_at,
         activities ( id, titulo, orden )`
      )
      .eq('curso_id', id)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (!user) redirect('/')
  if (!course) notFound()
  if (course.profesor_id !== user.id) redirect('/profesor')

  const sessions: Session[] = (rawSessions ?? []).map((s) => ({
    ...s,
    activities: (s.activities as Activity[]) ?? [],
  }))

  const claseSessions = sessions
    .filter((s) => s.tipo === 'clase')
    .sort(
      (a, b) =>
        (a.orden ?? 0) - (b.orden ?? 0) ||
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    )

  const repasoSessions = sessions
    .filter((s) => s.tipo === 'repaso')
    .sort(
      (a, b) =>
        (a.orden ?? 0) - (b.orden ?? 0) ||
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    )

  const claseSimples = claseSessions.map((s) => ({ id: s.id, orden: s.orden }))
  const repasoSimples = repasoSessions.map((s) => ({ id: s.id, orden: s.orden }))

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
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/curso/${id}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 transition"
              >
                Ver vista pública del curso ↗
              </Link>
              <DeleteCourseTrigger
                courseId={id}
                courseName={course.nombre}
                variant="header"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 sm:space-y-10 px-4 sm:px-6 py-6 sm:py-8">
        {/* ── En clase ─────────────────────────────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-zinc-800" />
              <h2 className="text-lg font-semibold text-zinc-900">En clase</h2>
              <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
                {claseSessions.length}
              </span>
            </div>
            {claseSessions.length > 1 && (
              <span className="text-xs text-zinc-400 hidden sm:inline">
                Usa las flechas ▲ ▼ o edita la sesión para cambiar el orden
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {claseSessions.map((session, idx) => (
              <SessionRow
                key={session.id}
                session={session}
                cursoId={id}
                index={idx}
                totalSessions={claseSessions.length}
                allSessionsOfType={claseSimples}
              />
            ))}

            {/* Create session card */}
            <SessionCreateTrigger
              cursoId={id}
              tipo="clase"
              totalSessionsOfType={claseSessions.length}
            />
          </div>
        </section>

        {/* ── Repaso ───────────────────────────────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-zinc-600" />
              <h2 className="text-lg font-semibold text-zinc-900">Repaso</h2>
              <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
                {repasoSessions.length}
              </span>
            </div>
            {repasoSessions.length > 1 && (
              <span className="text-xs text-zinc-400 hidden sm:inline">
                Usa las flechas ▲ ▼ o edita la sesión para cambiar el orden
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {repasoSessions.map((session, idx) => (
              <SessionRow
                key={session.id}
                session={session}
                cursoId={id}
                index={idx}
                totalSessions={repasoSessions.length}
                allSessionsOfType={repasoSimples}
              />
            ))}

            {/* Create session card */}
            <SessionCreateTrigger
              cursoId={id}
              tipo="repaso"
              totalSessionsOfType={repasoSessions.length}
            />
          </div>
        </section>
      </main>
    </div>
  )
}

// ─── Session Row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  cursoId,
  index,
  totalSessions,
  allSessionsOfType,
}: {
  session: Session
  cursoId: string
  index: number
  totalSessions: number
  allSessionsOfType: { id: string; orden: number }[]
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Info & Position Badge & Reorder Controls */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <span
              className="inline-flex items-center justify-center font-mono text-xs font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-lg px-2 py-1 select-none min-w-[32px] text-center shadow-2xs"
              title={`Posición #${index + 1} en ${session.tipo === 'clase' ? 'En clase' : 'Repaso'}`}
            >
              #{index + 1}
            </span>
            <SessionOrderControls
              cursoId={cursoId}
              tipo={session.tipo}
              currentSessionId={session.id}
              currentIndex={index}
              totalSessions={totalSessions}
              allSessionsOfType={allSessionsOfType}
            />
          </div>

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
              orden: session.orden || index + 1,
              activitiesCount: session.activities.length,
            }}
            totalSessionsOfType={totalSessions}
          />
          <DeleteSessionTrigger
            sessionId={session.id}
            sessionName={session.nombre}
            activitiesCount={session.activities.length}
            variant="icon"
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
          {session.activities.map((act, idx) => (
            <div
              key={act.id}
              className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 transition shadow-2xs group overflow-hidden"
            >
              <Link
                href={`/profesor/actividad/${act.id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-zinc-800 text-xs font-medium hover:text-zinc-950 transition"
              >
                <Pencil className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600" />
                <span>{act.titulo || `Actividad ${idx + 1}`}</span>
              </Link>
              <div className="w-px h-3.5 bg-zinc-200" />
              <DeleteActivityTrigger
                activityId={act.id}
                activityTitle={act.titulo || `Actividad ${idx + 1}`}
                variant="chip"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-zinc-400 italic">
          No hay actividades creadas en esta sesión.
        </p>
      )}
    </div>
  )
}
