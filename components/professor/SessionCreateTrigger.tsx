'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import CreateSessionModal from '@/components/professor/CreateSessionModal'

type Props = {
  cursoId: string
  /** Pre-select the tipo in the modal */
  tipo?: 'clase' | 'repaso'
  totalSessionsOfType?: number
}

/**
 * Thin client island rendered inside the (server) course page.
 * Owns the modal open/close state.
 */
export default function SessionCreateTrigger({
  cursoId,
  tipo = 'clase',
  totalSessionsOfType = 0,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-white py-4 text-zinc-400 transition hover:border-zinc-800 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 cursor-pointer"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-current">
          <Plus className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium">Nueva sesión</span>
      </button>

      <CreateSessionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        cursoId={cursoId}
        tipo={tipo}
        totalSessionsOfType={totalSessionsOfType}
      />
    </>
  )
}
