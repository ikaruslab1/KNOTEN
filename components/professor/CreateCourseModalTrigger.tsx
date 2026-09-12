'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import CreateCourseModal from '@/components/professor/CreateCourseModal'

/**
 * Thin client island that owns the modal open/close state.
 * Rendered by the professor dashboard Server Component.
 */
export default function CreateCourseModalTrigger() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Create card */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-6 text-gray-400 transition hover:border-blue-400 hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-current">
          <Plus className="h-6 w-6" />
        </span>
        <span className="text-sm font-medium">Crear curso</span>
      </button>

      <CreateCourseModal
        isOpen={open}
        onClose={() => setOpen(false)}
        course={null}
      />
    </>
  )
}
