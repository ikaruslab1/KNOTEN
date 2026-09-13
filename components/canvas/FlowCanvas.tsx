"use client"

import { useCallback, useState, useRef } from "react"
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  updateEdge,
  useReactFlow,
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
import { ChevronLeft } from "lucide-react"
import CodeBlock from "./CodeBlock"
import IndentBlock from "./IndentBlock"
import StickerNode from "./StickerNode"
import LineRailNode from "./LineRailNode"
import Toolbar from "./Toolbar"
import TerminalModal from "@/components/modals/TerminalModal"
import ProblemModal from "@/components/modals/ProblemModal"
import { reconstructCodeFromCanvas } from "@/lib/code-reconstructor"

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
  onDelete?: (id: string) => void
}

type AppEdge = Edge<EdgeData>

type NodeState = "idle" | "connected" | "success" | "error"

export interface FlowCanvasProps {
  activityId: string
  activityTitle?: string
  courseId?: string
  courseName?: string
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
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
    selected,
  } = props

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isAnimating: boolean = data?.animating ?? false
  const isSuccess: boolean = data?.success ?? false
  const isError: boolean = data?.error ?? false

  const stroke = isSuccess ? "#22c55e" : isError ? "#ef4444" : selected ? "#000000" : "#18181b"
  const strokeWidth = selected ? 2.5 : 2

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
          animation: isAnimating
            ? "springBack 0.8s ease-in-out forwards"
            : undefined,
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
                data?.onDelete?.(id)
              }}
              title="Desconectar enlace"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white border border-zinc-300 shadow-xs text-zinc-400 hover:text-white hover:bg-red-500 hover:border-red-600 transition-all cursor-pointer select-none"
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
    data: { lines: 1, readOnly: false },
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

    const base = {
      id: block.id,
      position: { x: posX, y: posY },
      draggable: true,
    }

    if (block.tipo === "codigo") {
      return {
        ...base,
        type: "codeBlock",
        data: { code: block.contenido ?? '', state: "idle" as NodeState },
      }
    }

    if (block.tipo === "indentacion") {
      return {
        ...base,
        type: "indentBlock",
        data: { rows: 1, state: "idle" as NodeState },
      }
    }

    // sticker
    return {
      ...base,
      type: "sticker",
      data: { emoji: block.contenido ?? '✔️' },
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

// ─── Inner canvas (needs useReactFlow) ───────────────────────────────────────

function FlowCanvasInner({
  activityId,
  activityTitle,
  courseId,
  courseName,
  blocks,
  connections,
  enunciado,
  resultadoEsperado,
  isReadOnly = false,
}: FlowCanvasProps) {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState(blocksToNodes(blocks))
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([])

  const [attempts, setAttempts] = useState(0)
  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>("idle")
  const [showProblem, setShowProblem] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  const onCenter = useCallback(() => {
    fitView({ duration: 500, padding: 0.2 })
  }, [fitView])

  const onAddSticker = useCallback((emoji: '✔️' | '❌' | '❔' | '☣️') => {
    const newNode: Node = {
      id: `sticker-${Date.now()}`,
      type: "sticker",
      position: { x: 250 + Math.random() * 40, y: 150 + Math.random() * 40 },
      data: { emoji },
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
    (edgeId: string) => {
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
      setEdges((els) => {
        const nextEdges = updateEdge(oldEdge, newConnection, els)
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
    (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeUpdateSuccessful.current) {
        removeEdge(edge.id)
      }
      edgeUpdateSuccessful.current = true
    },
    [removeEdge]
  )

  const onEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      removeEdge(edge.id)
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

  // ── onConnect ───────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
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

      setEdges((eds) => addEdge(newEdge, eds))

      // Mark source and target nodes as connected
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === "lineRail" || n.type === "sticker") return n
          if (n.id === connection.source || n.id === connection.target) {
            return { ...n, data: { ...n.data, state: "connected" } }
          }
          return n
        })
      )
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
      {/* Top-left back button & activity title */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
        <Link
          href={courseId ? `/curso/${courseId}` : '/'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-sm border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 shadow-sm text-xs font-semibold transition"
          title="Volver al curso"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{courseName ? courseName : 'Volver al curso'}</span>
        </Link>
        {activityTitle && (
          <span className="hidden sm:inline-block px-3 py-2 rounded-xl bg-white/90 backdrop-blur-sm border border-zinc-200 text-zinc-800 text-xs font-semibold shadow-sm">
            {activityTitle}
          </span>
        )}
      </div>

      <Toolbar
        attempts={attempts}
        canExecute={canExecute}
        onExecute={onExecute}
        onCenter={onCenter}
        onAddSticker={onAddSticker}
        onAddIndentBlock={onAddIndentBlock}
        onShowProblem={() => setShowProblem(true)}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
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
      </ReactFlow>

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