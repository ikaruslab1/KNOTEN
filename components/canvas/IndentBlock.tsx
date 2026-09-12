'use client'
import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export type IndentBlockData = {
  rows: number
  onResize: (rows: number) => void
  readOnly?: boolean
}

const ROW_HEIGHT = 48

const IndentBlock = memo(({ data }: NodeProps<IndentBlockData>) => {
  const [rows, setRows] = useState<number>(data.rows ?? 1)

  const totalHeight = rows * ROW_HEIGHT

  const addRow = () => {
    const next = rows + 1
    setRows(next)
    data.onResize(next)
  }

  const removeRow = () => {
    if (rows <= 1) return
    const next = rows - 1
    setRows(next)
    data.onResize(next)
  }

  return (
    <div
      className="relative rounded-lg border border-gray-400 bg-gray-200 select-none"
      style={{ width: 200, height: totalHeight + 32 }}
    >
      {/* Row dividers + handles */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="relative flex items-center"
          style={{ height: ROW_HEIGHT }}
        >
          {i > 0 && (
            <div className="absolute top-0 left-2 right-2 h-px bg-gray-400/60" />
          )}

          <Handle
            type="target"
            position={Position.Left}
            id={`left-${i}`}
            style={{
              top: i * ROW_HEIGHT + ROW_HEIGHT / 2,
              width: 12,
              height: 12,
              background: '#9CA3AF',
              border: '2px solid #fff',
              borderRadius: '50%',
            }}
          />

          <Handle
            type="source"
            position={Position.Right}
            id={`right-${i}`}
            style={{
              top: i * ROW_HEIGHT + ROW_HEIGHT / 2,
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
      <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center gap-2">
        {rows > 1 && !data.readOnly && (
          <button
            onClick={removeRow}
            className="w-6 h-6 rounded-full bg-gray-400 hover:bg-gray-500 text-white text-base font-bold flex items-center justify-center leading-none transition-colors"
            title="Quitar fila"
          >
            {String.fromCharCode(8722)}
          </button>
        )}
        {!data.readOnly && (
          <button
            onClick={addRow}
            className="w-6 h-6 rounded-full bg-gray-500 hover:bg-gray-600 text-white text-base font-bold flex items-center justify-center leading-none transition-colors"
            title="Agregar fila"
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
