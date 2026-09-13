'use client'
import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { cn } from '@/lib/utils'

export type CodeBlockData = {
  code: string
  state: 'idle' | 'connected' | 'correct' | 'error'
  readOnly?: boolean
  bump?: number
  isExiting?: boolean
  entranceDelay?: number
}

const borderByState: Record<CodeBlockData['state'], string> = {
  idle: 'border-zinc-300',
  connected: 'border-zinc-800 shadow-sm',
  correct: 'border-green-500',
  error: 'border-red-500',
}

const CodeBlock = memo(({ data, selected }: NodeProps<CodeBlockData>) => {
  const { code, state, bump, isExiting, entranceDelay = 0 } = data

  return (
    <div
      key={bump} // Re-triggers bump animation on change
      style={{
        animationDelay: `${entranceDelay}s`,
      }}
      className={cn(
        'relative rounded-lg border shadow-sm bg-white min-w-[56px] max-w-[400px] transition-all duration-200 select-none cursor-grab active:cursor-grabbing',
        borderByState[state],
        // Cartoon entrance / exit animations
        isExiting ? 'animate-cartoon-out' : 'animate-cartoon-in',
        // Block bump on connection impact
        bump && 'animate-block-bump',
        // User selection smooth zoom growth
        selected
          ? 'scale-108 shadow-2xl ring-2 ring-zinc-900 ring-offset-2 z-30'
          : 'hover:scale-[1.02]'
      )}
    >
      {/* Error flash overlay */}
      {state === 'error' && (
        <span
          className="pointer-events-none absolute inset-0 rounded-lg bg-red-500/20 animate-ping-once"
          aria-hidden
        />
      )}

      {/* Left (target) handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />

      {/* Content */}
      <div className="px-3.5 py-2.5 sm:px-3 sm:py-2 flex items-center justify-center">
        <pre className="text-sm font-mono text-zinc-900 whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>

      {/* Right (source) handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    </div>
  )
})

CodeBlock.displayName = 'CodeBlock'

export default CodeBlock
