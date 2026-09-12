'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import CreateCourseModal, { Course } from '@/components/professor/CreateCourseModal'

export default function EditCourseModalTrigger({ course }: { course: Course }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 cursor-pointer"
        aria-label={`Editar ${course.nombre}`}
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </button>

      <CreateCourseModal
        isOpen={open}
        onClose={() => setOpen(false)}
        course={course}
      />
    </>
  )
}
