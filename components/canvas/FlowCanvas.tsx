"use client"

import { useCallback, useState, useRef } from "react"
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  BezierEdge,
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
import Toolbar from "./Toolbar"
import TerminalModal from "@/components/modals/TerminalModal"
import ProblemModal from "@/components/modals/ProblemModal"

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
  animating: boolean
  success: boolean
  error: boolean
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
  const { data, ...rest } = props
  const isAnimating: boolean = data?.animating ?? false
  const isSuccess: boolean = data?.success ?? false
  const isError: boolean = data?.error ?? false

  const stroke = isSuccess ? "#22c55e" : isError ? "#ef4444" : "#18181b"

  return (
    <>
      {isAnimating && <style>{springKeyframes}</style>}
      <BezierEdge
        {...rest}
        data={data}
        style={{
          stroke,
          strokeWidth: 2,
          animation: isAnimating
            ? "springBack 0.8s ease-in-out forwards"
            : undefined,
        }}
      />
    </>
  )
}

// ─── Node types map ───────────────────────────────────────────────────────────

const nodeTypes = {
  codeBlock: CodeBlock,
  indentBlock: IndentBlock,
  sticker: StickerNode,
}

const edgeTypes = {
  spring: SpringEdge,
}

// ─── Helper: initialise nodes from blocks ─────────────────────────────────────

function blocksToNodes(blocks: Block[]): Node[] {
  return blocks.map((block, index) => {
    // Default staggered layout if positions are 0 or unset
    const defaultX = 120 + (index % 2) * 320
    const defaultY = 120 + Math.floor(index / 2) * 160
    const posX =
      block.posicion_x !== undefined && block.posicion_x !== 0
        ? block.posicion_x
        : defaultX
    const posY =
      block.posicion_y !== undefined && block.posicion_y !== 0
        ? block.posicion_y
        : defaultY

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
  // A minimal spanning connection: edges >= (non-sticker nodes - 1)
  const nonStickerCount = blocks.filter((b) => b.tipo !== "sticker").length
  const canExecute = edges.length >= Math.max(0, nonStickerCount - 1)

  // ── onConnect ───────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        type: "spring",
        data: { animating: false, success: false, error: false },
        style: { stroke: "#18181b", strokeWidth: 2 },
      } as Edge

      setEdges((eds) => addEdge(newEdge, eds))

      // Mark source and target nodes as connected
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === connection.source || n.id === connection.target) {
            return { ...n, data: { ...n.data, state: "connected" } }
          }
          return n
        })
      )
    },
    [setEdges, setNodes]
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
    }))

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, studentConnections }),
      })

      const json = await res.json()

      if (json.success) {
        // ── SUCCESS ──────────────────────────────────────────────────────────
        setTerminalStatus("success")
        setTerminalLines(resultadoEsperado.split("\n"))

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
        setTerminalLines([
          "Error: la secuencia no es correcta",
          "Revisa las conexiones e intenta de nuevo",
        ])

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
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        deleteKeyCode="Backspace"
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