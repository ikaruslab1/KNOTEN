import Image from 'next/image';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <span className="text-2xl font-bold text-blue-600 tracking-tight">PyNodes</span>
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Ingresar
        </Link>
      </header>

      {/* Hero */}
      <section className="bg-white py-16 px-6 text-center border-b border-gray-100">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
          Aprende Python de forma{' '}
          <span className="text-blue-600">visual</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Conecta bloques de código y descubre la lógica de la programación
        </p>
      </section>

      {/* Course Grid */}
      <main className="p-8">
        {courseList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-4">
            <BookOpen className="w-12 h-12" />
            <p className="text-lg font-medium">No hay cursos disponibles aún</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {courseList.map((course) => (
              <Link
                key={course.id}
                href={`/curso/${course.id}`}
                className="group overflow-hidden rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-white block"
              >
                {/* Course Image */}
                <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                  {course.imagen_url ? (
                    <Image
                      src={course.imagen_url}
                      alt={course.nombre}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500" />
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <h2 className="font-semibold text-gray-900 text-lg leading-snug group-hover:text-blue-600 transition-colors">
                    {course.nombre}
                  </h2>
                  {course.profiles && (
                    <p className="text-sm text-gray-500 mt-1">
                      Prof. {course.profiles.nombre} {course.profiles.apellido_paterno}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
