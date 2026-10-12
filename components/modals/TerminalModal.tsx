'use client'
import { useEffect, useState, useRef } from 'react'
import { X } from 'lucide-react'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/utils'

type TerminalModalProps = {
  isOpen: boolean
  onClose: () => void
  lines: string[]
  status: 'running' | 'success' | 'error' | 'idle'
  pendingPrompts?: string[]
  onCompleteInputs?: (inputs: string[]) => void
}

const LINE_DELAY_MS = 150

export default function TerminalModal({
  isOpen,
  onClose,
  lines,
  status,
  pendingPrompts = [],
  onCompleteInputs,
}: TerminalModalProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [currentPromptIdx, setCurrentPromptIdx] = useState(0)
  const [currentInputVal, setCurrentInputVal] = useState('')
  const [promptHistory, setPromptHistory] = useState<Array<{ prompt: string; value: string }>>([])
  const [isCollectingInputs, setIsCollectingInputs] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize modal state when opened
  useEffect(() => {
    if (!isOpen) {
      setDisplayedLines([])
      setDone(false)
      setCurrentPromptIdx(0)
      setCurrentInputVal('')
      setPromptHistory([])
      setIsCollectingInputs(false)
      return
    }

    if (pendingPrompts && pendingPrompts.length > 0 && onCompleteInputs) {
      setIsCollectingInputs(true)
      setCurrentPromptIdx(0)
      setCurrentInputVal('')
      setPromptHistory([])
      setDisplayedLines([])
      setDone(false)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    } else {
      setIsCollectingInputs(false)
      setDisplayedLines([])
      setDone(false)
    }
  }, [isOpen, pendingPrompts, onCompleteInputs])

  // Process output lines after input collection is done or when executing directly
  useEffect(() => {
    if (!isOpen || isCollectingInputs) return

    setDisplayedLines([])
    setDone(false)

    const timeouts: ReturnType<typeof setTimeout>[] = []

    lines.forEach((line, i) => {
      const t = setTimeout(() => {
        setDisplayedLines((prev) => [...prev, line])
        if (i === lines.length - 1) {
          setDone(true)
        }
      }, (i + 1) * LINE_DELAY_MS)
      timeouts.push(t)
    })

    return () => timeouts.forEach(clearTimeout)
  }, [isOpen, lines, isCollectingInputs])

  // Fire confetti on success
  useEffect(() => {
    if (done && status === 'success') {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      })
    }
  }, [done, status])

  // Auto-scroll terminal body
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [displayedLines, promptHistory, isCollectingInputs, currentPromptIdx])

  if (!isOpen) return null

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const promptText = pendingPrompts[currentPromptIdx] || ''
    const val = currentInputVal

    const nextHistory = [...promptHistory, { prompt: promptText, value: val }]
    setPromptHistory(nextHistory)
    setCurrentInputVal('')

    if (currentPromptIdx + 1 < pendingPrompts.length) {
      setCurrentPromptIdx((idx) => idx + 1)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 20)
    } else {
      // All inputs collected!
      setIsCollectingInputs(false)
      const allValues = nextHistory.map((h) => h.value)
      onCompleteInputs?.(allValues)
    }
  }

  const lineColorClass = () => {
    if (status === 'success') return 'text-green-400'
    if (status === 'error') return 'text-red-400'
    return 'text-gray-300'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-w-2xl w-full mx-3 sm:mx-4 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden shadow-2xl max-h-[85vh] flex flex-col animate-modal-zoom">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-[11px] sm:text-xs text-gray-400 font-mono tracking-widest">
            python terminal
          </span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 p-1 rounded transition-colors"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Terminal body */}
        <div
          ref={bodyRef}
          onClick={() => {
            if (isCollectingInputs) inputRef.current?.focus()
          }}
          className="min-h-36 sm:min-h-48 max-h-[60vh] sm:max-h-96 overflow-y-auto p-3 sm:p-4 font-mono text-xs sm:text-sm space-y-1.5 cursor-text"
        >
          {/* History of answered input prompts */}
          {promptHistory.map((h, i) => (
            <div key={`hist-${i}`} className="leading-5 text-gray-300 flex items-baseline flex-wrap">
              <span className="text-gray-500 select-none mr-2">$</span>
              {h.prompt && <span className="text-amber-300 mr-2">{h.prompt}</span>}
              <span className="text-green-300 font-semibold">{h.value}</span>
            </div>
          ))}

          {/* Active interactive input prompt */}
          {isCollectingInputs && currentPromptIdx < pendingPrompts.length && (
            <form
              onSubmit={handlePromptSubmit}
              className="flex items-center gap-1.5 leading-5 text-gray-100 bg-gray-800/40 px-2 py-1.5 rounded border border-gray-700/60"
            >
              <span className="text-amber-400 select-none mr-1 font-bold shrink-0">$</span>
              {pendingPrompts[currentPromptIdx] ? (
                <span className="text-amber-300 font-medium shrink-0">
                  {pendingPrompts[currentPromptIdx]}
                </span>
              ) : (
                <span className="text-zinc-400 text-xs shrink-0">&gt;</span>
              )}
              <input
                ref={inputRef}
                type="text"
                value={currentInputVal}
                onChange={(e) => setCurrentInputVal(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-green-400 font-mono text-xs sm:text-sm p-0 m-0 focus:ring-0 placeholder:text-gray-600"
                autoFocus
                placeholder="Escribe el valor y presiona Enter..."
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[11px] font-mono transition shrink-0 cursor-pointer shadow-xs"
              >
                ↵ Intro
              </button>
            </form>
          )}

          {/* Normal execution output lines */}
          {!isCollectingInputs &&
            displayedLines.map((line, i) => (
              <div key={`out-${i}`} className={cn('leading-5', lineColorClass())}>
                <span className="text-gray-500 select-none mr-2">$</span>
                {line}
              </div>
            ))}

          {status === 'running' && !done && !isCollectingInputs && (
            <span className="inline-block text-gray-300 animate-pulse">|</span>
          )}

          {done && status === 'success' && !isCollectingInputs && (
            <div className="mt-2 text-green-400 font-bold text-base">
              ✓ Correcto
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
