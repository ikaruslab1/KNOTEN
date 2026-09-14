'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, Loader2, BookOpen } from 'lucide-react'
import { openDB, OfflineCourse } from '@/lib/offline/db'
import CourseOfflineControls from '@/components/pwa/CourseOfflineControls'
import CourseSessionsView, { SessionItem } from './CourseSessionsView'
import { useAuth } from '@/components/auth/AuthProvider'

export interface CourseData {
  id: string
  nombre: string
  imagen_url: string | null
  profesor_id: string
  sessions: SessionItem[]
}

interface CourseDetailViewProps {
  courseId: string
  initialCourse: CourseData | null
  isProfessorInitial: boolean
}

export default function CourseDetailView({
  courseId,
  initialCourse,
  isProfessorInitial,
}: CourseDetailViewProps) {
  const [course, setCourse] = useState<CourseData | null>(initialCourse)
  const [isLoading, setIsLoading] = useState<boolean>(!initialCourse)
  const { profile } = useAuth()
  const isProfessor = isProfessorInitial || profile?.rol === 'profesor'

  useEffect(() => {
    let isMounted = true

    async function loadFromIndexedDB() {
      if (initialCourse && initialCourse.id === courseId) {
        if (isMounted) {
          setCourse(initialCourse)
          setIsLoading(false)
        }
        return
      }

      try {
        const db = await openDB()
        const offlineCourse = await new Promise<OfflineCourse | null>((resolve) => {
          const tx = db.transaction('courses', 'readonly')
          const req = tx.objectStore('courses').get(courseId)
          req.onsuccess = () => resolve(req.result || null)
          req.onerror = () => resolve(null)
        })

        if (offlineCourse && isMounted) {
          setCourse({
            id: offlineCourse.id,
            nombre: offlineCourse.nombre,
            imagen_url: offlineCourse.imagen_url,
            profesor_id: offlineCourse.profesor_id,
            sessions: [], // CourseSessionsView will load sessions from IndexedDB
          })
          setIsLoading(false)
          return
        }
      } catch (err) {
        console.warn('Could not read course from IndexedDB:', err)
      }

      if (isMounted) {
        setIsLoading(false)
      }
    }

    loadFromIndexedDB()

    return () => {
      isMounted = false
    }
  }, [courseId, initialCourse])

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
        <p className="text-sm font-medium">Cargando curso...</p>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center animate-slide-up-fade px-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4 text-zinc-400">
          <BookOpen className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-800">Curso no encontrado</h2>
        <p className="text-sm text-zinc-500 mt-2">
          El curso solicitado no existe o no ha sido descargado para uso sin conexión.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver al catálogo
        </Link>
      </div>
    )
  }

  const sessions: SessionItem[] = course.sessions || []
  const claseSessions = sessions.filter((s) => s.tipo === 'clase')
  const repasoSessions = sessions.filter((s) => s.tipo === 'repaso')

  return (
    <>
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

      {/* Sessions Content with Staggered Entrance */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <CourseSessionsView
          courseId={course.id}
          claseSessions={claseSessions}
          repasoSessions={repasoSessions}
          isProfessor={isProfessor}
        />
      </main>
    </>
  )
}
