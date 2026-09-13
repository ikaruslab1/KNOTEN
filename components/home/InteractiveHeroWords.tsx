'use client'

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react'
import { RotateCcw, Unlink, Sparkles } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  // Physics: damped oscillation per SpringEdge
  oscillation: number
  oscAmplitude: number
  oscStartTime: number
  lastOscTime: number
}

// ─── Physics helpers (mirrors SpringEdge logic exactly) ───────────────────────

function springPath(
  fromX: number, fromY: number,
  toX: number, toY: number,
  oscillation: number,
  fromSide: 'left' | 'right',
  toSide: 'left' | 'right'
): string {
  const dx = toX - fromX
  const dist = Math.sqrt(dx * dx + (toY - fromY) ** 2)
  const sagBase = Math.min(42, Math.max(10, dist * 0.11))
  const totalSag = sagBase + oscillation
  const curvature = Math.max(28, Math.min(110, Math.abs(dx) * 0.48))
  const c1x = fromSide === 'left' ? fromX - curvature : fromX + curvature
  const c1y = fromY + totalSag * 0.65
  const c2x = toSide === 'left' ? toX - curvature : toX + curvature
  const c2y = toY + totalSag * 0.65
  return `M ${fromX} ${fromY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toX} ${toY}`
}

function wirePath(
  fromX: number, fromY: number,
  toX: number, toY: number,
  oscillation: number,
  fromSide: 'left' | 'right'
): string {
  const dx = toX - fromX
  const dist = Math.sqrt(dx * dx + (toY - fromY) ** 2)
  const sagBase = Math.min(45, Math.max(12, dist * 0.12))
  const totalSag = sagBase + oscillation
  const curvature = Math.max(25, Math.min(100, Math.abs(dx) * 0.45))
  const c1x = fromSide === 'left' ? fromX - curvature : fromX + curvature
  const c1y = fromY + totalSag * 0.6
  const c2x = toX - curvature * 0.5
  const c2y = toY + totalSag * 0.6
  return `M ${fromX} ${fromY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toX} ${toY}`
}

