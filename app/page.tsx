import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { NavBar } from '@/components/ui/NavBar';

interface Professor {
  nombre: string;
  apellido_paterno: string;
}

interface Course {
  id: string;
  nombre: string;
  imagen_url: string | null;
  profiles: Professor | null;
}

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

  const courseList: Course[] = (rawCourses || []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    imagen_url: c.imagen_url,
    profiles: Array.isArray(c.profiles) ? c.profiles[0] ?? null : c.profiles ?? null,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Dynamic Navigation Bar */}
      <NavBar />

      {/* Hero Section (Monochromatic) */}
      <section className="bg-white py-16 sm:py-20 px-6 text-center border-b border-zinc-200">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-6">
            <Layers className="w-3.5 h-3.5" />
            Programación visual e interactiva
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-zinc-900 tracking-tight leading-tight">
            Aprende Python mediante{' '}
            <span className="underline decoration-zinc-400 decoration-wavy decoration-2">nodos lógicos</span>
          </h1>
          <p className="text-base sm:text-lg text-zinc-600 max-w-xl mx-auto mt-4">
            Conecta bloques de código, visualiza la estructura de indentación y domina la sintaxis en un lienzo infinito.
          </p>
        </div>
      </section>

      {/* Course Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Cursos disponibles</h2>
            <p className="text-sm text-zinc-500">Selecciona un curso para ver las actividades programadas</p>
          </div>
        </div>

        {courseList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-4 bg-white border border-dashed border-zinc-300 rounded-2xl">
            <BookOpen className="w-12 h-12 text-zinc-400" />
            <div className="text-center">
              <p className="text-lg font-semibold text-zinc-700">No hay cursos disponibles aún</p>
              <p className="text-sm text-zinc-500 mt-1">Los profesores publicarán nuevos cursos pronto.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courseList.map((course) => (
              <Link
                key={course.id}
                href={`/curso/${course.id}`}
                className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md hover:border-zinc-400 transition-all duration-200 flex flex-col"
              >
                {/* Course Image */}
                <div className="relative w-full aspect-video bg-zinc-900 overflow-hidden">
                  {course.imagen_url ? (
                    <Image
                      src={course.imagen_url}
                      alt={course.nombre}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center text-zinc-600">
                      <BookOpen className="w-10 h-10 text-zinc-500" />
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-lg leading-snug group-hover:text-zinc-600 transition-colors">
                      {course.nombre}
                    </h3>
                    {course.profiles && (
                      <p className="text-sm text-zinc-500 mt-1">
                        Prof. {course.profiles.nombre} {course.profiles.apellido_paterno}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-zinc-700 group-hover:text-zinc-900">
                    <span>Ver actividades</span>
                    <span>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
