export type PythonExecutionResult = {
  success: boolean
  stdout: string
  stderr: string
  state?: Record<string, string>
  exprResult?: string | null
  testRuns?: Array<{ out: string; state: Record<string, string>; expr: string | null }>
  exitCode?: number | null
}

export type LogicalStatement = {
  text: string
  startLine: number
}

/**
 * Strips comments from Python code while preserving strings.
 */
function cleanPythonComments(code: string): string {
  const lines = code.split('\n')
  return lines
    .map((l) => {
      let inStr: string | null = null
      for (let i = 0; i < l.length; i++) {
        const ch = l[i]
        const prev = i > 0 ? l[i - 1] : ''
        if (inStr) {
          if (ch === inStr && prev !== '\\') inStr = null
        } else {
          if (ch === '"' || ch === "'") inStr = ch
          else if (ch === '#') return l.slice(0, i)
        }
      }
      return l
    })
    .join('\n')
}

/**
 * Splits Python source code into logical statements, correctly grouping
 * multi-line dictionaries, lists, tuples, and function calls.
 */
export function splitIntoLogicalStatements(code: string): LogicalStatement[] {
  const rawLines = code.split('\n')
  const statements: LogicalStatement[] = []
  let current = ''
  let currentStartLine = 1
  let parenCount = 0
  let bracketCount = 0
  let braceCount = 0
  let inString: string | null = null

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (!current) {
      currentStartLine = i + 1
      current = line
    } else {
      current += '\n' + line
    }

    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      const prev = j > 0 ? line[j - 1] : ''

      if (inString) {
        if (ch === inString && prev !== '\\') {
          inString = null
        }
      } else {
        if (ch === '"' || ch === "'") {
          inString = ch
        } else if (ch === '#') {
          break
        } else if (ch === '(') parenCount++
        else if (ch === ')') parenCount = Math.max(0, parenCount - 1)
        else if (ch === '[') bracketCount++
        else if (ch === ']') bracketCount = Math.max(0, bracketCount - 1)
        else if (ch === '{') braceCount++
        else if (ch === '}') braceCount = Math.max(0, braceCount - 1)
      }
    }

    if (
      parenCount === 0 &&
      bracketCount === 0 &&
      braceCount === 0 &&
      !inString &&
      !line.trimEnd().endsWith('\\')
    ) {
      if (current.trim()) {
        statements.push({
          text: current,
          startLine: currentStartLine,
        })
      }
      current = ''
    }
  }

  if (current.trim()) {
    statements.push({
      text: current,
      startLine: currentStartLine,
    })
  }

  return statements
}

/**
 * Produces a deterministic JSON string with keys sorted at all levels.
 */
export function canonicalStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val)
  }
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalStringify).join(',') + ']'
  }
  const obj = val as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  const entries = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`)
  return '{' + entries.join(',') + '}'
}

/**
 * Safely evaluates a basic Python expression in the context of the scope.
 */
function evaluateExpr(expr: string, scope: Record<string, unknown>): unknown {
  let jsExpr = cleanPythonComments(expr).trim()

  // Convert Python f-strings: f"Hello, {name}!" -> `Hello, ${name}!`
  if (jsExpr.startsWith('f"') || jsExpr.startsWith("f'")) {
    const content = jsExpr.slice(2, -1)
    const converted = content.replace(/\{([^}]+)\}/g, (_, inner) => `\${${inner}}`)
    jsExpr = `\`${converted.replace(/`/g, '\\`')}\``
  }

  // Convert Python booleans and None to JS
  jsExpr = jsExpr
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')

  const scopeKeys = Object.keys(scope)
  const scopeVals = Object.values(scope)

  try {
    const fn = new Function(...scopeKeys, `return (${jsExpr});`)
    return fn(...scopeVals)
  } catch (err: unknown) {
    if (err instanceof ReferenceError) {
      const missingVar = err.message.replace(/ is not defined.*/, '')
      throw new Error(`NameError: name '${missingVar}' is not defined`)
    }
    throw err
  }
}

/**
 * Tries to parse a JSON or Python-style stringified dict/list.
 */
export function tryParseJsonOrPythonDict(str: string): unknown {
  if (!str || typeof str !== 'string') return null
  try {
    return JSON.parse(str)
  } catch {}
  try {
    const normalized = str
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
    return JSON.parse(normalized)
  } catch {}
  return null
}

