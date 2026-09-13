import Image from 'next/image';
import Link from 'next/link';
import { Lock, ChevronLeft, Calendar } from 'lucide-react';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { NavBar } from '@/components/ui/NavBar';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
}

interface Session {
  id: string;
  nombre: string;
  tipo: 'clase' | 'repaso';
  orden: number;
  fecha_liberacion: string | null;
  activities: Activity[];
}

interface Course {
  id: string;
  nombre: string;
  imagen_url: string | null;
  profesor_id: string;
  sessions: Session[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isInFuture(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) > new Date();
}

interface SessionCardProps {
  session: Session;
  isProfessor: boolean;
}

function SessionCard({ session, isProfessor }: SessionCardProps) {
  const locked = isInFuture(session.fecha_liberacion);
  const firstActivityId = session.activities?.[0]?.id;
  const href = firstActivityId ? `/actividad/${firstActivityId}` : '#';

  // Locked for students: show non-clickable locked card
  if (locked && !isProfessor) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-100/70 p-5 flex flex-col justify-between min-h-[120px] cursor-not-allowed select-none opacity-80">
        <div className="flex items-start justify-between gap-2 text-zinc-400">
          <span className="font-semibold text-base text-zinc-600">{session.nombre}</span>
          <Lock className="w-4 h-4 shrink-0 text-zinc-500 mt-1" />
        </div>
        {session.fecha_liberacion && (
          <p className="text-xs font-medium text-zinc-500 flex items-center gap-1.5 mt-4">
            <Calendar className="w-3.5 h-3.5" />
            Clase disponible el {formatDate(session.fecha_liberacion)}
          </p>
        )}
      </div>
    );
  }

  // Locked but user is Professor: clickable with gray banner indicating hidden from students
  if (locked && isProfessor) {
    return (
      <Link
        href={href}
        className="rounded-2xl border border-zinc-300 bg-white overflow-hidden block hover:shadow-md hover:border-zinc-500 transition-all shadow-sm"
      >
        <div className="bg-zinc-200 border-b border-zinc-300 px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-zinc-700 font-semibold tracking-tight">
            Contenido oculto para alumnos (fecha futura)
          </p>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-300 text-zinc-800">
            Vista profesor
          </span>
        </div>
        <div className="p-5">
          <span className="font-bold text-zinc-900 text-base">{session.nombre}</span>
          {session.fecha_liberacion && (
            <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Liberación: {formatDate(session.fecha_liberacion)}
            </p>
          )}
        </div>
      </Link>
    );
  }

  // Normal accessible card
  return (
    <Link
      href={href}
      className="rounded-2xl border border-zinc-200 bg-white p-5 flex flex-col justify-between min-h-[120px] hover:shadow-md hover:border-zinc-400 transition-all block group"
    >
      <div className="flex items-start justify-between">
        <span className="font-bold text-zinc-900 text-base group-hover:text-zinc-700 transition-colors">
          {session.nombre}
        </span>
        <span className="text-zinc-400 group-hover:text-zinc-900 transition-colors text-sm font-bold">
          →
        </span>
      </div>
      {session.fecha_liberacion && (
        <p className="text-xs text-zinc-500 mt-4 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          {formatDate(session.fecha_liberacion)}
        </p>
      )}
    </Link>
  );
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch profile (cached) and course in parallel
  const [profile, { data: rawCourse }] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from('courses')
      .select(`
        id,
        nombre,
        imagen_url,
        profesor_id,
        sessions (
          id,
          nombre,
          tipo,
          orden,
          fecha_liberacion,
          activities (
            id
          )
        )
      `)
      .eq('id', id)
      .order('orden', { referencedTable: 'sessions', ascending: true })
      .maybeSingle(),
  ]);

  const isProfessor = profile?.rol === 'profesor';

  if (!rawCourse) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <NavBar />
        <div className="max-w-xl mx-auto py-24 text-center">
          <h2 className="text-2xl font-bold text-zinc-800">Curso no encontrado</h2>
          <p className="text-sm text-zinc-500 mt-2">El curso solicitado no existe o fue eliminado.</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  const course = rawCourse as unknown as Course;
  const sessions: Session[] = (course.sessions as unknown as Session[]) ?? [];
  const claseSessions = sessions.filter((s) => s.tipo === 'clase');
  const repasoSessions = sessions.filter((s) => s.tipo === 'repaso');

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <NavBar />

      {/* Course Banner Header */}
      <div className="relative w-full h-56 sm:h-64 bg-zinc-900 overflow-hidden">
        {course.imagen_url ? (
          <Image
            src={course.imagen_url}
            alt={course.nombre}
            fill
            className="object-cover opacity-60"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-900/30 to-transparent flex items-end">
          <div className="max-w-5xl w-full mx-auto px-6 pb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors mb-3"
            >
              <ChevronLeft className="w-4 h-4" />
              Cursos
            </Link>
            <h1 className="text-white text-3xl sm:text-4xl font-black tracking-tight">{course.nombre}</h1>
          </div>
        </div>
      </div>

      {/* Sessions Content */}
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">
        {/* Actividades en clase */}
        <section>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Actividades en clase</h2>
              <p className="text-xs text-zinc-500">Sesiones prácticas programadas para el aula</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-200 text-zinc-800">
              {claseSessions.length} {claseSessions.length === 1 ? 'sesión' : 'sesiones'}
            </span>
          </div>

          {claseSessions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-zinc-300 bg-white text-center text-sm text-zinc-500">
              No hay actividades en clase programadas para este curso todavía.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {claseSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isProfessor={isProfessor}
                />
              ))}
            </div>
          )}
        </section>

        {/* Actividades de repaso */}
        <section>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Actividades de repaso</h2>
              <p className="text-xs text-zinc-500">Práctica autónoma y refuerzo de conceptos</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-200 text-zinc-800">
              {repasoSessions.length} {repasoSessions.length === 1 ? 'sesión' : 'sesiones'}
            </span>
          </div>

          {repasoSessions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-zinc-300 bg-white text-center text-sm text-zinc-500">
              No hay actividades de repaso registradas en este curso.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {repasoSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isProfessor={isProfessor}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
