"use client"

import { useCallback, useState, useRef, useEffect } from "react"
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  updateEdge,
  useReactFlow,
  useUpdateNodeInternals,
  useViewport,
  ReactFlowProvider,
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  EdgeProps,
  Connection,
  Edge,
  Node,
} from "reactflow"
import "reactflow/dist/style.css"
import confetti from "canvas-confetti"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronDown, ChevronUp, CheckCircle2, Circle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import CodeBlock from "./CodeBlock"
import IndentBlock from "./IndentBlock"
import StickerNode from "./StickerNode"
import LineRailNode from "./LineRailNode"
import Toolbar, { StickerItem } from "./Toolbar"
import ElasticConnectionLine from "./ElasticConnectionLine"
import ParticleBurst, { ParticleBurstEvent } from "./ParticleBurst"
import TerminalModal from "@/components/modals/TerminalModal"
import ProblemModal from "@/components/modals/ProblemModal"
import { reconstructCodeFromCanvas, reconstructCodeFromBlocks } from "@/lib/code-reconstructor"
import { saveActivity } from "@/lib/offline/db"

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockType = "codigo" | "indentacion" | "sticker"

export interface Block {
  id: string
  activity_id?: string
  actividad_id?: string
  tipo: BlockType
  contenido: string | null
  posicion_x?: number
  posicion_y?: number
  orden_correcto?: number
  indent_level?: number
}

export interface BlockConnection {
  id: string
  activity_id?: string
  actividad_id?: string
  source_block_id: string
  target_block_id: string
  source_handle?: string | null
  target_handle?: string | null
}

type TerminalStatus = "idle" | "running" | "success" | "error"

type EdgeData = {
  animating?: boolean
  success?: boolean
  error?: boolean
  onDelete?: (id: string, pos?: { x: number; y: number }) => void
}

type AppEdge = Edge<EdgeData>

type NodeState = "idle" | "connected" | "success" | "error"

export interface FlowCanvasProps {
  activityId: string
  activityTitle?: string
  activityOrder?: number
  courseId?: string
  courseName?: string
  sessionName?: string
  sessionType?: "clase" | "repaso"
  sessionActivities?: Array<{ id: string; titulo: string; orden: number }>
  initialCompletedMap?: Record<string, boolean>
  blocks: Block[]
  connections: BlockConnection[] // correct connections from DB – NOT shown to student
  enunciado: string
  resultadoEsperado: string
  isReadOnly?: boolean
}

// ─── Spring-back animated edge ────────────────────────────────────────────────

const springKeyframes = `
@keyframes springBack {
  0%   { stroke-dashoffset: 0;   opacity: 1; }
  30%  { stroke-dashoffset: -20; opacity: 1; }
  60%  { stroke-dashoffset: 10;  opacity: 0.8; }
  80%  { stroke-dashoffset: -5;  opacity: 0.9; }
  100% { stroke-dashoffset: 0;   opacity: 0; }
}
`

function SpringEdge(props: EdgeProps<EdgeData>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
    markerEnd,
    data,
    selected,
  } = props

  // Track movement of endpoints to simulate rubber elasticity & damped oscillation
  const [oscillation, setOscillation] = useState(0)
  const lastPos = useRef({ sourceX, sourceY, targetX, targetY, time: Date.now() })
  const animFrame = useRef<number | null>(null)

  useEffect(() => {
    const now = Date.now()
    const dxS = sourceX - lastPos.current.sourceX
    const dyS = sourceY - lastPos.current.sourceY
    const dxT = targetX - lastPos.current.targetX
    const dyT = targetY - lastPos.current.targetY
    const speed = Math.sqrt(dxS * dxS + dyS * dyS + dxT * dxT + dyT * dyT)
    lastPos.current = { sourceX, sourceY, targetX, targetY, time: now }

    // If movement is noticeable, initiate damped elastic oscillation
    if (speed > 1.2) {
      const startTime = performance.now()
      const initialAmp = Math.min(24, Math.max(6, speed * 0.4))

      const animate = (time: number) => {
        const elapsed = (time - startTime) / 1000 // in seconds
        if (elapsed > 0.6) {
          setOscillation(0)
          return
        }
        // Damped sine wave harmonic motion: y = A * e^(-lambda * t) * sin(omega * t)
        const decay = Math.exp(-elapsed * 6)
        const osc = initialAmp * decay * Math.sin(elapsed * 24)
        setOscillation(osc)
        animFrame.current = requestAnimationFrame(animate)
      }

      if (animFrame.current) cancelAnimationFrame(animFrame.current)
      animFrame.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current)
    }
  }, [sourceX, sourceY, targetX, targetY])

  // Calculate rubber stretch distance and tension
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Elastic tension sag: rubber cords sag slightly when closer, straighten under tension
  const sagBase = Math.min(42, Math.max(10, dist * 0.11))
  const totalSag = sagBase + oscillation

  // Cubic bezier with horizontal exit and entry at node aristas
  const curvature = Math.max(28, Math.min(110, Math.abs(dx) * 0.48))
  const c1x = sourceX + curvature
  const c1y = sourceY + totalSag * 0.65
  const c2x = targetX - curvature
  const c2y = targetY + totalSag * 0.65

  const edgePath = `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`

  // Center point on cubic bezier for label / disconnect button
  const labelX = (sourceX + 3 * c1x + 3 * c2x + targetX) / 8
  const labelY = (sourceY + 3 * c1y + 3 * c2y + targetY) / 8

  const isAnimating: boolean = data?.animating ?? false
  const isSuccess: boolean = data?.success ?? false
  const isError: boolean = data?.error ?? false

  const stroke = isSuccess ? "#22c55e" : isError ? "#ef4444" : selected ? "#000000" : "#18181b"
  const strokeWidth = selected ? 2.75 : 2.25

  return (
    <>
      {isAnimating && <style>{springKeyframes}</style>}

      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke,
          strokeWidth,
          strokeLinecap: "round",
          animation: isAnimating
            ? "springBack 0.8s ease-in-out forwards"
            : undefined,
          transition: "stroke 0.15s ease",
        }}
      />
      {!isSuccess && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                data?.onDelete?.(id, { x: e.clientX, y: e.clientY })
              }}
              title="Desconectar enlace"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white border border-zinc-300 shadow-sm text-zinc-400 hover:text-white hover:bg-red-500 hover:border-red-600 hover:scale-110 active:scale-95 transition-all cursor-pointer select-none"
            >
              <span className="text-xs font-bold leading-none select-none">
                ×
              </span>
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// ─── Node types map ───────────────────────────────────────────────────────────

