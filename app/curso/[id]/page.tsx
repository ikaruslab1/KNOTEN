import Image from 'next/image';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
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
  imagen_portada: string | null;
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
  isCourseOwner: boolean;
}

function SessionCard({ session, isProfessor, isCourseOwner }: SessionCardProps) {
  const locked = isInFuture(session.fecha_liberacion);
  const firstActivityId = session.activities?.[0]?.id;
  const href = firstActivityId ? `/actividad/${firstActivityId}` : `/sesion/${session.id}`;

  // Locked for students: show non-clickable locked card
  if (locked && !isProfessor) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col gap-2 cursor-not-allowed select-none">
        <div className="flex items-center gap-2 text-gray-400">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium text-sm text-gray-500">{session.nombre}</span>
        </div>
        {session.fecha_liberacion && (
          <p className="text-xs text-gray-400">
            Clase disponible el {formatDate(session.fecha_liberacion)}
          </p>
        )}
      </div>
    );
  }

  // Locked but professor owns the course: clickable with amber banner
  if (locked && isProfessor && isCourseOwner) {
    return (
      <Link href={href} className="rounded-xl border border-amber-300 bg-white overflow-hidden block hover:shadow-md transition-shadow">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <p className="text-xs text-amber-700 font-medium">
            Este contenido está oculto para los alumnos
          </p>
        </div>
        <div className="p-4">
          <span className="font-semibold text-gray-900 text-sm">{session.nombre}</span>
          {session.fecha_liberacion && (
            <p className="text-xs text-gray-400 mt-1">
              Se libera el {formatDate(session.fecha_liberacion)}
            </p>
          )}
        </div>
      </Link>
    );
  }

  // Normal card
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-1 hover:shadow-md hover:border-blue-200 transition-all block"
    >
      <span className="font-semibold text-gray-900 text-sm">{session.nombre}</span>
      {session.fecha_liberacion && (
        <p className="text-xs text-gray-400">
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

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch course + sessions + first activity per session
  const { data: course } = await supabase
    .from('courses')
    .select(`
      id,
      nombre,
      imagen_portada,
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
    .single();

  // Get professor role
  let isProfessor = false;
  let isCourseOwner = false;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    isProfessor = profile?.rol === 'profesor';
    isCourseOwner = isProfessor && course?.profesor_id === user.id;
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Curso no encontrado.
      </div>
    );
  }

  const sessions: Session[] = (course.sessions as unknown as Session[]) ?? [];
  const claseSessions = sessions.filter((s) => s.tipo === 'clase');
  const repasoSessions = sessions.filter((s) => s.tipo === 'repaso');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="px-6 pt-5 pb-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-blue-600 transition-colors">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700 font-medium">{course.nombre}</span>
      </div>

      {/* Course Header */}
      <div className="relative w-full max-h-48 overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500">
        {course.imagen_portada && (
          <Image
            src={course.imagen_portada}
            alt={course.nombre}
            width={1600}
            height={384}
            className="w-full max-h-48 object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/40 flex items-end px-8 pb-5">
          <h1 className="text-white text-3xl font-bold drop-shadow">{course.nombre}</h1>
        </div>
      </div>

      {/* Sessions */}
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Actividades en clase */}
        {claseSessions.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Actividades en clase</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {claseSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isProfessor={isProfessor}
                  isCourseOwner={isCourseOwner}
                />
              ))}
            </div>
          </section>
        )}

        {/* Actividades de repaso */}
        {repasoSessions.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Actividades de repaso</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {repasoSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isProfessor={isProfessor}
                  isCourseOwner={isCourseOwner}
                />
              ))}
            </div>
          </section>
        )}

        {claseSessions.length === 0 && repasoSessions.length === 0 && (
          <p className="text-gray-400 text-center py-16">
            Este curso aún no tiene sesiones disponibles.
          </p>
        )}
      </main>
    </div>
  );
}
