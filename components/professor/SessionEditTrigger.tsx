'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import CreateSessionModal, { SessionToEdit, SessionType } from '@/components/professor/CreateSessionModal'

type Props = {
  cursoId: string
  session: {
    id: string
    nombre: string
    tipo: SessionType
    fecha_liberacion: string | null
    orden?: number
    activitiesCount: number
  }
  totalSessionsOfType?: number
}

export default function SessionEditTrigger({ cursoId, session, totalSessionsOfType }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition cursor-pointer shadow-xs"
        title="Editar información, posición y actividades de la sesión"
      >
        <Pencil className="w-3.5 h-3.5 text-zinc-500" />
        <span>Editar sesión</span>
      </button>

      <CreateSessionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        cursoId={cursoId}
        tipo={session.tipo}
        sessionToEdit={session}
        totalSessionsOfType={totalSessionsOfType}
      />
    </>
  )
}
