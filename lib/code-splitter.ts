export type SplitBlock = {
  tipo: 'codigo' | 'indentacion'
  contenido: string // empty string for indentation blocks
  orden_correcto: number
  indent_level: number // 0-based indentation depth (each 4 spaces = 1 level)
}

// Keywords that introduce an indentation block
const INDENT_KEYWORDS = [
  'if ',
  'elif ',
  'else:',
  'for ',
  'while ',
  'def ',
  'class ',
  'with ',
  'try:',
  'except',
  'finally:',
  'async def ',
  'async for ',
  'async with ',
]

/**
 * Returns true if the trimmed line starts with any of the INDENT_KEYWORDS.
 * These are the lines that introduce a new indentation scope.
 */
function isIndentKeywordLine(trimmed: string): boolean {
  return INDENT_KEYWORDS.some((kw) => trimmed.startsWith(kw))
}

/**
 * Calculates the 0-based indentation depth of a raw line.
 * Each group of 4 leading spaces counts as 1 level.
 * Tabs are treated as 4 spaces each.
 */
function calcIndentLevel(rawLine: string): number {
  let spaces = 0
  for (const ch of rawLine) {
    if (ch === ' ') spaces++
    else if (ch === '\t') spaces += 4
    else break
  }
  return Math.floor(spaces / 4)
}

/**
 * Splits raw Python source code into an ordered array of SplitBlock objects.
 *
 * Rules:
 * - Blank / whitespace-only lines are skipped.
 * - Every meaningful line becomes a 'codigo' block whose `contenido` is the
 *   trimmed source text (leading indent stripped, preserved in `indent_level`).
 * - If a 'codigo' line introduces a new indent scope (ends with ':' AND starts
 *   with an INDENT_KEYWORD), an additional 'indentacion' placeholder block is
 *   inserted immediately after it. The placeholder has `contenido: ''` and the
 *   same `indent_level` as its parent line.
 * - `orden_correcto` is assigned sequentially starting from 0.
 */
export function splitPythonCode(rawCode: string): SplitBlock[] {
  const lines = rawCode.split('\n')
  const blocks: SplitBlock[] = []
  let order = 0

  for (const line of lines) {
    // Skip blank lines
    if (line.trim() === '') continue

    const indentLevel = calcIndentLevel(line)
    const trimmed = line.trim()

    // Every non-empty line becomes a 'codigo' block
    const codeBlock: SplitBlock = {
      tipo: 'codigo',
      contenido: trimmed,
      orden_correcto: order++,
      indent_level: indentLevel,
    }
    blocks.push(codeBlock)

    // If the line ends with ':' and starts with an indent keyword,
    // insert an 'indentacion' placeholder immediately after it.
    if (trimmed.endsWith(':') && isIndentKeywordLine(trimmed)) {
      const indentBlock: SplitBlock = {
        tipo: 'indentacion',
        contenido: '',
        orden_correcto: order++,
        indent_level: indentLevel,
      }
      blocks.push(indentBlock)
    }
  }

  return blocks
}

/**
 * Returns suggested initial (x, y) canvas positions for each block.
 *
 * Layout rules:
 * - Start at x=100, y=100.
 * - Stack blocks vertically with 80 px between each.
 * - Indent deeper blocks 40 px to the right per indent level.
 */
export function getDefaultPositions(
  blocks: SplitBlock[],
): { x: number; y: number }[] {
  const START_X = 100
  const START_Y = 100
  const Y_GAP = 80
  const X_INDENT = 40

  return blocks.map((block, index) => ({
    x: START_X + block.indent_level * X_INDENT,
    y: START_Y + index * Y_GAP,
  }))
}