const nodeTypes = {
  codeBlock: CodeBlock,
  indentBlock: IndentBlock,
  sticker: StickerNode,
  lineRail: LineRailNode,
}

const edgeTypes = {
  spring: SpringEdge,
}

// ─── Helper: initialise nodes from blocks ─────────────────────────────────────

function blocksToNodes(blocks: Block[]): Node[] {
  // Line rail starts with only 1 line per user requirement
  const lineRailNode: Node = {
    id: "line-rail",
    type: "lineRail",
    position: { x: 30, y: 80 },
    data: { lines: 1, readOnly: false, entranceDelay: 0, isExiting: false },
    deletable: false,
  }

  // Shuffle blocks so they do NOT appear in the answer order
  const shuffledBlocks = [...blocks].sort(() => Math.random() - 0.5)

  // Layout grid parameters for scattering blocks across the canvas
  const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(shuffledBlocks.length * 1.5))))
  const START_X = 240
  const START_Y = 80
  const COL_WIDTH = 130
  const ROW_HEIGHT = 100

  const blockNodes: Node[] = shuffledBlocks.map((block, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const jitterX = Math.floor(Math.random() * 40) - 20
    const jitterY = Math.floor(Math.random() * 30) - 15

    const posX = START_X + col * COL_WIDTH + jitterX
    const posY = START_Y + row * ROW_HEIGHT + jitterY
    const entranceDelay = Number(((index + 1) * 0.075).toFixed(3))

    const base = {
      id: block.id,
      position: { x: posX, y: posY },
      draggable: true,
    }

    if (block.tipo === "codigo") {
      return {
        ...base,
        type: "codeBlock",
        data: { code: block.contenido ?? '', state: "idle" as NodeState, entranceDelay, isExiting: false },
      }
    }

    if (block.tipo === "indentacion") {
      return {
        ...base,
        type: "indentBlock",
        data: { rows: 1, state: "idle" as NodeState, entranceDelay, isExiting: false },
      }
    }

    // sticker
    let emoji = block.contenido ?? '✔️'
    let text: string | undefined = undefined
    let bgClass: string | undefined = undefined
    let borderClass: string | undefined = undefined
    let textClass: string | undefined = undefined
    let variant: 'emoji' | 'badge' = 'emoji'

    try {
      if (block.contenido && block.contenido.startsWith('{')) {
        const parsed = JSON.parse(block.contenido)
        if (parsed.text) {
          variant = 'badge'
          text = parsed.text
          bgClass = parsed.bgClass
          borderClass = parsed.borderClass
          textClass = parsed.textClass
        }
      }
    } catch {}

    return {
      ...base,
      type: "sticker",
      data: {
        variant,
        emoji,
        text,
        bgClass,
        borderClass,
        textClass,
        entranceDelay,
        isExiting: false,
      },
    }
  })

  return [lineRailNode, ...blockNodes]
}

// ─── Helper: calculate student block order from edges graph ──────────────────

function getStudentBlockOrder(edges: Edge[], nodes: Node[]): string[] {
  const codeNodeIds = new Set(
    nodes.filter((n) => n.type !== 'sticker').map((n) => n.id)
  )

  const nextMap = new Map<string, string>()
  const inDegree = new Map<string, number>()

  for (const edge of edges) {
    if (codeNodeIds.has(edge.source) && codeNodeIds.has(edge.target)) {
      nextMap.set(edge.source, edge.target)
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    }
  }

  // Find start node: in codeNodeIds, with inDegree === 0 and has outgoing edge
  const startId = Array.from(codeNodeIds).find(
    (id) => !inDegree.has(id) && nextMap.has(id)
  )

  const order: string[] = []
  const visited = new Set<string>()
  let curr = startId

  while (curr && !visited.has(curr)) {
    visited.add(curr)
    order.push(curr)
    curr = nextMap.get(curr)
  }

  return order
}

// ─── Helper: Get accurate dimensions for smart center calculations ───────────

function getNodeDimensions(node: Node): { width: number; height: number } {
  if (node.width && node.height) {
    return { width: node.width, height: node.height }
  }
  if (node.type === "lineRail") {
    const lines = node.data?.lines ?? 1
    return { width: 130, height: lines * 64 + 72 }
  }
  if (node.type === "indentBlock") {
    const rows = node.data?.rows ?? 1
    return { width: 115, height: rows * 64 + 72 }
  }
  if (node.type === "sticker") {
    const scale = node.data?.scale ?? 1
    if (node.data?.text) {
      const textLen = String(node.data.text).length
      return { width: Math.max(70, textLen * 9 + 32) * scale, height: 38 * scale }
    }
    return { width: 64 * scale, height: 64 * scale }
  }
  // codeBlock default estimate
  const code = String(node.data?.code ?? "")
  const estWidth = Math.max(70, 44 + code.length * 8.5)
  return { width: estWidth, height: 42 }
}

// ─── Component: Smart Guides overlay ──────────────────────────────────────────

