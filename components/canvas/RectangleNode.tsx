'use client'

import { memo, useState } from 'react'
import { NodeProps, useReactFlow, NodeResizer } from 'reactflow'
import { Trash2, X } from 'lucide-react'
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

  const showControls = (selected || isHovered) && !data?.readOnly
  const isRainbow = Boolean(data?.isRainbow)
  const activeBorder = data?.activeBorderColor
  const activeBg = data?.activeBgColor

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full h-full select-none group"
      style={{ minWidth: 60, minHeight: 40 }}
    >
      {/* NodeResizer for resizing from aristas (lines) and corners */}
      <NodeResizer
        isVisible={selected && !data?.readOnly}
        minWidth={60}
        minHeight={40}
        lineClassName="!border-zinc-500/80 !border-dashed"
        handleClassName="!w-3 !h-3 !bg-white !border-2 !border-zinc-700 !rounded-xs !shadow-md hover:!scale-125 transition-transform"
      />

      {/* Floating delete button badge */}
      {showControls && (
        <div className="absolute -top-10 right-0 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl shadow-lg px-2.5 py-1 z-50 nodrag nopan animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-red-600 transition-colors cursor-pointer"
            title="Eliminar figura"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Eliminar</span>
          </button>
        </div>
      )}

      {/* Corner delete button badge */}
      {showControls && (
        <button
          type="button"
          onClick={handleDelete}
          className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-zinc-900 text-white hover:bg-red-600 hover:scale-110 flex items-center justify-center shadow-md transition-all nodrag nopan z-50 cursor-pointer"
          title="Eliminar figura"
        >
          <X className="w-3.5 h-3.5" />
        </button>
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
