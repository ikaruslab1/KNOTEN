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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-w-lg w-full mx-3 sm:mx-4 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden max-h-[85vh] flex flex-col animate-modal-zoom">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 text-gray-800">
            <BookOpen size={18} className="text-zinc-800" />
            <h2 className="text-sm sm:text-base font-semibold">Problema</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 overflow-y-auto">
          {/* Instrucciones */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
              Instrucciones
            </h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {enunciado}
            </p>
          </section>

          {/* Resultado esperado */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
              Resultado esperado
            </h3>
            <div className="bg-gray-100 rounded-lg px-3.5 py-2.5 sm:px-4 sm:py-3 font-mono text-xs sm:text-sm text-gray-800 whitespace-pre overflow-x-auto">
              {resultadoEsperado}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
