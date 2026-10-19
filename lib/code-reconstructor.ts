import type { Node, Edge } from 'reactflow'

const PYTHON_SPACE_BEFORE_PAREN_KEYWORDS = new Set([
  'if',
  'elif',
  'else',
  'while',
  'for',
  'return',
  'not',
  'and',
  'or',
  'in',
  'is',
  'lambda',
  'yield',
  'assert',
  'del',
  'raise',
  'with',
  'from',
  'import',
  'except',
])

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

    // No space before '(' if preceded by an identifier (function call / definition),
    // EXCEPT for Python control-flow / logical keywords like `if`, `elif`, `not`, `and`, `or`.
    if (
      t === '(' &&
      prev &&
      /^[a-zA-Z_]\w*$/.test(prev) &&
      !PYTHON_SPACE_BEFORE_PAREN_KEYWORDS.has(prev)
    ) {
      line += t
      continue
    }

    line += ' ' + t
  }
  return line
}

export type ReconstructedLineDetail = {
  lineNumber: number // 1-indexed line number in reconstructed code
  railLineNumber?: number // 1-indexed handle number on LineRailNode if connected
  code: string
  trimmedCode: string
  indentLevel: number
  nodeIds: string[]
  edgeIds: string[]
  kind: 'if' | 'elif' | 'else' | 'statement'
}

type RawLineSegment = {
  railLineNumber?: number
  tokens: string[]
  nodeIds: string[]
  edgeIds: string[]
  indentNodeIds: string[]
  indentRowIndices: number[]
  inlineForcedIndent?: number
}

function classifyLineKind(trimmed: string): 'if' | 'elif' | 'else' | 'statement' {
  if (/^if(?:\s|\()/.test(trimmed)) return 'if'
  if (/^elif(?:\s|\()/.test(trimmed)) return 'elif'
  if (/^else\s*:/.test(trimmed)) return 'else'
  return 'statement'
}

/**
 * Resolves indentation levels across all reconstructed line segments so that:
 * 1. Single-level and multi-level nested `if / elif / else` structures produce valid Python indentation.
 * 2. Both mental models for `IndentBlock` work seamlessly:
 *    - Stretching a single `IndentBlock` across multiple rows for the same block or nested blocks
 *    - Placing separate `IndentBlock`s per line or chaining `IndentBlock`s horizontally for nested levels
 */
function resolveSegmentsToLines(segments: RawLineSegment[]): ReconstructedLineDetail[] {
  const details: ReconstructedLineDetail[] = []
  let prevIndent = 0
  let prevEndsWithColon = false
  const openIfIndents: number[] = []
  const indentNodeBaseLevel = new Map<string, number>()

  for (const seg of segments) {
    const trimmed = joinTokens(seg.tokens).trim()
    if (!trimmed) continue

    const kind = classifyLineKind(trimmed)
    const isElifOrElse = kind === 'elif' || kind === 'else'
    const hasIndentBlocks = seg.indentNodeIds.length > 0
    let indentLevel = 0

    if (seg.inlineForcedIndent !== undefined) {
      indentLevel = seg.inlineForcedIndent
    } else if (!hasIndentBlocks) {
      indentLevel = 0
    } else {
      const lastIndentId = seg.indentNodeIds[seg.indentNodeIds.length - 1]
      const lastRowIdx = seg.indentRowIndices[seg.indentRowIndices.length - 1] ?? 0

      if (isElifOrElse) {
        // `elif` and `else` with IndentBlock(s) must pair with an open `if` at indent >= 1
        const rawCandidate =
          seg.indentNodeIds.length > 1
            ? seg.indentNodeIds.length
            : indentNodeBaseLevel.get(lastIndentId) ?? lastRowIdx + 1

        const validOpenIndents = openIfIndents.filter((lvl) => lvl >= 1 && lvl <= prevIndent)
        if (validOpenIndents.length > 0) {
          // Pick closest open `if` indent <= rawCandidate, or highest valid open indent
          const leq = validOpenIndents.filter((lvl) => lvl <= rawCandidate)
          indentLevel =
            leq.length > 0 ? leq[leq.length - 1] : validOpenIndents[validOpenIndents.length - 1]
        } else {
          indentLevel = Math.max(1, Math.min(rawCandidate, prevIndent))
        }
      } else if (prevEndsWithColon) {
        // In Python, a statement with an IndentBlock immediately after a `:` header at `prevIndent`
        // MUST be indented at `prevIndent + 1`.
        indentLevel = prevIndent + 1
        indentNodeBaseLevel.set(lastIndentId, indentLevel)
      } else {
        // Continuation line inside an already-open indented block:
        // Cannot exceed `prevIndent` in Python when the previous line did not end with `:`.
        let candidate: number
        if (seg.indentNodeIds.length > 1) {
          candidate = seg.indentNodeIds.length
        } else if (indentNodeBaseLevel.has(lastIndentId)) {
          candidate = indentNodeBaseLevel.get(lastIndentId)!
        } else {
          candidate = lastRowIdx + 1
          indentNodeBaseLevel.set(lastIndentId, Math.max(1, Math.min(candidate, prevIndent)))
        }
        indentLevel = Math.max(1, Math.min(candidate, prevIndent))
      }
    }

    // Maintain stack of open `if` indentation levels
    while (openIfIndents.length > 0 && openIfIndents[openIfIndents.length - 1] > indentLevel) {
      openIfIndents.pop()
    }
    if (kind === 'if') {
      if (openIfIndents[openIfIndents.length - 1] !== indentLevel) {
        openIfIndents.push(indentLevel)
      }
    } else if (kind === 'else') {
      // `else:` closes the current `if/elif` header at `indentLevel` once its body is entered,
      // though we pop any deeper `if`s above. Keep `indentLevel` popped so a subsequent `else` can't re-match it.
      if (openIfIndents[openIfIndents.length - 1] === indentLevel) {
        openIfIndents.pop()
      }
    }

    const code = ' '.repeat(indentLevel * 4) + trimmed
    const lineNumber = details.length + 1

    details.push({
      lineNumber,
      railLineNumber: seg.railLineNumber,
      code,
      trimmedCode: trimmed,
      indentLevel,
      nodeIds: Array.from(new Set(seg.nodeIds)),
      edgeIds: Array.from(new Set(seg.edgeIds)),
      kind,
    })

    prevIndent = indentLevel
    prevEndsWithColon = trimmed.endsWith(':')
  }

  return details
}

/**
 * Reconstructs the complete Python code from the canvas nodes and connections.
 *
 * Supports:
 * 1. Line Rail navigation: starts from line-1, line-2, etc. and follows each line's chain.
 * 2. Indentation blocks (indentBlock): computes indent level for single and nested conditionals.
 * 3. Fallback: if Line Rail is not connected, traverses chains sorted by Y-position.
 */
export function reconstructCodeFromCanvas(
  nodes: Node[],
  edges: Edge[],
): { code: string; lines: string[]; lineDetails: ReconstructedLineDetail[] } {
  const lineRail = nodes.find((n) => n.type === 'lineRail' || n.id === 'line-rail')
  const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]))

  const rawSegments: RawLineSegment[] = []

  if (lineRail) {
    // ── Mode 1: Reconstruct using Line Rail in ascending order (1, 2, 3...) ───
    const railEdges = edges.filter(
      (e) => e.source === lineRail.id || e.source === 'line-rail'
    )

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

      const { segments } = followLineChain(startEdge, nodeMap, edges, i)
      rawSegments.push(...segments)
    }
  } else {
    // ── Mode 2: Fallback — find chains not originating from line-rail ─────────
    const codeNodes = nodes.filter(
      (n) => n.type === 'codeBlock' || n.type === 'indentBlock'
    )

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
      const { segments, visited } = cand.edge
        ? followLineChain(cand.edge, nodeMap, edges)
        : followCodeNodeChain(cand.nodeId, nodeMap, edges)

      visited.forEach((id) => visitedGlobally.add(id))
      rawSegments.push(...segments)
    }
  }

  const lineDetails = resolveSegmentsToLines(rawSegments)
  const resultLines = lineDetails.map((d) => d.code)

  return {
    code: resultLines.join('\n'),
    lines: resultLines,
    lineDetails,
  }
}

