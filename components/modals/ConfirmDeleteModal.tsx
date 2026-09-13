'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title: string
  itemName: string
  itemType: 'curso' | 'sesión' | 'actividad'
  cascadeWarning?: string
  isDeleting?: boolean
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemType,
  cascadeWarning,
  isDeleting = false,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (isDeleting) return
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      onCancel={(e) => {
        e.preventDefault()
        if (!isDeleting) onClose()
      }}
      className="m-auto rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs max-w-md w-full animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">{title}</h3>
              <p className="text-xs text-zinc-500 capitalize">Eliminar {itemType}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-50 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-600 leading-relaxed">
            ¿Estás seguro de que deseas eliminar permanentemente{' '}
            <strong className="font-semibold text-zinc-900 break-words">"{itemName}"</strong>?
          </p>

          {cascadeWarning && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{cascadeWarning}</span>
            </div>
          )}

          <p className="text-xs text-zinc-400 italic">
            Esta acción no se puede deshacer.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 active:bg-red-800 cursor-pointer',
              isDeleting && 'opacity-70 cursor-not-allowed'
            )}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Eliminando…</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Eliminar {itemType}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </dialog>
  )
}
