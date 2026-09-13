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
  Magnet,
  AlignCenterHorizontal,
  RectangleHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type StickerItem = {
  id: string
  label: string
  category: 'emotes' | 'bloques' | 'datos'
  variant?: 'emoji' | 'badge'
  emoji?: string
  text?: string
  bgClass?: string
  borderClass?: string
  textClass?: string
}

type ToolbarProps = {
  onCenter: () => void
  onAddSticker: (sticker: StickerItem | string) => void
  onAddIndentBlock: () => void
  onAddRectangle?: () => void
  smartGuidesEnabled?: boolean
  onToggleSmartGuides?: () => void
  onAlignLine?: (lineNum?: number) => void
  onAlignAllLines?: () => void
  lineCount?: number
  onExecute: () => void
  canExecute: boolean
  attempts: number
  onShowProblem: () => void
  isMobileFolded?: boolean
  onToggleMobileFold?: () => void
}

const EMOTE_STICKERS: StickerItem[] = [
  { id: 'monkey', category: 'emotes', emoji: '🐵', label: 'Cara de monito' },
  { id: 'love', category: 'emotes', emoji: '🥰', label: 'Carita bonita' },
  { id: 'heart', category: 'emotes', emoji: '❤️', label: 'Corazón' },
  { id: 'pride', category: 'emotes', emoji: '🏳️‍🌈', label: 'Bandera gay' },
  { id: 'dino', category: 'emotes', emoji: '🦖', label: 'Godzilla' },
  { id: 'skull', category: 'emotes', emoji: '💀', label: 'Calavera' },
  { id: 'check', category: 'emotes', emoji: '✔️', label: 'Correcto' },
  { id: 'cross', category: 'emotes', emoji: '❌', label: 'Error' },
  { id: 'question', category: 'emotes', emoji: '❔', label: 'Pregunta' },
  { id: 'danger', category: 'emotes', emoji: '☣️', label: 'Peligro' },
]

const BLOQUE_STICKERS: StickerItem[] = [
  {
    id: 'block-variable',
    category: 'bloques',
    variant: 'badge',
    text: 'Variable',
    label: 'Variable (rojo)',
    bgClass: 'bg-red-100',
    borderClass: 'border-red-500',
    textClass: 'text-red-700',
  },
  {
    id: 'block-operador',
    category: 'bloques',
    variant: 'badge',
    text: 'Operador',
    label: 'Operador (rosa)',
    bgClass: 'bg-pink-100',
    borderClass: 'border-pink-500',
    textClass: 'text-pink-700',
  },
  {
    id: 'block-condicional',
    category: 'bloques',
    variant: 'badge',
    text: 'Condicional',
    label: 'Condicional (verde)',
    bgClass: 'bg-emerald-100',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-800',
  },
  {
    id: 'block-bucle',
    category: 'bloques',
    variant: 'badge',
    text: 'Bucle',
    label: 'Bucle (morado)',
    bgClass: 'bg-purple-100',
    borderClass: 'border-purple-500',
    textClass: 'text-purple-800',
  },
  {
    id: 'block-funcion',
    category: 'bloques',
    variant: 'badge',
    text: 'Función',
    label: 'Función (amarillo)',
    bgClass: 'bg-amber-100',
    borderClass: 'border-amber-500',
    textClass: 'text-amber-900',
  },
  {
    id: 'block-clase',
    category: 'bloques',
    variant: 'badge',
    text: 'Clase',
    label: 'Clase (azul)',
    bgClass: 'bg-blue-100',
    borderClass: 'border-blue-500',
    textClass: 'text-blue-800',
  },
  {
    id: 'block-modulo',
    category: 'bloques',
    variant: 'badge',
    text: 'Módulo',
    label: 'Módulo (gris)',
    bgClass: 'bg-zinc-100',
    borderClass: 'border-zinc-500',
    textClass: 'text-zinc-800',
  },
  {
    id: 'block-excepcion',
    category: 'bloques',
    variant: 'badge',
    text: 'Excepción',
    label: 'Excepción (naranja)',
    bgClass: 'bg-orange-100',
    borderClass: 'border-orange-500',
    textClass: 'text-orange-800',
  },
]

