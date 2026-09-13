'use client'
import { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow'
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

const CodeBlock = memo(({ id, data, selected }: NodeProps<CodeBlockData>) => {
  const { code, state, bump, isExiting, entranceDelay = 0 } = data
  const updateNodeInternals = useUpdateNodeInternals()
  const [isBumping, setIsBumping] = useState(false)
  const prevBumpRef = useRef(bump)

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

  // Keep handle bounds accurately synchronized with ReactFlow
  useEffect(() => {
    updateNodeInternals(id)
    const t1 = setTimeout(() => updateNodeInternals(id), 60)
    const t2 = setTimeout(() => updateNodeInternals(id), 600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [id, code, updateNodeInternals])

  const handleAnimationEnd = () => {
    updateNodeInternals(id)
  }

  return (
    <div
      onAnimationEnd={handleAnimationEnd}
      style={{
        animationDelay: isBumping ? '0s' : `${entranceDelay}s`,
      }}
      className={cn(
        'relative rounded-lg border shadow-sm bg-white min-w-[56px] w-fit max-w-none transition-all duration-200 select-none cursor-grab active:cursor-grabbing',
        borderByState[state],
        // Cartoon entrance / exit animations
        isExiting ? 'animate-cartoon-out' : 'animate-cartoon-in',
        // Immediate block bump on connection impact
        isBumping && 'animate-block-bump',
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

      {/* Left (target) handle on the left arista */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />

      {/* Content - ample horizontal padding (px-5) to never overlap arista handles */}
      <div className="px-5 py-2.5 sm:px-4 sm:py-2 flex items-center justify-center">
        <pre className="text-sm font-mono text-zinc-900 whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>

      {/* Right (source) handle on the right arista */}
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
