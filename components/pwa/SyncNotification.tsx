'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, WifiOff, RefreshCw, X, HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SyncNotification() {
  const [isOnline, setIsOnline] = useState(true)
  const [syncMessage, setSyncMessage] = useState<{
    text: string
    type: 'success' | 'syncing' | 'offline' | 'info'
  } | null>(null)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setSyncMessage({
        text: 'Conexión a internet restaurada.',
        type: 'success',
      })
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncMessage({
        text: 'Modo sin conexión activo — Las sesiones y cursos que hayas descargado siguen disponibles.',
        type: 'offline',
      })
    }

    const handleDownloadUpdated = (e: Event) => {
      const customEvent = e as CustomEvent
      const detail = customEvent.detail
      if (!detail) return

      if (detail.type === 'course-downloaded') {
        setSyncMessage({
          text: `Curso descargado con éxito (${detail.activitiesCount} actividades). Disponible para resolver sin conexión.`,
          type: 'success',
        })
      } else if (detail.type === 'session-downloaded') {
        setSyncMessage({
          text: `Sesión descargada con éxito (${detail.activitiesCount} actividades). Disponible para resolver sin conexión.`,
          type: 'success',
        })
      } else if (detail.type === 'course-deleted') {
        setSyncMessage({
          text: 'Curso eliminado del almacenamiento local. Memoria liberada.',
          type: 'info',
        })
      } else if (detail.type === 'session-deleted') {
        setSyncMessage({
          text: 'Sesión eliminada del almacenamiento local. Memoria liberada.',
          type: 'info',
        })
      } else if (detail.type === 'all-cleared') {
        setSyncMessage({
          text: 'Se ha liberado todo el almacenamiento offline de este dispositivo.',
          type: 'info',
        })
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('knoten:download-updated', handleDownloadUpdated)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('knoten:download-updated', handleDownloadUpdated)
    }
  }, [])

  // Auto-dismiss success/info messages after 5s (offline stays while disconnected)
  useEffect(() => {
    if (syncMessage?.type === 'success' || syncMessage?.type === 'info') {
      const timer = setTimeout(() => {
        setSyncMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [syncMessage])

  if (!syncMessage) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-medium backdrop-blur-md max-w-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3',
        syncMessage.type === 'offline'
          ? 'bg-zinc-900/95 text-white border-zinc-700'
          : syncMessage.type === 'success'
          ? 'bg-white/95 text-zinc-800 border-zinc-200'
          : syncMessage.type === 'info'
          ? 'bg-zinc-900/95 text-zinc-100 border-zinc-700'
          : 'bg-zinc-50/95 text-zinc-700 border-zinc-300'
      )}
    >
      <div className="shrink-0">
        {syncMessage.type === 'offline' ? (
          <WifiOff className="w-4 h-4 text-amber-400" />
        ) : syncMessage.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : syncMessage.type === 'info' ? (
          <HardDrive className="w-4 h-4 text-zinc-400" />
        ) : (
          <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
        )}
      </div>

      <div className="flex-1 leading-snug">{syncMessage.text}</div>

      <button
        type="button"
        onClick={() => setSyncMessage(null)}
        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1 rounded-md transition shrink-0 cursor-pointer"
        title="Cerrar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
