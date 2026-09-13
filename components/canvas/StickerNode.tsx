'use client'
import { memo, useState } from 'react'
import { NodeProps, useReactFlow } from 'reactflow'
import { Minus, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StickerNodeData = {
  emoji: string
  scale?: number
  onDelete?: (id: string) => void
  readOnly?: boolean
}

const StickerNode = memo(({ id, data, selected }: NodeProps<StickerNodeData>) => {
  const { setNodes } = useReactFlow()
  const [scale, setScale] = useState<number>(data?.scale ?? 1)
  const [isHovered, setIsHovered] = useState(false)

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data?.onDelete) {
      data.onDelete(id)
    }
    setNodes((nodes) => nodes.filter((n) => n.id !== id))
  }

  const handleScaleChange = (newScale: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const clamped = Math.min(2.5, Math.max(0.5, Math.round(newScale * 100) / 100))
    setScale(clamped)
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, scale: clamped } } : n))
    )
  }

  const showControls = (selected || isHovered) && !data?.readOnly
  const baseSize = 64
  const currentSize = Math.round(baseSize * scale)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative flex items-center justify-center cursor-move select-none group',
        (data as any)?.isExiting ? 'animate-cartoon-out' : 'animate-cartoon-in'
      )}
      style={{
        width: currentSize,
        height: currentSize,
        animationDelay: `${(data as any)?.entranceDelay ?? 0}s`,
      }}
    >
      {/* Floating Toolbar for Scaling and Delete */}
      {showControls && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/95 backdrop-blur-xs border border-zinc-200 rounded-xl shadow-lg px-2 py-1 z-50 nodrag nopan animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={(e) => handleScaleChange(scale - 0.25, e)}
            disabled={scale <= 0.5}
            className="w-5 h-5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Reducir tamaño"
          >
            <Minus className="w-3 h-3" />
          </button>

          <span className="text-[10px] font-mono text-zinc-500 font-semibold px-1 select-none min-w-[34px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={(e) => handleScaleChange(scale + 0.25, e)}
            disabled={scale >= 2.5}
            className="w-5 h-5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Aumentar tamaño"
          >
            <Plus className="w-3 h-3" />
          </button>

          <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />

          <button
            type="button"
            onClick={handleDelete}
            className="w-5 h-5 rounded-md text-zinc-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition"
            title="Eliminar sticker"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Direct Delete badge on corner */}
      {showControls && (
        <button
          type="button"
          onClick={handleDelete}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-zinc-900 text-white hover:bg-red-600 flex items-center justify-center shadow-md transition-colors nodrag nopan z-40"
          title="Eliminar sticker"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Emoji Content */}
      <span
        className="leading-none transition-all duration-100"
        style={{
          fontSize: `${Math.round(38 * scale)}px`,
        }}
      >
        {data.emoji}
      </span>
    </div>
  )
})

StickerNode.displayName = 'StickerNode'

export default StickerNode