/**
 * Lightweight JavaScript fallback evaluator for basic Python scripts.
 * Supports assignments, arithmetic, strings, f-strings, comparisons, dictionaries, lists, and print statements.
 * Safe for both server-side and browser/offline execution.
 */
export function evaluatePythonJS(code: string): PythonExecutionResult {
  const statements = splitIntoLogicalStatements(code)
  const scope: Record<string, unknown> = {}
  const output: string[] = []
  let lastExprValue: unknown = undefined

  // Pre-populate common free variables (e.g. x, y) consistently across runs
  const mockVars = new Set<string>()
  const primes = [3, 7, 11, 13, 17, 19]
  let primeIdx = 0
  const rawWords = code.match(/\b[a-zA-Z_]\w*\b/g) || []
  const uniqueWords = Array.from(new Set(rawWords)).sort()
  for (const word of uniqueWords) {
    if (
      !scope[word] &&
      !['print', 'True', 'False', 'None', 'if', 'else', 'for', 'while', 'def'].includes(word)
    ) {
      scope[word] = primes[primeIdx++ % primes.length]
      mockVars.add(word)
    }
  }

  for (const stmt of statements) {
    const rawText = stmt.text.trim()
    if (!rawText || rawText.startsWith('#')) continue

    // Handle print(...)
    const printMatch = rawText.match(/^print\s*\(([\s\S]*)\)$/)
    if (printMatch) {
      const expr = printMatch[1].trim()
      try {
        const val = evaluateExpr(expr, scope)
        output.push(val !== undefined ? String(val) : '')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          stdout: output.join('\n'),
          stderr: `Traceback (most recent call last):\n  File "<string>", line ${stmt.startLine}, in <module>\n${msg}`,
          state: {},
          exitCode: 1,
        }
      }
      continue
    }

    // Handle type-annotated or regular assignment: var: type = expr OR var = expr
    const assignMatch = rawText.match(/^([a-zA-Z_]\w*)(?:\s*:\s*[\w\[\], ]+)?\s*=\s*([\s\S]+)$/)
    if (assignMatch) {
      const varName = assignMatch[1].trim()
      const expr = assignMatch[2].trim()

      try {
        const val = evaluateExpr(expr, scope)
        scope[varName] = val
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          stdout: output.join('\n'),
          stderr: `Traceback (most recent call last):\n  File "<string>", line ${stmt.startLine}, in <module>\n${msg}`,
          state: {},
          exitCode: 1,
        }
      }
      continue
    }

    // Bare expression evaluation
    try {
      lastExprValue = evaluateExpr(rawText, scope)
      if (lastExprValue !== undefined && output.length === 0) {
        output.push(String(lastExprValue))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        stdout: output.join('\n'),
        stderr: `Traceback (most recent call last):\n  File "<string>", line ${stmt.startLine}, in <module>\n${msg}`,
        state: {},
        exitCode: 1,
      }
    }
  }

  const state: Record<string, string> = {}
  for (const [k, v] of Object.entries(scope)) {
    if (mockVars.has(k)) continue
    try {
      state[k] = typeof v === 'object' && v !== null ? canonicalStringify(v) : String(v)
    } catch {
      state[k] = String(v)
    }
  }

  return {
    success: true,
    stdout: output.join('\n'),
    stderr: '',
    state,
    exprResult: lastExprValue !== undefined ? String(lastExprValue) : null,
    exitCode: 0,
  }
}

/**
 * Compares reference code execution results with student code execution results.
 * Verifies that the student's code runs without error and produces the exact same result:
 * - Matching console stdout (for print-based programs)
 * - Matching memory/variable states (for assignments and logic, e.g. x = 1, dictionaries, etc.)
 * - Matching multi-run test suites for algebraic expressions (e.g. x+y vs y+x)
 */
