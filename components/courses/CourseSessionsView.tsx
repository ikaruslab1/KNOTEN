'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Calendar, ArrowRight } from 'lucide-react'
import OfflineSessionBadge from '@/components/pwa/OfflineSessionBadge'
import { cn } from '@/lib/utils'

interface Activity {
  id: string
}

export interface SessionItem {
  id: string
  nombre: string
  tipo: 'clase' | 'repaso'
  orden: number
  fecha_liberacion: string | null
  activities: Activity[]
}

interface CourseSessionsViewProps {
  claseSessions: SessionItem[]
  repasoSessions: SessionItem[]
  isProfessor: boolean
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function isInFuture(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) > new Date()
}

export default function CourseSessionsView({
  claseSessions,
  repasoSessions,
  isProfessor,
}: CourseSessionsViewProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const router = useRouter()

  const handleSessionClick = (session: SessionItem, href: string, isLocked: boolean) => {
    if (isLocked) return
    if (isTransitioning) return

    setSelectedSessionId(session.id)
    setIsTransitioning(true)

    // Cinematic transition: selected vanishes, others slide right, screen goes white
    setTimeout(() => {
      router.push(href)
    }, 380)
  }

  const renderSessionCard = (session: SessionItem, index: number) => {
    const locked = isInFuture(session.fecha_liberacion)
    const isLockedForUser = locked && !isProfessor
    const firstActivityId = session.activities?.[0]?.id
    const href = firstActivityId ? `/actividad/${firstActivityId}` : '#'

    const isSelected = selectedSessionId === session.id
    const hasSelection = selectedSessionId !== null
    const isOther = hasSelection && !isSelected

    if (isLockedForUser) {
      return (
        <div
          key={session.id}
          style={{ animationDelay: `${index * 60 + 100}ms` }}
          className={cn(
            'rounded-2xl border border-zinc-200 bg-zinc-100/70 p-5 flex flex-col justify-between min-h-[120px] cursor-not-allowed select-none opacity-80',
            !hasSelection && 'animate-slide-up-fade'
          )}
        >
          <div className="flex items-start justify-between gap-2 text-zinc-400">
            <span className="font-semibold text-base text-zinc-600">{session.nombre}</span>
            <Lock className="w-4 h-4 shrink-0 text-zinc-500 mt-1" />
          </div>
          {session.fecha_liberacion && (
            <p className="text-xs font-medium text-zinc-500 flex items-center gap-1.5 mt-4">
              <Calendar className="w-3.5 h-3.5" />
              Clase disponible el {formatDate(session.fecha_liberacion)}
            </p>
          )}
        </div>
      )
    }

    if (locked && isProfessor) {
      return (
        <div
          key={session.id}
          onClick={() => handleSessionClick(session, href, false)}
          style={{ animationDelay: `${index * 60 + 100}ms` }}
          className={cn(
            'rounded-2xl border border-zinc-300 bg-white overflow-hidden block transition-all shadow-sm cursor-pointer select-none',
            !hasSelection &&
              'animate-slide-up-fade hover:shadow-md hover:border-zinc-500 hover:scale-[1.02]',
            isSelected && 'opacity-0 scale-95 transition-all duration-200 pointer-events-none',
            isOther && 'opacity-0 translate-x-16 transition-all duration-350 ease-in pointer-events-none'
          )}
        >
          <div className="bg-zinc-200 border-b border-zinc-300 px-4 py-2 flex items-center justify-between">
            <p className="text-xs text-zinc-700 font-semibold tracking-tight">
              Contenido oculto para alumnos (fecha futura)
            </p>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-300 text-zinc-800">
              Vista profesor
            </span>
          </div>
          <div className="p-5">
            <span className="font-bold text-zinc-900 text-base">{session.nombre}</span>
            <div className="mt-2">
              <OfflineSessionBadge sessionId={session.id} />
            </div>
            {session.fecha_liberacion && (
              <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Liberación: {formatDate(session.fecha_liberacion)}
              </p>
            )}
          </div>
        </div>
      )
    }

    // Accessible session card
    return (
      <div
        key={session.id}
        onClick={() => handleSessionClick(session, href, false)}
        style={{ animationDelay: `${index * 60 + 100}ms` }}
        className={cn(
          'rounded-2xl border border-zinc-200 bg-white p-5 flex flex-col justify-between min-h-[120px] transition-all cursor-pointer select-none group',
          !hasSelection &&
            'animate-slide-up-fade hover:shadow-lg hover:border-zinc-400 hover:scale-[1.02]',
          isSelected && 'opacity-0 scale-95 transition-all duration-200 pointer-events-none',
          isOther && 'opacity-0 translate-x-20 transition-all duration-350 ease-in pointer-events-none'
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="font-bold text-zinc-900 text-base group-hover:text-zinc-700 transition-colors block">
              {session.nombre}
            </span>
            <div className="mt-2">
              <OfflineSessionBadge sessionId={session.id} />
            </div>
          </div>
          <span className="text-zinc-400 group-hover:text-zinc-900 group-hover:translate-x-1 transition-all text-sm font-bold">
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>
        {session.fecha_liberacion && (
          <p className="text-xs text-zinc-500 mt-4 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            {formatDate(session.fecha_liberacion)}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      {/* White transition overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-white pointer-events-none z-50 transition-opacity duration-400',
          isTransitioning ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden
      />

      <div className="space-y-8 sm:space-y-12">
        {/* Actividades en clase */}
        <section>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200 animate-slide-up-fade">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Actividades en clase</h2>
              <p className="text-xs text-zinc-500">Sesiones prácticas programadas para el aula</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-200 text-zinc-800">
              {claseSessions.length} {claseSessions.length === 1 ? 'sesión' : 'sesiones'}
            </span>
          </div>

          {claseSessions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-zinc-300 bg-white text-center text-sm text-zinc-500 animate-slide-up-fade">
              No hay actividades en clase programadas para este curso todavía.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {claseSessions.map((s, idx) => renderSessionCard(s, idx))}
            </div>
          )}
        </section>

        {/* Actividades de repaso */}
        <section>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200 animate-slide-up-fade [animation-delay:150ms]">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Actividades de repaso</h2>
              <p className="text-xs text-zinc-500">Práctica autónoma y refuerzo de conceptos</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-200 text-zinc-800">
              {repasoSessions.length} {repasoSessions.length === 1 ? 'sesión' : 'sesiones'}
            </span>
          </div>

          {repasoSessions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-zinc-300 bg-white text-center text-sm text-zinc-500 animate-slide-up-fade [animation-delay:200ms]">
              No hay actividades de repaso registradas en este curso.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {repasoSessions.map((s, idx) =>
                renderSessionCard(s, idx + claseSessions.length)
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
