'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  CloudDownload,
  Trash2,
  CheckCircle2,
  Loader2,
  HardDrive,
  X,
  AlertTriangle,
} from 'lucide-react'
import {
  getCourseOfflineStatus,
  deleteOfflineCourse,
  getOfflineDatabaseStats,
  clearAllOfflineStorage,
} from '@/lib/offline/db'
import { downloadCourseOffline } from '@/lib/offline/sync'
import { cn } from '@/lib/utils'

interface CourseOfflineControlsProps {
  cursoId: string
  className?: string
}

export default function CourseOfflineControls({
  cursoId,
  className,
}: CourseOfflineControlsProps) {
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [sessionsCount, setSessionsCount] = useState(0)
  const [activitiesCount, setActivitiesCount] = useState(0)
  const [isBusy, setIsBusy] = useState<'downloading' | 'deleting' | 'clearing' | null>(null)
  const [showStorageModal, setShowStorageModal] = useState(false)
  const [storageStats, setStorageStats] = useState<{
    coursesCount: number
    sessionsCount: number
    activitiesCount: number
  } | null>(null)
  const [mounted, setMounted] = useState(false)

  const checkStatus = async () => {
    try {
      const status = await getCourseOfflineStatus(cursoId)
      setIsDownloaded(status.isDownloaded)
      setSessionsCount(status.sessionsCount)
      setActivitiesCount(status.activitiesCount)

      const stats = await getOfflineDatabaseStats()
      setStorageStats(stats)
    } catch {
      setIsDownloaded(false)
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
  }, [cursoId])

  const handleDownloadCourse = async () => {
    if (isBusy) return
    setIsBusy('downloading')

    try {
      const res = await downloadCourseOffline(cursoId)
      if (res.success) {
        setIsDownloaded(true)
        setActivitiesCount(res.activitiesCount)
        setSessionsCount(res.sessionsCount)
      } else {
        alert(res.error || 'Error al descargar el curso para uso sin conexión')
      }
    } catch (err: any) {
      alert(err.message || 'Error al descargar curso')
    } finally {
      setIsBusy(null)
      checkStatus()
    }
  }

  const handleDeleteCourse = async () => {
    if (isBusy) return
    const confirmed = window.confirm(
      '¿Deseas eliminar este curso del almacenamiento sin conexión para liberar espacio en tu dispositivo?'
    )
    if (!confirmed) return

    setIsBusy('deleting')
    try {
      await deleteOfflineCourse(cursoId)
      setIsDownloaded(false)
      setActivitiesCount(0)
      setSessionsCount(0)
    } catch (err: any) {
      alert(err.message || 'Error al eliminar contenido del curso')
    } finally {
      setIsBusy(null)
      checkStatus()
    }
  }

  const handleClearAllStorage = async () => {
    if (isBusy) return
    const confirmed = window.confirm(
      '¿Estás seguro de que deseas borrar TODO el almacenamiento offline (todos los cursos, sesiones y actividades descargadas)? Esta acción liberará la memoria local de tu dispositivo.'
    )
    if (!confirmed) return

    setIsBusy('clearing')
    try {
      await clearAllOfflineStorage()
      setIsDownloaded(false)
      setActivitiesCount(0)
      setSessionsCount(0)
      setShowStorageModal(false)
    } catch (err: any) {
      alert(err.message || 'Error al limpiar almacenamiento offline')
    } finally {
      setIsBusy(null)
      checkStatus()
    }
  }

  if (!mounted) {
    return (
      <div className={cn('h-9 flex items-center', className)}>
        <span className="text-xs text-zinc-400">...</span>
      </div>
    )
  }

  return (
    <>
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        {isDownloaded ? (
          <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md border border-zinc-700/80 rounded-xl px-3 py-1.5 shadow-sm">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400"
              title="El curso y sus actividades están disponibles para estudiar sin conexión"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
              <span className="text-zinc-100">
                Curso descargado{activitiesCount > 0 ? ` (${activitiesCount} act.)` : ''}
              </span>
            </span>

            <div className="h-3 w-[1px] bg-zinc-700 mx-0.5" />

            <button
              type="button"
              onClick={handleDeleteCourse}
              disabled={isBusy !== null}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-red-400 transition-colors p-1 rounded-md cursor-pointer"
              title="Liberar espacio de este curso"
            >
              {isBusy === 'deleting' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Liberar</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleDownloadCourse}
            disabled={isBusy !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="Descargar todas las actividades del curso para usarlas sin internet"
          >
            {isBusy === 'downloading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-700" />
                <span>Descargando curso...</span>
              </>
            ) : (
              <>
                <CloudDownload className="w-4 h-4 text-zinc-900" />
                <span>Descargar curso offline</span>
              </>
            )}
          </button>
        )}

        {/* Storage Management Button */}
        <button
          type="button"
          onClick={() => {
            checkStatus()
            setShowStorageModal(true)
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-medium backdrop-blur-sm transition-colors cursor-pointer"
          title="Gestionar almacenamiento local de PyNodes"
        >
          <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden sm:inline">Memoria</span>
        </button>
      </div>

      {/* Storage Management Modal */}
      {showStorageModal && mounted && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
              className="bg-white text-zinc-900 border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-zinc-100 text-zinc-700">
                    <HardDrive className="w-5 h-5 text-zinc-700" />
                  </div>
                  <h3 className="font-bold text-base text-zinc-900">Almacenamiento Local Offline</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStorageModal(false)}
                  className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 transition cursor-pointer"
                  aria-label="Cerrar modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                PyNodes te permite descargar únicamente los cursos y sesiones que necesitas para
                resolver actividades en modo sin conexión sin llenar la memoria de tu dispositivo.
              </p>

              {/* Current Storage Stats */}
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200/80 space-y-2.5 text-xs">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Datos guardados en este dispositivo
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-zinc-200 shadow-xs">
                    <div className="text-lg font-bold text-zinc-900">
                      {storageStats?.coursesCount ?? 0}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium">Cursos</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-zinc-200 shadow-xs">
                    <div className="text-lg font-bold text-zinc-900">
                      {storageStats?.sessionsCount ?? 0}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium">Sesiones</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-zinc-200 shadow-xs">
                    <div className="text-lg font-bold text-zinc-900">
                      {storageStats?.activitiesCount ?? 0}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-medium">Actividades</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleClearAllStorage}
                  disabled={isBusy !== null || (storageStats?.activitiesCount ?? 0) === 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isBusy === 'clearing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                      <span>Borrando almacenamiento...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 text-red-600" />
                      <span>Borrar todos los datos offline del dispositivo</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowStorageModal(false)}
                  className="w-full px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
