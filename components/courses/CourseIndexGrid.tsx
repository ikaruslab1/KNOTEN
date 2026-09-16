'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { BookOpen, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getOfflineCourses, saveCourses } from '@/lib/offline/db'
import { navigateSafely } from '@/lib/offline/connectivity'

interface Professor {
  nombre: string
  apellido_paterno: string
}

export interface CourseItem {
  id: string
  nombre: string
  imagen_url: string | null
  profiles: Professor | null
}

interface CourseIndexGridProps {
  courses: CourseItem[]
}

export default function CourseIndexGrid({ courses }: CourseIndexGridProps) {
  const [localCourses, setLocalCourses] = useState<CourseItem[]>(courses)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const router = useRouter()

  // Load offline courses from IndexedDB if SSR courses was empty; auto-persist if present
  useEffect(() => {
    let isMounted = true
    if (courses && courses.length > 0) {
      setLocalCourses(courses)
      // Auto-persist courses to IndexedDB so they are immediately available offline!
      ;(async () => {
        try {
          await saveCourses(
            courses.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              imagen_url: c.imagen_url,
              profesor_id: '',
              profesor_nombre: c.profiles
                ? `${c.profiles.nombre} ${c.profiles.apellido_paterno}`
                : undefined,
            }))
          )
        } catch {}
      })()
      return
    }

    async function loadOffline() {
      try {
        const offCourses = await getOfflineCourses()
        if (offCourses && offCourses.length > 0 && isMounted) {
          setLocalCourses(
            offCourses.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              imagen_url: c.imagen_url,
              profiles: c.profesor_nombre
                ? {
                    nombre: c.profesor_nombre,
                    apellido_paterno: '',
                  }
                : null,
            }))
          )
        }
      } catch (err) {
        console.warn('Could not load offline courses in grid:', err)
      }
    }

    loadOffline()
    return () => {
      isMounted = false
    }
  }, [courses])

  // Reset transition state if user navigates back (pageshow / popstate)
  useEffect(() => {
    const handleReset = () => {
      setIsTransitioning(false)
      setSelectedCourseId(null)
    }
    window.addEventListener('pageshow', handleReset)
    window.addEventListener('popstate', handleReset)
    return () => {
      window.removeEventListener('pageshow', handleReset)
      window.removeEventListener('popstate', handleReset)
    }
  }, [])

  const handleCourseClick = (courseId: string, e: React.MouseEvent) => {
    e.preventDefault()
    if (isTransitioning) return

    setSelectedCourseId(courseId)
    setIsTransitioning(true)

    const targetUrl = `/curso/${courseId}`
    navigateSafely(targetUrl, router, 250)
  }

  if (localCourses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-400 gap-4 bg-white border border-dashed border-zinc-300 rounded-2xl animate-slide-up-fade">
        <BookOpen className="w-12 h-12 text-zinc-400" />
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-700">No hay cursos disponibles aún</p>
          <p className="text-sm text-zinc-500 mt-1">Los profesores publicarán nuevos cursos pronto.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Cinematic White Flash / Fade Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-white pointer-events-none z-50 transition-opacity duration-400',
          isTransitioning ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {localCourses.map((course, index) => {
          const isSelected = selectedCourseId === course.id
          const hasSelection = selectedCourseId !== null
          const isOther = hasSelection && !isSelected

          return (
            <div
              key={course.id}
              onClick={(e) => handleCourseClick(course.id, e)}
              style={{
                animationDelay: `${index * 80 + 100}ms`,
              }}
              className={cn(
                'group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 flex flex-col cursor-pointer select-none',
                // Initial entrance animation
                !hasSelection && 'animate-slide-up-fade',
                // Hover effect: grows without shifting the CSS grid
                !hasSelection &&
                  'hover:scale-[1.03] hover:shadow-xl hover:border-zinc-400 hover:z-10 relative',
                // Transition state: selected card disappears
                isSelected && 'opacity-0 scale-95 transition-all duration-200 pointer-events-none',
                // Transition state: other cards zoom out
                isOther && 'opacity-0 scale-75 transition-all duration-350 ease-in pointer-events-none'
              )}
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
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