export function compareExecutionResults(
  refResult: PythonExecutionResult,
  studentResult: PythonExecutionResult
): { isSuccess: boolean; responseMessage: string; displayOutput: string } {
  // 1. Student code threw a runtime or syntax error
  if (!studentResult.success) {
    return {
      isSuccess: false,
      responseMessage: studentResult.stderr || 'Error de sintaxis o ejecución en Python.',
      displayOutput: studentResult.stderr || 'Error de ejecución en Python.',
    }
  }

  // 2. Multi-run test suites for expressions with free variables
  if (
    refResult.testRuns &&
    studentResult.testRuns &&
    refResult.testRuns.length > 1 &&
    studentResult.testRuns.length === refResult.testRuns.length
  ) {
    let allRunsMatch = true
    for (let i = 0; i < refResult.testRuns.length; i++) {
      const refRun = refResult.testRuns[i]
      const stuRun = studentResult.testRuns[i]
      const outMatches = refRun.out === stuRun.out
      const exprMatches = refRun.expr === stuRun.expr
      const stateMatches = canonicalStringify(refRun.state) === canonicalStringify(stuRun.state)
      if (!outMatches || !exprMatches || !stateMatches) {
        allRunsMatch = false
        break
      }
    }

    if (allRunsMatch) {
      return {
        isSuccess: true,
        responseMessage: '¡Correcto! El código se ejecutó y llegó al mismo resultado que el código original.',
        displayOutput: studentResult.stdout || studentResult.exprResult || 'Código ejecutado exitosamente.',
      }
    }
  }

  const refStdout = (refResult.stdout ?? '').trim()
  const stuStdout = (studentResult.stdout ?? '').trim()

  const refState = refResult.state ?? {}
  const stuState = studentResult.state ?? {}

  // Check state match: every variable defined in reference code must match in student code
  let stateMatches = true
  const stateMismatchDetails: string[] = []

  const refKeys = Object.keys(refState)
  for (const k of refKeys) {
    let stuKey = k
    if (!(stuKey in stuState)) {
      // Look for case-insensitive match (e.g. Persona vs persona)
      const found = Object.keys(stuState).find((sk) => sk.toLowerCase() === k.toLowerCase())
      if (found) {
        stuKey = found
      }
    }

    if (!(stuKey in stuState)) {
      stateMatches = false
      stateMismatchDetails.push(`Falta definir la variable '${k}'`)
    } else {
      const refVal = refState[k]
      const stuVal = stuState[stuKey]
      if (stuVal !== refVal) {
        let valsEqual = false
        const parsedStu = tryParseJsonOrPythonDict(stuVal)
        const parsedRef = tryParseJsonOrPythonDict(refVal)

        if (parsedStu !== null && parsedRef !== null) {
          valsEqual = canonicalStringify(parsedStu) === canonicalStringify(parsedRef)
        } else if (!isNaN(Number(stuVal)) && !isNaN(Number(refVal))) {
          valsEqual = Number(stuVal) === Number(refVal)
        } else {
          const unquote = (s: string) => s.trim().replace(/^['"](.*)['"]$/, '$1')
          valsEqual = unquote(stuVal) === unquote(refVal)
        }

        if (!valsEqual) {
          stateMatches = false
          stateMismatchDetails.push(`Variable '${k}': se esperaba ${refVal}, pero tiene ${stuVal}`)
        }
      }
    }
  }

  let isSuccess = false
  if (refStdout !== '') {
    isSuccess = (stuStdout === refStdout) && stateMatches
  } else if (refResult.exprResult !== undefined && refResult.exprResult !== null) {
    isSuccess = (studentResult.exprResult === refResult.exprResult) && stateMatches
  } else if (refKeys.length > 0) {
    isSuccess = stateMatches
  } else {
    isSuccess = true
  }

  // Build clean display output for the terminal modal
  let displayOutput = stuStdout
  if (!displayOutput && studentResult.exprResult) {
    displayOutput = studentResult.exprResult
  }
  if (!displayOutput && Object.keys(stuState).length > 0) {
    displayOutput = Object.entries(stuState)
      .map(([k, v]) => `${k} = ${v}`)
      .join('\n')
  }

  if (isSuccess) {
    return {
      isSuccess: true,
      responseMessage: '¡Correcto! El código se ejecutó y llegó al mismo resultado que el código original.',
      displayOutput: displayOutput || 'Código ejecutado exitosamente sin errores.',
    }
  }

  // Detailed failure explanation
  const reasons: string[] = []
  if (refStdout !== '' && stuStdout !== refStdout) {
    reasons.push(`Salida en consola:\n  Obtenida: "${stuStdout}"\n  Esperada: "${refStdout}"`)
  }
  if (!stateMatches && stateMismatchDetails.length > 0) {
    reasons.push(stateMismatchDetails.join('\n'))
  }

  return {
    isSuccess: false,
    responseMessage: `El código se ejecutó pero el resultado no coincide con el código original:\n${reasons.join('\n\n')}`,
    displayOutput: displayOutput || studentResult.stdout || 'Sin salida en consola.',
  }
}
