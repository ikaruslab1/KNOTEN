import { createClient, getCurrentProfile } from '@/lib/supabase/server';
import { NavBar } from '@/components/ui/NavBar';
import CourseDetailView, { CourseData } from '@/components/courses/CourseDetailView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let rawCourse = null;
  let profile = null;

  try {
    const supabase = await createClient();
    const [profResult, courseResult] = await Promise.allSettled([
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
              id,
              orden
            )
          )
        `)
        .eq('id', id)
        .order('orden', { referencedTable: 'sessions', ascending: true })
        .maybeSingle(),
    ]);

    if (profResult.status === 'fulfilled') {
      profile = profResult.value;
    }
    if (courseResult.status === 'fulfilled') {
      rawCourse = courseResult.value?.data || null;
      if (courseResult.value?.error) {
        console.warn('Course query returned error:', courseResult.value.error);
      }
    }
  } catch (err) {
    console.warn('Could not fetch course on server (offline):', err);
  }

  const isProfessor = profile?.rol === 'profesor';
  const initialCourse: CourseData | null = rawCourse
    ? {
        id: rawCourse.id,
        nombre: rawCourse.nombre,
        imagen_url: rawCourse.imagen_url,
        profesor_id: rawCourse.profesor_id,
        sessions: (rawCourse.sessions as any) ?? [],
      }
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 overflow-x-hidden">
      <NavBar />
      <CourseDetailView
        courseId={id}
        initialCourse={initialCourse}
        isProfessorInitial={isProfessor}
      />
    </div>
  );
}
