'use client'
import { useState, useRef, useEffect } from 'react'
import {
  Crosshair,
  Smile,
  LayoutTemplate,
  PlayCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type StickerItem = {
  emoji: string
  label: string
}

type ToolbarProps = {
  onCenter: () => void
  onAddSticker: (emoji: string) => void
  onAddIndentBlock: () => void
  onExecute: () => void
  canExecute: boolean
  attempts: number
  onShowProblem: () => void
  isMobileFolded?: boolean
  onToggleMobileFold?: () => void
}

const STICKERS: StickerItem[] = [
  { emoji: '🐵', label: 'Cara de monito' },
  { emoji: '🥰', label: 'Carita bonita' },
  { emoji: '❤️', label: 'Corazón' },
  { emoji: '🏳️‍🌈', label: 'Bandera gay' },
  { emoji: '🦖', label: 'Godzilla' },
  { emoji: '💀', label: 'Calavera' },
  { emoji: '✔️', label: 'Correcto' },
  { emoji: '❌', label: 'Error' },
  { emoji: '❔', label: 'Pregunta' },
  { emoji: '☣️', label: 'Peligro' },
]

const IconBtn = ({
  onClick,
  title,
  children,
  className,
}: {
  onClick: () => void
  title?: string
  children: React.ReactNode
  className?: string
}) => (
  <button
    onClick={onClick}
    title={title}
    className={cn(
      'flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors shrink-0',
      className,
    )}
  >
    {children}
  </button>
)

const Divider = () => (
  <div className="w-px h-5 sm:h-6 bg-gray-200 mx-0.5 sm:mx-1 self-center shrink-0" aria-hidden />
)

export default function Toolbar({
  onCenter,
  onAddSticker,
  onAddIndentBlock,
  onExecute,
  canExecute,
  attempts,
  onShowProblem,
  isMobileFolded = false,
  onToggleMobileFold,
}: ToolbarProps) {
  const [stickerOpen, setStickerOpen] = useState(false)
  const stickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (stickerRef.current && !stickerRef.current.contains(e.target as Node)) {
        setStickerOpen(false)
      }
    }
    if (stickerOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [stickerOpen])

  const handleSticker = (emoji: string) => {
    onAddSticker(emoji)
    setStickerOpen(false)
  }

  return (
    <>
      {/* Main Toolbar Container */}
      <div
        className={cn(
          'fixed z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 transition-all duration-300 transform',
          // Desktop: centered at top
          'sm:top-4 sm:bottom-auto sm:left-1/2 sm:-translate-x-1/2',
          // Mobile: floating above bottom edge for thumb reach
          'bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100vw-20px)] overflow-x-auto no-scrollbar',
          // Mobile folded state
          isMobileFolded && 'translate-y-28 opacity-0 pointer-events-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto'
        )}
      >
        {/* Center */}
        <IconBtn onClick={onCenter} title="Volver al centro">
          <Crosshair size={17} />
        </IconBtn>

        {/* Sticker picker */}
        <div className="relative" ref={stickerRef}>
          <IconBtn onClick={() => setStickerOpen((o) => !o)} title="Agregar sticker">
            <Smile size={17} />
          </IconBtn>
          {stickerOpen && (
            <div className="absolute bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-5 gap-1.5 min-w-[210px] animate-in fade-in zoom-in-95 duration-150">
              {STICKERS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSticker(emoji)}
                  className="text-xl w-9 h-9 flex items-center justify-center rounded-xl hover:bg-zinc-100 hover:scale-110 active:scale-95 transition-all"
                  title={label}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Indent block */}
        <IconBtn onClick={onAddIndentBlock} title="Agregar bloque de indentación">
          <LayoutTemplate size={17} />
        </IconBtn>

        <Divider />

        {/* Execute button */}
        <button
          onClick={onExecute}
          disabled={!canExecute}
          title="Ejecutar"
          className={cn(
            'flex items-center gap-1.5 bg-zinc-900 text-white rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-all hover:bg-zinc-800 active:bg-black shrink-0 shadow-xs',
            !canExecute && 'opacity-40 cursor-not-allowed',
          )}
        >
          <PlayCircle size={15} />
          <span>Ejecutar</span>
        </button>

        <Divider />

        {/* Attempts */}
        <span className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap px-0.5">
          {attempts} int.
        </span>

        {/* Problem modal trigger */}
        <IconBtn onClick={onShowProblem} title="Ver problema">
          <BookOpen size={17} />
        </IconBtn>

        {/* Mobile Fold Button */}
        {onToggleMobileFold && (
          <>
            <Divider />
            <button
              type="button"
              onClick={onToggleMobileFold}
              className="sm:hidden flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition shrink-0"
              title="Plegar barra de herramientas"
            >
              <ChevronDown size={17} />
            </button>
          </>
        )}
      </div>

      {/* Floating trigger pill when mobile toolbar is folded */}
      {isMobileFolded && onToggleMobileFold && (
        <button
          type="button"
          onClick={onToggleMobileFold}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 sm:hidden flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-900/95 backdrop-blur-md text-white shadow-xl text-xs font-semibold hover:bg-zinc-800 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 border border-zinc-700"
          title="Desplegar herramientas"
        >
          <PlayCircle size={15} className="text-emerald-400" />
          <span>Herramientas</span>
          <ChevronUp size={14} className="text-zinc-400" />
        </button>
      )}
    </>
  )
}

