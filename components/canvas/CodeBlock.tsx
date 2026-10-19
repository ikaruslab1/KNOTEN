'use client'
import { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow'
import { cn } from '@/lib/utils'
import { PythonCodeHighlight } from '@/lib/python-syntax'

export type FlowBadgeData = {
  label: string
  tone: 'true' | 'false' | 'else' | 'executed' | 'skipped'
}

export type CodeBlockData = {
  code: string
  state: 'idle' | 'connected' | 'correct' | 'success' | 'error' | 'skipped'
  flowBadge?: FlowBadgeData | null
  readOnly?: boolean
  bump?: number
  isExiting?: boolean
  entranceDelay?: number
}

const borderByState: Record<CodeBlockData['state'], string> = {
  idle: 'border-zinc-300',
  connected: 'border-zinc-800 shadow-sm',
  correct: 'border-green-500 ring-1 ring-green-500/30',
  success: 'border-green-500 ring-1 ring-green-500/30',
  error: 'border-red-500',
  skipped: 'border-dashed border-zinc-300 opacity-60 bg-zinc-50/90',
}

const badgeStyleByTone: Record<FlowBadgeData['tone'], string> = {
  true: 'bg-emerald-600 text-white border-emerald-700',
  false: 'bg-amber-500 text-white border-amber-600',
  else: 'bg-emerald-600 text-white border-emerald-700',
  executed: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  skipped: 'bg-zinc-200 text-zinc-600 border-zinc-300',
}

const CodeBlock = memo(({ id, data, selected }: NodeProps<CodeBlockData>) => {
  const { code, state = 'idle', flowBadge, bump, isExiting, entranceDelay = 0 } = data
  const updateNodeInternals = useUpdateNodeInternals()
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

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName.includes('cartoonBounceIn')) {
      setHasEntered(true)
    }
    updateNodeInternals(id)
  }

  return (
    <div
      onAnimationEnd={handleAnimationEnd}
      onContextMenu={(e) => {
        e.preventDefault()
      }}
      style={{
        animationDelay: isBumping ? '0s' : `${entranceDelay}s`,
      }}
      className={cn(
        'relative rounded-lg border shadow-sm bg-white min-w-[56px] w-fit max-w-none transition-all duration-200 select-none cursor-grab active:cursor-grabbing',
        borderByState[state] ?? borderByState.idle,
        // Cartoon entrance (runs strictly once on initial entrance) / exit animations
        isExiting
          ? 'animate-cartoon-out'
          : !hasEntered
          ? 'animate-cartoon-in'
          : '',
        // Immediate block bump on connection impact
        isBumping && 'animate-block-bump',
        // User selection smooth zoom growth
        selected
          ? 'scale-108 shadow-2xl ring-2 ring-zinc-900 ring-offset-2 z-30'
          : 'hover:scale-[1.02]'
      )}
    >
      {/* Control-flow evaluation badge (e.g. ✓ True, ✗ False, ✓ Else, ↷ Omitido) */}
      {flowBadge && (
        <span
          className={cn(
            'pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full border text-[9px] font-mono font-bold tracking-tight whitespace-nowrap shadow-xs z-20',
            badgeStyleByTone[flowBadge.tone]
          )}
        >
          {flowBadge.label}
        </span>
      )}

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
      <div className="px-5 py-2.5 sm:px-4 sm:py-2 flex items-center justify-center min-h-[38px]">
        <pre className="text-sm font-mono whitespace-pre leading-relaxed select-none">
          <code>
            <PythonCodeHighlight code={code} />
            {!code && <span className="opacity-0 select-none">&nbsp;</span>}
          </code>
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
