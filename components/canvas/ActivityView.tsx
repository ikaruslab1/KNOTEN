'use client'

import { useEffect, useState } from 'react'
import FlowCanvas, { Block, BlockConnection } from './FlowCanvas'
import { getOfflineActivity, getOfflineActivitiesBySession, saveActivity } from '@/lib/offline/db'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export interface ActivityViewInitialData {
  id: string
  titulo: string
  orden?: number
  enunciado: string | null
  resultado_esperado: string | null
  blocks: Block[]
  connections: BlockConnection[]
  courseId: string
  courseName: string
  sessionType: 'clase' | 'repaso'
  sessionName: string
  sessionActivities: { id: string; titulo: string; orden: number }[]
  initialCompletedMap: Record<string, boolean>
}

interface ActivityViewProps {
  activityId: string
  initialActivity: ActivityViewInitialData | null
}

export default function ActivityView({
  activityId,
  initialActivity,
}: ActivityViewProps) {
  const [data, setData] = useState<ActivityViewInitialData | null>(initialActivity)
  const [isLoading, setIsLoading] = useState<boolean>(!initialActivity)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function resolveActivity() {
      // 1. If initialActivity is provided and matches activityId (or activityId is generic), use it immediately!
      if (initialActivity && (initialActivity.id === activityId || !activityId || activityId === 'actividad-shell')) {
        if (isMounted) {
          setData(initialActivity)
          setIsLoading(false)
          setErrorMsg(null)
        }
        return
      }

      // 2. Determine active activity ID safely (avoid picking up previous page's pathname like /curso/[id])
      let targetId = activityId
      if (!targetId || targetId === 'actividad-shell' || targetId === 'offline') {
        if (typeof window !== 'undefined') {
          const segments = window.location.pathname.split('/').filter(Boolean)
          const actIdx = segments.indexOf('actividad')
          if (actIdx !== -1 && segments[actIdx + 1]) {
            targetId = segments[actIdx + 1]
          }
        }
      }

      if (!targetId && initialActivity) {
        targetId = initialActivity.id
      }

      // If initialActivity matches targetId, use it!
      if (initialActivity && initialActivity.id === targetId) {
        if (isMounted) {
          setData(initialActivity)
          setIsLoading(false)
          setErrorMsg(null)
        }
        return
      }

      // 3. Check IndexedDB offline cache
      try {
        const offlineAct = await getOfflineActivity(targetId)
        if (offlineAct && isMounted) {
          const rawBlocks = (offlineAct.blocks as any[]) ?? []
          const sortedBlocks: Block[] = [...rawBlocks].sort(
            (a, b) => (a.orden_correcto ?? 0) - (b.orden_correcto ?? 0)
          )

          // Load sibling activities from the same session in IndexedDB
          const siblings = await getOfflineActivitiesBySession(offlineAct.session_id)

          // Load completed map from localStorage
          let localCompleted: Record<string, boolean> = {}
          try {
            const raw = localStorage.getItem('knoten_completed_activities')
            if (raw) localCompleted = JSON.parse(raw)
          } catch {}

          setData({
            id: offlineAct.id,
            titulo: offlineAct.titulo,
            orden: offlineAct.orden,
            enunciado: offlineAct.enunciado,
            resultado_esperado: offlineAct.resultado_esperado,
            blocks: sortedBlocks,
            connections: (offlineAct.connections as BlockConnection[]) ?? [],
            courseId: offlineAct.curso_id || '',
            courseName: offlineAct.curso_nombre || 'Curso',
            sessionType: offlineAct.session_tipo || 'clase',
            sessionName: offlineAct.session_nombre || 'Sesión',
            sessionActivities: siblings.map((s) => ({
              id: s.id,
              titulo: s.titulo,
              orden: s.orden,
            })),
            initialCompletedMap: localCompleted,
          })
          setIsLoading(false)
          setErrorMsg(null)
          return
        }
      } catch (err) {
        console.warn('Could not read activity from IndexedDB:', err)
      }

      // 4. Fetch directly from Supabase on client if not in IndexedDB (only if online)
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const supabase = createClient()
          const { data: act, error } = await supabase
            .from('activities')
          .select(`
            id,
            titulo,
            enunciado,
            resultado_esperado,
            orden,
            session_id,
            sessions (
              id,
              nombre,
              tipo,
              curso_id,
              courses (
                id,
                nombre
              )
            ),
            blocks (
              id,
              activity_id,
              tipo,
              contenido,
              posicion_x,
              posicion_y,
              indent_level,
              orden_correcto
            ),
            connections (
              id,
              activity_id,
              source_block_id,
              target_block_id,
              source_handle,
              target_handle,
              orden
            )
          `)
          .eq('id', targetId)
          .maybeSingle()

        if (act && !error && isMounted) {
          const rawBlocks = (act.blocks as any[]) ?? []
          const sortedBlocks: Block[] = [...rawBlocks].sort(
            (a, b) => (a.orden_correcto ?? 0) - (b.orden_correcto ?? 0)
          )

          const sessionData = act.sessions as any
          const courseId = sessionData?.curso_id || sessionData?.courses?.id || ''
          const courseName = sessionData?.courses?.nombre || ''
          const sessionType: 'clase' | 'repaso' = sessionData?.tipo || 'clase'
          const sessionName: string = sessionData?.nombre || ''

          // Load siblings
          let sessionActivities: { id: string; titulo: string; orden: number }[] = []
          try {
            const { data: siblings } = await supabase
              .from('activities')
              .select('id, titulo, orden')
              .eq('session_id', act.session_id)
              .order('orden', { ascending: true })
            if (siblings) {
              sessionActivities = siblings
            }
          } catch {}

          // Load progress
          let initialCompletedMap: Record<string, boolean> = {}
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser()
            if (user && sessionActivities.length > 0) {
              const { data: progressRows } = await supabase
                .from('progress')
                .select('activity_id, completado')
                .eq('student_id', user.id)
                .in('activity_id', sessionActivities.map((a) => a.id))

              if (progressRows) {
                for (const p of progressRows) {
                  if (p.completado) initialCompletedMap[p.activity_id] = true
                }
              }
            }
          } catch {}

          const resolvedData: ActivityViewInitialData = {
            id: act.id,
            titulo: act.titulo,
            orden: act.orden,
            enunciado: act.enunciado,
            resultado_esperado: act.resultado_esperado,
            blocks: sortedBlocks,
            connections: (act.connections as BlockConnection[]) ?? [],
            courseId,
            courseName,
            sessionType,
            sessionName,
            sessionActivities,
            initialCompletedMap,
          }

          // Cache for future offline usage
          try {
            await saveActivity({
              id: act.id,
              session_id: act.session_id,
              titulo: act.titulo,
              enunciado: act.enunciado,
              resultado_esperado: act.resultado_esperado,
              orden: act.orden,
              blocks: sortedBlocks,
              connections: (act.connections as any[]) ?? [],
              curso_id: courseId,
              curso_nombre: courseName,
              session_tipo: sessionType,
              session_nombre: sessionName,
            } as any)
          } catch {}

          setData(resolvedData)
          setIsLoading(false)
          setErrorMsg(null)
          return
        }

        if (!act && !error && isMounted) {
          // Explicitly confirmed that activity does not exist
          setIsLoading(false)
          setErrorMsg('La actividad que buscas no existe o fue eliminada.')
          return
        }
        } catch (clientErr) {
          console.warn('Client-side Supabase fetch failed:', clientErr)
        }
      }

      // 5. Fallback if initialActivity was provided but ID differed
      if (initialActivity && isMounted) {
        setData(initialActivity)
        setIsLoading(false)
        setErrorMsg(null)
        return
      }

      // 6. Activity not found anywhere or offline failure
      if (isMounted) {
        setIsLoading(false)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setErrorMsg(
            'Esta actividad no está disponible sin conexión. Conéctate a internet para sincronizarla.'
          )
        } else {
          setErrorMsg('La actividad que buscas no existe o fue eliminada.')
        }
      }
    }

    resolveActivity()

    return () => {
      isMounted = false
    }
  }, [activityId, initialActivity])

  if (isLoading) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-zinc-50 text-zinc-600 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
        <p className="text-sm font-medium">Cargando actividad...</p>
      </div>
    )
  }

  if (errorMsg || !data) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-zinc-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 p-6 shadow-xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4 text-zinc-500">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-2">Actividad no disponible</h2>
          <p className="text-xs sm:text-sm text-zinc-500 mb-6 leading-relaxed">
            {errorMsg || 'No se pudo cargar la actividad solicitada.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition"
            >
              <Home className="w-4 h-4" />
              Ir al inicio
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-700 text-xs font-semibold hover:bg-zinc-100 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <FlowCanvas
      activityId={data.id}
      activityTitle={data.titulo}
      activityOrder={data.orden}
      blocks={data.blocks}
      connections={data.connections}
      enunciado={data.enunciado || ''}
      resultadoEsperado={data.resultado_esperado || ''}
      courseId={data.courseId}
      courseName={data.courseName}
      sessionType={data.sessionType}
      sessionName={data.sessionName}
      sessionActivities={data.sessionActivities}
      initialCompletedMap={data.initialCompletedMap}
    />
  )
}
