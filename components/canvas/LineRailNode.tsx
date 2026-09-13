'use client'

import { memo, useState, useEffect } from 'react'
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow'
import { ArrowRight, Hash, Plus, Minus } from 'lucide-react'

export type LineRailData = {
  lines?: number
  onLinesChange?: (lines: number) => void
  readOnly?: boolean
}

// 90px matches the vertical distance between lines of code (Y_GAP in code-splitter)
const ROW_HEIGHT = 90

const LineRailNode = memo(({ id, data }: NodeProps<LineRailData>) => {
  const [lines, setLines] = useState<number>(data?.lines ?? 1)
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, lines, updateNodeInternals])

  const addLine = () => {
    const next = lines + 1
    setLines(next)
    data?.onLinesChange?.(next)
    setTimeout(() => updateNodeInternals(id), 10)
  }

  const removeLine = () => {
    if (lines <= 1) return
    const next = lines - 1
    setLines(next)
    data?.onLinesChange?.(next)
    setTimeout(() => updateNodeInternals(id), 10)
  }

  const totalHeight = lines * ROW_HEIGHT

  return (
    <div
      className="relative rounded-2xl border border-zinc-300 bg-white/95 shadow-md backdrop-blur-xs select-none min-w-[130px] transition-all"
      style={{ height: totalHeight + 48 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-50 rounded-t-2xl">
        <div className="flex items-center gap-1.5 text-zinc-700">
          <Hash className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[11px] font-bold tracking-wider uppercase font-mono">
            Líneas
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 font-medium">
          1..{lines}
        </span>
      </div>

      {/* Rows of lines */}
      <div className="relative">
        {Array.from({ length: lines }).map((_, i) => {
          const lineNum = i + 1
          return (
            <div
              key={lineNum}
              className="relative flex items-center justify-between px-3"
              style={{ height: ROW_HEIGHT }}
            >
              {/* Divider between lines */}
              {i > 0 && (
                <div className="absolute top-0 left-2 right-2 h-px bg-zinc-200" />
              )}

              {/* Left side: line number badge */}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-900 font-mono text-xs font-bold text-white shadow-xs">
                  {lineNum}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline">
                  línea
                </span>
              </div>

              {/* Right side: arrow indicator and connection handle */}
              <div className="relative flex items-center pr-2">
                <ArrowRight className="w-4 h-4 text-zinc-400" />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`line-${lineNum}`}
                  style={{
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 12,
                    height: 12,
                    background: '#18181b',
                    border: '2px solid #ffffff',
                    borderRadius: '50%',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom controls to add/remove lines */}
      {!data?.readOnly && (
        <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-2">
          {lines > 1 && (
            <button
              type="button"
              onClick={removeLine}
              className="w-5 h-5 rounded-md bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-bold flex items-center justify-center transition"
              title="Quitar línea"
            >
              <Minus className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={addLine}
            className="w-5 h-5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center justify-center transition"
            title="Agregar línea"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
})

LineRailNode.displayName = 'LineRailNode'

export default LineRailNode
