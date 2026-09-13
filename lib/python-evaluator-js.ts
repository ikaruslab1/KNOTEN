export type PythonExecutionResult = {
  success: boolean
  stdout: string
  stderr: string
  state?: Record<string, string>
  exprResult?: string | null
  testRuns?: Array<{ out: string; state: Record<string, string>; expr: string | null }>
  exitCode?: number | null
}

/**
 * Lightweight JavaScript fallback evaluator for basic Python scripts.
 * Supports assignments, arithmetic, strings, f-strings, comparisons, and print statements.
 * Safe for both server-side and browser/offline execution.
 */
export function evaluatePythonJS(code: string): PythonExecutionResult {
  const lines = code.split('\n')
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

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex]
    const line = rawLine.trim()

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue

    // Handle print(...)
    const printMatch = line.match(/^print\s*\(([\s\S]*)\)$/)
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
          stderr: `Traceback (most recent call last):\n  File "<string>", line ${lineIndex + 1}, in <module>\n${msg}`,
          state: {},
          exitCode: 1,
        }
      }
      continue
    }

    // Handle type-annotated or regular assignment: var: type = expr OR var = expr
    const assignMatch = line.match(/^([a-zA-Z_]\w*)(?:\s*:\s*[\w\[\], ]+)?\s*=\s*([\s\S]+)$/)
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
          stderr: `Traceback (most recent call last):\n  File "<string>", line ${lineIndex + 1}, in <module>\n${msg}`,
          state: {},
          exitCode: 1,
        }
      }
      continue
    }

    // Bare expression evaluation
    try {
      lastExprValue = evaluateExpr(line, scope)
      if (lastExprValue !== undefined && output.length === 0) {
        output.push(String(lastExprValue))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        stdout: output.join('\n'),
        stderr: `Traceback (most recent call last):\n  File "<string>", line ${lineIndex + 1}, in <module>\n${msg}`,
        state: {},
        exitCode: 1,
      }
    }
  }

  const state: Record<string, string> = {}
  for (const [k, v] of Object.entries(scope)) {
    if (mockVars.has(k)) continue
    try {
      state[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)
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
 * Safely evaluates a basic Python expression in the context of the scope.
 */
function evaluateExpr(expr: string, scope: Record<string, unknown>): unknown {
  // Convert Python f-strings: f"Hello, {name}!" -> `Hello, ${name}!`
  let jsExpr = expr
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
 * Compares reference code execution results with student code execution results.
 * Verifies that the student's code runs without error and produces the exact same result:
 * - Matching console stdout (for print-based programs)
 * - Matching memory/variable states (for assignments and logic, e.g. x = 1)
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
      const stateMatches = JSON.stringify(refRun.state) === JSON.stringify(stuRun.state)
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
    if (!(k in stuState)) {
      stateMatches = false
      stateMismatchDetails.push(`Falta definir la variable '${k}'`)
    } else if (stuState[k] !== refState[k]) {
      // Try parsing both as JSON in case of differing serialization formats
      let valsEqual = false
      try {
        valsEqual = JSON.stringify(JSON.parse(stuState[k])) === JSON.stringify(JSON.parse(refState[k]))
      } catch {}
      if (!valsEqual) {
        stateMatches = false
        stateMismatchDetails.push(`Variable '${k}': se esperaba ${refState[k]}, pero tiene ${stuState[k]}`)
      }
    }
  }

  let isSuccess = false
  if (refStdout !== '') {
    // Code has output / print / expression: stdout must match and any defined variables must match
    isSuccess = (stuStdout === refStdout) && stateMatches
  } else if (refResult.exprResult !== undefined && refResult.exprResult !== null) {
    // Both produced expression results
    isSuccess = (studentResult.exprResult === refResult.exprResult) && stateMatches
  } else if (refKeys.length > 0) {
    // Code is pure logic/assignments (e.g. x = 1): states must match
    isSuccess = stateMatches
  } else {
    // Neither stdout nor variables: code ran without errors
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