function bezierMid(
  fromX: number, fromY: number,
  c1x: number, c1y: number,
  c2x: number, c2y: number,
  toX: number, toY: number
) {
  return {
    x: (fromX + 3 * c1x + 3 * c2x + toX) / 8,
    y: (fromY + 3 * c1y + 3 * c2y + toY) / 8,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveHeroWords() {
  // ── Refs (avoid stale closures in RAF loops) ────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const handleEls = useRef<Record<string, HTMLElement | null>>({})
  const nodeEls = useRef<Record<string, HTMLElement | null>>({})

  // Positions stored in a ref for use inside RAF callbacks – also mirrored into
  // state so React re-renders the DOM correctly.
  const positionsRef = useRef<Record<string, { x: number; y: number }>>(
    (() => {
      const o: Record<string, { x: number; y: number }> = {}
      WORDS.forEach(w => { o[w.id] = { x: 0, y: 0 } })
      return o
    })()
  )
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const o: Record<string, { x: number; y: number }> = {}
    WORDS.forEach(w => { o[w.id] = { x: 0, y: 0 } })
    return o
  })

  // Edges – kept in state so disconnect button re-renders on removal
  const edgesRef = useRef<Edge[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  // Active wire being drawn (purely imperative – never stored in state to avoid
  // the "disappears for one frame" flash on connect)
  const dragWireRef = useRef<{
    fromWordId: string
    fromHandle: 'left' | 'right'
    pathEl: SVGPathElement | null
    tipEl: SVGCircleElement | null
    oscAmplitude: number
    oscStartTime: number
    lastX: number
    lastY: number
    lastTime: number
    rafId: number | null
  } | null>(null)

  // Hovered target handle for snap highlight
  const [hoveredHandle, setHoveredHandle] = useState<{ wordId: string; handle: 'left' | 'right' } | null>(null)
  const hoveredHandleRef = useRef<{ wordId: string; handle: 'left' | 'right' } | null>(null)

  // Entrance animations
  const [enteredWords, setEnteredWords] = useState<Record<string, boolean>>({})

  // Bump animation – stored as bump counter keyed by wordId to force re-trigger
  // even if the animation class is already applied
  const bumpCounterRef = useRef<Record<string, number>>({})
  const [bumpKeys, setBumpKeys] = useState<Record<string, number>>({})

  // Z-indices
  const [zIndices, setZIndices] = useState<Record<string, number>>(() => {
    const o: Record<string, { x: number }> = {}
    const zi: Record<string, number> = {}
    WORDS.forEach((w, i) => { zi[w.id] = 10 + i })
    return zi
  })
  const topZRef = useRef(30)

  const [activeDragWord, setActiveDragWord] = useState<string | null>(null)

  // Global RAF loop for physics (oscillations on edges)
  const physicsRafRef = useRef<number | null>(null)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getHandlePos = useCallback((wordId: string, side: 'left' | 'right') => {
    const el = handleEls.current[`${wordId}-${side}`]
    const cont = containerRef.current
    if (!el || !cont) return { x: 0, y: 0 }
    const er = el.getBoundingClientRect()
    const cr = cont.getBoundingClientRect()
    return {
      x: er.left - cr.left + er.width / 2,
      y: er.top - cr.top + er.height / 2,
    }
  }, [])

  const checkSequenceComplete = useCallback((es: Edge[]) => {
    for (let i = 0; i < WORDS.length - 1; i++) {
      const cur = WORDS[i].id
      const nxt = WORDS[i + 1].id
      const conn = es.some(
        e => (e.fromWordId === cur && e.toWordId === nxt) ||
             (e.fromWordId === nxt && e.toWordId === cur)
      )
      if (!conn) return false
    }
    return true
  }, [])

  // ── Draw edges imperatively on SVG paths ─────────────────────────────────────
  // This avoids React re-renders during animation frames
  const edgePathEls = useRef<Record<string, {
    shadow: SVGPathElement | null
    main: SVGPathElement | null
    hit: SVGPathElement | null
    tipFrom: SVGCircleElement | null
    tipTo: SVGCircleElement | null
    btn: HTMLElement | null
  }>>({})

  const redrawEdges = useCallback(() => {
    const es = edgesRef.current
    const complete = checkSequenceComplete(es)

    for (const edge of es) {
      const els = edgePathEls.current[edge.id]
      if (!els) continue

      const fp = getHandlePos(edge.fromWordId, edge.fromHandle)
      const tp = getHandlePos(edge.toWordId, edge.toHandle)

      const dx = tp.x - fp.x
      const dist = Math.sqrt(dx * dx + (tp.y - fp.y) ** 2)
      const sagBase = Math.min(42, Math.max(10, dist * 0.11))
      const totalSag = sagBase + edge.oscillation
      const curvature = Math.max(28, Math.min(110, Math.abs(dx) * 0.48))

      const c1x = edge.fromHandle === 'left' ? fp.x - curvature : fp.x + curvature
      const c1y = fp.y + totalSag * 0.65
      const c2x = edge.toHandle === 'left' ? tp.x - curvature : tp.x + curvature
      const c2y = tp.y + totalSag * 0.65

      const d = `M ${fp.x} ${fp.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tp.x} ${tp.y}`
      const strokeColor = complete ? '#10b981' : '#27272a'
      const sw = complete ? '3.25' : '2.75'

      if (els.shadow) els.shadow.setAttribute('d', d)
      if (els.main) {
        els.main.setAttribute('d', d)
        els.main.setAttribute('stroke', strokeColor)
        els.main.setAttribute('stroke-width', sw)
      }
      if (els.hit) els.hit.setAttribute('d', d)
      if (els.tipFrom) {
        els.tipFrom.setAttribute('cx', String(fp.x))
        els.tipFrom.setAttribute('cy', String(fp.y))
        els.tipFrom.setAttribute('fill', strokeColor)
      }
      if (els.tipTo) {
        els.tipTo.setAttribute('cx', String(tp.x))
        els.tipTo.setAttribute('cy', String(tp.y))
        els.tipTo.setAttribute('fill', strokeColor)
      }

      // Update disconnect button position
      if (els.btn) {
        const mid = bezierMid(fp.x, fp.y, c1x, c1y, c2x, c2y, tp.x, tp.y)
        ;(els.btn as HTMLElement).style.left = `${mid.x}px`
        ;(els.btn as HTMLElement).style.top = `${mid.y}px`
      }
    }
  }, [getHandlePos, checkSequenceComplete])

  // ── Physics loop ─────────────────────────────────────────────────────────────

  const startPhysicsLoop = useCallback(() => {
    if (physicsRafRef.current) return

    const tick = (now: number) => {
      let anyActive = false

      for (const edge of edgesRef.current) {
        if (edge.oscillation !== 0) {
          const elapsed = (now - edge.oscStartTime) / 1000
          if (elapsed > 0.65) {
            edge.oscillation = 0
          } else {
            const decay = Math.exp(-elapsed * 6)
            edge.oscillation = edge.oscAmplitude * decay * Math.sin(elapsed * 24)
            anyActive = true
          }
        }
      }

      redrawEdges()

      if (anyActive) {
        physicsRafRef.current = requestAnimationFrame(tick)
      } else {
        physicsRafRef.current = null
      }
    }

    physicsRafRef.current = requestAnimationFrame(tick)
  }, [redrawEdges])

  const triggerEdgeOscillation = useCallback((edgeId: string, speed: number) => {
    const edge = edgesRef.current.find(e => e.id === edgeId)
    if (!edge) return
    const amp = Math.min(24, Math.max(6, speed * 0.4))
    edge.oscAmplitude = amp
    edge.oscillation = amp
    edge.oscStartTime = performance.now()
    startPhysicsLoop()
  }, [startPhysicsLoop])

  // Also trigger oscillation when node is moved (all connected edges)
  const triggerConnectedEdgesOscillation = useCallback((wordId: string, speed: number) => {
    for (const edge of edgesRef.current) {
      if (edge.fromWordId === wordId || edge.toWordId === wordId) {
        const amp = Math.min(24, Math.max(6, speed * 0.4))
        edge.oscAmplitude = amp
        edge.oscillation = amp
        edge.oscStartTime = performance.now()
      }
    }
    startPhysicsLoop()
  }, [startPhysicsLoop])

  // ── Trigger bump on a word node ───────────────────────────────────────────────

  const triggerBump = useCallback((wordId: string) => {
    const next = (bumpCounterRef.current[wordId] ?? 0) + 1
    bumpCounterRef.current[wordId] = next
    // Use requestAnimationFrame to allow any removal of the class first
    requestAnimationFrame(() => {
      setBumpKeys(prev => ({ ...prev, [wordId]: next }))
    })
  }, [])

  // ── Word node drag ────────────────────────────────────────────────────────────

  const startWordDrag = useCallback((e: React.PointerEvent, wordId: string) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-handle]') || target.closest('button')) return

    e.preventDefault()
    e.stopPropagation()

    setEnteredWords(prev => ({ ...prev, [wordId]: true }))
    topZRef.current += 1
    const newZ = topZRef.current
    setZIndices(prev => ({ ...prev, [wordId]: newZ }))
    setActiveDragWord(wordId)

    const startX = e.clientX
    const startY = e.clientY
    const startPosX = positionsRef.current[wordId]?.x ?? 0
    const startPosY = positionsRef.current[wordId]?.y ?? 0
    let prevX = startX, prevY = startY, prevTime = performance.now()
    let rafId: number | null = null

    const onMove = (me: PointerEvent) => {
      me.preventDefault()
      const dx = me.clientX - startX
      const dy = me.clientY - startY
      const newX = startPosX + dx
      const newY = startPosY + dy

      // Speed for oscillation trigger
      const now = performance.now()
      const dt = Math.max(1, now - prevTime)
      const speed = Math.hypot(me.clientX - prevX, me.clientY - prevY) / dt * 16
      prevX = me.clientX; prevY = me.clientY; prevTime = now

      positionsRef.current[wordId] = { x: newX, y: newY }

      // Trigger oscillation on connected edges immediately inside RAF
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        // Update DOM directly for the dragged node
        const el = nodeEls.current[wordId]
        if (el) {
          el.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
        }
        triggerConnectedEdgesOscillation(wordId, speed)
        redrawEdges()
      })
    }

    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId)
      setActiveDragWord(null)
      // Sync React state with the final ref position
      setPositions(prev => ({
        ...prev,
        [wordId]: { ...positionsRef.current[wordId] },
      }))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [redrawEdges, triggerConnectedEdgesOscillation])

  // ── Wire drag (imperative, bypasses React state for live path) ───────────────

  const startWireDrag = useCallback((
    e: React.PointerEvent,
    fromWordId: string,
    fromHandle: 'left' | 'right'
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const svg = svgRef.current
    const cont = containerRef.current
    if (!svg || !cont) return

    // Create SVG elements directly – never touch React state for the in-progress wire
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    pathEl.setAttribute('fill', 'none')
    pathEl.setAttribute('stroke', '#18181b')
    pathEl.setAttribute('stroke-width', '2.75')
    pathEl.setAttribute('stroke-linecap', 'round')
    pathEl.setAttribute('stroke-dasharray', '6 4')
    pathEl.style.pointerEvents = 'none'

    const tipEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    tipEl.setAttribute('r', '5.5')
    tipEl.setAttribute('fill', '#18181b')
    tipEl.setAttribute('stroke', '#ffffff')
    tipEl.setAttribute('stroke-width', '2')
    tipEl.style.pointerEvents = 'none'

    svg.appendChild(pathEl)
    svg.appendChild(tipEl)

    dragWireRef.current = {
      fromWordId,
      fromHandle,
      pathEl,
      tipEl,
      oscAmplitude: 8,
      oscStartTime: performance.now(),
      lastX: 0, lastY: 0,
      lastTime: performance.now(),
      rafId: null,
    }

    const onMove = (me: PointerEvent) => {
      me.preventDefault()
      const cr = cont.getBoundingClientRect()
      let curX = me.clientX - cr.left
      let curY = me.clientY - cr.top

      // Snap + hover detection
      let foundHover: { wordId: string; handle: 'left' | 'right' } | null = null
      for (const w of WORDS) {
        if (w.id === fromWordId) continue
        for (const side of ['left', 'right'] as const) {
          const pos = getHandlePos(w.id, side)
          if (Math.hypot(curX - pos.x, curY - pos.y) < 34) {
            foundHover = { wordId: w.id, handle: side }
            curX = pos.x
            curY = pos.y
            break
          }
        }
        if (foundHover) break
      }

      if (JSON.stringify(foundHover) !== JSON.stringify(hoveredHandleRef.current)) {
        hoveredHandleRef.current = foundHover
        setHoveredHandle(foundHover)
      }

      const ref = dragWireRef.current
      if (!ref) return

      // Speed-based oscillation for the in-flight wire
      const now = performance.now()
      const dt = Math.max(1, now - ref.lastTime)
      const speed = Math.hypot(curX - ref.lastX, curY - ref.lastY) / dt * 16
      ref.lastX = curX; ref.lastY = curY; ref.lastTime = now
      if (speed > 1.5) {
        ref.oscAmplitude = Math.min(22, Math.max(6, speed * 0.4))
        ref.oscStartTime = performance.now()
      }

      if (ref.rafId) cancelAnimationFrame(ref.rafId)
      ref.rafId = requestAnimationFrame(() => {
        const r = dragWireRef.current
        if (!r?.pathEl || !r.tipEl) return
        const fp = getHandlePos(fromWordId, fromHandle)
        const elapsed = (performance.now() - r.oscStartTime) / 1000
        let osc = 0
        if (elapsed < 0.65) {
          osc = r.oscAmplitude * Math.exp(-elapsed * 6) * Math.sin(elapsed * 24)
        }
        const d = wirePath(fp.x, fp.y, curX, curY, osc, fromHandle)
        r.pathEl.setAttribute('d', d)
        r.tipEl.setAttribute('cx', String(curX))
        r.tipEl.setAttribute('cy', String(curY))
      })
    }

    const onUp = (ue: PointerEvent) => {
      const ref = dragWireRef.current
      if (ref?.rafId) cancelAnimationFrame(ref.rafId)

      // Remove in-flight SVG elements BEFORE adding a new edge to avoid the
      // "one-frame disappear" artifact
      if (ref?.pathEl) ref.pathEl.remove()
      if (ref?.tipEl) ref.tipEl.remove()
      dragWireRef.current = null
      setHoveredHandle(null)
      hoveredHandleRef.current = null

      // Check drop target
      const cr = cont.getBoundingClientRect()
      const curX = ue.clientX - cr.left
      const curY = ue.clientY - cr.top

      let target: { wordId: string; handle: 'left' | 'right' } | null = null
      for (const w of WORDS) {
        if (w.id === fromWordId) continue
        for (const side of ['left', 'right'] as const) {
          const pos = getHandlePos(w.id, side)
          if (Math.hypot(curX - pos.x, curY - pos.y) < 36) {
            target = { wordId: w.id, handle: side }
            break
          }
        }
        if (target) break
      }

      if (target) {
        const edgeId = `${fromWordId}-${fromHandle}--${target.wordId}-${target.handle}`
        const reverseId = `${target.wordId}-${target.handle}--${fromWordId}-${fromHandle}`
        const isDuplicate = edgesRef.current.some(ex => ex.id === edgeId || ex.id === reverseId)

        if (!isDuplicate) {
          const newEdge: Edge = {
            id: edgeId,
            fromWordId,
            fromHandle,
            toWordId: target.wordId,
            toHandle: target.handle,
            oscillation: 14,
            oscAmplitude: 14,
            oscStartTime: performance.now(),
            lastOscTime: performance.now(),
          }
          edgesRef.current = [...edgesRef.current, newEdge]

          // Immediately inject SVG paths for the new edge BEFORE React renders
          injectEdgePaths(newEdge)

          // Sync React state
          setEdges([...edgesRef.current])

          // Bump both nodes
          triggerBump(fromWordId)
          triggerBump(target.wordId)

          // Start oscillation
          startPhysicsLoop()
        }
      }

      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [getHandlePos, triggerBump, startPhysicsLoop])

  // ── Inject SVG elements for a new edge imperatively ──────────────────────────
  const injectEdgePaths = useCallback((edge: Edge) => {
    const svg = svgRef.current
    if (!svg) return

    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    shadow.setAttribute('fill', 'none')
    shadow.setAttribute('stroke', '#000')
    shadow.setAttribute('stroke-width', '4')
    shadow.setAttribute('stroke-opacity', '0.08')
    shadow.setAttribute('stroke-linecap', 'round')

    const main = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    main.setAttribute('fill', 'none')
    main.setAttribute('stroke-linecap', 'round')
    main.style.transition = 'stroke 0.25s ease'

    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    hit.setAttribute('fill', 'none')
    hit.setAttribute('stroke', 'transparent')
    hit.setAttribute('stroke-width', '18')
    hit.style.cursor = 'pointer'
    hit.style.pointerEvents = 'stroke'
    hit.addEventListener('click', () => removeEdge(edge.id))

    const tipFrom = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    tipFrom.setAttribute('r', '3.5')
    const tipTo = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    tipTo.setAttribute('r', '3.5')

    svg.appendChild(shadow)
    svg.appendChild(main)
    svg.appendChild(hit)
    svg.appendChild(tipFrom)
    svg.appendChild(tipTo)

    // Disconnect button in DOM overlay
    const btnWrap = document.createElement('div')
    btnWrap.style.position = 'absolute'
    btnWrap.style.transform = 'translate(-50%, -50%)'
    btnWrap.style.zIndex = '35'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = 'Desconectar'
    btn.className = 'flex h-5 w-5 items-center justify-center rounded-full bg-white border border-zinc-300 shadow-md text-zinc-500 hover:text-white hover:bg-red-500 hover:border-red-600 hover:scale-110 active:scale-95 transition-all cursor-pointer'
    btn.innerHTML = '<span class="text-xs font-bold leading-none select-none">×</span>'
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      removeEdge(edge.id)
    })
    btnWrap.appendChild(btn)
    containerRef.current?.appendChild(btnWrap)

    edgePathEls.current[edge.id] = {
      shadow, main, hit, tipFrom, tipTo, btn: btnWrap,
    }
  }, [])

  const removeEdge = useCallback((edgeId: string) => {
    // Remove SVG elements
    const els = edgePathEls.current[edgeId]
    if (els) {
      els.shadow?.remove()
      els.main?.remove()
      els.hit?.remove()
      els.tipFrom?.remove()
      els.tipTo?.remove()
      els.btn?.remove()
      delete edgePathEls.current[edgeId]
    }
    edgesRef.current = edgesRef.current.filter(e => e.id !== edgeId)
    setEdges([...edgesRef.current])
  }, [])

  // ── On first mount, inject paths for any existing edges ──────────────────────
  // (none initially, but useful if we ever hydrate from state)
  useLayoutEffect(() => {
    // Ensure SVG paths exist for the initial edge set (empty here)
    for (const edge of edgesRef.current) {
      if (!edgePathEls.current[edge.id]) injectEdgePaths(edge)
    }
  }, [injectEdgePaths])

  // ── Continuous redraw on every animation frame while anything is live ─────────
  // We run a lightweight loop just for edge updates after node drag
  const redrawRafRef = useRef<number | null>(null)
  const scheduleRedraw = useCallback(() => {
    if (redrawRafRef.current) return
    const loop = () => {
      redrawEdges()
      redrawRafRef.current = null
    }
    redrawRafRef.current = requestAnimationFrame(loop)
  }, [redrawEdges])

  // Trigger redraw on position changes
  useEffect(() => {
    scheduleRedraw()
  }, [positions, scheduleRedraw])

  // ── Sync React state → DOM for nodes during non-drag updates (reset etc.) ────
  useEffect(() => {
    for (const [wordId, pos] of Object.entries(positions)) {
      const el = nodeEls.current[wordId]
      if (el) el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
    }
    positionsRef.current = { ...positions }
    scheduleRedraw()
  }, [positions, scheduleRedraw])

  // ── Resize / scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => scheduleRedraw()
    const onScroll = () => scheduleRedraw()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [scheduleRedraw])

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (physicsRafRef.current) cancelAnimationFrame(physicsRafRef.current)
      if (redrawRafRef.current) cancelAnimationFrame(redrawRafRef.current)
    }
  }, [])

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const resetPositions = useCallback(() => {
    const reset: Record<string, { x: number; y: number }> = {}
    WORDS.forEach(w => { reset[w.id] = { x: 0, y: 0 } })
    setPositions(reset)
  }, [])

  const disconnectAll = useCallback(() => {
    for (const edge of edgesRef.current) {
      const els = edgePathEls.current[edge.id]
      if (els) {
        els.shadow?.remove(); els.main?.remove(); els.hit?.remove()
        els.tipFrom?.remove(); els.tipTo?.remove(); els.btn?.remove()
        delete edgePathEls.current[edge.id]
      }
    }
    edgesRef.current = []
    setEdges([])
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────────
  const hasMovedAny = Object.values(positions).some(p => p.x !== 0 || p.y !== 0)
  const hasEdges = edges.length > 0
  const complete = checkSequenceComplete(edges)

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full py-4 sm:py-6 overflow-visible select-none"
    >
      {/* SVG overlay for all edges – content injected imperatively */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20"
        aria-hidden="true"
      />

      {/* ── Heading: 5 word-node boxes ─────────────────────────────────── */}
      <h1
        aria-label="Aprende código mediante nodos lógicos"
        className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-8 md:gap-x-10 gap-y-4 sm:gap-y-6 max-w-4xl mx-auto overflow-visible"
      >
        {WORDS.map((word) => {
          const pos = positions[word.id] || { x: 0, y: 0 }
          const isDragging = activeDragWord === word.id
          const hasEntered = enteredWords[word.id]
          const bumpKey = bumpKeys[word.id] ?? 0
          const zIndex = zIndices[word.id] ?? 10

          const isLeftHovered = hoveredHandle?.wordId === word.id && hoveredHandle.handle === 'left'
          const isRightHovered = hoveredHandle?.wordId === word.id && hoveredHandle.handle === 'right'
          const entranceDelay = `${word.order * 0.08}s`

          return (
            <div
              key={word.id}
              ref={(el) => { nodeEls.current[word.id] = el }}
              onPointerDown={(e) => startWordDrag(e, word.id)}
              onAnimationEnd={(e) => {
                if (e.animationName.includes('cartoonBounceIn')) {
                  setEnteredWords(prev => ({ ...prev, [word.id]: true }))
                }
              }}
              style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                zIndex,
                animationDelay: !hasEntered ? entranceDelay : undefined,
                touchAction: 'none',
                willChange: 'transform',
              }}
              className={[
                'group relative inline-flex items-center justify-center',
                'px-4 py-2 sm:px-6 sm:py-3',
                'rounded-2xl border-2 bg-white',
                'select-none cursor-grab active:cursor-grabbing',
                !hasEntered ? 'animate-cartoon-in' : '',
                // Bump: key forces React to unmount/remount the class
                bumpKey > 0 ? `animate-block-bump bump-${bumpKey}` : '',
                isDragging
                  ? 'shadow-2xl ring-2 ring-zinc-900 ring-offset-2 border-zinc-900'
                  : 'border-zinc-200 hover:border-zinc-400 shadow-md hover:shadow-xl',
              ].filter(Boolean).join(' ')}
            >
              {/* Left handle */}
              <div
                data-handle="left"
                ref={(el) => { handleEls.current[`${word.id}-left`] = el }}
                onPointerDown={(e) => startWireDrag(e, word.id, 'left')}
                title="Conector izquierdo"
                className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 cursor-crosshair"
                style={{ touchAction: 'none' }}
              >
                <span className="absolute -inset-3 rounded-full" />
                <span className={[
                  'block w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white shadow-md transition-all duration-150',
                  isLeftHovered
                    ? 'bg-emerald-500 scale-125 ring-4 ring-emerald-300'
                    : 'bg-zinc-600 hover:bg-zinc-950 hover:scale-125',
                ].join(' ')} />
              </div>

              {/* Word text */}
              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-zinc-900 tracking-tight leading-none pointer-events-none">
                {word.text}
              </span>

              {/* Right handle */}
              <div
                data-handle="right"
                ref={(el) => { handleEls.current[`${word.id}-right`] = el }}
                onPointerDown={(e) => startWireDrag(e, word.id, 'right')}
                title="Conector derecho"
                className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 z-30 cursor-crosshair"
                style={{ touchAction: 'none' }}
              >
                <span className="absolute -inset-3 rounded-full" />
                <span className={[
                  'block w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white shadow-md transition-all duration-150',
                  isRightHovered
                    ? 'bg-emerald-500 scale-125 ring-4 ring-emerald-300'
                    : 'bg-zinc-600 hover:bg-zinc-950 hover:scale-125',
                ].join(' ')} />
              </div>
            </div>
          )
        })}
      </h1>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-xs text-zinc-500">
        {complete ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold animate-in fade-in zoom-in-95 duration-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            ¡Secuencia de nodos conectada con éxito!
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100/90 border border-zinc-200 text-zinc-600 font-medium">
            💡 Arrastra las palabras y conecta sus puertos
          </span>
        )}

        {hasMovedAny && (
          <button
            type="button"
            onClick={resetPositions}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 shadow-xs font-semibold cursor-pointer transition-all animate-in fade-in zoom-in-95"
          >
            <RotateCcw className="w-3 h-3" />
            Restablecer
          </button>
        )}

        {hasEdges && (
          <button
            type="button"
            onClick={disconnectAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-zinc-300 text-zinc-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300 shadow-xs font-semibold cursor-pointer transition-all animate-in fade-in zoom-in-95"
          >
            <Unlink className="w-3 h-3" />
            Desconectar todo
          </button>
        )}
      </div>
    </div>
  )
}