const DATO_STICKERS: StickerItem[] = [
  { id: 'data-int', category: 'datos', variant: 'badge', text: 'Entero (int)', label: 'Entero (int)' },
  { id: 'data-float', category: 'datos', variant: 'badge', text: 'Flotante (float)', label: 'Flotante (float)' },
  { id: 'data-complex', category: 'datos', variant: 'badge', text: 'Complejo (complex)', label: 'Complejo (complex)' },
  { id: 'data-bool', category: 'datos', variant: 'badge', text: 'Booleano (bool)', label: 'Booleano (bool)' },
  { id: 'data-str', category: 'datos', variant: 'badge', text: 'Texto (str)', label: 'Texto (str)' },
  { id: 'data-null', category: 'datos', variant: 'badge', text: 'Nulo (null)', label: 'Nulo (null)' },
  { id: 'data-list', category: 'datos', variant: 'badge', text: 'Lista (list)', label: 'Lista (list)' },
  { id: 'data-tuple', category: 'datos', variant: 'badge', text: 'Tupla (tuple)', label: 'Tupla (tuple)' },
  { id: 'data-dict', category: 'datos', variant: 'badge', text: 'Diccionario (dict)', label: 'Diccionario (dict)' },
  { id: 'data-set', category: 'datos', variant: 'badge', text: 'Conjunto (set)', label: 'Conjunto (set)' },
  { id: 'data-frozenset', category: 'datos', variant: 'badge', text: 'Inmutable (Frozenset)', label: 'Inmutable (Frozenset)' },
  { id: 'data-bytes', category: 'datos', variant: 'badge', text: 'Bytes (bytes)', label: 'Bytes (bytes)' },
  { id: 'data-bytearray', category: 'datos', variant: 'badge', text: 'Arreglo de bytes (bytearray)', label: 'Arreglo de bytes (bytearray)' },
  { id: 'data-memoryview', category: 'datos', variant: 'badge', text: 'Vista de memoria (memoryview)', label: 'Vista de memoria (memoryview)' },
].map((item): StickerItem => ({
  id: item.id,
  label: item.label,
  text: item.text,
  category: 'datos',
  variant: 'badge',
  bgClass: 'bg-cyan-100',
  borderClass: 'border-cyan-500',
  textClass: 'text-cyan-900',
}))

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
  onAddRectangle,
  smartGuidesEnabled = true,
  onToggleSmartGuides,
  onAlignLine,
  onAlignAllLines,
  lineCount = 1,
  onExecute,
  canExecute,
  attempts,
  onShowProblem,
  isMobileFolded = false,
  onToggleMobileFold,
}: ToolbarProps) {
  const [stickerOpen, setStickerOpen] = useState(false)
  const [alignMenuOpen, setAlignMenuOpen] = useState(false)
  const stickerRef = useRef<HTMLDivElement>(null)
  const alignMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (stickerRef.current && !stickerRef.current.contains(e.target as Node)) {
        setStickerOpen(false)
      }
      if (alignMenuRef.current && !alignMenuRef.current.contains(e.target as Node)) {
        setAlignMenuOpen(false)
      }
    }
    if (stickerOpen || alignMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [stickerOpen, alignMenuOpen])

  const handleSticker = (item: StickerItem) => {
    onAddSticker(item)
    setStickerOpen(false)
  }

  return (
    <>
      <div
        className={cn(
          'fixed z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2 transition-all duration-300 transform select-none',
          // Desktop (xl: >= 1280px): horizontally on the right at the top
          'xl:top-4 xl:bottom-auto xl:right-4 xl:left-auto xl:translate-x-0 xl:animate-slide-down-fade',
          // Mobile: floating bottom center; Tablet (sm:): floating bottom right
          'bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 w-[calc(100vw-24px)] max-w-sm sm:w-auto sm:max-w-none',
          // Mobile & Tablet folded state vs expanded slide up
          isMobileFolded
            ? 'translate-y-36 opacity-0 pointer-events-none xl:translate-y-0 xl:opacity-100 xl:pointer-events-auto'
            : 'animate-slide-up-fade xl:animate-slide-down-fade'
        )}
      >
        {/* Mobile handle indicator */}
        {onToggleMobileFold && (
          <button
            type="button"
            onClick={onToggleMobileFold}
            className="sm:hidden w-full flex justify-center py-0.5 -mt-1 -mb-0.5 text-zinc-300 hover:text-zinc-500 cursor-pointer"
            title="Plegar barra de herramientas"
          >
            <div className="w-8 h-1 rounded-full bg-zinc-200 hover:bg-zinc-300 transition-colors" />
          </button>
        )}

        {/* Tier 1: Creation & Alignment Tools */}
        <div className="flex items-center justify-around sm:justify-start gap-1 w-full sm:w-auto">
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
            <div
              className={cn(
                "fixed z-[60] bg-white/98 backdrop-blur-md border border-zinc-200 rounded-2xl shadow-2xl p-3 w-[295px] sm:w-[335px] max-h-[400px] sm:max-h-[460px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5",
                "bottom-28 left-1/2 -translate-x-1/2 sm:bottom-18 sm:left-auto sm:right-4 sm:translate-x-0",
                "xl:bottom-auto xl:top-16 xl:right-4 xl:left-auto xl:translate-x-0"
              )}
            >
              {/* Category 1: Emotes */}
              <div>
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 px-0.5">
                  Emotes
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {EMOTE_STICKERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSticker(item)}
                      className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-100 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                      title={item.label}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-zinc-200 -mx-1" />

              {/* Category 2: Bloques */}
              <div>
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 px-0.5">
                  Bloques
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {BLOQUE_STICKERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSticker(item)}
                      className={cn(
                        "py-1.5 px-2 rounded-lg border-2 text-xs font-semibold text-center transition-all hover:scale-[1.03] active:scale-95 cursor-pointer shadow-xs leading-tight",
                        item.bgClass,
                        item.borderClass,
                        item.textClass
                      )}
                      title={item.label}
                    >
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-zinc-200 -mx-1" />

              {/* Category 3: Datos */}
              <div>
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 px-0.5">
                  Datos
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {DATO_STICKERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSticker(item)}
                      className={cn(
                        "py-1.5 px-1.5 rounded-lg border-2 text-[11px] font-semibold text-center transition-all hover:scale-[1.03] active:scale-95 cursor-pointer shadow-xs leading-tight",
                        item.bgClass,
                        item.borderClass,
                        item.textClass
                      )}
                      title={item.label}
                    >
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Indent block */}
        <IconBtn onClick={onAddIndentBlock} title="Agregar bloque de indentación">
          <LayoutTemplate size={17} />
        </IconBtn>

        {/* Rectangle shape tool */}
        {onAddRectangle && (
          <IconBtn onClick={onAddRectangle} title="Crear figura rectangular">
            <RectangleHorizontal size={17} />
          </IconBtn>
        )}

        {/* Smart Guides Toggle */}
        {onToggleSmartGuides && (
          <IconBtn
            onClick={onToggleSmartGuides}
            title={
              smartGuidesEnabled
                ? "Guías inteligentes activadas (centrado automático). Haz clic para desactivar"
                : "Activar guías inteligentes (alinear al centro de los contenedores)"
            }
            className={cn(
              smartGuidesEnabled
                ? "bg-sky-100 text-sky-700 hover:bg-sky-200 hover:text-sky-800 ring-1 ring-sky-300"
                : "text-zinc-400 hover:text-zinc-700"
            )}
          >
            <Magnet size={17} />
          </IconBtn>
        )}

        {/* Align Row Button & Dropdown */}
        {(onAlignLine || onAlignAllLines) && (
          <div className="relative" ref={alignMenuRef}>
            <IconBtn
              onClick={() => setAlignMenuOpen((o) => !o)}
              title="Alinear fila de código horizontalmente"
              className={cn(alignMenuOpen && "bg-zinc-100 text-zinc-900")}
            >
              <AlignCenterHorizontal size={17} />
            </IconBtn>

            {alignMenuOpen && (
              <div
                className={cn(
                  "fixed z-[60] bg-white/98 backdrop-blur-md border border-zinc-200 rounded-2xl shadow-xl p-2 flex flex-col gap-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-150",
                  "bottom-28 left-1/2 -translate-x-1/2 sm:bottom-18 sm:left-auto sm:right-4 sm:translate-x-0",
                  "xl:bottom-auto xl:top-16 xl:right-4 xl:left-auto xl:translate-x-0"
                )}
              >
                <span className="text-[10px] font-bold text-zinc-400 px-2.5 py-1 uppercase tracking-wider font-mono">
                  Alinear fila horizontal
                </span>
                {lineCount > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onAlignAllLines?.()
                        setAlignMenuOpen(false)
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-800 hover:bg-zinc-100 hover:text-zinc-900 transition text-left cursor-pointer"
                    >
                      <AlignCenterHorizontal className="w-3.5 h-3.5 text-zinc-600" />
                      <span>Todas las filas ({lineCount})</span>
                    </button>
                    <div className="h-px bg-zinc-100 my-0.5" />
                    {Array.from({ length: lineCount }).map((_, i) => {
                      const lineNum = i + 1
                      return (
                        <button
                          key={lineNum}
                          type="button"
                          onClick={() => {
                            onAlignLine?.(lineNum)
                            setAlignMenuOpen(false)
                          }}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded bg-zinc-900 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                              {lineNum}
                            </span>
                            <span>Fila {lineNum}</span>
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">alinear</span>
                        </button>
                      )
                    })}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onAlignLine?.(1)
                      setAlignMenuOpen(false)
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-800 hover:bg-zinc-100 hover:text-zinc-900 transition text-left cursor-pointer"
                  >
                    <AlignCenterHorizontal className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Alinear elementos de fila 1</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        </div>

        {/* Separator between tiers: vertical on tablet/desktop, horizontal on mobile */}
        <div className="hidden sm:block">
          <Divider />
        </div>
        <div className="sm:hidden w-full h-px bg-gray-100 my-0.5" />

        {/* Tier 2: Execution, Problem, Attempts & Fold */}
        <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Execute button */}
          <button
            onClick={onExecute}
            disabled={!canExecute}
            title="Ejecutar"
            className={cn(
              'flex items-center gap-1.5 bg-zinc-900 text-white rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-all hover:bg-zinc-800 active:bg-black shrink-0 shadow-xs cursor-pointer',
              !canExecute && 'opacity-40 cursor-not-allowed',
            )}
          >
            <PlayCircle size={15} />
            <span>Ejecutar</span>
          </button>

          {/* Right-aligned cluster on mobile / inline on tablet & desktop */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Attempts */}
            <span className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap px-1">
              {attempts} int.
            </span>

            {/* Problem modal trigger */}
            <IconBtn onClick={onShowProblem} title="Ver problema">
              <BookOpen size={17} />
            </IconBtn>

            {/* Mobile / Tablet Fold Button */}
            {onToggleMobileFold && (
              <>
                <div className="hidden sm:block">
                  <Divider />
                </div>
                <button
                  type="button"
                  onClick={onToggleMobileFold}
                  className="xl:hidden flex items-center gap-1 px-2.5 py-1.5 sm:px-0 sm:py-0 sm:w-8 sm:h-8 justify-center rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/80 transition shrink-0 cursor-pointer bg-zinc-100/90 sm:bg-transparent border border-zinc-200/70 sm:border-0"
                  title="Plegar barra de herramientas"
                >
                  <ChevronDown size={17} />
                  <span className="text-[11px] font-semibold sm:hidden">Ocultar</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating trigger pill when mobile/tablet toolbar is folded */}
      {isMobileFolded && onToggleMobileFold && (
        <button
          type="button"
          onClick={onToggleMobileFold}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-50 xl:hidden flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-900/95 backdrop-blur-md text-white shadow-xl text-xs font-semibold hover:bg-zinc-800 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 border border-zinc-700 cursor-pointer"
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

