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
}

const LINE_DELAY_MS = 150

export default function TerminalModal({
  isOpen,
  onClose,
  lines,
  status,
}: TerminalModalProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setDisplayedLines([])
      setDone(false)
      return
    }

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
  }, [isOpen, lines])

  useEffect(() => {
    if (done && status === 'success') {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      })
    }
  }, [done, status])

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [displayedLines])

  if (!isOpen) return null

  const lineColorClass = () => {
    if (status === 'success') return 'text-green-400'
    if (status === 'error') return 'text-red-400'
    return 'text-gray-300'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-w-2xl w-full mx-3 sm:mx-4 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden shadow-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
          className="min-h-36 sm:min-h-48 max-h-[60vh] sm:max-h-96 overflow-y-auto p-3 sm:p-4 font-mono text-xs sm:text-sm space-y-0.5"
        >
          {displayedLines.map((line, i) => (
            <div key={i} className={cn('leading-5', lineColorClass())}>
              <span className="text-gray-500 select-none mr-2">$</span>
              {line}
            </div>
          ))}

          {status === 'running' && !done && (
            <span className="inline-block text-gray-300 animate-pulse">|</span>
          )}

          {done && status === 'success' && (
            <div className="mt-2 text-green-400 font-bold text-base">
              ✓ Correcto
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
