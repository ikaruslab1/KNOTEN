import type { Node, Edge } from 'reactflow'

/**
 * Formats a sequence of Python tokens into a clean statement with standard Python spacing.
 */
export function joinTokens(tokens: string[]): string {
  let line = ''
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const prev = i > 0 ? tokens[i - 1] : null

    if (i === 0) {
      line += t
      continue
    }

    // No space before: ')', ']', '}', ':', ',', '.', ';'
    if ([')', ']', '}', ':', ',', '.', ';'].includes(t)) {
      line += t
      continue
    }

    // No space after: '(', '[', '{', '.'
    if (prev && ['(', '[', '{', '.'].includes(prev)) {
      line += t
      continue
    }

    // No space before '(' if preceded by an identifier (function call / definition)
    if (t === '(' && prev && /^[a-zA-Z_]\w*$/.test(prev)) {
      line += t
      continue
    }

    line += ' ' + t
  }
  return line
}

/**
 * Reconstructs the complete Python code from the canvas nodes and connections.
 * 
 * Supports:
 * 1. Line Rail navigation: starts from line-1, line-2, etc. and follows each line's chain.
 * 2. Indentation blocks (indentBlock): computes indent level.
 * 3. Fallback: if Line Rail is not connected, traverses chains sorted by Y-position.
 */
export function reconstructCodeFromCanvas(
  nodes: Node[],
  edges: Edge[],
): { code: string; lines: string[] } {
  const lineRail = nodes.find((n) => n.type === 'lineRail' || n.id === 'line-rail')
  const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]))

  const resultLines: string[] = []

  if (lineRail) {
    // ── Mode 1: Reconstruct using Line Rail in descending order (1, 2, 3...) ───
    // Find all edges starting from line-rail
    const railEdges = edges.filter(
      (e) => e.source === lineRail.id || e.source === 'line-rail'
    )

    // Calculate maximum line number present on rail
    const handleMaxLine = railEdges.reduce((max, e) => {
      const m = (e.sourceHandle || '').match(/^line-(\d+)$/)
      return m ? Math.max(max, parseInt(m[1], 10)) : max
    }, 1)
    const numLines = Math.max(lineRail.data?.lines ?? 1, handleMaxLine)

    for (let i = 1; i <= numLines; i++) {
      const handleId = `line-${i}`
      const startEdge = railEdges.find(
        (e) => e.sourceHandle === handleId || (!e.sourceHandle && i === 1)
      )
      if (!startEdge) continue

      const { lineCode } = followLineChain(startEdge, nodeMap, edges)
      if (lineCode.trim()) {
        resultLines.push(lineCode)
      }
    }
  } else {
    // ── Mode 2: Fallback — find chains not originating from line-rail ─────────
    const codeNodes = nodes.filter(
      (n) => n.type === 'codeBlock' || n.type === 'indentBlock'
    )

    // Set of edges that enter nodes
    const incomingEdgeTargets = new Set(edges.map((e) => `${e.target}:${e.targetHandle || ''}`))
    const targetNodeIds = new Set(edges.map((e) => e.target))

    type StartCandidate = {
      edge?: Edge
      nodeId: string
      y: number
    }
    const startCandidates: StartCandidate[] = []

    for (const node of codeNodes) {
      if (node.type === 'indentBlock') {
        const rows = node.data?.rows ?? 1
        for (let r = 0; r < rows; r++) {
          const hasIncoming = incomingEdgeTargets.has(`${node.id}:left-${r}`)
          const outEdge = edges.find(
            (e) => e.source === node.id && e.sourceHandle === `right-${r}`
          )
          if (!hasIncoming && outEdge) {
            startCandidates.push({
              edge: outEdge,
              nodeId: node.id,
              y: node.position.y + r * 64,
            })
          }
        }
      } else if (node.type === 'codeBlock') {
        if (!targetNodeIds.has(node.id)) {
          startCandidates.push({
            nodeId: node.id,
            y: node.position.y,
          })
        }
      }
    }

    startCandidates.sort((a, b) => a.y - b.y)
    const visitedGlobally = new Set<string>()

    for (const cand of startCandidates) {
      if (visitedGlobally.has(cand.nodeId)) continue
      const { lineCode, visited } = cand.edge
        ? followLineChain(cand.edge, nodeMap, edges)
        : followCodeNodeChain(cand.nodeId, nodeMap, edges)

      visited.forEach((id) => visitedGlobally.add(id))
      if (lineCode.trim()) {
        resultLines.push(lineCode)
      }
    }
  }

  return {
    code: resultLines.join('\n'),
    lines: resultLines,
  }
}

/**
 * Follows an edge starting from lineRail or an indentBlock output handle through the chain.
 */
