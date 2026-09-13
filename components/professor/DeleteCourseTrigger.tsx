'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal'
import { cn } from '@/lib/utils'

type Props = {
  courseId: string
  courseName: string
  variant?: 'card' | 'header' | 'button'
  redirectTo?: string
  className?: string
}

export default function DeleteCourseTrigger({
  courseId,
  courseName,
  variant = 'card',
  redirectTo = '/profesor',
  className,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)

    try {
      // 1. Delete course (PostgreSQL ON DELETE CASCADE handles sessions, activities, blocks, connections, enrollments, and progress)
      const { error: deleteErr } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId)

      if (deleteErr) throw deleteErr

      setOpen(false)
      if (redirectTo) {
        router.push(redirectTo)
        router.refresh()
      } else {
        router.refresh()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el curso.'
      setError(msg)
      console.error('Error deleting course:', err)
      alert(`No se pudo eliminar el curso: ${msg}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {variant === 'card' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex items-center justify-center p-2 rounded-lg border border-zinc-200 text-zinc-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition cursor-pointer',
            className
          )}
          title={`Eliminar ${courseName}`}
          aria-label={`Eliminar curso ${courseName}`}
        >
          <Trash2 className="h-4 w-4" />
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
          title={`Eliminar curso ${courseName}`}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-600" />
          <span>Eliminar curso</span>
        </button>
      )}

      {variant === 'button' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition cursor-pointer',
            className
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Eliminar curso</span>
        </button>
      )}

      <ConfirmDeleteModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar curso completo"
        itemName={courseName}
        itemType="curso"
        cascadeWarning="Esta acción es irreversible y eliminará en cascada todas las sesiones, actividades, bloques de código y el progreso de los alumnos inscritos en este curso."
        isDeleting={isDeleting}
      />
    </>
  )
}
