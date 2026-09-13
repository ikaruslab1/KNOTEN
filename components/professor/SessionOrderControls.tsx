'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type SessionSimple = {
  id: string
  orden: number
}

type Props = {
  cursoId: string
  tipo: 'clase' | 'repaso'
  currentSessionId: string
  currentIndex: number
  totalSessions: number
  allSessionsOfType: SessionSimple[]
}

export default function SessionOrderControls({
  cursoId,
  tipo,
  currentSessionId,
  currentIndex,
  totalSessions,
  allSessionsOfType,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const isFirst = currentIndex === 0
  const isLast = currentIndex === totalSessions - 1

  async function handleMove(direction: 'up' | 'down') {
    if (isUpdating) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= allSessionsOfType.length) return

    setIsUpdating(true)

    try {
      // Create a shallow copy and swap the items
      const reordered = [...allSessionsOfType]
      const [movedItem] = reordered.splice(currentIndex, 1)
      reordered.splice(targetIndex, 0, movedItem)

      // Re-index all items 1..N
      const updatePromises = reordered.map((session, idx) => {
        const newOrden = idx + 1
        // Only update if the order actually changed
        if (session.orden !== newOrden) {
          return supabase
            .from('sessions')
            .update({ orden: newOrden })
            .eq('id', session.id)
        }
        return Promise.resolve({ error: null })
      })

      const results = await Promise.all(updatePromises)
      const hasError = results.some((r) => r.error)
      if (hasError) {
        throw new Error('Error al actualizar el orden de las sesiones.')
      }

      router.refresh()
    } catch (err) {
      console.error('Error reordering sessions:', err)
      alert(err instanceof Error ? err.message : 'Error al reordenar.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50/80 p-0.5 shadow-2xs">
      <button
        type="button"
        onClick={() => handleMove('up')}
        disabled={isFirst || isUpdating}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-all cursor-pointer',
          isFirst || isUpdating
            ? 'opacity-30 cursor-not-allowed text-zinc-300'
            : 'hover:bg-white hover:text-zinc-900 hover:shadow-2xs active:scale-95'
        )}
        title={isFirst ? 'Ya está en la primera posición' : 'Subir posición'}
        aria-label="Subir posición"
      >
        {isUpdating ? (
          <Loader2 className="h-3 w-3 animate-spin text-zinc-600" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
      </button>

      <div className="h-3 w-px bg-zinc-200" />

      <button
        type="button"
        onClick={() => handleMove('down')}
        disabled={isLast || isUpdating}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-all cursor-pointer',
          isLast || isUpdating
            ? 'opacity-30 cursor-not-allowed text-zinc-300'
            : 'hover:bg-white hover:text-zinc-900 hover:shadow-2xs active:scale-95'
        )}
        title={isLast ? 'Ya está en la última posición' : 'Bajar posición'}
        aria-label="Bajar posición"
      >
        {isUpdating ? (
          <Loader2 className="h-3 w-3 animate-spin text-zinc-600" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
