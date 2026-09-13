'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DeleteSessionTrigger from '@/components/professor/DeleteSessionTrigger'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionType = 'clase' | 'repaso'

export type SessionToEdit = {
  id: string
  nombre: string
  tipo: SessionType
  fecha_liberacion: string | null
  activitiesCount: number
}

type Props = {
  isOpen: boolean
  onClose: () => void
  cursoId: string
  tipo: SessionType
  sessionToEdit?: SessionToEdit | null
}

function formatIsoForDateTimeInput(iso?: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => n.toString().padStart(2, '0')
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const min = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`
  } catch {
    return ''
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateSessionModal({
  isOpen,
  onClose,
  cursoId,
  tipo,
  sessionToEdit,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const isEditing = !!sessionToEdit

  const [nombre, setNombre] = useState('')
  const [numActividades, setNumActividades] = useState(3)
  const [fechaLiberacion, setFechaLiberacion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync / reset form values when opening
  useEffect(() => {
    if (isOpen) {
      if (sessionToEdit) {
        setNombre(sessionToEdit.nombre)
        setNumActividades(Math.max(1, sessionToEdit.activitiesCount))
        setFechaLiberacion(formatIsoForDateTimeInput(sessionToEdit.fecha_liberacion))
      } else {
        setNombre('')
        setNumActividades(3)
        setFechaLiberacion('')
      }
      setError(null)
    }
  }, [isOpen, sessionToEdit])

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
    if (numActividades < 1) {
      setError('La sesión debe tener al menos 1 actividad.')
      return
    }

    setSaving(true)

    try {
      if (isEditing && sessionToEdit) {
        // ── EDIT EXISTING SESSION ─────────────────────────────────────────────
        const sessionId = sessionToEdit.id

        // 1. Update session info
        const { error: updateSessionErr } = await supabase
          .from('sessions')
          .update({
            nombre: nombre.trim(),
            fecha_liberacion: tipo === 'clase' ? (fechaLiberacion ? new Date(fechaLiberacion).toISOString() : null) : null,
          })
          .eq('id', sessionId)

        if (updateSessionErr) throw updateSessionErr

        // 2. Adjust activities count
        const currentCount = sessionToEdit.activitiesCount
        const targetCount = numActividades

        if (targetCount > currentCount) {
          // Add extra activities
          const toAdd = targetCount - currentCount
          const newRows = Array.from({ length: toAdd }, (_, i) => ({
            session_id: sessionId,
            titulo: `Actividad ${currentCount + i + 1}`,
            orden: currentCount + i,
          }))

          const { error: insertErr } = await supabase.from('activities').insert(newRows)
          if (insertErr) throw insertErr
        } else if (targetCount < currentCount) {
          // Delete excess activities with orden >= targetCount
          const { error: deleteErr } = await supabase
            .from('activities')
            .delete()
            .eq('session_id', sessionId)
            .gte('orden', targetCount)

          if (deleteErr) throw deleteErr
        }
      } else {
        // ── CREATE NEW SESSION ────────────────────────────────────────────────
        const { data: newSession, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            curso_id: cursoId,
            nombre: nombre.trim(),
            tipo,
            fecha_liberacion: tipo === 'clase' ? (fechaLiberacion ? new Date(fechaLiberacion).toISOString() : null) : null,
          })
          .select('id')
          .single()

        if (sessionError || !newSession) throw sessionError ?? new Error('Error creando sesión.')

        const sessionId = newSession.id

        // Create initial activities
        const activityRows = Array.from({ length: numActividades }, (_, i) => ({
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
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
        <h2 className="text-lg font-bold text-zinc-900">
          {isEditing
            ? 'Editar sesión'
            : tipo === 'clase'
            ? 'Nueva sesión en clase'
            : 'Nueva sesión de repaso'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="session-nombre" className="text-sm font-medium text-zinc-700">
            Nombre de la sesión <span className="text-red-500">*</span>
          </label>
          <input
            id="session-nombre"
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={tipo === 'clase' ? 'Ej. Sesión 1 – Condicionales' : 'Ej. Repaso 1 – Variables'}
            className="rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15"
          />
        </div>

        {/* Número de actividades */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="session-num-actividades" className="text-sm font-medium text-zinc-700">
            Número de actividades <span className="text-red-500">*</span>
          </label>
          <input
            id="session-num-actividades"
            type="number"
            min={1}
            max={30}
            required
            value={numActividades}
            onChange={(e) => setNumActividades(Math.max(1, Number(e.target.value)))}
            className="rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15"
          />
          <p className="text-xs text-zinc-500">
            {isEditing
              ? `Actividades configuradas: ${numActividades} (se ${numActividades >= (sessionToEdit?.activitiesCount ?? 0) ? 'agregarán' : 'eliminarán'} actividades automáticamente si modificas este valor).`
              : `Se crearán ${numActividades} actividades para esta sesión.`}
          </p>
        </div>

        {/* Fecha de liberación (solo para sesiones de clase) */}
        {tipo === 'clase' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="session-fecha" className="text-sm font-medium text-zinc-700">
              Fecha de liberación{' '}
              <span className="font-normal text-zinc-400">(opcional para programar)</span>
            </label>
            <input
              id="session-fecha"
              type="datetime-local"
              value={fechaLiberacion}
              onChange={(e) => setFechaLiberacion(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15"
            />
            <p className="text-xs text-zinc-400">
              Si se establece en una fecha futura, el contenido estará bloqueado para los alumnos hasta ese momento.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2 text-sm text-red-600 border border-red-200">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            {isEditing && sessionToEdit && (
              <DeleteSessionTrigger
                sessionId={sessionToEdit.id}
                sessionName={sessionToEdit.nombre}
                activitiesCount={sessionToEdit.activitiesCount}
                variant="button"
                onSuccess={onClose}
              />
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                'flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition shadow-sm cursor-pointer',
                saving ? 'opacity-70 cursor-not-allowed' : 'hover:bg-zinc-800',
              )}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving
                ? isEditing
                  ? 'Guardando…'
                  : 'Creando…'
                : isEditing
                ? 'Guardar cambios'
                : 'Crear sesión'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