/**
 * Follows an edge starting from lineRail or an indentBlock output handle through the chain.
 * If an `indentBlock` is encountered mid-chain AFTER code tokens (e.g. `if x > 0 : -> Indent -> print(x)`),
 * it automatically splits into a new logical line segment so inline single-chain conditionals also work.
 */
function followLineChain(
  initialEdge: Edge,
  nodeMap: Map<string, Node>,
  edges: Edge[],
  railLineNumber?: number,
): { segments: RawLineSegment[]; visited: Set<string> } {
  const visited = new Set<string>()
  const segments: RawLineSegment[] = []

  let currentSegment: RawLineSegment = {
    railLineNumber,
    tokens: [],
    nodeIds: [],
    edgeIds: initialEdge.id && initialEdge.id !== 'dummy' ? [initialEdge.id] : [],
    indentNodeIds: [],
    indentRowIndices: [],
  }

  // If initialEdge starts directly from an indentBlock (fallback mode), record that indentBlock
  if (initialEdge.source) {
    const sourceNode = nodeMap.get(initialEdge.source)
    if (sourceNode?.type === 'indentBlock') {
      let rIdx = 0
      const m = (initialEdge.sourceHandle || '').match(/right-(\d+)/)
      if (m) rIdx = parseInt(m[1], 10)
      currentSegment.nodeIds.push(sourceNode.id)
      currentSegment.indentNodeIds.push(sourceNode.id)
      currentSegment.indentRowIndices.push(rIdx)
    }
  }

  let currentTargetId: string | undefined = initialEdge.target
  let currentTargetHandle: string | null | undefined = initialEdge.targetHandle

  while (currentTargetId) {
    const visitKey = `${currentTargetId}:${currentTargetHandle || ''}`
    if (visited.has(visitKey)) break
    visited.add(visitKey)

    const node = nodeMap.get(currentTargetId)
    if (!node) break

    if (node.type === 'indentBlock') {
      let rowIdx = 0
      if (currentTargetHandle) {
        const m = currentTargetHandle.match(/left-(\d+)/)
        if (m) rowIdx = parseInt(m[1], 10)
      }

      // If we already collected code tokens on this segment (e.g. `if cond : -> IndentBlock -> ...`),
      // flush the current segment and start a new indented segment!
      if (currentSegment.tokens.length > 0) {
        segments.push(currentSegment)
        currentSegment = {
          railLineNumber,
          tokens: [],
          nodeIds: [],
          edgeIds: [],
          indentNodeIds: [],
          indentRowIndices: [],
        }
      }

      currentSegment.nodeIds.push(node.id)
      currentSegment.indentNodeIds.push(node.id)
      currentSegment.indentRowIndices.push(rowIdx)

      const outHandle = `right-${rowIdx}`
      const outEdge =
        edges.find((e) => e.source === currentTargetId && e.sourceHandle === outHandle) ||
        edges.find((e) => e.source === currentTargetId)

      if (outEdge) {
        currentSegment.edgeIds.push(outEdge.id)
        currentTargetId = outEdge.target
        currentTargetHandle = outEdge.targetHandle
      } else {
        currentTargetId = undefined
        currentTargetHandle = undefined
      }
    } else if (node.type === 'codeBlock') {
      const code = node.data?.code ?? ''
      currentSegment.nodeIds.push(node.id)
      if (code) currentSegment.tokens.push(code)

      const outEdge = edges.find((e) => e.source === currentTargetId)
      if (outEdge) {
        currentSegment.edgeIds.push(outEdge.id)
        currentTargetId = outEdge.target
        currentTargetHandle = outEdge.targetHandle
      } else {
        currentTargetId = undefined
        currentTargetHandle = undefined
      }
    } else {
      const outEdge = edges.find((e) => e.source === currentTargetId)
      if (outEdge) {
        currentSegment.edgeIds.push(outEdge.id)
        currentTargetId = outEdge.target
        currentTargetHandle = outEdge.targetHandle
      } else {
        currentTargetId = undefined
        currentTargetHandle = undefined
      }
    }
  }

  if (currentSegment.tokens.length > 0) {
    segments.push(currentSegment)
  }

  return { segments, visited }
}

