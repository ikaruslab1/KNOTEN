'use client'
import { memo, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeProps, useUpdateNodeInternals, useReactFlow } from 'reactflow'
import { LayoutTemplate, Plus, Minus, Trash2, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'

export type IndentBlockData = {
  rows?: number
  level?: number
  state?: 'idle' | 'connected' | 'correct' | 'success' | 'error' | 'skipped'
  mergedBlockIds?: string[]
  onResize?: (rows: number) => void
  onDelete?: (id: string) => void
  onSeparate?: (id: string) => void
  readOnly?: boolean
  bump?: number
  isExiting?: boolean
  entranceDelay?: number
}

// Exactly 64px per row, strictly matching LineRailNode's 64px line distribution
const ROW_HEIGHT = 64
// Exactly 112px per indent level
const LEVEL_WIDTH = 112

const IndentBlock = memo(({ id, data, selected }: NodeProps<IndentBlockData>) => {
  const { setNodes, setEdges } = useReactFlow()
  const [rows, setRows] = useState<number>(data?.rows ?? 1)
  const level = data?.level ?? 1
  const [isHovered, setIsHovered] = useState(false)
  const updateNodeInternals = useUpdateNodeInternals()
  const { bump, isExiting, entranceDelay = 0, state = 'idle' } = data || {}
  const [isBumping, setIsBumping] = useState(false)
  const prevBumpRef = useRef(bump)
  const [hasEntered, setHasEntered] = useState(false)

  // Mark entrance as finished so animate-cartoon-in is never re-triggered
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasEntered(true)
    }, (entranceDelay + 0.6) * 1000)
    return () => clearTimeout(timer)
  }, [entranceDelay])

  // Width is exactly proportional to indent levels: 1 level = 112px, 2 levels = 224px, etc.
  const totalWidth = level * LEVEL_WIDTH
  // Total height matches the exact lines it represents
  const totalHeight = rows * ROW_HEIGHT

  // Immediate block bump without delay
  useEffect(() => {
    if (bump && bump !== prevBumpRef.current) {
      prevBumpRef.current = bump
      setIsBumping(false)
      const r = requestAnimationFrame(() => {
        setIsBumping(true)
      })
      const t = setTimeout(() => {
        setIsBumping(false)
      }, 300)
      return () => {
        cancelAnimationFrame(r)
        clearTimeout(t)
      }
    }
  }, [bump])

  useEffect(() => {
    updateNodeInternals(id)
    const t1 = setTimeout(() => updateNodeInternals(id), 60)
    const t2 = setTimeout(() => updateNodeInternals(id), 600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [id, rows, level, updateNodeInternals])

  const addRow = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    const next = rows + 1
    setRows(next)
    data?.onResize?.(next)
    setTimeout(() => updateNodeInternals(id), 10)
  }

  const removeRow = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (rows <= 1) return
    const next = rows - 1
    setRows(next)
    data?.onResize?.(next)
    setTimeout(() => updateNodeInternals(id), 10)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    data?.onDelete?.(id)
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
  }

  const handleSeparate = (e: React.MouseEvent) => {
    e.stopPropagation()
    data?.onSeparate?.(id)
  }

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName.includes('cartoonBounceIn')) {
      setHasEntered(true)
    }
    updateNodeInternals(id)
  }

  const isMultiLevel = level > 1
  const isSuccess = state === 'success' || state === 'correct'
  const isSkipped = state === 'skipped'
  const isError = state === 'error'

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onAnimationEnd={handleAnimationEnd}
      onContextMenu={(e) => {
        e.preventDefault()
      }}
      style={{
        width: totalWidth,
        height: totalHeight,
        animationDelay: isBumping ? '0s' : `${entranceDelay}s`,
      }}
      className={cn(
        'relative rounded-xl border shadow-md backdrop-blur-xs select-none transition-all cursor-grab active:cursor-grabbing group overflow-visible',
        isSuccess
          ? 'border-green-500 bg-emerald-50/90 ring-1 ring-green-500/30'
          : isSkipped
          ? 'border-dashed border-zinc-300 opacity-40 bg-zinc-100/60 grayscale'
          : isError
          ? 'border-red-500 bg-red-50/90'
          : isMultiLevel
          ? 'border-indigo-300/80 bg-zinc-100/95'
          : 'border-zinc-400 bg-zinc-200/95',
        isExiting
          ? 'animate-cartoon-out'
          : !hasEntered
          ? 'animate-cartoon-in'
          : '',
        isBumping && 'animate-block-bump',
        selected
          ? 'scale-105 shadow-2xl ring-2 ring-zinc-900 ring-offset-2 z-30'
          : 'hover:scale-[1.01]'
      )}
    >
      {/* Floating Separar button on top when multi-level and hovered/selected (no space consumed inside block) */}
      {!data?.readOnly && isMultiLevel && (selected || isHovered) && (
        <button
          type="button"
          onClick={handleSeparate}
          title="Separar en bloques individuales de nivel 1"
          className="absolute -top-3 left-4 px-2 py-0.5 rounded-full bg-zinc-900 hover:bg-indigo-600 text-white text-[9px] font-mono font-semibold flex items-center gap-1 shadow-md transition-all nodrag nopan z-40 cursor-pointer animate-in fade-in zoom-in-90 duration-150"
        >
          <Unlink className="w-2.5 h-2.5" />
          <span>Separar</span>
        </button>
      )}

      {/* Floating direct delete badge on corner when selected or hovered */}
      {!data?.readOnly && (selected || isHovered) && (
        <button
          type="button"
          onClick={handleDelete}
          title="Eliminar bloque de indentación"
          className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-zinc-900 text-white hover:bg-red-600 flex items-center justify-center shadow-md transition-all nodrag nopan z-40 cursor-pointer animate-in fade-in zoom-in-90 duration-150"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      )}

      {/* Rows of indentation (each row is strictly 64px) */}
      <div className="relative h-full flex flex-col justify-between">
        {Array.from({ length: rows }).map((_, i) => {
          const isFirstRow = i === 0
          const isLastRow = i === rows - 1

          return (
            <div
              key={i}
              className="relative flex flex-col justify-between px-2 w-full"
              style={{ height: ROW_HEIGHT }}
            >
              {/* Divider between multiple rows */}
              {i > 0 && (
                <div className="absolute top-0 left-2 right-2 h-px bg-zinc-300" />
              )}

              {/* Target handle on the left, centered vertically in this 64px row */}
              <Handle
                type="target"
                position={Position.Left}
                id={`left-${i}`}
                style={{
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />

              {/* Top micro-tag on row 0 */}
              {isFirstRow ? (
                <div
                  className={cn(
                    'flex items-center justify-between pt-1',
                    isSuccess ? 'text-emerald-700' : isSkipped ? 'text-zinc-400' : 'text-zinc-500'
                  )}
                >
                  <div className="flex items-center gap-1">
                    <LayoutTemplate
                      className={cn(
                        'w-2.5 h-2.5',
                        isSuccess ? 'text-emerald-600' : isSkipped ? 'text-zinc-400' : 'text-zinc-600'
                      )}
                    />
                    <span className="text-[9px] font-bold tracking-wider uppercase font-mono">
                      Indent
                    </span>
                  </div>
                  {isMultiLevel ? (
                    <span
                      className={cn(
                        'text-[8px] font-mono px-1 py-0.2 rounded font-bold border',
                        isSuccess
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isSkipped
                          ? 'bg-zinc-200 text-zinc-500 border-zinc-300'
                          : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      )}
                    >
                      Nivel {level}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'text-[8.5px] font-mono font-medium',
                        isSuccess ? 'text-emerald-600' : isSkipped ? 'text-zinc-400' : 'text-zinc-500'
                      )}
                    >
                      1..{rows}
                    </span>
                  )}
                </div>
              ) : (
                <div className="h-2" />
              )}

              {/* Center level indicator */}
              <div className="flex items-center justify-center -my-1">
                <span
                  className={cn(
                    'text-[11px] font-mono font-bold select-none text-center leading-tight',
                    isSuccess ? 'text-emerald-900' : isSkipped ? 'text-zinc-400' : 'text-zinc-800'
                  )}
                >
                  {level === 2
                    ? 'segundo nivel'
                    : level > 2
                    ? `nivel ${level}`
                    : `nivel ${i + 1}`}
                </span>
              </div>

              {/* Bottom micro-controls on last row */}
              {isLastRow ? (
                <div className="flex items-center justify-center pb-1">
                  {!data?.readOnly && (
                    <div className="flex items-center gap-1.5 nodrag nopan">
                      {rows > 1 && (
                        <button
                          type="button"
                          onClick={removeRow}
                          className="w-4 h-4 rounded bg-zinc-300 hover:bg-zinc-400 text-zinc-800 flex items-center justify-center transition cursor-pointer"
                          title="Quitar nivel"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={addRow}
                        className="w-4 h-4 rounded bg-zinc-800 hover:bg-zinc-900 text-white flex items-center justify-center transition cursor-pointer"
                        title="Agregar nivel"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-2" />
              )}

              {/* Source handle on the right, centered vertically in this 64px row */}
              <Handle
                type="source"
                position={Position.Right}
                id={`right-${i}`}
                style={{
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
})

IndentBlock.displayName = 'IndentBlock'

export default IndentBlock
