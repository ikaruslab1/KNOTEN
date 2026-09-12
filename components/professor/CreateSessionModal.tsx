'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionType = 'clase' | 'repaso'

type Props = {
  isOpen: boolean
  onClose: () => void
  cursoId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateSessionModal({ isOpen, onClose, cursoId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<SessionType>('clase')
  const [numClase, setNumClase] = useState(3)
  const [numRepaso, setNumRepaso] = useState(2)
  const [fechaLiberacion, setFechaLiberacion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setNombre('')
      setTipo('clase')
      setNumClase(3)
      setNumRepaso(2)
      setFechaLiberacion('')
      setError(null)
    }
  }, [isOpen])

  // Open/close native <dialog>
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  // Close on backdrop click
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nombre.trim()) {
      setError('El nombre de la sesión es obligatorio.')
      return
    }
    if (numClase < 1) {
      setError('La sesión debe tener al menos 1 actividad de clase.')
      return
    }

    setSaving(true)

    try {
      // 1. INSERT the session ──────────────────────────────────────────────────
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          curso_id: cursoId,
          nombre: nombre.trim(),
          tipo,
          fecha_liberacion: fechaLiberacion || null,
        })
        .select('id')
        .single()

      if (sessionError || !newSession) throw sessionError ?? new Error('Error creando sesión.')

      const sessionId = newSession.id

      // 2. Build activity rows ─────────────────────────────────────────────────
      const totalActividades = numClase + numRepaso
      const activityRows = Array.from({ length: totalActividades }, (_, i) => ({
        session_id: sessionId,
        titulo: `Actividad ${i + 1}`,
        orden: i,
      }))

      if (activityRows.length > 0) {
        const { error: activitiesError } = await supabase
          .from('activities')
          .insert(activityRows)

        if (activitiesError) throw activitiesError
      }

      router.refresh()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClick={handleDialogClick}
      className="w-full max-w-lg rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/50 open:animate-in open:fade-in-0 open:zoom-in-95"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Nueva sesión</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="session-nombre" className="text-sm font-medium text-gray-700">
            Nombre de la sesión <span className="text-red-500">*</span>
          </label>
          <input
            id="session-nombre"
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Sesión 1 – Condicionales"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Tipo */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="session-tipo" className="text-sm font-medium text-gray-700">
            Tipo de sesión
          </label>
          <select
            id="session-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as SessionType)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="clase">En clase</option>
            <option value="repaso">Repaso</option>
          </select>
        </div>

        {/* Actividades counts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="session-num-clase" className="text-sm font-medium text-gray-700">
              Actividades de clase <span className="text-red-500">*</span>
            </label>
            <input
              id="session-num-clase"
              type="number"
              min={1}
              required
              value={numClase}
              onChange={(e) => setNumClase(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="session-num-repaso" className="text-sm font-medium text-gray-700">
              Actividades de repaso
            </label>
            <input
              id="session-num-repaso"
              type="number"
              min={0}
              value={numRepaso}
              onChange={(e) => setNumRepaso(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Total preview */}
        <p className="text-xs text-gray-500">
          Se crearán <strong>{numClase + numRepaso}</strong> actividades en total.
        </p>

        {/* Fecha de liberación */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="session-fecha" className="text-sm font-medium text-gray-700">
            Fecha de liberación{' '}
            <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            id="session-fecha"
            type="datetime-local"
            value={fechaLiberacion}
            onChange={(e) => setFechaLiberacion(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className={cn(
              'flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition',
              saving ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700',
            )}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Creando…' : 'Crear sesión'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
