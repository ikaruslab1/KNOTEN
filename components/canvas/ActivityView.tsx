'use client'

import { useEffect, useState } from 'react'
import FlowCanvas, { Block, BlockConnection } from './FlowCanvas'
import { getOfflineActivity, getOfflineActivitiesBySession } from '@/lib/offline/db'
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
      // 1. Determine active activity ID from URL path or prop
      let targetId = activityId
      if (typeof window !== 'undefined') {
        const segments = window.location.pathname.split('/').filter(Boolean)
        const lastSegment = segments[segments.length - 1]
        if (
          lastSegment &&
          lastSegment !== 'actividad' &&
          lastSegment !== 'offline' &&
          lastSegment !== 'actividad-shell'
        ) {
          targetId = lastSegment
        }
      }

      // 2. If initialActivity matches targetId, use it immediately
      if (initialActivity && initialActivity.id === targetId) {
        if (isMounted) {
          setData(initialActivity)
          setIsLoading(false)
          setErrorMsg(null)
        }
        return
      }

      // 3. Otherwise (e.g. offline navigation, generic activity shell, or server returned null): load from IndexedDB!
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

      // 4. Fallback if initialActivity was provided but ID differed
      if (initialActivity && isMounted) {
        setData(initialActivity)
        setIsLoading(false)
        setErrorMsg(null)
        return
      }

      // 5. Activity not found in IndexedDB or online
      if (isMounted) {
        setIsLoading(false)
        setErrorMsg(
          'Esta actividad no está disponible sin conexión. Conéctate a internet para sincronizarla.'
        )
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
