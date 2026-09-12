'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Course = {
  id: string
  nombre: string
  imagen_url: string | null
  profesor_id: string
  created_at: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
  course?: Course | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateCourseModal({ isOpen, onClose, course }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [nombre, setNombre] = useState('')
  const [imagenUrl, setImagenUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync form when the prop changes (editing vs. creating)
  useEffect(() => {
    if (isOpen) {
      setNombre(course?.nombre ?? '')
      setImagenUrl(course?.imagen_url ?? '')
      setError(null)
    }
  }, [isOpen, course])

  // Open/close the native <dialog>
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
      setError('El nombre del curso es obligatorio.')
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('No autenticado.')

      const payload = {
        nombre: nombre.trim(),
        imagen_url: imagenUrl.trim() || null,
      }

      if (course) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('courses')
          .update(payload)
          .eq('id', course.id)

        if (updateError) throw updateError
      } else {
        // INSERT
        const { error: insertError } = await supabase.from('courses').insert({
          ...payload,
          profesor_id: user.id,
        })

        if (insertError) throw insertError
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

  const previewUrl = isValidUrl(imagenUrl) ? imagenUrl : null
  const isEditing = Boolean(course)

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClick={handleDialogClick}
      className="w-full max-w-lg rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/50 open:animate-in open:fade-in-0 open:zoom-in-95"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEditing ? 'Editar curso' : 'Crear nuevo curso'}
        </h2>
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
          <label
            htmlFor="course-nombre"
            className="text-sm font-medium text-gray-700"
          >
            Nombre del curso <span className="text-red-500">*</span>
          </label>
          <input
            id="course-nombre"
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Introducción a Python"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Imagen URL */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="course-imagen"
            className="text-sm font-medium text-gray-700"
          >
            URL de imagen{' '}
            <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            id="course-imagen"
            type="url"
            value={imagenUrl}
            onChange={(e) => setImagenUrl(e.target.value)}
            placeholder="https://example.com/imagen.png"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {/* Image preview */}
          {previewUrl && (
            <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Vista previa"
                className="h-40 w-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
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
            {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear curso'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