function SmartGuides({
  guideLines,
}: {
  guideLines: { x: number | null; y: number | null }
}) {
  const { x: vpX, y: vpY, zoom } = useViewport()

  if (guideLines.x === null && guideLines.y === null) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden select-none">
      {guideLines.x !== null && (
        <div
          className="absolute top-0 bottom-0 border-l-2 border-dashed border-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.7)]"
          style={{ left: guideLines.x * zoom + vpX }}
        >
          <div className="absolute top-4 -left-7 bg-sky-600/95 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 animate-in fade-in zoom-in-90 duration-100">
            Centro
          </div>
        </div>
      )}
      {guideLines.y !== null && (
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.7)]"
          style={{ top: guideLines.y * zoom + vpY }}
        >
          <div className="absolute left-4 -top-6 bg-sky-600/95 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 animate-in fade-in zoom-in-90 duration-100">
            Centro
          </div>
        </div>
      )}
      {guideLines.x !== null && guideLines.y !== null && (
        <div
          className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-sky-500 shadow-md ring-2 ring-sky-300 animate-ping-once"
          style={{
            left: guideLines.x * zoom + vpX,
            top: guideLines.y * zoom + vpY,
          }}
        />
      )}
    </div>
  )
}

// ─── Inner canvas (needs useReactFlow) ───────────────────────────────────────

