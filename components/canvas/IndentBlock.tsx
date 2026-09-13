'use client'
import { memo, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeProps, useUpdateNodeInternals, useReactFlow } from 'reactflow'
import { LayoutTemplate, Plus, Minus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type IndentBlockData = {
  rows?: number
  onResize?: (rows: number) => void
  onDelete?: (id: string) => void
  readOnly?: boolean
  bump?: number
  isExiting?: boolean
  entranceDelay?: number
}

// Exactly matching LineRailNode's vertical dimensions (36px header, 64px per row, 36px footer)
const ROW_HEIGHT = 64
const HEADER_HEIGHT = 36
const FOOTER_HEIGHT = 36

const IndentBlock = memo(({ id, data, selected }: NodeProps<IndentBlockData>) => {
  const { setNodes, setEdges } = useReactFlow()
  const [rows, setRows] = useState<number>(data?.rows ?? 1)
  const [isHovered, setIsHovered] = useState(false)
  const updateNodeInternals = useUpdateNodeInternals()
  const { bump, isExiting, entranceDelay = 0 } = data || {}
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
  }, [id, rows, updateNodeInternals])

  const addRow = () => {
    const next = rows + 1
    setRows(next)
    data?.onResize?.(next)
    setTimeout(() => updateNodeInternals(id), 10)
  }

  const removeRow = () => {
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

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName.includes('cartoonBounceIn')) {
      setHasEntered(true)
    }
    updateNodeInternals(id)
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onAnimationEnd={handleAnimationEnd}
      style={{
        height: totalHeight + HEADER_HEIGHT + FOOTER_HEIGHT,
        animationDelay: isBumping ? '0s' : `${entranceDelay}s`,
      }}
      className={cn(
        'relative rounded-2xl border border-zinc-400 bg-zinc-200/95 shadow-md backdrop-blur-xs select-none w-[115px] transition-all cursor-grab active:cursor-grabbing group',
        isExiting
          ? 'animate-cartoon-out'
          : !hasEntered
          ? 'animate-cartoon-in'
          : '',
        isBumping && 'animate-block-bump',
        selected
          ? 'scale-106 shadow-2xl ring-2 ring-zinc-900 ring-offset-2 z-30'
          : 'hover:scale-[1.01]'
      )}
    >
      {/* Floating direct delete badge on corner when selected or hovered */}
      {!data?.readOnly && (selected || isHovered) && (
        <button
          type="button"
          onClick={handleDelete}
          title="Eliminar bloque de indentación"
          className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-zinc-900 text-white hover:bg-red-600 flex items-center justify-center shadow-md transition-all nodrag nopan z-40 cursor-pointer animate-in fade-in zoom-in-90 duration-150"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      {/* Header (36px - matches LineRailNode header) */}
      <div className="h-[36px] flex items-center justify-between px-2.5 border-b border-zinc-300 bg-zinc-300/40 rounded-t-2xl">
        <div className="flex items-center gap-1 text-zinc-700">
          <LayoutTemplate className="w-3.5 h-3.5 text-zinc-600" />
          <span className="text-[11px] font-bold tracking-wider uppercase font-mono">
            Indent
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-zinc-500 font-medium">
            1..{rows}
          </span>
          {!data?.readOnly && (
            <button
              type="button"
              onClick={handleDelete}
              title="Eliminar bloque de indentación"
              className="flex items-center justify-center w-5 h-5 rounded text-zinc-400 hover:text-red-600 hover:bg-red-100/60 transition nodrag nopan cursor-pointer ml-0.5"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Row dividers + handles (each 64px - matches LineRailNode row) */}
      <div className="relative">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="relative flex items-center justify-between px-2"
            style={{ height: ROW_HEIGHT }}
          >
            {i > 0 && (
              <div className="absolute top-0 left-2 right-2 h-px bg-zinc-300" />
            )}

            <Handle
              type="target"
              position={Position.Left}
              id={`left-${i}`}
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />

            <span className="text-[11px] font-mono text-zinc-600 font-semibold select-none text-center w-full">
              nivel {i + 1}
            </span>

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
        ))}
      </div>

      {/* Bottom controls (36px - matches LineRailNode footer) */}
      {!data?.readOnly && (
        <div className="h-[36px] absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2">
          {rows > 1 && (
            <button
              type="button"
              onClick={removeRow}
              className="w-5 h-5 rounded-md bg-zinc-300 hover:bg-zinc-400 text-zinc-800 text-xs font-bold flex items-center justify-center transition"
              title="Quitar nivel"
            >
              <Minus className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={addRow}
            className="w-5 h-5 rounded-md bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold flex items-center justify-center transition"
            title="Agregar nivel"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
})

IndentBlock.displayName = 'IndentBlock'

export default IndentBlock
