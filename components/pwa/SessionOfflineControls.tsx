'use client'

import { useState, useEffect, MouseEvent } from 'react'
import { Download, Trash2, Check, Loader2 } from 'lucide-react'
import { getSessionOfflineStatus, deleteOfflineSession } from '@/lib/offline/db'
import { downloadSessionOffline } from '@/lib/offline/sync'
import { cn } from '@/lib/utils'

interface SessionOfflineControlsProps {
  sessionId: string
  className?: string
}

export default function SessionOfflineControls({
  sessionId,
  className,
}: SessionOfflineControlsProps) {
  const [isCached, setIsCached] = useState(false)
  const [activitiesCount, setActivitiesCount] = useState(0)
  const [isBusy, setIsBusy] = useState<'downloading' | 'deleting' | null>(null)
  const [mounted, setMounted] = useState(false)

  const checkStatus = async () => {
    try {
      const status = await getSessionOfflineStatus(sessionId)
      setIsCached(status.isDownloaded)
      setActivitiesCount(status.activitiesCount)
    } catch {
      setIsCached(false)
      setActivitiesCount(0)
    }
  }

  useEffect(() => {
    setMounted(true)
    checkStatus()

    const handleUpdate = () => {
      checkStatus()
    }

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkStatus()
      }
    }

    window.addEventListener('knoten:download-updated', handleUpdate)
    window.addEventListener('knoten:sync-complete', handleUpdate)
    window.addEventListener('focus', handleUpdate)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('knoten:download-updated', handleUpdate)
      window.removeEventListener('knoten:sync-complete', handleUpdate)
      window.removeEventListener('focus', handleUpdate)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [sessionId])

  const handleDownload = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isBusy) return

    setIsBusy('downloading')
    try {
      const res = await downloadSessionOffline(sessionId)
      if (res.success) {
        setIsCached(true)
        setActivitiesCount(res.activitiesCount)
      } else {
        alert(res.error || 'Error al descargar la sesión para offline')
      }
    } catch (err: any) {
      alert(err.message || 'Error al descargar sesión')
    } finally {
      setIsBusy(null)
      checkStatus()
    }
  }

  const handleDelete = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isBusy) return

    const confirmed = window.confirm(
      '¿Deseas eliminar esta sesión del almacenamiento sin conexión para liberar espacio?'
    )
    if (!confirmed) return

    setIsBusy('deleting')
    try {
      await deleteOfflineSession(sessionId)
      setIsCached(false)
      setActivitiesCount(0)
    } catch (err: any) {
      alert(err.message || 'Error al eliminar sesión')
    } finally {
      setIsBusy(null)
      checkStatus()
    }
  }

  if (!mounted) {
    return (
      <div className={cn('h-6 flex items-center', className)}>
        <span className="text-[11px] text-zinc-400">...</span>
      </div>
    )
  }

  return (
    <div
      className={cn('inline-flex items-center gap-1.5 flex-wrap', className)}
      onClick={(e) => {
        // Prevent card link navigation
        e.stopPropagation()
      }}
    >
      {isCached ? (
        <div className="inline-flex items-center gap-1">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-[11px] font-medium text-zinc-700 select-none"
            title="Sesión descargada y disponible para resolver sin conexión"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
            <span>Offline listo{activitiesCount > 0 ? ` (${activitiesCount})` : ''}</span>
          </span>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isBusy !== null}
            className="p-1 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors cursor-pointer"
            title="Eliminar de la memoria local"
            aria-label="Eliminar sesión del almacenamiento local"
          >
            {isBusy === 'deleting' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isBusy !== null}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-700 border border-zinc-200 text-[11px] font-medium transition-colors cursor-pointer select-none"
          title="Descargar esta sesión para usar sin internet"
        >
          {isBusy === 'downloading' ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-zinc-600" />
              <span>Descargando...</span>
            </>
          ) : (
            <>
              <Download className="w-3 h-3 text-zinc-600" />
              <span>Descargar sesión</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
