'use client'

import { memo, useState } from 'react'
import { NodeProps, useReactFlow, NodeResizer } from 'reactflow'
import { Trash2, Move } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RectangleNodeData = {
  width?: number
  height?: number
  isRainbow?: boolean
  activeBorderColor?: string | null
  activeBgColor?: string | null
  onDelete?: (id: string) => void
  readOnly?: boolean
}

const RectangleNode = memo(({ id, data, selected }: NodeProps<RectangleNodeData>) => {
  const { setNodes } = useReactFlow()
  const [isHovered, setIsHovered] = useState(false)

  const handleDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (data?.onDelete) {
      data.onDelete(id)
    }
    setNodes((nodes) => nodes.filter((n) => n.id !== id))
  }

  // Rectangles remain interactive even after code execution
  const showControls = selected || isHovered
  const isRainbow = Boolean(data?.isRainbow)
  const activeBorder = data?.activeBorderColor

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full h-full select-none group"
      style={{ minWidth: 60, minHeight: 40 }}
    >
      {/* NodeResizer for resizing from aristas (lines) and corners */}
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={40}
        lineClassName="!border-zinc-500/80 !border-dashed"
        handleClassName="!w-3 !h-3 !bg-white !border-2 !border-zinc-700 !rounded-xs !shadow-md hover:!scale-125 transition-transform"
      />

      {/* Center Action Pill: Mover & Borrar buttons (centered, away from aristas) */}
      {showControls && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl px-2 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* Mover button / drag handle */}
          <div
            className="rect-drag-handle flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold cursor-grab active:cursor-grabbing transition-colors"
            title="Arrastra para mover el rectángulo"
          >
            <Move className="w-3.5 h-3.5 text-zinc-600" />
            <span>Mover</span>
          </div>

          <div className="w-px h-5 bg-zinc-200 mx-0.5" />

          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            className="nodrag nopan flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            title="Eliminar rectángulo"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Eliminar</span>
          </button>
        </div>
      )}

      {/* The Rectangle box */}
      <div
        className={cn(
          "w-full h-full rounded-xl transition-all duration-200",
          isRainbow ? "rainbow-rectangle-border" : "border-2"
        )}
        style={
          isRainbow
            ? undefined
            : {
                borderColor: activeBorder || "#a1a1aa", // default neutral gray border
                backgroundColor: "transparent", // overlay renders the 8% tint over elements
              }
        }
      />
    </div>
  )
})

RectangleNode.displayName = 'RectangleNode'

export default RectangleNode
