import { Node, Edge } from 'reactflow'

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

  // Map edges
  // railLineEdges: map line handle ID (e.g. 'line-1') to target block ID
  const railLineToTarget = new Map<string, string>()
  // blockNext: map source block ID to target block ID
  const blockNext = new Map<string, string>()

  for (const edge of edges) {
    if (lineRail && edge.source === lineRail.id) {
      if (edge.sourceHandle) {
        railLineToTarget.set(edge.sourceHandle, edge.target)
      }
    } else {
      blockNext.set(edge.source, edge.target)
    }
  }

  const resultLines: string[] = []

  if (lineRail && railLineToTarget.size > 0) {
    // ── Mode 1: Reconstruct using Line Rail in descending order (1, 2, 3...) ───
    const numLines = lineRail.data?.lines ?? Math.max(railLineToTarget.size, 3)

    for (let i = 1; i <= numLines; i++) {
      const handleId = `line-${i}`
      const startId = railLineToTarget.get(handleId)
      if (!startId) continue

      const { lineCode } = traverseLineChain(startId, nodeMap, blockNext)
      if (lineCode.trim()) {
        resultLines.push(lineCode)
      }
    }
  } else {
    // ── Mode 2: Fallback — find chains not originating from line-rail ─────────
    const codeNodes = nodes.filter(
      (n) => n.type === 'codeBlock' || n.type === 'indentBlock',
    )
    const inDegree = new Map<string, number>()
    for (const edge of edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    }

    // Heads are nodes with 0 incoming edges
    const heads = codeNodes
      .filter((n) => (inDegree.get(n.id) || 0) === 0)
      .sort((a, b) => a.position.y - b.position.y)

    const visitedGlobally = new Set<string>()

    for (const head of heads) {
      if (visitedGlobally.has(head.id)) continue
      const { lineCode, visited } = traverseLineChain(head.id, nodeMap, blockNext)
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
 * Traverses a chain of nodes starting from startId, accumulating tokens and indentation.
 */
function traverseLineChain(
  startId: string,
  nodeMap: Map<string, Node>,
  blockNext: Map<string, string>,
): { lineCode: string; visited: Set<string> } {
  const visited = new Set<string>()
  const tokens: string[] = []
  let indentDepth = 0
  let curr: string | undefined = startId

  while (curr && !visited.has(curr)) {
    visited.add(curr)
    const node = nodeMap.get(curr)
    if (!node) break

    if (node.type === 'codeBlock') {
      const code = node.data?.code ?? ''
      if (code) tokens.push(code)
    } else if (node.type === 'indentBlock') {
      indentDepth += 1
    }

    curr = blockNext.get(curr)
  }

  const indentation = ' '.repeat(indentDepth * 4)
  const lineCode = indentation + joinTokens(tokens)

  return { lineCode, visited }
}
