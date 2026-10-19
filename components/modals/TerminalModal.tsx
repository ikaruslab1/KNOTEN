'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { X, GitBranch, RotateCcw, CheckCircle2, XCircle, CornerDownRight, Play } from 'lucide-react'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/utils'
import { probeNextInput, type ControlFlowStep } from '@/lib/python-evaluator-js'

type TerminalModalProps = {
  isOpen: boolean
  onClose: () => void
  lines: string[]
  status: 'running' | 'success' | 'error' | 'idle'
  pendingPrompts?: string[]
  onCompleteInputs?: (inputs: string[]) => void
  studentCode?: string
  flowTrace?: ControlFlowStep[]
  variableState?: Record<string, string>
}

const LINE_DELAY_MS = 120

function inferDisplayType(rawVal: string): { label: string; colorClass: string } {
  const v = rawVal.trim()
  if (v === 'true' || v === 'false' || v === 'True' || v === 'False') {
    return { label: 'bool', colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
  }
  if (v === 'null' || v === 'None') {
    return { label: 'NoneType', colorClass: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40' }
  }
  if (/^[+-]?\d+\.\d*$/.test(v)) {
    return { label: 'float', colorClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' }
  }
  if (/^[+-]?\d+$/.test(v)) {
    return { label: 'int', colorClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40' }
  }
  if (v.startsWith('[') && v.endsWith(']')) {
    return { label: 'list', colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
  }
  if (v.startsWith('{') && v.endsWith('}')) {
    return { label: 'dict', colorClass: 'bg-pink-500/20 text-pink-300 border-pink-500/40' }
  }
  return { label: 'str', colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
}

function formatPyDisplayVal(rawVal: string): string {
  const v = rawVal.trim()
  if (v === 'true') return 'True'
  if (v === 'false') return 'False'
  if (v === 'null') return 'None'
  return v
}

export default function TerminalModal({
  isOpen,
  onClose,
  lines,
  status,
  pendingPrompts = [],
  onCompleteInputs,
  studentCode,
  flowTrace = [],
  variableState = {},
}: TerminalModalProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [currentPromptIdx, setCurrentPromptIdx] = useState(0)
  const [activePromptText, setActivePromptText] = useState('')
  const [currentInputVal, setCurrentInputVal] = useState('')
  const [promptHistory, setPromptHistory] = useState<Array<{ prompt: string; value: string }>>([])
  const [isCollectingInputs, setIsCollectingInputs] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasConditionalFlow = useMemo(
    () => flowTrace.some((step) => step.kind === 'if' || step.kind === 'elif' || step.kind === 'else'),
    [flowTrace]
  )

  const hasInputs = useMemo(
    () =>
      (pendingPrompts && pendingPrompts.length > 0) ||
      promptHistory.length > 0 ||
      Boolean(studentCode && /\binput\s*\(/.test(studentCode)),
    [pendingPrompts, promptHistory.length, studentCode]
  )

  // Initialize modal state when opened
  useEffect(() => {
    if (!isOpen) {
      setDisplayedLines([])
      setDone(false)
      setCurrentPromptIdx(0)
      setActivePromptText('')
      setCurrentInputVal('')
      setPromptHistory([])
      setIsCollectingInputs(false)
      return
    }

    if (onCompleteInputs && studentCode && /\binput\s*\(/.test(studentCode)) {
      const probe = probeNextInput(studentCode, [])
      if (probe.status === 'need_input') {
        setIsCollectingInputs(true)
        setCurrentPromptIdx(0)
        setActivePromptText(probe.prompt || pendingPrompts[0] || '')
        setCurrentInputVal('')
        setPromptHistory([])
        setDisplayedLines([])
        setDone(false)
        setTimeout(() => {
          inputRef.current?.focus()
        }, 50)
        return
      }
    }

    if (pendingPrompts && pendingPrompts.length > 0 && onCompleteInputs) {
      setIsCollectingInputs(true)
      setCurrentPromptIdx(0)
      setActivePromptText(pendingPrompts[0] || '')
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
  }, [isOpen, pendingPrompts, onCompleteInputs, studentCode])

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

    if (lines.length === 0) {
      setDone(true)
    }

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
  }, [displayedLines, promptHistory, isCollectingInputs, currentPromptIdx, done])

  if (!isOpen) return null

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = currentInputVal
    const nextHistory = [...promptHistory, { prompt: activePromptText, value: val }]
    setPromptHistory(nextHistory)
    setCurrentInputVal('')
    const collectedValues = nextHistory.map((h) => h.value)

    // Dynamically probe if the taken control-flow path needs another input()
    if (studentCode && /\binput\s*\(/.test(studentCode)) {
      const probe = probeNextInput(studentCode, collectedValues)
      if (probe.status === 'need_input') {
        setCurrentPromptIdx(collectedValues.length)
        setActivePromptText(probe.prompt || pendingPrompts[collectedValues.length] || '')
        setTimeout(() => {
          inputRef.current?.focus()
        }, 20)
        return
      } else {
        setIsCollectingInputs(false)
        onCompleteInputs?.(collectedValues)
        return
      }
    }

    if (currentPromptIdx + 1 < pendingPrompts.length) {
      const nextIdx = currentPromptIdx + 1
      setCurrentPromptIdx(nextIdx)
      setActivePromptText(pendingPrompts[nextIdx] || '')
      setTimeout(() => {
        inputRef.current?.focus()
      }, 20)
    } else {
      setIsCollectingInputs(false)
      onCompleteInputs?.(collectedValues)
    }
  }

  const handleRetryInputs = () => {
    setDisplayedLines([])
    setDone(false)
    setPromptHistory([])
    setCurrentInputVal('')
    setCurrentPromptIdx(0)
    if (studentCode && /\binput\s*\(/.test(studentCode)) {
      const probe = probeNextInput(studentCode, [])
      if (probe.status === 'need_input') {
        setActivePromptText(probe.prompt || pendingPrompts[0] || '')
        setIsCollectingInputs(true)
        setTimeout(() => inputRef.current?.focus(), 40)
        return
      }
    }
    setActivePromptText(pendingPrompts[0] || '')
    setIsCollectingInputs(true)
    setTimeout(() => inputRef.current?.focus(), 40)
  }

  const lineColorClass = () => {
    if (status === 'success') return 'text-green-400'
    if (status === 'error') return 'text-red-400'
    return 'text-gray-300'
  }

  const varEntries = Object.entries(variableState)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs animate-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="max-w-2xl w-full mx-3 sm:mx-4 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden shadow-2xl max-h-[88vh] flex flex-col animate-modal-zoom">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] sm:text-xs text-gray-400 font-mono tracking-widest">
              python terminal
            </span>
            {hasConditionalFlow && !isCollectingInputs && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-mono">
                <GitBranch className="w-3 h-3" />
                Control de Flujo
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {hasInputs && !isCollectingInputs && onCompleteInputs && (
              <button
                type="button"
                onClick={handleRetryInputs}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 text-[11px] font-mono transition cursor-pointer"
                title="Ingresar otros valores en input() para probar otras ramas if / elif / else"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Probar otra entrada</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-200 p-1 rounded transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Terminal body */}
        <div
          ref={bodyRef}
          onClick={() => {
            if (isCollectingInputs) inputRef.current?.focus()
          }}
          className="min-h-36 sm:min-h-48 max-h-[72vh] overflow-y-auto p-3 sm:p-4 font-mono text-xs sm:text-sm space-y-2 cursor-text"
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
          {isCollectingInputs && (
            <form
              onSubmit={handlePromptSubmit}
              className="flex items-center gap-1.5 leading-5 text-gray-100 bg-gray-800/60 px-2.5 py-2 rounded-lg border border-amber-500/40 shadow-inner"
            >
              <span className="text-amber-400 select-none mr-1 font-bold shrink-0">input()</span>
              {activePromptText ? (
                <span className="text-amber-300 font-medium shrink-0">{activePromptText}</span>
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
                placeholder="Escribe el valor de entrada y presiona Enter..."
              />
              <button
                type="submit"
                className="px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[11px] font-mono transition shrink-0 cursor-pointer shadow-xs"
              >
                ↵ Intro
              </button>
            </form>
          )}

          {/* Normal execution output lines */}
          {!isCollectingInputs &&
            displayedLines.map((line, i) => (
              <div key={`out-${i}`} className={cn('leading-5 whitespace-pre-wrap', lineColorClass())}>
                <span className="text-gray-500 select-none mr-2">$</span>
                {line}
              </div>
            ))}

          {status === 'running' && !done && !isCollectingInputs && (
            <span className="inline-block text-gray-300 animate-pulse">|</span>
          )}

          {done && status === 'success' && !isCollectingInputs && (
            <div className="mt-2 text-green-400 font-bold text-sm sm:text-base flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>¡Correcto! Ejecución verificada</span>
            </div>
          )}

          {/* Variable memory state inspector (primitive types & casted values) */}
          {done && !isCollectingInputs && varEntries.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5 font-semibold">
                Variables en memoria (Tipos de datos)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {varEntries.map(([k, v]) => {
                  const typeMeta = inferDisplayType(v)
                  return (
                    <div
                      key={k}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-800/90 border border-gray-700 text-xs"
                    >
                      <span className="text-sky-300 font-semibold">{k}</span>
                      <span className="text-gray-500">=</span>
                      <span className="text-gray-100">{formatPyDisplayVal(v)}</span>
                      <span
                        className={cn(
                          'px-1.5 py-0.2 rounded border text-[9px] font-bold',
                          typeMeta.colorClass
                        )}
                      >
                        {typeMeta.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Visual Control Flow Trace (`if`, `elif`, `else` & nested conditionals) */}
          {done && !isCollectingInputs && hasConditionalFlow && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-indigo-300 font-semibold">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Recorrido del Control de Flujo (if / elif / else)</span>
                </div>
                <span className="text-[10px] text-gray-500">
                  Verde = ejecutado · Ámbar = condición False · Gris = rama omitida
                </span>
              </div>

              <div className="space-y-1 bg-gray-950/70 rounded-lg p-2.5 border border-gray-800">
                {flowTrace.map((step, idx) => {
                  const isBranchHeader =
                    step.kind === 'if' || step.kind === 'elif' || step.kind === 'else'
                  const indentPx = step.indentLevel * 18

                  let badge: React.ReactNode = null
                  let rowStyle = 'border-gray-800 bg-gray-900/50 text-gray-400'

                  if (isBranchHeader) {
                    if (step.branchTaken) {
                      rowStyle = 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                      badge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          {step.kind === 'else' ? 'Else activo → Entra' : 'True → Entra al bloque'}
                        </span>
                      )
                    } else if (step.executed) {
                      rowStyle = 'border-amber-500/40 bg-amber-950/25 text-amber-200'
                      badge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-semibold shrink-0">
                          <XCircle className="w-3 h-3" />
                          False → Salta rama
                        </span>
                      )
                    } else {
                      rowStyle = 'border-gray-800 bg-gray-900/30 text-gray-500 opacity-65'
                      badge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] shrink-0">
                          ↷ Rama omitida
                        </span>
                      )
                    }
                  } else {
                    if (step.executed) {
                      rowStyle = 'border-emerald-500/30 bg-emerald-950/20 text-gray-200'
                      badge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] shrink-0">
                          <Play className="w-2.5 h-2.5 fill-current" />
                          Ejecutado
                        </span>
                      )
                    } else {
                      rowStyle = 'border-gray-800/70 bg-gray-900/20 text-gray-500 opacity-55'
                      badge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-500 text-[10px] shrink-0">
                          ↷ Omitido
                        </span>
                      )
                    }
                  }

                  return (
                    <div
                      key={`${step.lineNumber}-${idx}`}
                      style={{ marginLeft: `${indentPx}px` }}
                      className={cn(
                        'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-all',
                        rowStyle
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-gray-500 shrink-0 font-mono">
                          L{step.lineNumber}
                        </span>
                        {step.indentLevel > 0 && (
                          <CornerDownRight className="w-3 h-3 text-indigo-400 shrink-0" />
                        )}
                        <code className="truncate font-mono">{step.code}</code>
                      </div>
                      {badge}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
