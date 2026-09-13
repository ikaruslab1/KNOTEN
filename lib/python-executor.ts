import { execFile } from 'child_process'

export type PythonExecutionResult = {
  success: boolean
  stdout: string
  stderr: string
  state?: Record<string, string>
  exitCode?: number | null
}

const PYTHON_HARNESS = `
import io, contextlib, sys, json, traceback

code = sys.argv[1]
stdout_buf = io.StringIO()
env = {}

try:
    with contextlib.redirect_stdout(stdout_buf):
        exec(code, env)
    state = {}
    for k, v in env.items():
        if not k.startswith('__'):
            try:
                if callable(v):
                    state[k] = f"<function {k}>"
                else:
                    state[k] = repr(v)
            except Exception:
                state[k] = str(type(v))
    res = {
        "success": True,
        "stdout": stdout_buf.getvalue().strip(),
        "state": state
    }
    sys.stdout.write("__PYNODES_RESULT__" + json.dumps(res))
except Exception as e:
    lines = traceback.format_exc().splitlines()
    clean_lines = [l for l in lines if 'exec(code, env)' not in l and 'redirect_stdout' not in l]
    err_msg = '\\n'.join(clean_lines).strip() or str(e)
    sys.stderr.write(err_msg)
    sys.exit(1)
`

/**
 * Executes a string of Python code with a 3-second timeout.
 * 
 * First attempts to run via the system's Python binary (`python -c "..."`) with state capture.
 * If Python is not installed (e.g. certain serverless hosting),
 * it falls back to an internal JavaScript sandbox evaluator.
 */
export async function executePythonCode(code: string): Promise<PythonExecutionResult> {
  const binaryResult = await tryExecutePythonBinary(code)
  if (binaryResult !== null) {
    return binaryResult
  }

  // Fallback: evaluate via JS sandbox
  return evaluatePythonJS(code)
}

/**
 * Attempts execution with Python binary and state capture.
 * Returns null if the python binary is unavailable on the system.
 */
function tryExecutePythonBinary(code: string): Promise<PythonExecutionResult | null> {
  return new Promise((resolve) => {
    try {
      execFile(
        'python',
        ['-c', PYTHON_HARNESS, code],
        { timeout: 3000, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            const errObj = error as unknown as { code?: string }
            if (errObj?.code === 'ENOENT') {
              return resolve(null)
            }
            return resolve({
              success: false,
              stdout: (stdout || '').trim(),
              stderr: (stderr || error.message || '').trim(),
              state: {},
              exitCode: error.code !== undefined ? Number(error.code) : 1,
            })
          }

          const rawStdout = stdout || ''
          const marker = '__PYNODES_RESULT__'
          const idx = rawStdout.indexOf(marker)

          if (idx !== -1) {
            try {
              const payload = JSON.parse(rawStdout.slice(idx + marker.length))
              return resolve({
                success: true,
                stdout: payload.stdout ?? '',
                stderr: '',
                state: payload.state ?? {},
                exitCode: 0,
              })
            } catch {
              // Fallback to raw stdout
            }
          }

          resolve({
            success: true,
            stdout: rawStdout.trim(),
            stderr: (stderr || '').trim(),
            state: {},
            exitCode: 0,
          })
        },
      )
    } catch {
      resolve(null)
    }
  })
}

/**
 * Lightweight JavaScript fallback evaluator for basic Python scripts.
 * Supports assignments, arithmetic, strings, f-strings, comparisons, and print statements.
 */
export function evaluatePythonJS(code: string): PythonExecutionResult {
  const lines = code.split('\n')
  const scope: Record<string, unknown> = {}
  const output: string[] = []

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
      evaluateExpr(line, scope)
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
    state[k] = typeof v === 'string' ? `'${v}'` : String(v)
  }

  return {
    success: true,
    stdout: output.join('\n'),
    stderr: '',
    state,
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
      stateMatches = false
      stateMismatchDetails.push(`Variable '${k}': se esperaba ${refState[k]}, pero tiene ${stuState[k]}`)
    }
  }

  let isSuccess = false
  if (refStdout !== '') {
    // Code has print statements: stdout must match and any defined variables must match
    isSuccess = (stuStdout === refStdout) && stateMatches
  } else if (refKeys.length > 0) {
    // Code is pure logic/assignments (e.g. x = 1): states must match
    isSuccess = stateMatches
  } else {
    // Neither stdout nor variables: code ran without errors
    isSuccess = true
  }

  // Build clean display output for the terminal modal
  let displayOutput = stuStdout
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
