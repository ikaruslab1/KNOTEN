import { spawn } from 'child_process'
import {
  type PythonExecutionResult,
  evaluatePythonJS,
  compareExecutionResults,
  normalizeTypeOutput,
  canonicalStringify,
  splitIntoLogicalStatements,
  tryParseJsonOrPythonDict,
} from './python-evaluator-js'

export type { PythonExecutionResult }
export {
  evaluatePythonJS,
  compareExecutionResults,
  normalizeTypeOutput,
  canonicalStringify,
  splitIntoLogicalStatements,
  tryParseJsonOrPythonDict,
}

const PYTHON_HARNESS = `
import io, contextlib, sys, json, traceback, ast

code = sys.stdin.read()

def run_script(source_code, var_defaults=None):
    tree = ast.parse(source_code)
    
    # Identify free/unbound variables
    loaded = set()
    stored = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            if isinstance(node.ctx, ast.Load):
                loaded.add(node.id)
            elif isinstance(node.ctx, ast.Store):
                stored.add(node.id)
    undefined = loaded - stored - set(dir(__builtins__))
    
    env = {}
    if var_defaults:
        for v in undefined:
            env[v] = var_defaults.get(v, 10)
    elif undefined:
        primes = [3, 7, 11, 13, 17, 19, 23, 29]
        for idx, v in enumerate(sorted(undefined)):
            env[v] = primes[idx % len(primes)]

    stdout_buf = io.StringIO()
    expr_result = None
    with contextlib.redirect_stdout(stdout_buf):
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last_expr = tree.body.pop()
            if tree.body:
                exec(compile(tree, '<string>', 'exec'), env)
            expr_result = eval(compile(ast.Expression(last_expr.value), '<string>', 'eval'), env)
            if expr_result is not None and stdout_buf.getvalue().strip() == '':
                sys.stdout.write(repr(expr_result) + '\\n')
        else:
            exec(compile(tree, '<string>', 'exec'), env)

    state = {}
    for k, v in env.items():
        if not k.startswith('__') and k not in undefined:
            try:
                if isinstance(v, (dict, list, int, float, str, bool, type(None))):
                    state[k] = json.dumps(v, sort_keys=True)
                else:
                    state[k] = repr(v)
            except Exception:
                state[k] = str(type(v))

    expr_str = None
    if expr_result is not None:
        try:
            if isinstance(expr_result, (dict, list, int, float, str, bool, type(None))):
                expr_str = json.dumps(expr_result, sort_keys=True)
            else:
                expr_str = repr(expr_result)
        except Exception:
            expr_str = str(expr_result)

    return stdout_buf.getvalue().strip(), state, expr_str, undefined

try:
    out1, state1, expr1, undef = run_script(code)
    test_runs = [{'out': out1, 'state': state1, 'expr': expr1}]

    # If there were unbound variables, run a second test suite with different values
    # to mathematically verify algebraic equivalence (e.g. x+y == y+x, but x-y != y-x)
    if undef:
        primes2 = [5, 19, 29, 37, 47, 59]
        mock2 = {v: primes2[idx % len(primes2)] for idx, v in enumerate(sorted(undef))}
        out2, state2, expr2, _ = run_script(code, mock2)
        test_runs.append({'out': out2, 'state': state2, 'expr': expr2})

    res = {
        "success": True,
        "stdout": out1,
        "state": state1,
        "expr": expr1,
        "test_runs": test_runs
    }
    sys.stdout.write("__PYNODES_RESULT__" + json.dumps(res))
except Exception as e:
    lines = traceback.format_exc().splitlines()
    clean_lines = [l for l in lines if 'exec(compile' not in l and 'redirect_stdout' not in l and 'run_script' not in l]
    err_msg = '\\n'.join(clean_lines).strip() or str(e)
    sys.stderr.write(err_msg)
    sys.exit(1)
`

/**
 * Executes a string of Python code with a 3-second timeout.
 * 
 * First attempts to run via the system's Python binary (`python`, `py`, or `python3`) with state capture.
 * If Python is not installed or available on the host system,
 * it falls back to the internal JavaScript sandbox evaluator.
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
 * Attempts execution with Python binary candidates ('python', 'py', 'python3').
 * Sends code via stdin to avoid Windows CLI escaping and length restrictions.
 * Returns null if no python binary is available on the system.
 */
async function tryExecutePythonBinary(code: string): Promise<PythonExecutionResult | null> {
  const binaries = ['python', 'py', 'python3']

  for (const bin of binaries) {
    const res = await runPythonBinary(bin, code)
    if (res !== 'ENOENT') {
      return res
    }
  }

  return null
}

function runPythonBinary(
  bin: string,
  code: string,
): Promise<PythonExecutionResult | 'ENOENT'> {
  return new Promise((resolve) => {
    try {
      const child = spawn(bin, ['-c', PYTHON_HARNESS], {
        timeout: 3000,
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (d) => {
        stdout += d.toString()
      })

      child.stderr.on('data', (d) => {
        stderr += d.toString()
      })

      child.on('error', (err: unknown) => {
        const errObj = err as { code?: string }
        if (errObj?.code === 'ENOENT') {
          resolve('ENOENT')
        } else {
          resolve({
            success: false,
            stdout: '',
            stderr: (err as Error).message || String(err),
            state: {},
            exitCode: 1,
          })
        }
      })

      child.on('close', (exitCode) => {
        if (exitCode !== 0 && !stdout.includes('__PYNODES_RESULT__')) {
          resolve({
            success: false,
            stdout: stdout.trim(),
            stderr: (stderr || 'Error de ejecución en Python').trim(),
            state: {},
            exitCode: exitCode ?? 1,
          })
          return
        }

        const marker = '__PYNODES_RESULT__'
        const idx = stdout.indexOf(marker)

        if (idx !== -1) {
          try {
            const payload = JSON.parse(stdout.slice(idx + marker.length))
            resolve({
              success: true,
              stdout: payload.stdout ?? '',
              stderr: '',
              state: payload.state ?? {},
              exprResult: payload.expr ?? null,
              testRuns: payload.test_runs ?? [],
              exitCode: 0,
            })
            return
          } catch {
            // Fallback to raw stdout
          }
        }

        resolve({
          success: true,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          state: {},
          exitCode: 0,
        })
      })

      child.stdin.write(code)
      child.stdin.end()
    } catch {
      resolve('ENOENT')
    }
  })
}
