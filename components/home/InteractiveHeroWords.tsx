'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { RotateCcw, Unlink, Sparkles } from 'lucide-react'

interface WordNode {
  id: string
  text: string
  order: number
}

const WORDS: WordNode[] = [
  { id: 'word-aprende', text: 'Aprende', order: 0 },
  { id: 'word-codigo', text: 'código', order: 1 },
  { id: 'word-mediante', text: 'mediante', order: 2 },
  { id: 'word-nodos', text: 'nodos', order: 3 },
  { id: 'word-logicos', text: 'lógicos', order: 4 },
]

interface Edge {
  id: string
  fromWordId: string
  fromHandle: 'left' | 'right'
  toWordId: string
  toHandle: 'left' | 'right'
}

interface DragWireState {
  fromWordId: string
  fromHandle: 'left' | 'right'
  currentX: number
  currentY: number
}

export default function InteractiveHeroWords() {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const handleRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Node position offsets { [wordId]: { x, y } }
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const initial: Record<string, { x: number; y: number }> = {}
    WORDS.forEach((w) => {
      initial[w.id] = { x: 0, y: 0 }
    })
    return initial
  })

  // Has entrance animation completed
  const [enteredWords, setEnteredWords] = useState<Record<string, boolean>>({})

  // Track bump impact animation on connection
  const [bumpingWords, setBumpingWords] = useState<Record<string, boolean>>({})

  // Z-indices so last moved word is always on top
  const [zIndices, setZIndices] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    WORDS.forEach((w, i) => {
      initial[w.id] = 10 + i
    })
    return initial
  })
  const topZRef = useRef(30)

  // Active dragging word id
  const [activeDragWord, setActiveDragWord] = useState<string | null>(null)

  // Dragging wire state
  const [dragWire, setDragWire] = useState<DragWireState | null>(null)
  const [hoveredHandle, setHoveredHandle] = useState<{ wordId: string; handle: 'left' | 'right' } | null>(null)

  // Connections / Edges (initially empty = disconnected)
  const [edges, setEdges] = useState<Edge[]>([])

  // State to force re-render of SVG paths when nodes move
  const [, setTick] = useState(0)
  const forceUpdate = useCallback(() => setTick((t) => (t + 1) % 100000), [])

  // Check if any word has moved
  const hasMovedAny = Object.values(positions).some((p) => p.x !== 0 || p.y !== 0)
  const hasEdges = edges.length > 0

  // Check if all 5 words are connected in sequence (Aprende -> código -> mediante -> nodos -> lógicos)
  const isSequenceComplete = useCallback(() => {
    for (let i = 0; i < WORDS.length - 1; i++) {
      const current = WORDS[i].id
      const next = WORDS[i + 1].id
      const connected = edges.some(
        (e) =>
          (e.fromWordId === current && e.toWordId === next) ||
          (e.fromWordId === next && e.toWordId === current)
      )
      if (!connected) return false
    }
    return true
  }, [edges])

  // Get handle center coordinates relative to containerRef
  const getHandlePosition = useCallback(
    (wordId: string, handleSide: 'left' | 'right') => {
      const handleEl = handleRefs.current[`${wordId}-${handleSide}`]
      const container = containerRef.current
      if (!handleEl || !container) return { x: 0, y: 0 }
      const handleRect = handleEl.getBoundingClientRect()
      const contRect = container.getBoundingClientRect()
      return {
        x: handleRect.left - contRect.left + handleRect.width / 2,
        y: handleRect.top - contRect.top + handleRect.height / 2,
      }
    },
    []
  )

  // Trigger impact bump animation on a node
  const triggerBump = (wordId: string) => {
    setBumpingWords((prev) => ({ ...prev, [wordId]: true }))
    setTimeout(() => {
      setBumpingWords((prev) => ({ ...prev, [wordId]: false }))
    }, 280)
  }

  // ── Dragging Word Nodes ───────────────────────────────────────────────────
  const startWordDrag = (e: React.PointerEvent, wordId: string) => {
    // Only primary button
    if (e.button !== 0) return

    // Don't initiate word drag if clicking on a handle or button
    const target = e.target as HTMLElement
    if (target.closest('[data-handle]') || target.closest('button')) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    // Mark as entered to prevent CSS entrance animation from resetting transform
    setEnteredWords((prev) => ({ ...prev, [wordId]: true }))

    // Elevate z-index
    topZRef.current += 1
    const newZ = topZRef.current
    setZIndices((prev) => ({ ...prev, [wordId]: newZ }))
    setActiveDragWord(wordId)

    const startPointerX = e.clientX
    const startPointerY = e.clientY
    const startPosX = positions[wordId]?.x || 0
    const startPosY = positions[wordId]?.y || 0

    let currentAnimFrame: number | null = null

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      const deltaX = moveEvent.clientX - startPointerX
      const deltaY = moveEvent.clientY - startPointerY

      if (currentAnimFrame) cancelAnimationFrame(currentAnimFrame)
      currentAnimFrame = requestAnimationFrame(() => {
        setPositions((prev) => ({
          ...prev,
          [wordId]: {
            x: startPosX + deltaX,
            y: startPosY + deltaY,
          },
        }))
      })
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      upEvent.preventDefault()
      if (currentAnimFrame) cancelAnimationFrame(currentAnimFrame)
      setActiveDragWord(null)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      forceUpdate()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  // ── Dragging Wires / Connecting Handles ──────────────────────────────────
  const startWireDrag = (
    e: React.PointerEvent,
    fromWordId: string,
    fromHandle: 'left' | 'right'
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const container = containerRef.current
    if (!container) return
    const contRect = container.getBoundingClientRect()

    const initialX = e.clientX - contRect.left
    const initialY = e.clientY - contRect.top

    setDragWire({
      fromWordId,
      fromHandle,
      currentX: initialX,
      currentY: initialY,
    })

    let currentAnimFrame: number | null = null

    const onWirePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      const currContRect = containerRef.current?.getBoundingClientRect()
      if (!currContRect) return

      const curX = moveEvent.clientX - currContRect.left
      const curY = moveEvent.clientY - currContRect.top

      // Check proximity to any valid target handle
      let foundHover: { wordId: string; handle: 'left' | 'right' } | null = null
      let snapX = curX
      let snapY = curY

      for (const w of WORDS) {
        if (w.id === fromWordId) continue // Can't connect to itself

        for (const side of ['left', 'right'] as const) {
          const pos = getHandlePosition(w.id, side)
          const dist = Math.hypot(curX - pos.x, curY - pos.y)
          if (dist < 32) {
            foundHover = { wordId: w.id, handle: side }
            snapX = pos.x
            snapY = pos.y
            break
          }
        }
        if (foundHover) break
      }

      setHoveredHandle(foundHover)

      if (currentAnimFrame) cancelAnimationFrame(currentAnimFrame)
      currentAnimFrame = requestAnimationFrame(() => {
        setDragWire({
          fromWordId,
          fromHandle,
          currentX: snapX,
          currentY: snapY,
        })
      })
    }

    const onWirePointerUp = (upEvent: PointerEvent) => {
      upEvent.preventDefault()
      if (currentAnimFrame) cancelAnimationFrame(currentAnimFrame)

      const currContRect = containerRef.current?.getBoundingClientRect()
      if (currContRect) {
        const curX = upEvent.clientX - currContRect.left
        const curY = upEvent.clientY - currContRect.top

        // Find if released on another node's handle
        let targetHandleFound: { wordId: string; handle: 'left' | 'right' } | null = null
        for (const w of WORDS) {
          if (w.id === fromWordId) continue

          for (const side of ['left', 'right'] as const) {
            const pos = getHandlePosition(w.id, side)
            const dist = Math.hypot(curX - pos.x, curY - pos.y)
            if (dist < 35) {
              targetHandleFound = { wordId: w.id, handle: side }
              break
            }
          }
          if (targetHandleFound) break
        }

        if (targetHandleFound) {
          const edgeId = `${fromWordId}-${fromHandle}-${targetHandleFound.wordId}-${targetHandleFound.handle}`
          const reverseId = `${targetHandleFound.wordId}-${targetHandleFound.handle}-${fromWordId}-${fromHandle}`

          // Only add if not already connected
          setEdges((prev) => {
            if (prev.some((e) => e.id === edgeId || e.id === reverseId)) {
              return prev
            }
            return [
              ...prev,
              {
                id: edgeId,
                fromWordId,
                fromHandle,
                toWordId: targetHandleFound.wordId,
                toHandle: targetHandleFound.handle,
              },
            ]
          })

          // Trigger bump animations on connection impact!
          triggerBump(fromWordId)
          triggerBump(targetHandleFound.wordId)
        }
      }

      setDragWire(null)
      setHoveredHandle(null)
      window.removeEventListener('pointermove', onWirePointerMove)
      window.removeEventListener('pointerup', onWirePointerUp)
      window.removeEventListener('pointercancel', onWirePointerUp)
      forceUpdate()
    }

    window.addEventListener('pointermove', onWirePointerMove, { passive: false })
    window.addEventListener('pointerup', onWirePointerUp)
    window.addEventListener('pointercancel', onWirePointerUp)
  }

  // Remove edge
  const removeEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId))
  }

  // State to animate words back on reset
  const [isResetting, setIsResetting] = useState(false)

  // Reset positions back to original reading layout with smooth magnet transition
  const resetPositions = () => {
    setIsResetting(true)
    setPositions(() => {
      const reset: Record<string, { x: number; y: number }> = {}
      WORDS.forEach((w) => {
        reset[w.id] = { x: 0, y: 0 }
      })
      return reset
    })
    setTimeout(() => {
      setIsResetting(false)
      forceUpdate()
    }, 450)
  }

  // Disconnect all edges
  const disconnectAll = () => {
    setEdges([])
  }

  // Keep wires synchronized with window resize & scroll
  useEffect(() => {
    const handleResizeOrScroll = () => {
      forceUpdate()
    }
    window.addEventListener('resize', handleResizeOrScroll)
    window.addEventListener('scroll', handleResizeOrScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', handleResizeOrScroll)
      window.removeEventListener('scroll', handleResizeOrScroll)
    }
  }, [forceUpdate])

  const complete = isSequenceComplete()

  return (
    <div
      ref={containerRef}
      className="relative w-full py-4 sm:py-6 overflow-visible select-none"
    >
      {/* ── Background SVG Connection Lines ─────────────────────────────────── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="edgeSuccessGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <filter id="wireGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* Existing Connected Edges */}
        {edges.map((edge) => {
          const fromPos = getHandlePosition(edge.fromWordId, edge.fromHandle)
          const toPos = getHandlePosition(edge.toWordId, edge.toHandle)

          const dx = toPos.x - fromPos.x
          const dy = toPos.y - fromPos.y
          const dist = Math.hypot(dx, dy)

          // Elastic sag & curvature
          const sag = Math.min(36, Math.max(10, dist * 0.09))
          const curvature = Math.max(28, Math.min(130, Math.abs(dx) * 0.48))

          const c1x = edge.fromHandle === 'left' ? fromPos.x - curvature : fromPos.x + curvature
          const c1y = fromPos.y + sag * 0.65
          const c2x = edge.toHandle === 'left' ? toPos.x - curvature : toPos.x + curvature
          const c2y = toPos.y + sag * 0.65

          const pathD = `M ${fromPos.x} ${fromPos.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toPos.x} ${toPos.y}`

          const strokeColor = complete ? '#10b981' : '#27272a'

          return (
            <g key={edge.id} className="group">
              {/* Thick transparent hit stroke for hover */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="18"
                className="cursor-pointer pointer-events-auto"
                onClick={() => removeEdge(edge.id)}
              />
              {/* Outer shadow / glow */}
              <path
                d={pathD}
                fill="none"
                stroke="#000000"
                strokeWidth="4"
                strokeOpacity="0.08"
                strokeLinecap="round"
              />
              {/* Main rubber cable path */}
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={complete ? '3.25' : '2.75'}
                strokeLinecap="round"
                className="transition-colors duration-300"
                filter="url(#wireGlow)"
              />
              {/* Terminal rings */}
              <circle cx={fromPos.x} cy={fromPos.y} r="3.5" fill={strokeColor} />
              <circle cx={toPos.x} cy={toPos.y} r="3.5" fill={strokeColor} />
            </g>
          )
        })}

        {/* In-progress Dragging Wire */}
        {dragWire && (
          (() => {
            const fromPos = getHandlePosition(dragWire.fromWordId, dragWire.fromHandle)
            const toX = dragWire.currentX
            const toY = dragWire.currentY

            const dx = toX - fromPos.x
            const dy = toY - fromPos.y
            const dist = Math.hypot(dx, dy)
            const sag = Math.min(40, Math.max(12, dist * 0.12))
            const curvature = Math.max(25, Math.min(100, Math.abs(dx) * 0.45))

            const c1x = dragWire.fromHandle === 'left' ? fromPos.x - curvature : fromPos.x + curvature
            const c1y = fromPos.y + sag * 0.6
            const c2x = toX - curvature * 0.4
            const c2y = toY + sag * 0.6

            const wirePath = `M ${fromPos.x} ${fromPos.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toX} ${toY}`

            return (
              <g className="pointer-events-none">
                <path
                  d={wirePath}
                  fill="none"
                  stroke="#18181b"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeDasharray="6 4"
                  className="animate-pulse"
                />
                <circle
                  cx={toX}
                  cy={toY}
                  r="5.5"
                  fill="#18181b"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="animate-pulse"
                />
              </g>
            )
          })()
        )}
      </svg>

      {/* ── Disconnect Buttons Overlay for Active Edges ─────────────────────── */}
      {edges.map((edge) => {
        const fromPos = getHandlePosition(edge.fromWordId, edge.fromHandle)
        const toPos = getHandlePosition(edge.toWordId, edge.toHandle)

        const dx = toPos.x - fromPos.x
        const curvature = Math.max(28, Math.min(130, Math.abs(dx) * 0.48))
        const sag = Math.min(36, Math.max(10, Math.hypot(dx, toPos.y - fromPos.y) * 0.09))

        const c1x = edge.fromHandle === 'left' ? fromPos.x - curvature : fromPos.x + curvature
        const c1y = fromPos.y + sag * 0.65
        const c2x = edge.toHandle === 'left' ? toPos.x - curvature : toPos.x + curvature
        const c2y = toPos.y + sag * 0.65

        // Center on cubic bezier
        const midX = (fromPos.x + 3 * c1x + 3 * c2x + toPos.x) / 8
        const midY = (fromPos.y + 3 * c1y + 3 * c2y + toPos.y) / 8

        return (
          <div
            key={`btn-${edge.id}`}
            style={{
              position: 'absolute',
              left: `${midX}px`,
              top: `${midY}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 35,
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeEdge(edge.id)
              }}
              title="Desconectar"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white border border-zinc-300 shadow-md text-zinc-500 hover:text-white hover:bg-red-500 hover:border-red-600 hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-xs font-bold leading-none select-none">×</span>
            </button>
          </div>
        )
      })}

      {/* ── Heading Container with 5 Word Nodes in Reading Order ────────────── */}
      <h1
        aria-label="Aprende código mediante nodos lógicos"
        className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-8 md:gap-x-10 gap-y-4 sm:gap-y-6 max-w-4xl mx-auto overflow-visible"
      >
        {WORDS.map((word) => {
          const pos = positions[word.id] || { x: 0, y: 0 }
          const isDragging = activeDragWord === word.id
          const hasEntered = enteredWords[word.id]
          const isBumping = bumpingWords[word.id]
          const zIndex = zIndices[word.id] || 10

          // Check if left/right handle is currently highlighted as target
          const isLeftHovered =
            hoveredHandle?.wordId === word.id && hoveredHandle.handle === 'left'
          const isRightHovered =
            hoveredHandle?.wordId === word.id && hoveredHandle.handle === 'right'

          // Staggered delay for zoom-in entrance
          const entranceDelay = `${word.order * 0.08}s`

          return (
            <div
              key={word.id}
              ref={(el) => {
                nodeRefs.current[word.id] = el
              }}
              onPointerDown={(e) => startWordDrag(e, word.id)}
              onAnimationEnd={(e) => {
                if (e.animationName.includes('cartoonBounceIn')) {
                  setEnteredWords((prev) => ({ ...prev, [word.id]: true }))
                }
              }}
              style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                zIndex,
                animationDelay: !hasEntered ? entranceDelay : undefined,
                touchAction: 'none',
              }}
              className={`
                group relative inline-flex items-center justify-center
                px-4 py-2 sm:px-6 sm:py-3
                rounded-2xl border-2 bg-white
                select-none cursor-grab active:cursor-grabbing
                transition-[box-shadow,border-color] duration-150
                ${isResetting ? 'transition-transform duration-400 cubic-bezier(0.34, 1.56, 0.64, 1)' : ''}
                ${
                  !hasEntered
                    ? 'animate-cartoon-in'
                    : ''
                }
                ${isBumping ? 'animate-block-bump' : ''}
                ${
                  isDragging
                    ? 'scale-105 shadow-2xl ring-2 ring-zinc-900 ring-offset-2 border-zinc-900 z-50'
                    : 'border-zinc-200 hover:border-zinc-400 shadow-md hover:shadow-xl'
                }
              `}
            >
              {/* ── Left Port (Target Handle) ─────────────────────────────────── */}
              <div
                data-handle="left"
                ref={(el) => {
                  handleRefs.current[`${word.id}-left`] = el
                }}
                onPointerDown={(e) => startWireDrag(e, word.id, 'left')}
                title="Conector izquierdo (arrastra para conectar)"
                className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 cursor-crosshair"
                style={{ touchAction: 'none' }}
              >
                {/* Expanded touch target hit area */}
                <span className="absolute -inset-2.5 rounded-full" />

                {/* Visible handle circle */}
                <span
                  className={`
                    block w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white shadow-md
                    transition-all duration-150
                    ${
                      isLeftHovered
                        ? 'bg-emerald-500 scale-125 ring-4 ring-emerald-300'
                        : 'bg-zinc-600 hover:bg-zinc-950 hover:scale-125'
                    }
                  `}
                />
              </div>

              {/* ── Word Content ────────────────────────────────────────────── */}
              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-zinc-900 tracking-tight leading-none pointer-events-none">
                {word.text}
              </span>

              {/* ── Right Port (Source Handle) ────────────────────────────────── */}
              <div
                data-handle="right"
                ref={(el) => {
                  handleRefs.current[`${word.id}-right`] = el
                }}
                onPointerDown={(e) => startWireDrag(e, word.id, 'right')}
                title="Conector derecho (arrastra para conectar)"
                className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 z-30 cursor-crosshair"
                style={{ touchAction: 'none' }}
              >
                {/* Expanded touch target hit area */}
                <span className="absolute -inset-2.5 rounded-full" />

                {/* Visible handle circle */}
                <span
                  className={`
                    block w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white shadow-md
                    transition-all duration-150
                    ${
                      isRightHovered
                        ? 'bg-emerald-500 scale-125 ring-4 ring-emerald-300'
                        : 'bg-zinc-600 hover:bg-zinc-950 hover:scale-125'
                    }
                  `}
                />
              </div>
            </div>
          )
        })}
      </h1>

      {/* ── Interactive Hint & Reset Controls ───────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-xs text-zinc-500">
        {complete ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold animate-in fade-in zoom-in-95 duration-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            ¡Secuencia de nodos conectada con éxito!
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100/90 border border-zinc-200 text-zinc-600 font-medium">
            💡 Puedes arrastrar las palabras por toda la pantalla y conectar sus puertos
          </span>
        )}

        {/* Reset Positions button (visible if user has moved any word) */}
        {hasMovedAny && (
          <button
            type="button"
            onClick={resetPositions}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 shadow-xs font-semibold cursor-pointer transition-all animate-in fade-in zoom-in-95"
            title="Volver las palabras a su posición original"
          >
            <RotateCcw className="w-3 h-3" />
            Restablecer orden
          </button>
        )}

        {/* Disconnect all edges button (visible if edges exist) */}
        {hasEdges && (
          <button
            type="button"
            onClick={disconnectAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-zinc-300 text-zinc-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300 shadow-xs font-semibold cursor-pointer transition-all animate-in fade-in zoom-in-95"
            title="Desconectar todos los enlaces"
          >
            <Unlink className="w-3 h-3" />
            Desconectar todo
          </button>
        )}
      </div>
    </div>
  )
}
