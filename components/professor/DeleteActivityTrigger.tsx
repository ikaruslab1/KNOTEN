'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal'
import { cn } from '@/lib/utils'

type Props = {
  activityId: string
  activityTitle: string
  redirectTo?: string
  variant?: 'icon' | 'chip' | 'header'
  className?: string
  onSuccess?: () => void
}

export default function DeleteActivityTrigger({
  activityId,
  activityTitle,
  redirectTo,
  variant = 'icon',
  className,
  onSuccess,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)

    try {
      // Delete activity (cascades to blocks, connections, progress)
      const { error: deleteErr } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId)

      if (deleteErr) throw deleteErr

      setOpen(false)
      onSuccess?.()
      if (redirectTo) {
        router.push(redirectTo)
        router.refresh()
      } else {
        router.refresh()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la actividad.'
      console.error('Error deleting activity:', err)
      alert(`No se pudo eliminar la actividad: ${msg}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {variant === 'icon' && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}
          className={cn(
            'flex items-center justify-center p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer',
            className
          )}
          title={`Eliminar ${activityTitle}`}
          aria-label={`Eliminar actividad ${activityTitle}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      {variant === 'chip' && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}
          className={cn(
            'flex items-center justify-center w-4 h-4 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-100 transition cursor-pointer ml-1 shrink-0',
            className
          )}
          title={`Eliminar ${activityTitle}`}
          aria-label={`Eliminar actividad ${activityTitle}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {variant === 'header' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-red-200 bg-red-50/60 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100/80 transition cursor-pointer shadow-xs',
            className
          )}
          title={`Eliminar actividad ${activityTitle}`}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-600" />
          <span>Eliminar actividad</span>
        </button>
      )}

      <ConfirmDeleteModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar actividad"
        itemName={activityTitle}
        itemType="actividad"
        cascadeWarning="Esta acción es permanente y eliminará todos los bloques de código, conexiones y las respuestas guardadas de los estudiantes en esta actividad."
        isDeleting={isDeleting}
      />
    </>
  )
}
