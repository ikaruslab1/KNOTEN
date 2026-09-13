import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { NavBar } from '@/components/ui/NavBar';
import CourseOfflineControls from '@/components/pwa/CourseOfflineControls';
import CourseSessionsView, { SessionItem } from '@/components/courses/CourseSessionsView';

interface Activity {
  id: string;
}

interface Course {
  id: string;
  nombre: string;
  imagen_url: string | null;
  profesor_id: string;
  sessions: SessionItem[];
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
        <div className="max-w-xl mx-auto py-24 text-center animate-slide-up-fade">
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
  const sessions: SessionItem[] = (course.sessions as unknown as SessionItem[]) ?? [];
  const claseSessions = sessions.filter((s) => s.tipo === 'clase');
  const repasoSessions = sessions.filter((s) => s.tipo === 'repaso');

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 overflow-x-hidden">
      <NavBar />

      {/* Course Banner Header with Slide-up Animation */}
      <div className="relative w-full h-56 sm:h-64 bg-zinc-900 overflow-hidden animate-slide-down-fade">
        {course.imagen_url ? (
          <Image
            src={course.imagen_url}
            alt={course.nombre}
            fill
            className="object-cover opacity-60"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-900/30 to-transparent flex items-end">
          <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pb-6 sm:pb-8 animate-slide-up-fade [animation-delay:100ms]">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors mb-3"
            >
              <ChevronLeft className="w-4 h-4" />
              Cursos
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <h1 className="text-white text-2xl sm:text-4xl font-black tracking-tight">
                {course.nombre}
              </h1>
              <div className="pb-0.5">
                <CourseOfflineControls cursoId={course.id} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Content with Staggered Entrance and Cinematic Transition */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <CourseSessionsView
          claseSessions={claseSessions}
          repasoSessions={repasoSessions}
          isProfessor={isProfessor}
        />
      </main>
    </div>
  );
}
