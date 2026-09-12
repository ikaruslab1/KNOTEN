'use client'
import { X, BookOpen } from 'lucide-react'

type ProblemModalProps = {
  isOpen: boolean
  onClose: () => void
  enunciado: string
  resultadoEsperado: string
}

export default function ProblemModal({
  isOpen,
  onClose,
  enunciado,
  resultadoEsperado,
}: ProblemModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-w-lg w-full mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-800">
            <BookOpen size={20} className="text-zinc-800" />
            <h2 className="text-base font-semibold">Problema</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Instrucciones */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Instrucciones
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {enunciado}
            </p>
          </section>

          {/* Resultado esperado */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Resultado esperado
            </h3>
            <div className="bg-gray-100 rounded-lg px-4 py-3 font-mono text-sm text-gray-800 whitespace-pre">
              {resultadoEsperado}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