/**
 * Follows a code block chain starting directly from a codeBlock node (used in fallback).
 */
function followCodeNodeChain(
  startNodeId: string,
  nodeMap: Map<string, Node>,
  edges: Edge[],
): { segments: RawLineSegment[]; visited: Set<string> } {
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
  line_index?: number | null
}

/**
 * Reconstructs the reference Python code from database blocks sorted by orden_correcto.
 */
export function reconstructCodeFromBlocks(blocks: BlockForReconstruction[]): string {
  if (!blocks || blocks.length === 0) return ''
  const sorted = [...blocks].sort((a, b) => (a.orden_correcto ?? 0) - (b.orden_correcto ?? 0))

  const lines: { indent: number; tokens: string[] }[] = []
  let currentTokens: string[] = []
  let currentIndent = 0
  let currentY: number | null = null
  let currentLineIdx: number | null = null
  let forceBreakNext = false

  for (const b of sorted) {
    if (b.tipo === 'indentacion') {
      // An 'indentacion' block always follows the end of a header line (e.g. `if ...:`)
      if (currentTokens.length > 0) {
        lines.push({ indent: currentIndent, tokens: currentTokens })
        currentTokens = []
      }
      forceBreakNext = true
      continue
    }

    if (b.tipo !== 'codigo' || b.contenido === null || b.contenido === undefined) {
      continue
    }

    const bIndent = b.indent_level ?? 0
    const bY = b.posicion_y !== undefined && b.posicion_y !== null ? b.posicion_y : null
    const bLineIdx = b.line_index !== undefined && b.line_index !== null ? b.line_index : null

    const isNewLineByLineIdx =
      bLineIdx !== null && currentLineIdx !== null && bLineIdx !== currentLineIdx
    const isNewLineByY =
      bLineIdx === null && bY !== null && currentY !== null && Math.abs(bY - currentY) > 25
    const isNewLineByIndentChange = currentTokens.length > 0 && bIndent !== currentIndent

    if (
      currentTokens.length > 0 &&
      (forceBreakNext || isNewLineByLineIdx || isNewLineByY || isNewLineByIndentChange)
    ) {
      lines.push({ indent: currentIndent, tokens: currentTokens })
      currentTokens = []
    }

    if (currentTokens.length === 0) {
      currentIndent = bIndent
      currentY = bY
      currentLineIdx = bLineIdx
      forceBreakNext = false
    }

    currentTokens.push(b.contenido)
  }

  if (currentTokens.length > 0) {
    lines.push({ indent: currentIndent, tokens: currentTokens })
  }

  return lines
    .map((l) => ' '.repeat(Math.max(0, l.indent) * 4) + joinTokens(l.tokens))
    .join('\n')
}