function FlowCanvasInner({
  activityId,
  activityTitle,
  activityOrder,
  courseId,
  courseName,
  sessionName,
  sessionType = "clase",
  sessionActivities = [],
  initialCompletedMap = {},
  blocks,
  connections,
  enunciado,
  resultadoEsperado,
  isReadOnly = false,
}: FlowCanvasProps) {
  const router = useRouter()
  const { fitView } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const [nodes, setNodes, onNodesChange] = useNodesState(blocksToNodes(blocks))
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([])

  // Ensure all node handles are measured accurately at resting bounds after mount & animations
  useEffect(() => {
    const t1 = setTimeout(() => {
      nodes.forEach((n) => updateNodeInternals(n.id))
    }, 100)
    const t2 = setTimeout(() => {
      nodes.forEach((n) => updateNodeInternals(n.id))
    }, 650)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [nodes.length, updateNodeInternals])

  const [attempts, setAttempts] = useState(0)
  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>("idle")
  const [showProblem, setShowProblem] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  // ── Physics & Particles state ───────────────────────────────────────────────
  const [bursts, setBursts] = useState<ParticleBurstEvent[]>([])
  const isConnectingRef = useRef(false)

  const clearBurst = useCallback((id: string) => {
    setBursts((prev) => prev.filter((b) => b.id !== id))
  }, [])

  // ── Smart Guides & Snapping state ─────────────────────────────────────────
  const [smartGuidesEnabled, setSmartGuidesEnabled] = useState<boolean>(true)
  const [guideLines, setGuideLines] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem("knoten_smart_guides_enabled")
      if (saved !== null) {
        setSmartGuidesEnabled(saved === "true")
      }
    } catch {
      // ignore
    }
  }, [])

  const handleToggleSmartGuides = useCallback(() => {
    setSmartGuidesEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem("knoten_smart_guides_enabled", String(next))
      } catch {
        // ignore
      }
      if (!next) {
        setGuideLines({ x: null, y: null })
      }
      return next
    })
  }, [])

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      if (!smartGuidesEnabled) {
        if (guideLines.x !== null || guideLines.y !== null) {
          setGuideLines({ x: null, y: null })
        }
        return
      }

      const { width: dW, height: dH } = getNodeDimensions(draggedNode)
      const dCenterX = draggedNode.position.x + dW / 2
      const dCenterY = draggedNode.position.y + dH / 2

      let matchedSnapX: number | null = null
      let matchedGuideX: number | null = null
      let matchedSnapY: number | null = null
      let matchedGuideY: number | null = null
      let minDiffX = Infinity
      let minDiffY = Infinity

      const SNAP_THRESHOLD = 8 // canvas coordinates snap distance

      for (const other of nodes) {
        if (other.id === draggedNode.id) continue
        const { width: oW, height: oH } = getNodeDimensions(other)
        const oCenterX = other.position.x + oW / 2
        const oCenterY = other.position.y + oH / 2

        // Check vertical guide (X center match)
        const diffX = Math.abs(dCenterX - oCenterX)
        if (diffX <= SNAP_THRESHOLD && diffX < minDiffX) {
          minDiffX = diffX
          matchedGuideX = oCenterX
          matchedSnapX = oCenterX - dW / 2
        }

        // Check horizontal guide (Y center match)
        const diffY = Math.abs(dCenterY - oCenterY)
        if (diffY <= SNAP_THRESHOLD && diffY < minDiffY) {
          minDiffY = diffY
          matchedGuideY = oCenterY
          matchedSnapY = oCenterY - dH / 2
        }
      }

      if (matchedSnapX !== null) {
        draggedNode.position.x = matchedSnapX
      }
      if (matchedSnapY !== null) {
        draggedNode.position.y = matchedSnapY
      }

      setGuideLines((prev) => {
        if (prev.x === matchedGuideX && prev.y === matchedGuideY) return prev
        return { x: matchedGuideX, y: matchedGuideY }
      })
    },
    [smartGuidesEnabled, nodes]
  )

  const onNodeDragStop = useCallback(() => {
    setGuideLines({ x: null, y: null })
  }, [])

  // ── Horizontal alignment for rows of code ──────────────────────────────────
  const alignLine = useCallback(
    (lineNumber: number = 1) => {
      const lineRail = nodes.find((n) => n.type === "lineRail" || n.id === "line-rail")
      const targetLine = Math.max(1, lineNumber)
      const targetHandle = `line-${targetLine}`

      const railX = lineRail ? lineRail.position.x : 30
      const railY = lineRail ? lineRail.position.y : 80
      const railWidth = lineRail?.width ?? 130

      // Handle center Y for this line: 36px header + (targetLine - 1) * 64 + 32
      const handleCenterY = railY + 36 + (targetLine - 1) * 64 + 32

      // 1. Find edge originating from lineRail at this line's handle
      const startEdge = edges.find(
        (e) =>
          (e.source === "line-rail" || (lineRail && e.source === lineRail.id)) &&
          (e.sourceHandle === targetHandle || (!e.sourceHandle && targetLine === 1))
      )

      const chainNodes: Node[] = []
      if (startEdge?.target) {
        const visited = new Set<string>()
        let currentId: string | undefined = startEdge.target

        while (currentId && !visited.has(currentId)) {
          visited.add(currentId)
          const n = nodes.find((node) => node.id === currentId)
          if (n) {
            chainNodes.push(n)
            const nextEdge = edges.find((e) => e.source === currentId)
            currentId = nextEdge?.target
          } else {
            break
          }
        }
      }

      let nodesToAlign = chainNodes

      // 2. Fallback: if no nodes connected to this line rail handle, check selected nodes
      if (nodesToAlign.length === 0) {
        const selected = nodes.filter((n) => n.selected && n.type !== "lineRail")
        if (selected.length > 0) {
          nodesToAlign = [...selected].sort((a, b) => a.position.x - b.position.x)
        }
      }

      // 3. Fallback: find unassigned code/indent nodes placed near this line's Y row
      if (nodesToAlign.length === 0) {
        // Collect node IDs already attached to any line rail handle chain so we don't displace them
        const assignedNodeIds = new Set<string>()
        for (const edge of edges) {
          if (edge.source === "line-rail" || (lineRail && edge.source === lineRail.id)) {
            let cur: string | undefined = edge.target
            while (cur && !assignedNodeIds.has(cur)) {
              assignedNodeIds.add(cur)
              const next: Edge | undefined = edges.find((e) => e.source === cur)
              cur = next?.target
            }
          }
        }

        const candidates = nodes.filter((n) => {
          if (n.type === "lineRail" || n.type === "sticker" || assignedNodeIds.has(n.id)) {
            return false
          }
          const { height } = getNodeDimensions(n)
          const nodeCenterY = n.position.y + (n.type === "indentBlock" ? 68 : height / 2)
          return Math.abs(nodeCenterY - handleCenterY) <= 36
        })

        if (candidates.length > 0) {
          nodesToAlign = [...candidates].sort((a, b) => a.position.x - b.position.x)
        }
      }

      if (nodesToAlign.length === 0) return

      // Compute horizontal alignment
      const startX = lineRail ? railX + railWidth + 36 : nodesToAlign[0].position.x
      let currentX = startX

      const updatedPositions = new Map<string, { x: number; y: number }>()

      for (const node of nodesToAlign) {
        const { width, height } = getNodeDimensions(node)
        let targetY: number

        if (node.type === "indentBlock") {
          // IndentBlock row 0 handle is at 36 + 32 = 68px from top
          targetY = handleCenterY - 68
        } else {
          targetY = handleCenterY - height / 2
        }

        updatedPositions.set(node.id, { x: currentX, y: targetY })
        currentX += width + 28
      }

      setNodes((nds) =>
        nds.map((n) => {
          const pos = updatedPositions.get(n.id)
          if (pos) {
            return {
              ...n,
              position: pos,
            }
          }
          return n
        })
      )

      setTimeout(() => {
        nodesToAlign.forEach((n) => updateNodeInternals(n.id))
        if (lineRail) updateNodeInternals(lineRail.id)
      }, 20)
    },
    [nodes, edges, updateNodeInternals, setNodes]
  )

  const alignAllLines = useCallback(() => {
    const lineRail = nodes.find((n) => n.type === "lineRail" || n.id === "line-rail")
    const totalLines = lineRail?.data?.lines ?? 1
    for (let i = 1; i <= totalLines; i++) {
      alignLine(i)
    }
  }, [nodes, alignLine])

  const handleLinesChange = useCallback(
    (newLines: number) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === "lineRail" || n.id === "line-rail") {
            return {
              ...n,
              data: {
                ...n.data,
                lines: newLines,
              },
            }
          }
          return n
        })
      )
    },
    [setNodes]
  )

  // Ref to always access the latest alignLine function without triggering re-render loops
  const alignLineRef = useRef<(lineNumber?: number) => void>(() => {})
  alignLineRef.current = alignLine

  const stableAlignLine = useCallback((lineNumber?: number) => {
    alignLineRef.current(lineNumber)
  }, [])

  // Keep onAlignLine and onLinesChange wired to lineRailNode safely without causing an infinite re-render loop
  useEffect(() => {
    setNodes((nds) => {
      const lineRail = nds.find((n) => n.type === "lineRail" || n.id === "line-rail")
      if (
        lineRail &&
        lineRail.data?.onAlignLine === stableAlignLine &&
        lineRail.data?.onLinesChange === handleLinesChange
      ) {
        return nds
      }
      return nds.map((n) => {
        if (n.type === "lineRail" || n.id === "line-rail") {
          return {
            ...n,
            data: {
              ...n.data,
              onAlignLine: stableAlignLine,
              onLinesChange: handleLinesChange,
            },
          }
        }
        return n
      })
    })
  }, [stableAlignLine, handleLinesChange, setNodes])

  // ── Activity switch with cartoon bounce zoom-out exit ──────────────────────
  const handleSwitchActivity = useCallback(
    (targetId: string, e?: React.MouseEvent) => {
      e?.preventDefault()
      if (targetId === activityId) {
        setSelectorOpen(false)
        return
      }
      setSelectorOpen(false)
      // Trigger cartoon bounce-out on all nodes
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isExiting: true },
        }))
      )
      // Navigate after exit animation completes
      setTimeout(() => {
        router.push(`/actividad/${targetId}`)
      }, 300)
    },
    [activityId, router, setNodes]
  )

  // ── Completion & Local Cache Management ─────────────────────────────────────
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>(
    initialCompletedMap ?? {}
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem("knoten_completed_activities")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed === "object" && parsed !== null) {
          setCompletedMap((prev) => ({ ...prev, ...parsed }))
        }
      }
    } catch (e) {
      console.error("Error reading localStorage completed activities", e)
    }
  }, [])

  const handleToggleCompleted = useCallback(
    (actId: string, e?: React.MouseEvent) => {
      e?.stopPropagation()
      e?.preventDefault()
      setCompletedMap((prev) => {
        const nextVal = !prev[actId]
        const updated = { ...prev, [actId]: nextVal }
        try {
          localStorage.setItem("knoten_completed_activities", JSON.stringify(updated))
        } catch (err) {
          console.error("Error updating localStorage", err)
        }
        return updated
      })
    },
    []
  )

  // ── Auto-cache activity to IndexedDB for offline access ────────────────────
  useEffect(() => {
    if (activityId && blocks && blocks.length > 0) {
      saveActivity({
        id: activityId,
        session_id: '',
        titulo: activityTitle || 'Actividad',
        enunciado: enunciado || null,
        resultado_esperado: resultadoEsperado || null,
        orden: activityOrder ?? 0,
        blocks: blocks as any,
        connections: connections as any,
        session_nombre: sessionName,
        session_tipo: sessionType,
        curso_id: courseId,
        curso_nombre: courseName,
      }).catch(() => {
        // Silently catch in environments where IndexedDB might be restricted
      })
    }
  }, [
    activityId,
    blocks,
    connections,
    activityTitle,
    enunciado,
    resultadoEsperado,
    activityOrder,
    sessionName,
    sessionType,
    courseId,
    courseName,
  ])

  // ── Activity Selector & Next Activity computation ──────────────────────────
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [isMobileNavFolded, setIsMobileNavFolded] = useState(false)
  const [isMobileToolbarFolded, setIsMobileToolbarFolded] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as HTMLElement)) {
        setSelectorOpen(false)
      }
    }
    if (selectorOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [selectorOpen])

  const activitiesList =
    sessionActivities && sessionActivities.length > 0
      ? sessionActivities
      : [{ id: activityId, titulo: activityTitle || "Actividad", orden: activityOrder ?? 0 }]

  const currentIndex = activitiesList.findIndex((a) => a.id === activityId)
  const nextActivity =
    currentIndex !== -1 && currentIndex < activitiesList.length - 1
      ? activitiesList[currentIndex + 1]
      : null

  const isCurrentCompleted = Boolean(completedMap[activityId])
  const currentDisplayTitle =
    activityTitle ||
    (activityOrder !== undefined ? `Actividad ${activityOrder + 1}` : "Actividad")

  const onCenter = useCallback(() => {
    fitView({ duration: 500, padding: 0.2 })
  }, [fitView])

  const onAddSticker = useCallback((sticker: StickerItem | string) => {
    const isString = typeof sticker === 'string'
    const stickerData = isString
      ? { variant: 'emoji', emoji: sticker, scale: 1 }
      : {
          variant: sticker.variant || (sticker.emoji ? 'emoji' : 'badge'),
          emoji: sticker.emoji,
          text: sticker.text,
          bgClass: sticker.bgClass,
          borderClass: sticker.borderClass,
          textClass: sticker.textClass,
          scale: 1,
        }

    const newNode: Node = {
      id: `sticker-${Date.now()}`,
      type: "sticker",
      position: { x: 250 + Math.random() * 40, y: 150 + Math.random() * 40 },
      data: stickerData,
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  const onAddIndentBlock = useCallback(() => {
    const newNode: Node = {
      id: `indent-${Date.now()}`,
      type: "indentBlock",
      position: { x: 200 + Math.random() * 40, y: 200 + Math.random() * 40 },
      data: { rows: 1, state: "idle" },
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  // ── canExecute ──────────────────────────────────────────────────────────────
  // A minimal connection count across the code blocks
  const codeNodesCount = nodes.filter(
    (n) => n.type === "codeBlock" || n.type === "indentBlock"
  ).length
  const canExecute = edges.length >= Math.max(1, codeNodesCount - 1)

  // ── removeEdge ──────────────────────────────────────────────────────────────
  const removeEdge = useCallback(
    (edgeId: string, burstPos?: { x: number; y: number }) => {
      if (burstPos) {
        setBursts((prev) => [
          ...prev,
          { id: `burst-${Date.now()}`, x: burstPos.x, y: burstPos.y },
        ])
      }

      setEdges((eds) => {
        const targetEdge = eds.find((e) => e.id === edgeId)
        const remaining = eds.filter((e) => e.id !== edgeId)

        if (targetEdge) {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.type === "lineRail" || n.type === "sticker") return n
              if (n.id === targetEdge.source || n.id === targetEdge.target) {
                const stillConnected = remaining.some(
                  (e) => e.source === n.id || e.target === n.id
                )
                if (!stillConnected) {
                  return { ...n, data: { ...n.data, state: "idle" } }
                }
              }
              return n
            })
          )
        }

        return remaining
      })
    },
    [setEdges, setNodes]
  )

  // ── edgeUpdate handlers (drag edge endpoint to reconnect or disconnect) ──
  const edgeUpdateSuccessful = useRef(true)

  const onEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessful.current = false
  }, [])

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeUpdateSuccessful.current = true

      const isConflicting = (e: Edge) => {
        if (e.id === oldEdge.id) return false
        const sameSource =
          e.source === newConnection.source &&
          (newConnection.sourceHandle
            ? e.sourceHandle === newConnection.sourceHandle
            : !e.sourceHandle)
        const sameTarget =
          e.target === newConnection.target &&
          (newConnection.targetHandle
            ? e.targetHandle === newConnection.targetHandle
            : !e.targetHandle)
        return sameSource || sameTarget
      }

      setEdges((els) => {
        const nonConflicting = els.filter((e) => !isConflicting(e))
        const nextEdges = updateEdge(oldEdge, newConnection, nonConflicting)
        return nextEdges.map((e) =>
          e.id === oldEdge.id
            ? { ...e, data: { ...e.data, onDelete: removeEdge } }
            : e
        )
      })

      // Update node states for affected nodes
      setTimeout(() => {
        setEdges((currentEdges) => {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.type === "lineRail" || n.type === "sticker") return n
              const isConnected = currentEdges.some(
                (e) => e.source === n.id || e.target === n.id
              )
              return {
                ...n,
                data: {
                  ...n.data,
                  state: isConnected ? "connected" : "idle",
                },
              }
            })
          )
          return currentEdges
        })
      }, 0)
    },
    [setEdges, setNodes, removeEdge]
  )

  const onEdgeUpdateEnd = useCallback(
    (event: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeUpdateSuccessful.current) {
        const clientX =
          (event as MouseEvent).clientX ??
          (event as TouchEvent).changedTouches?.[0]?.clientX ??
          0
        const clientY =
          (event as MouseEvent).clientY ??
          (event as TouchEvent).changedTouches?.[0]?.clientY ??
          0
        removeEdge(edge.id, clientX && clientY ? { x: clientX, y: clientY } : undefined)
      }
      edgeUpdateSuccessful.current = true
    },
    [removeEdge]
  )

  const onEdgeDoubleClick = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      removeEdge(edge.id, { x: e.clientX, y: e.clientY })
    },
    [removeEdge]
  )

  const handleEdgesChange: typeof onEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes)
      const hasRemovals = changes.some((c) => c.type === "remove")
      if (hasRemovals) {
        setTimeout(() => {
          setEdges((currentEdges) => {
            setNodes((nds) =>
              nds.map((n) => {
                if (n.type === "lineRail" || n.type === "sticker") return n
                const isStillConnected = currentEdges.some(
                  (e) => e.source === n.id || e.target === n.id
                )
                if (!isStillConnected && n.data?.state === "connected") {
                  return { ...n, data: { ...n.data, state: "idle" } }
                }
                return n
              })
            )
            return currentEdges
          })
        }, 0)
      }
    },
    [onEdgesChange, setEdges, setNodes]
  )

  // ── Connection lifecycle (elastic stretch, snap back, particles, block impact) ──
  const onConnectStart = useCallback(() => {
    isConnectingRef.current = true
    nodes.forEach((n) => updateNodeInternals(n.id))
  }, [nodes, updateNodeInternals])

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    if (isConnectingRef.current) {
      // Connection released in the void: snap-back & burst particles
      const clientX =
        (event as MouseEvent).clientX ??
        (event as TouchEvent).changedTouches?.[0]?.clientX ??
        0
      const clientY =
        (event as MouseEvent).clientY ??
        (event as TouchEvent).changedTouches?.[0]?.clientY ??
        0
      if (clientX && clientY) {
        setBursts((prev) => [
          ...prev,
          { id: `burst-${Date.now()}`, x: clientX, y: clientY },
        ])
      }
    }
    isConnectingRef.current = false
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      isConnectingRef.current = false
      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.sourceHandle || ""}-${connection.target}-${Date.now()}`,
        type: "spring",
        updatable: !isReadOnly,
        data: {
          animating: false,
          success: false,
          error: false,
          onDelete: removeEdge,
        },
        style: { stroke: "#18181b", strokeWidth: 2 },
      } as Edge

      // A handle or node can only have 1 connection at a time.
      // If a node/handle is already occupied, remove the previous connection.
      const isConflicting = (e: Edge) => {
        const sameSource =
          e.source === connection.source &&
          (connection.sourceHandle
            ? e.sourceHandle === connection.sourceHandle
            : !e.sourceHandle)

        const sameTarget =
          e.target === connection.target &&
          (connection.targetHandle
            ? e.targetHandle === connection.targetHandle
            : !e.targetHandle)

        return sameSource || sameTarget
      }

      setEdges((eds) => {
        const remaining = eds.filter((e) => !isConflicting(e))
        const finalEdges = [...remaining, newEdge]

        // Update node states for all nodes in the canvas
        setNodes((nds) =>
          nds.map((n) => {
            if (n.type === "lineRail" || n.type === "sticker") return n

            // Source and target of the new connection are connected and bump immediately
            if (n.id === connection.target || n.id === connection.source) {
              return {
                ...n,
                data: {
                  ...n.data,
                  state: "connected",
                  bump: Date.now(),
                },
              }
            }

            // For all other nodes, check if they are still connected in finalEdges
            const isStillConnected = finalEdges.some(
              (e) => e.source === n.id || e.target === n.id
            )

            return {
              ...n,
              data: {
                ...n.data,
                state: isStillConnected ? "connected" : "idle",
              },
            }
          })
        )

        return finalEdges
      })
    },
    [setEdges, setNodes, removeEdge, isReadOnly]
  )

  // ── onExecute ───────────────────────────────────────────────────────────────
  const onExecute = useCallback(async () => {
    if (!canExecute || isExecuting) return

    setIsExecuting(true)
    setAttempts((a) => a + 1)
    setShowTerminal(true)
    setTerminalStatus("running")
    setTerminalLines(["Ejecutando..."])

    const studentConnections = edges.map((e) => ({
      sourceBlockId: e.source,
      targetBlockId: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    }))

    const studentBlockOrder = getStudentBlockOrder(edges, nodes)
    const { code: reconstructedCode } = reconstructCodeFromCanvas(nodes, edges)

    // Local offline validation fallback if disconnected from internet
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const codeBlocks = blocks.filter((b) => b.tipo !== 'sticker')
      const correctBlockIds = [...codeBlocks]
        .sort((a, b) => (a.orden_correcto ?? 0) - (b.orden_correcto ?? 0))
        .map((b) => b.id)
      const correctCode = reconstructCodeFromBlocks(
        blocks.map((b, idx) => ({
          ...b,
          orden_correcto: b.orden_correcto ?? idx,
        }))
      )

      const normalizedReconstructed = (reconstructedCode || '').trim().replace(/\r\n/g, '\n')
      const normalizedCorrect = (correctCode || '').trim().replace(/\r\n/g, '\n')

      const codeMatches =
        normalizedReconstructed.length > 0 &&
        (normalizedReconstructed === normalizedCorrect ||
          normalizedReconstructed.replace(/\s+/g, '') === normalizedCorrect.replace(/\s+/g, ''))

      const orderMatches =
        correctBlockIds.length > 0 &&
        studentBlockOrder.length === correctBlockIds.length &&
        studentBlockOrder.every((id, idx) => id === correctBlockIds[idx])

      const studentConnSet = new Set(
        studentConnections.map((c) => `${c.sourceBlockId}->${c.targetBlockId}`)
      )
      const connMatches =
        connections.length > 0 &&
        studentConnections.length === connections.length &&
        connections.every((c) =>
          studentConnSet.has(`${c.source_block_id}->${c.target_block_id}`)
        )

      const isOfflineSuccess = codeMatches || orderMatches || connMatches

      if (isOfflineSuccess) {
        setTerminalStatus("success")
        const outputLines = resultadoEsperado
          ? resultadoEsperado.split("\n")
          : ["Código ejecutado exitosamente sin errores (Modo offline)."]
        setTerminalLines(outputLines)

        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            data: { ...e.data, success: true, error: false, animating: false },
            style: { stroke: "#22c55e", strokeWidth: 2 },
          }))
        )

        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            draggable: false,
            data: { ...n.data, state: "success", readOnly: true },
          }))
        )

        setCompletedMap((prev) => {
          const updated = { ...prev, [activityId]: true }
          try {
            localStorage.setItem("knoten_completed_activities", JSON.stringify(updated))
          } catch (e) {
            console.error("Error saving completed activities to localStorage", e)
          }
          return updated
        })

        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        })
        return
      } else {
        setTerminalStatus("error")
        setTerminalLines([
          "Error: la secuencia de bloques no es correcta.",
          "Verifica el orden y la conexión de las líneas e inténtalo nuevamente (Modo offline).",
        ])

        // Flash edges red + spring-back animation
        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            data: { ...e.data, error: true, animating: true, success: false },
            style: { stroke: "#ef4444", strokeWidth: 2 },
          }))
        )

        setTimeout(() => {
          setEdges([])
          setNodes((nds) =>
            nds.map((n) => ({
              ...n,
              data: { ...n.data, state: "idle", readOnly: false },
            }))
          )
        }, 1000)
        return
      }
    }

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          studentConnections,
          studentBlockOrder,
          reconstructedCode,
        }),
      })

      const json = await res.json()

      if (json.success) {
        // ── SUCCESS ──────────────────────────────────────────────────────────
        setTerminalStatus("success")
        const outputLines = json.stdout
          ? json.stdout.split("\n")
          : ["Código ejecutado exitosamente sin errores."]
        setTerminalLines(outputLines)

        // Turn all edges green
        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            data: { ...e.data, success: true, error: false, animating: false },
            style: { stroke: "#22c55e", strokeWidth: 2 },
          }))
        )

        // Mark all nodes as success + read-only
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            draggable: false,
            data: { ...n.data, state: "success", readOnly: true },
          }))
        )

        // Mark as completed in local state & localStorage
        setCompletedMap((prev) => {
          const updated = { ...prev, [activityId]: true }
          try {
            localStorage.setItem("knoten_completed_activities", JSON.stringify(updated))
          } catch (e) {
            console.error("Error saving completed activities to localStorage", e)
          }
          return updated
        })

        // Celebrate 🎉
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        })
      } else {
        // ── ERROR ─────────────────────────────────────────────────────────────
        setTerminalStatus("error")
        const errorLines = json.message
          ? json.message.split("\n")
          : [
              "Error: la secuencia no es correcta",
              "Revisa las conexiones e intenta de nuevo",
            ]
        setTerminalLines(errorLines)

        // Flash edges red + spring-back animation
        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            data: { ...e.data, error: true, animating: true, success: false },
            style: { stroke: "#ef4444", strokeWidth: 2 },
          }))
        )

        // After 1 s: delete all edges and reset node states
        setTimeout(() => {
          setEdges([])
          setNodes((nds) =>
            nds.map((n) => ({
              ...n,
              data: { ...n.data, state: "idle", readOnly: false },
            }))
          )
        }, 1000)
      }
    } catch (err) {
      setTerminalStatus("error")
      setTerminalLines([
        "Error de red: no se pudo conectar con el servidor",
        "Comprueba tu conexión e intenta de nuevo",
      ])
    } finally {
      setIsExecuting(false)
    }
  }, [
    activityId,
    canExecute,
    edges,
    isExecuting,
    nodes,
    resultadoEsperado,
    setEdges,
    setNodes,
  ])

  return (
    <div className="w-full h-screen relative">
      {/* Top navigation & activity selector */}
      <div
        className={cn(
          "fixed z-50 flex items-center gap-1.5 sm:gap-2 transition-all duration-300 transform",
          // Desktop / Tablet
          "sm:top-4 sm:left-4 sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto",
          // Mobile: top-2.5 left-2.5 right-2.5 justify-between sm:justify-start sm:right-auto max-w-[calc(100vw-20px)]",
          "top-2.5 left-2.5 right-2.5 justify-between sm:justify-start sm:right-auto",
          isMobileNavFolded && "-translate-y-20 opacity-0 pointer-events-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto"
        )}
      >
        <div className="flex items-center gap-1.5 py-0.5">
          <Link
            href={courseId ? `/curso/${courseId}` : '/'}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/95 backdrop-blur-sm border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 shadow-sm text-xs font-semibold transition shrink-0"
            title="Volver al curso"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{courseName ? courseName : 'Volver al curso'}</span>
            <span className="sm:hidden">Curso</span>
          </Link>

          {/* Activity selector dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setSelectorOpen((prev) => !prev)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/95 backdrop-blur-sm border border-zinc-200 text-zinc-800 text-xs font-semibold shadow-sm hover:bg-zinc-50 transition"
            >
              <div className="flex items-center gap-1.5">
                {isCurrentCompleted && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
                <span className="max-w-[100px] sm:max-w-none truncate">{currentDisplayTitle}</span>
              </div>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0",
                  selectorOpen && "rotate-180"
                )}
              />
            </button>

            {selectorOpen && (
              <div
                className={cn(
                  "bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200 py-2.5 z-[70] overflow-hidden text-xs sm:text-sm animate-dropdown-in",
                  // Mobile and tablet: generous floating overlay positioned below top bar
                  "fixed top-14 left-2.5 right-2.5 max-w-sm sm:max-w-md md:max-w-sm",
                  // Desktop: attached directly below trigger button
                  "lg:absolute lg:top-full lg:left-0 lg:right-auto lg:mt-1.5 lg:w-80"
                )}
              >
                <div className="px-4 py-2 border-b border-zinc-100 text-xs font-semibold text-zinc-500 flex items-center justify-between">
                  <span className="truncate mr-2">{sessionName || "Actividades de la sesión"}</span>
                  <span className="text-[11px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full font-mono shrink-0">
                    {activitiesList.filter((a) => completedMap[a.id]).length}/
                    {activitiesList.length}
                  </span>
                </div>
                <div className="max-h-[65vh] sm:max-h-80 overflow-y-auto py-1 divide-y divide-zinc-50">
                  {activitiesList.map((act, idx) => {
                    const isCurrent = act.id === activityId
                    const isDone = Boolean(completedMap[act.id])
                    const title =
                      act.titulo ||
                      `Actividad ${act.orden !== undefined ? act.orden + 1 : idx + 1}`

                    return (
                      <div
                        key={act.id}
                        className={cn(
                          "group relative flex items-center justify-between px-3.5 py-2.5 sm:py-2 transition-all duration-200",
                          isCurrent
                            ? "bg-zinc-100/95 font-semibold text-zinc-950 shadow-xs"
                            : "hover:bg-zinc-50"
                        )}
                      >
                        {/* Active indicator bar */}
                        {isCurrent && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-zinc-900 rounded-r-full animate-pulse" />
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleSwitchActivity(act.id, e)}
                          className="flex-1 flex items-center gap-2.5 text-zinc-700 hover:text-zinc-950 truncate mr-2 text-left cursor-pointer"
                        >
                          <span
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-medium transition-transform duration-200",
                              isCurrent
                                ? "bg-zinc-900 text-white shadow-xs scale-105 ring-2 ring-zinc-300 ring-offset-1"
                                : "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"
                            )}
                          >
                            {act.orden !== undefined ? act.orden + 1 : idx + 1}
                          </span>
                          <span className="truncate">{title}</span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-600 bg-zinc-200/80 px-1.5 py-0.5 rounded ml-1 animate-pulse">
                              Activa
                            </span>
                          )}
                        </button>

                        {/* Completion toggle button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleCompleted(act.id, e)}
                          title={
                            isDone
                              ? "Desmarcar como resuelta"
                              : "Marcar como resuelta"
                          }
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 hover:text-emerald-700" />
                          ) : (
                            <Circle className="w-5 h-5 text-zinc-300 hover:text-zinc-500" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Next activity button (triggers cartoon zoom-out and enters next activity) */}
          {isCurrentCompleted && nextActivity && (
            <button
              type="button"
              onClick={(e) => handleSwitchActivity(nextActivity.id, e)}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm text-xs font-semibold transition shrink-0 animate-in fade-in slide-in-from-left-2 duration-200 cursor-pointer"
              title="Ir a la siguiente actividad"
            >
              <span className="hidden sm:inline">Siguiente actividad</span>
              <span className="sm:hidden">Siguiente</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Navbar Fold Button */}
        <button
          type="button"
          onClick={() => setIsMobileNavFolded(true)}
          className="sm:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-white/95 backdrop-blur-sm border border-zinc-200 text-zinc-500 hover:text-zinc-900 shadow-sm shrink-0 transition"
          title="Plegar barra superior"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Floating pill when mobile navbar is folded */}
      {isMobileNavFolded && (
        <button
          type="button"
          onClick={() => setIsMobileNavFolded(false)}
          className="fixed top-2.5 left-2.5 z-50 sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-zinc-200 text-zinc-800 shadow-md text-xs font-semibold animate-in fade-in zoom-in-95 duration-150"
          title="Desplegar navegación"
        >
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          <span className="truncate max-w-[120px]">{currentDisplayTitle}</span>
        </button>
      )}

      <Toolbar
        attempts={attempts}
        canExecute={canExecute}
        onExecute={onExecute}
        onCenter={onCenter}
        onAddSticker={onAddSticker}
        onAddIndentBlock={onAddIndentBlock}
        smartGuidesEnabled={smartGuidesEnabled}
        onToggleSmartGuides={handleToggleSmartGuides}
        onAlignLine={alignLine}
        onAlignAllLines={alignAllLines}
        lineCount={nodes.find((n) => n.type === "lineRail" || n.id === "line-rail")?.data?.lines ?? 1}
        onShowProblem={() => setShowProblem(true)}
        isMobileFolded={isMobileToolbarFolded}
        onToggleMobileFold={() => setIsMobileToolbarFolded((prev) => !prev)}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        connectionLineComponent={ElasticConnectionLine}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateStart={onEdgeUpdateStart}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
        onEdgeDoubleClick={onEdgeDoubleClick}
        edgesUpdatable={!isReadOnly}
        edgesFocusable={true}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-gray-50"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#D1D5DB"
          gap={20}
          size={1.5}
        />
        <Controls showInteractive={false} />
        <SmartGuides guideLines={guideLines} />
      </ReactFlow>

      {/* Particle explosion effects on cancelled / broken connections */}
      <ParticleBurst bursts={bursts} onClear={clearBurst} />

      <TerminalModal
        isOpen={showTerminal}
        onClose={() => setShowTerminal(false)}
        lines={terminalLines}
        status={terminalStatus}
      />

      <ProblemModal
        isOpen={showProblem}
        onClose={() => setShowProblem(false)}
        enunciado={enunciado}
        resultadoEsperado={resultadoEsperado}
      />
    </div>
  )
}

// ─── Public export (wraps inner in ReactFlowProvider) ─────────────────────────

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}