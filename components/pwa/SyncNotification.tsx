'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, WifiOff, CloudDownload, X, RefreshCw } from 'lucide-react'
import { syncOfflineContent, SyncResult } from '@/lib/offline/sync'
import { cn } from '@/lib/utils'

export default function SyncNotification() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{
    text: string
    type: 'success' | 'syncing' | 'offline'
  } | null>(null)

  // Listen to network status
  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setSyncMessage({
        text: 'Conexión restaurada. Sincronizando contenido...',
        type: 'syncing',
      })
      triggerSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncMessage({
        text: 'Modo sin conexión activo — Las sesiones y actividades descargadas siguen disponibles.',
        type: 'offline',
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial sync on mount
    triggerSync()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const triggerSync = async () => {
    if (!navigator.onLine) return

    setIsSyncing(true)
    try {
      const result: SyncResult = await syncOfflineContent()
      if (result.success && !result.offline) {
        if (result.newActivitiesCount > 0 || result.updatedActivitiesCount > 0) {
          setSyncMessage({
            text: `Contenido descargado correctamente: ${result.newActivitiesCount} actividades nuevas y ${result.updatedActivitiesCount} actualizadas. Listo para usar sin conexión.`,
            type: 'success',
          })
        } else if (result.totalActivitiesCount > 0) {
          setSyncMessage({
            text: `Contenido sincronizado correctamente: ${result.totalSessionsCount} sesiones y ${result.totalActivitiesCount} actividades listas para uso offline.`,
            type: 'success',
          })
        }
      }
    } catch {
      // Sincronización silenciosa en background
    } finally {
      setIsSyncing(false)
    }
  }

  // Auto-dismiss success messages after 6s (offline stays while disconnected)
  useEffect(() => {
    if (syncMessage?.type === 'success') {
      const timer = setTimeout(() => {
        setSyncMessage(null)
      }, 6000)
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
          : 'bg-zinc-50/95 text-zinc-700 border-zinc-300'
      )}
    >
      <div className="shrink-0">
        {syncMessage.type === 'offline' ? (
          <WifiOff className="w-4 h-4 text-amber-400" />
        ) : syncMessage.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
        )}
      </div>

      <div className="flex-1 leading-snug">{syncMessage.text}</div>

      <button
        type="button"
        onClick={() => setSyncMessage(null)}
        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1 rounded-md transition shrink-0"
        title="Cerrar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
