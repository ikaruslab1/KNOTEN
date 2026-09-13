import { Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { NavBar } from '@/components/ui/NavBar';
import CourseIndexGrid, { CourseItem } from '@/components/courses/CourseIndexGrid';
import InteractiveHeroWords from '@/components/home/InteractiveHeroWords';

export const revalidate = 30;

export default async function HomePage() {
  const supabase = await createClient();

  const { data: rawCourses } = await supabase
    .from('courses')
    .select(`
      id,
      nombre,
      imagen_url,
      profiles:profesor_id (
        nombre,
        apellido_paterno
      )
    `)
    .order('created_at', { ascending: false });

  const courseList: CourseItem[] = (rawCourses || []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    imagen_url: c.imagen_url,
    profiles: Array.isArray(c.profiles) ? c.profiles[0] ?? null : c.profiles ?? null,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 relative">
      {/* Dynamic Navigation Bar */}
      <NavBar />

      {/* Hero Section */}
      <section className="bg-white py-12 sm:py-18 px-4 sm:px-6 text-center border-b border-zinc-200 relative overflow-visible z-10">
        <div className="max-w-4xl mx-auto space-y-4 overflow-visible">
          <div className="animate-slide-up-fade inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-700">
            <Layers className="w-3.5 h-3.5" />
            Programación visual e interactiva
          </div>

          <InteractiveHeroWords />

          <p className="animate-slide-up-fade text-sm sm:text-lg text-zinc-600 max-w-xl mx-auto [animation-delay:200ms]">
            Conecta bloques de código, visualiza la estructura de indentación y domina la sintaxis en un lienzo infinito.
          </p>
        </div>
      </section>

      {/* Course Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="animate-slide-up-fade flex items-center justify-between mb-8 [animation-delay:250ms]">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Cursos disponibles</h2>
            <p className="text-sm text-zinc-500">Selecciona un curso para ver las actividades programadas</p>
          </div>
        </div>

        <CourseIndexGrid courses={courseList} />
      </main>
    </div>
  );
}
