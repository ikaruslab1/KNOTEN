'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal'
import { cn } from '@/lib/utils'

type Props = {
  sessionId: string
  sessionName: string
  activitiesCount?: number
  variant?: 'icon' | 'button'
  className?: string
  onSuccess?: () => void
}

export default function DeleteSessionTrigger({
  sessionId,
  sessionName,
  activitiesCount = 0,
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
      // Delete session (cascades to activities, blocks, connections, progress)
      const { error: deleteErr } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)

      if (deleteErr) throw deleteErr

      setOpen(false)
      onSuccess?.()
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la sesión.'
      console.error('Error deleting session:', err)
      alert(`No se pudo eliminar la sesión: ${msg}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const cascadeWarning =
    activitiesCount > 0
      ? `Esta sesión contiene ${activitiesCount} actividad${
          activitiesCount > 1 ? 'es' : ''
        }. Al eliminarla, se eliminarán en cascada todas sus actividades y bloques de código asociados.`
      : 'Esta acción eliminará permanentemente la sesión.'

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex items-center justify-center p-2 rounded-lg border border-zinc-200 text-zinc-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition cursor-pointer shadow-xs',
            className
          )}
          title={`Eliminar sesión ${sessionName}`}
          aria-label={`Eliminar sesión ${sessionName}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition cursor-pointer',
            className
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Eliminar sesión</span>
        </button>
      )}

      <ConfirmDeleteModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar sesión"
        itemName={sessionName}
        itemType="sesión"
        cascadeWarning={cascadeWarning}
        isDeleting={isDeleting}
      />
    </>
  )
}
