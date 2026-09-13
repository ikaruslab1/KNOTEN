'use client'
import { memo, useState, useEffect } from 'react'
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow'

export type IndentBlockData = {
  rows?: number
  onResize?: (rows: number) => void
  readOnly?: boolean
}

const ROW_HEIGHT = 48

const IndentBlock = memo(({ id, data }: NodeProps<IndentBlockData>) => {
  const [rows, setRows] = useState<number>(data?.rows ?? 1)
  const updateNodeInternals = useUpdateNodeInternals()

  const totalHeight = rows * ROW_HEIGHT

  useEffect(() => {
    updateNodeInternals(id)
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

  return (
    <div
      className="relative rounded-xl border-2 border-zinc-400 bg-zinc-200/95 shadow-sm select-none"
      style={{ width: 220, minHeight: totalHeight + 40, height: totalHeight + 40 }}
    >
      {/* Row dividers + handles */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="relative flex items-center justify-between px-3"
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
              width: 12,
              height: 12,
              background: '#9CA3AF',
              border: '2px solid #fff',
              borderRadius: '50%',
            }}
          />

          <span className="text-[11px] font-mono text-zinc-500 font-semibold select-none pl-1">
            nivel {i + 1}
          </span>

          <Handle
            type="source"
            position={Position.Right}
            id={`right-${i}`}
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              width: 12,
              height: 12,
              background: '#9CA3AF',
              border: '2px solid #fff',
              borderRadius: '50%',
            }}
          />
        </div>
      ))}

      {/* Bottom controls */}
      <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-2">
        {rows > 1 && !data?.readOnly && (
          <button
            type="button"
            onClick={removeRow}
            className="w-6 h-6 rounded-full bg-zinc-400 hover:bg-zinc-500 text-white text-base font-bold flex items-center justify-center leading-none transition-colors shadow-xs"
            title="Quitar nivel"
          >
            {String.fromCharCode(8722)}
          </button>
        )}
        {!data?.readOnly && (
          <button
            type="button"
            onClick={addRow}
            className="w-6 h-6 rounded-full bg-zinc-700 hover:bg-zinc-800 text-white text-base font-bold flex items-center justify-center leading-none transition-colors shadow-xs"
            title="Agregar nivel"
          >
            +
          </button>
        )}
      </div>
    </div>
  )
})

IndentBlock.displayName = 'IndentBlock'

export default IndentBlock
