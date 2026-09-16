'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, Loader2, BookOpen } from 'lucide-react'
import {
  openDB,
  OfflineCourse,
  getOfflineSessionsByCourse,
  getOfflineActivitiesBySession,
  saveCourses,
  saveSessions,
  OFFLINE_CACHE_NAME,
} from '@/lib/offline/db'
import { precachePageAndAssets } from '@/lib/offline/sync'
import { isOnlineSync, setKnownOffline } from '@/lib/offline/connectivity'
import { createClient } from '@/lib/supabase/client'
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

    // 1. Determine active course ID from window pathname if available (handles cached shell)
    let pathCourseId = ''
    if (typeof window !== 'undefined') {
      const segments = window.location.pathname.split('/').filter(Boolean)
      const cIdx = segments.indexOf('curso')
      if (cIdx !== -1 && segments[cIdx + 1]) {
        pathCourseId = segments[cIdx + 1]
      }
    }
    const resolvedId = pathCourseId || courseId || initialCourse?.id || ''

    // 2. If initialCourse matches resolvedId, is not a shell, and has sessions, use it!
    if (
      initialCourse &&
      initialCourse.id === resolvedId &&
      resolvedId !== 'curso-shell' &&
      resolvedId !== 'offline' &&
      Array.isArray(initialCourse.sessions) &&
      initialCourse.sessions.length > 0
    ) {
      if (isMounted) {
        setCourse(initialCourse)
        setIsLoading(false)
      }
      // Auto-persist course and sessions to IndexedDB in background
      ;(async () => {
        try {
          await saveCourses([{
            id: initialCourse.id,
            nombre: initialCourse.nombre,
            imagen_url: initialCourse.imagen_url,
            profesor_id: initialCourse.profesor_id,
          }])
          if (initialCourse.sessions && initialCourse.sessions.length > 0) {
            await saveSessions(
              initialCourse.sessions.map((s) => ({
                id: s.id,
                curso_id: initialCourse.id,
                nombre: s.nombre,
                tipo: s.tipo,
                orden: s.orden ?? 0,
                fecha_liberacion: s.fecha_liberacion,
              }))
            )
            // Pre-warm the first activity's chunks into Cache Storage in background if online
            const firstActId = initialCourse.sessions[0]?.activities?.[0]?.id
            if (firstActId && typeof window !== 'undefined' && 'caches' in window && isOnlineSync()) {
              window.caches.open(OFFLINE_CACHE_NAME).then((cache) => {
                precachePageAndAssets(`/actividad/${firstActId}`, cache, '/actividad-shell')
              }).catch(() => {})
            }
          }
        } catch (e) {
          console.warn('Could not auto-persist course to IndexedDB:', e)
        }
      })()
      return
    }

    async function resolveCourse() {
      if (!resolvedId) {
        if (isMounted) setIsLoading(false)
        return
      }

      if (!course || course.id !== resolvedId) {
        setIsLoading(true)
      }

      // 3. Check IndexedDB offline cache
      try {
        const db = await openDB()
        const offlineCourse = await new Promise<OfflineCourse | null>((resolve) => {
          const tx = db.transaction('courses', 'readonly')
          const req = tx.objectStore('courses').get(resolvedId)
          req.onsuccess = () => resolve(req.result || null)
          req.onerror = () => resolve(null)
        })

        if (offlineCourse && isMounted) {
          const offSessions = await getOfflineSessionsByCourse(resolvedId)
          const fullSessions: SessionItem[] = await Promise.all(
            offSessions.map(async (s) => {
              const acts = await getOfflineActivitiesBySession(s.id)
              return {
                id: s.id,
                nombre: s.nombre,
                tipo: s.tipo,
                orden: s.orden ?? 0,
                fecha_liberacion: s.fecha_liberacion,
                activities: acts.map((a) => ({ id: a.id, orden: a.orden })),
              }
            })
          )

          setCourse({
            id: offlineCourse.id,
            nombre: offlineCourse.nombre,
            imagen_url: offlineCourse.imagen_url,
            profesor_id: offlineCourse.profesor_id,
            sessions: fullSessions,
          })
          setIsLoading(false)
          return
        }
      } catch (err) {
        console.warn('Could not read course from IndexedDB:', err)
      }

      // 4. Fetch directly from Supabase on client if not in IndexedDB (when online)
      if (isOnlineSync()) {
        try {
          const supabase = createClient()
          const { data: rawCourse, error } = await supabase
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
            .eq('id', resolvedId)
            .order('orden', { referencedTable: 'sessions', ascending: true })
            .maybeSingle()

          if (rawCourse && isMounted) {
            const resolvedCourse: CourseData = {
              id: rawCourse.id,
              nombre: rawCourse.nombre,
              imagen_url: rawCourse.imagen_url,
              profesor_id: rawCourse.profesor_id,
              sessions: (rawCourse.sessions as any) ?? [],
            }
            setCourse(resolvedCourse)
            setIsLoading(false)

            // Auto-persist newly fetched course and sessions to IndexedDB
            ;(async () => {
              try {
                await saveCourses([{
                  id: rawCourse.id,
                  nombre: rawCourse.nombre,
                  imagen_url: rawCourse.imagen_url,
                  profesor_id: rawCourse.profesor_id,
                }])
                const rawSessions = (rawCourse.sessions as any[]) ?? []
                if (rawSessions.length > 0) {
                  await saveSessions(
                    rawSessions.map((s) => ({
                      id: s.id,
                      curso_id: rawCourse.id,
                      nombre: s.nombre,
                      tipo: s.tipo,
                      orden: s.orden ?? 0,
                      fecha_liberacion: s.fecha_liberacion,
                    }))
                  )
                }
              } catch {}
            })()
            return
          }
        } catch (err) {
          console.warn('Could not fetch course client-side:', err)
          setKnownOffline()
        }
      }

      // 5. Fallback: if initialCourse was provided for this ID, use it even if sessions were empty
      if (initialCourse && initialCourse.id === resolvedId && isMounted) {
        setCourse(initialCourse)
        setIsLoading(false)
        return
      }

      if (isMounted) {
        setIsLoading(false)
      }
    }

    resolveCourse()

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
        <h2 className="text-2xl font-bold text-zinc-800">
          {!isOnlineSync() ? 'Curso no disponible sin conexión' : 'Curso no encontrado'}
        </h2>
        <p className="text-sm text-zinc-500 mt-2">
          {!isOnlineSync()
            ? 'Este curso no ha sido descargado para su uso sin conexión. Conéctate a internet para sincronizarlo.'
            : 'El curso solicitado no existe o fue eliminado.'}
        </p>
        <Link
          href="/"
          onClick={(e) => {
            if (!isOnlineSync()) {
              e.preventDefault()
              window.location.assign('/')
            }
          }}
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
