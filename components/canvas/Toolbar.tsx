'use client'
import { useState, useRef, useEffect } from 'react'
import {
  Crosshair,
  Smile,
  LayoutTemplate,
  PlayCircle,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type StickerEmoji = '✔️' | '❌' | '❔' | '☣️'

type ToolbarProps = {
  onCenter: () => void
  onAddSticker: (emoji: StickerEmoji) => void
  onAddIndentBlock: () => void
  onExecute: () => void
  canExecute: boolean
  attempts: number
  onShowProblem: () => void
}

const EMOJIS: StickerEmoji[] = ['✔️', '❌', '❔', '☣️']

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
      'flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors',
      className,
    )}
  >
    {children}
  </button>
)

const Divider = () => (
  <div className="w-px h-6 bg-gray-200 mx-1 self-center" aria-hidden />
)

export default function Toolbar({
  onCenter,
  onAddSticker,
  onAddIndentBlock,
  onExecute,
  canExecute,
  attempts,
  onShowProblem,
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

  const handleSticker = (emoji: StickerEmoji) => {
    onAddSticker(emoji)
    setStickerOpen(false)
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center gap-2 px-4 py-2">
      {/* Center */}
      <IconBtn onClick={onCenter} title="Volver al centro">
        <Crosshair size={18} />
      </IconBtn>

      {/* Sticker picker */}
      <div className="relative" ref={stickerRef}>
        <IconBtn onClick={() => setStickerOpen((o) => !o)} title="Agregar sticker">
          <Smile size={18} />
        </IconBtn>
        {stickerOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg flex gap-1 px-2 py-1.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSticker(emoji)}
                className="text-xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                title={`Sticker ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Indent block */}
      <IconBtn onClick={onAddIndentBlock} title="Agregar bloque de indentación">
        <LayoutTemplate size={18} />
      </IconBtn>

      <Divider />

      {/* Execute */}
      <button
        onClick={onExecute}
        disabled={!canExecute}
        title="Ejecutar"
        className={cn(
          'flex items-center gap-1.5 bg-zinc-900 text-white rounded-xl px-4 py-1.5 text-sm font-medium transition-all hover:bg-zinc-800 active:bg-black',
          !canExecute && 'opacity-40 cursor-not-allowed',
        )}
      >
        <PlayCircle size={16} />
        Ejecutar
      </button>

      <Divider />

      {/* Attempts */}
      <span className="text-xs text-gray-400 whitespace-nowrap">
        Intentos: {attempts}
      </span>

      {/* Problem */}
      <IconBtn onClick={onShowProblem} title="Ver problema">
        <BookOpen size={18} />
      </IconBtn>
    </div>
  )
}
