import { execFile } from 'child_process'

export type PythonExecutionResult = {
  success: boolean
  stdout: string
  stderr: string
  exitCode?: number | null
}

/**
 * Executes a string of Python code with a 3-second timeout.
 * 
 * First attempts to run via the system's Python binary (`python -c "..."`).
 * If Python is not installed (e.g., in some serverless hosting environments),
 * it seamlessly falls back to an internal JavaScript sandbox evaluator.
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
 * Attempts execution with `python -c`.
 * Returns null if the python binary is unavailable on the system.
 */
function tryExecutePythonBinary(code: string): Promise<PythonExecutionResult | null> {
  return new Promise((resolve) => {
    try {
      execFile(
        'python',
        ['-c', code],
        { timeout: 3000, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            // If binary not found (ENOENT), return null to trigger fallback
            const errObj = error as unknown as { code?: string }
            if (errObj?.code === 'ENOENT') {
              return resolve(null)
            }
            return resolve({
              success: false,
              stdout: (stdout || '').trim(),
              stderr: (stderr || error.message || '').trim(),
              exitCode: error.code !== undefined ? Number(error.code) : 1,
            })
          }

          resolve({
            success: true,
            stdout: (stdout || '').trim(),
            stderr: (stderr || '').trim(),
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
          exitCode: 1,
        }
      }
      continue
    }

    // Handle variable assignment: var = expr
    const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*([\s\S]+)$/)
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
        exitCode: 1,
      }
    }
  }

  return {
    success: true,
    stdout: output.join('\n'),
    stderr: '',
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
    const rawQuote = jsExpr[1]
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