function followLineChain(
  initialEdge: Edge,
  nodeMap: Map<string, Node>,
  edges: Edge[],
): { lineCode: string; visited: Set<string> } {
  const visited = new Set<string>()
  const tokens: string[] = []
  let indentDepth = 0

  let currentTargetId: string | undefined = initialEdge.target
  let currentTargetHandle: string | null | undefined = initialEdge.targetHandle

  while (currentTargetId) {
    const visitKey = `${currentTargetId}:${currentTargetHandle || ''}`
    if (visited.has(visitKey)) break
    visited.add(visitKey)

    const node = nodeMap.get(currentTargetId)
    if (!node) break

    if (node.type === 'indentBlock') {
      // Determine indent level from targetHandle (e.g. 'left-0' -> 1, 'left-1' -> 2)
      let rowIdx = 0
      if (currentTargetHandle) {
        const m = currentTargetHandle.match(/left-(\d+)/)
        if (m) rowIdx = parseInt(m[1], 10)
      }
      indentDepth += rowIdx + 1

      // Find the corresponding outgoing edge from this row
      const outHandle = `right-${rowIdx}`
      const outEdge =
        edges.find((e) => e.source === currentTargetId && e.sourceHandle === outHandle) ||
        edges.find((e) => e.source === currentTargetId)

      if (outEdge) {
        currentTargetId = outEdge.target
        currentTargetHandle = outEdge.targetHandle
      } else {
        currentTargetId = undefined
        currentTargetHandle = undefined
      }
    } else if (node.type === 'codeBlock') {
      const code = node.data?.code ?? ''
      if (code) tokens.push(code)

      // Find outgoing edge from this code block
      const outEdge = edges.find((e) => e.source === currentTargetId)
      if (outEdge) {
        currentTargetId = outEdge.target
        currentTargetHandle = outEdge.targetHandle
      } else {
        currentTargetId = undefined
        currentTargetHandle = undefined
      }
    } else {
      // Other node types (e.g. sticker): ignore tokens and follow edge
      const outEdge = edges.find((e) => e.source === currentTargetId)
      if (outEdge) {
        currentTargetId = outEdge.target
        currentTargetHandle = outEdge.targetHandle
      } else {
        currentTargetId = undefined
        currentTargetHandle = undefined
      }
    }
  }

  const indentation = ' '.repeat(indentDepth * 4)
  const lineCode = indentation + joinTokens(tokens)
  return { lineCode, visited }
}

/**
 * Follows a code block chain starting directly from a codeBlock node (used in fallback).
 */
function followCodeNodeChain(
  startNodeId: string,
  nodeMap: Map<string, Node>,
  edges: Edge[],
): { lineCode: string; visited: Set<string> } {
  const dummyEdge: Edge = {
    id: 'dummy',
    source: '',
    target: startNodeId,
  }
  return followLineChain(dummyEdge, nodeMap, edges)
}

export type BlockForReconstruction = {
  tipo: string
  contenido: string | null
  orden_correcto: number
  indent_level?: number | null
  posicion_y?: number | null
}

/**
 * Reconstructs the reference Python code from database blocks sorted by orden_correcto.
 */
export function reconstructCodeFromBlocks(blocks: BlockForReconstruction[]): string {
  if (!blocks || blocks.length === 0) return ''
  const sorted = [...blocks].sort((a, b) => (a.orden_correcto ?? 0) - (b.orden_correcto ?? 0))
  const codeBlocks = sorted.filter(
    (b) => b.tipo === 'codigo' && b.contenido !== null && b.contenido !== undefined
  )
  if (codeBlocks.length === 0) return ''

  const lines: { indent: number; tokens: string[] }[] = []
  let currentTokens: string[] = []
  let currentIndent = codeBlocks[0].indent_level ?? 0
  let currentY = codeBlocks[0].posicion_y ?? 0

  for (const b of codeBlocks) {
    const isNewLine =
      b.posicion_y !== undefined &&
      b.posicion_y !== null &&
      Math.abs((b.posicion_y ?? 0) - currentY) > 25

    if (isNewLine && currentTokens.length > 0) {
      lines.push({ indent: currentIndent, tokens: currentTokens })
      currentTokens = []
      currentIndent = b.indent_level ?? 0
      currentY = b.posicion_y ?? 0
    }

    currentTokens.push(b.contenido ?? '')
  }

  if (currentTokens.length > 0) {
    lines.push({ indent: currentIndent, tokens: currentTokens })
  }

  return lines
    .map((l) => ' '.repeat(Math.max(0, l.indent) * 4) + joinTokens(l.tokens))
    .join('\n')
}

