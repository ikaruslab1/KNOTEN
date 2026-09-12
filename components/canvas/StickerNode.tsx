'use client'
import { memo } from 'react'
import { NodeProps } from 'reactflow'

export type StickerNodeData = {
  emoji: '✔️' | '❌' | '❔' | '☣️'
}

const StickerNode = memo(({ data }: NodeProps<StickerNodeData>) => {
  return (
    <div
      className="flex items-center justify-center cursor-move select-none"
      style={{ width: 64, height: 64, background: 'transparent' }}
    >
      <span className="text-4xl leading-none">{data.emoji}</span>
    </div>
  )
})

StickerNode.displayName = 'StickerNode'

export default StickerNode
