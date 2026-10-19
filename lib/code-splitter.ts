export type SplitBlock = {
  tipo: 'codigo' | 'indentacion' | 'sticker'
  contenido: string // empty string for indentation blocks
  orden_correcto: number
  indent_level: number // 0-based indentation depth (each 4 spaces = 1 level)
  line_index?: number // 0-based line number for layout grouping
}

// Keywords that introduce an indentation block
const INDENT_KEYWORDS_REGEX = /^(?:if|elif|else|for|while|def|class|with|try|except|finally|match|case|async\s+(?:def|for|with))\b/

/**
 * Returns true if the trimmed line starts with any of the Python block keywords.
 * Handles both `if x > 0:` and `if(x > 0):`.
 */
function isIndentKeywordLine(trimmed: string): boolean {
  return INDENT_KEYWORDS_REGEX.test(trimmed)
}

/**
 * Calculates the 0-based indentation depth of a raw line.
 * Supports standard 4-space indentation as well as 2-space indentation if used consistently.
 * Tabs are treated as 4 spaces each.
 */
function calcIndentSpaces(rawLine: string): number {
  let spaces = 0
  for (const ch of rawLine) {
    if (ch === ' ') spaces++
    else if (ch === '\t') spaces += 4
    else break
  }
  return spaces
}

/**
 * Normalizes raw leading space counts across lines into 0-based indentation levels (0, 1, 2...).
 */
function computeLineIndentLevels(rawLines: string[]): number[] {
  const spaceCounts = rawLines.map((l) => (l.trim() === '' ? 0 : calcIndentSpaces(l)))
  const nonZero = spaceCounts.filter((s) => s > 0)
  if (nonZero.length === 0) return spaceCounts.map(() => 0)

  // Detect indentation unit (usually 4, or 2 if 2-space indentation is used)
  const minIndent = Math.min(...nonZero)
  const unit = minIndent >= 4 ? 4 : minIndent >= 2 ? minIndent : 1

  const indentStack: number[] = [0]
  return rawLines.map((l, idx) => {
    if (l.trim() === '') return 0
    const sp = spaceCounts[idx]
    if (sp === 0) {
      indentStack.length = 1
      return 0
    }
    if (sp > indentStack[indentStack.length - 1]) {
      indentStack.push(sp)
      return indentStack.length - 1
    }
    while (indentStack.length > 1 && indentStack[indentStack.length - 1] > sp) {
      indentStack.pop()
    }
    return Math.max(1, indentStack.length - 1 || Math.round(sp / unit))
  })
}

/**
 * Tokenizes a single line of Python source code into constituent syntactic tokens.
 * Matches:
 * - String literals (with f/r/b prefixes, single/double/triple quotes)
 * - Number literals (floats, ints, hex, binary)
 * - Multi-character operators (==, !=, <=, >=, +=, -=, *=, /=, //, **, etc.)
 * - Identifiers and Python keywords
 * - Single-character delimiters and operators
 * Strips comments outside strings.
 */
export function tokenizeLine(line: string): string[] {
  const tokenRegex =
    /([fFrRbBuU]?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))|(#[^\r\n]*)|(0[xXoObB][0-9a-fA-F_]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\*\*=|--|\+\+|\/\/=|<<=|>>=|\*\*|\/\/|<<|>>|->|==|!=|<=|>=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=)|([a-zA-Z_]\w*)|([+\-*/%=<>!&|^~():,.[\]{}])/g

  const tokens: string[] = []
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(line)) !== null) {
    // If it is a comment (match[2]), stop processing remainder of the line
    if (match[2]) break
    tokens.push(match[0])
  }

  return tokens
}

/**
 * Splits raw Python source code into an ordered array of SplitBlock objects.
 *
 * Rules:
 * - Blank / whitespace-only lines are skipped.
 * - Each code line is tokenized into individual syntactic token blocks ('codigo').
 *   For example, `x = 10` produces 3 blocks: `"x"`, `"="`, `"10"`.
 * - If a line introduces a new indent scope (ends with ':' AND starts
 *   with an INDENT_KEYWORD), an additional 'indentacion' placeholder block is
 *   appended after its tokens with the target scope's indent_level (indentLevel + 1).
 * - `orden_correcto` is assigned sequentially starting from 0.
 */
export function splitPythonCode(rawCode: string): SplitBlock[] {
  const lines = rawCode.split('\n')
  const lineIndents = computeLineIndentLevels(lines)
  const blocks: SplitBlock[] = []
  let order = 0
  let lineIdx = 0

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    if (rawLine.trim() === '') continue

    const indentLevel = lineIndents[i] ?? 0
    const tokens = tokenizeLine(rawLine)

    if (tokens.length === 0) continue

    for (const token of tokens) {
      blocks.push({
        tipo: 'codigo',
        contenido: token,
        orden_correcto: order++,
        indent_level: indentLevel,
        line_index: lineIdx,
      })
    }

    const trimmed = rawLine.replace(/#[^\r\n]*$/, '').trim()
    // If the line ends with ':' and starts with an indent keyword,
    // insert an 'indentacion' placeholder immediately after its tokens.
    if (trimmed.endsWith(':') && isIndentKeywordLine(trimmed)) {
      blocks.push({
        tipo: 'indentacion',
        contenido: '',
        orden_correcto: order++,
        indent_level: indentLevel + 1,
        line_index: lineIdx,
      })
    }

    lineIdx++
  }

  return blocks
}

/**
 * Returns suggested initial (x, y) canvas positions for each block.
 *
 * Layout rules:
 * - Tokens in the same line are laid out horizontally from left to right.
 * - Each subsequent line starts on a new row (Y offset).
 * - Indented lines are shifted right by 40px per indent level.
 * - Spacing between tokens is calculated dynamically to prevent overlap.
 */
export function getDefaultPositions(
  blocks: SplitBlock[],
): { x: number; y: number }[] {
  const START_X = 220
  const START_Y = 100
  const Y_GAP = 64
  const X_INDENT = 48
  const TOKEN_MARGIN = 24

  // Group by line_index (or by detecting line changes)
  let currentLineIdx = -1
  let currentX = START_X

  return blocks.map((block) => {
    const line = block.line_index ?? 0

    if (line !== currentLineIdx) {
      currentLineIdx = line
      currentX = START_X + (block.indent_level ?? 0) * X_INDENT
    }

    const posX = currentX
    const posY = START_Y + line * Y_GAP

    // Estimate width of this block to position the next one
    const textLen = (block.contenido ?? '').length
    const estimatedWidth =
      block.tipo === 'indentacion'
        ? 115
        : Math.max(60, textLen * 9 + 32)

    currentX += estimatedWidth + TOKEN_MARGIN

    return { x: posX, y: posY }
  })
}
