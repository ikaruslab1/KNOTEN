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
 * Set of standard Python keywords, built-ins, and dunder attributes.
 */
export const PYTHON_BUILTINS_SET = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  'abs', 'all', 'any', 'ascii', 'bin', 'bool', 'bytearray', 'bytes',
  'callable', 'chr', 'classmethod', 'compile', 'complex', 'delattr', 'dict',
  'dir', 'divmod', 'enumerate', 'eval', 'exec', 'filter', 'float', 'format',
  'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex', 'id',
  'input', 'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals',
  'map', 'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord',
  'pow', 'print', 'property', 'range', 'repr', 'reversed', 'round', 'set',
  'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super',
  'tuple', 'type', 'vars', 'zip',
  '__name__', '__name', '__doc__', '__file__', '__class__', '__dict__'
])

/**
 * Creates a Python-like type constructor and class object (e.g. str, int, bool, list, dict).
 */
export function createPyType(name: string) {
  const fn = function (arg?: unknown) {
    if (name === 'str') {
      if (arg === undefined) return ''
      if (arg === null) return 'None'
      if (arg === true) return 'True'
      if (arg === false) return 'False'
      return String(arg)
    }
    if (name === 'int') {
      if (arg === undefined) return 0
      if (typeof arg === 'boolean') return arg ? 1 : 0
      return Math.trunc(Number(arg))
    }
    if (name === 'float') {
      if (arg === undefined) return 0.0
      return Number(arg)
    }
    if (name === 'bool') {
      if (arg === undefined) return false
      return Boolean(arg)
    }
    if (name === 'list') {
      if (arg === undefined) return []
      return Array.isArray(arg) ? [...arg] : Array.from((arg as any) || [])
    }
    if (name === 'dict') {
      if (arg === undefined) return {}
      return { ...(arg as object) }
    }
    if (name === 'tuple') {
      if (arg === undefined) return []
      return Array.isArray(arg) ? [...arg] : Array.from((arg as any) || [])
    }
    if (name === 'set') {
      if (arg === undefined) return new Set()
      return new Set((arg as any) || [])
    }
    return arg
  }

  Object.defineProperty(fn, 'name', { value: name, configurable: true, writable: true })
  Object.defineProperty(fn, '__name__', { value: name, configurable: true, writable: true })
  Object.defineProperty(fn, '__name', { value: name, configurable: true, writable: true })
  fn.toString = () => `<class '${name}'>`
  ;(fn as any)[Symbol.toPrimitive] = (hint: string) => {
    if (hint === 'string') return `<class '${name}'>`
    return name
  }
  return fn
}

export const PyStr = createPyType('str')
export const PyInt = createPyType('int')
export const PyFloat = createPyType('float')
export const PyBool = createPyType('bool')
export const PyList = createPyType('list')
export const PyDict = createPyType('dict')
export const PyTuple = createPyType('tuple')
export const PySet = createPyType('set')
export const PyNoneType = createPyType('NoneType')

/**
 * Python-like `type(val)` function that returns class descriptors with `.__name__` and `toString()`.
 */
export function pyType(val: unknown) {
  if (val === null || val === undefined) return PyNoneType
  if (typeof val === 'string') return PyStr
  if (typeof val === 'number') {
    return Number.isInteger(val) ? PyInt : PyFloat
  }
  if (typeof val === 'boolean') return PyBool
  if (Array.isArray(val)) return PyList
  if (val instanceof Set) return PySet
  if (typeof val === 'function' && ((val as any).__name__ || (val as any).name)) {
    return createPyType('type')
  }
  if (typeof val === 'object') return PyDict
  return PyStr
}
Object.defineProperty(pyType, '__name__', { value: 'type', configurable: true, writable: true })
Object.defineProperty(pyType, '__name', { value: 'type', configurable: true, writable: true })
pyType.toString = () => "<class 'type'>"

/**
 * Returns a fresh scope pre-loaded with Python standard built-in functions.
 */
export function getBuiltinScope(): Record<string, unknown> {
  return {
    type: pyType,
    str: PyStr,
    int: PyInt,
    float: PyFloat,
    bool: PyBool,
    list: PyList,
    dict: PyDict,
    tuple: PyTuple,
    set: PySet,
    len: (val: unknown) => {
      if (val === null || val === undefined) return 0
      if (typeof val === 'string' || Array.isArray(val)) return val.length
      if (typeof val === 'object') return Object.keys(val as object).length
      return 0
    },
    range: (start: number, stop?: number, step = 1) => {
      if (stop === undefined) {
        stop = start
        start = 0
      }
      const res: number[] = []
      if (step > 0) {
        for (let i = start; i < stop; i += step) res.push(i)
      } else if (step < 0) {
        for (let i = start; i > stop; i += step) res.push(i)
      }
      return res
    },
    abs: (val: unknown) => Math.abs(Number(val)),
    round: (val: unknown, n = 0) => {
      const f = Math.pow(10, n)
      return Math.round(Number(val) * f) / f
    },
    sum: (arr: unknown[], start = 0) =>
      Array.isArray(arr) ? arr.reduce((a: number, b: unknown) => a + Number(b), start) : start,
    min: (...args: any[]) => {
      const items = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      return Math.min(...items)
    },
    max: (...args: any[]) => {
      const items = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      return Math.max(...items)
    },
    input: () => '',
    isinstance: (val: unknown, targetType: unknown) => {
      if (typeof targetType === 'function') {
        const actualType = pyType(val)
        return actualType === targetType || (actualType as any).__name__ === (targetType as any).__name__
      }
      return false
    },
  }
}

/**
 * Splits comma-separated arguments at depth 0 outside quotes.
 */
export function splitArguments(argsStr: string): string[] {
  const str = argsStr.trim()
  if (!str) return []
  const args: string[] = []
  let current = ''
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let inString: string | null = null

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    const prev = i > 0 ? str[i - 1] : ''

    if (inString) {
      current += ch
      if (ch === inString && prev !== '\\') inString = null
    } else {
      if (ch === '"' || ch === "'") {
        inString = ch
        current += ch
      } else if (ch === '(') {
        parenDepth++
        current += ch
      } else if (ch === ')') {
        parenDepth = Math.max(0, parenDepth - 1)
        current += ch
      } else if (ch === '[') {
        bracketDepth++
        current += ch
      } else if (ch === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1)
        current += ch
      } else if (ch === '{') {
        braceDepth++
        current += ch
      } else if (ch === '}') {
        braceDepth = Math.max(0, braceDepth - 1)
        current += ch
      } else if (ch === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
        args.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }

  if (current.trim()) {
    args.push(current.trim())
  }

  return args
}

/**
 * Formats a value as standard Python output.
 */
export function formatPyValue(val: unknown): string {
  if (val === null || val === undefined) return 'None'
  if (val === true) return 'True'
  if (val === false) return 'False'
  if (typeof val === 'function' && val.toString) return val.toString()
  return String(val)
}

/**
 * Scans code to find genuinely undefined/unbound variables (e.g. free variables in algebraic expressions).
 * Properly ignores assigned variables, for loops, function defs, strings, and Python builtins.
 */
export function findUndefinedVariables(code: string): Set<string> {
  const cleanCode = cleanPythonComments(code)
  const lines = cleanCode.split('\n')

  const stored = new Set<string>()
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Assignment: var: type = ... OR var = ...
    const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)(?:\s*:\s*[\w\[\], ]+)?\s*=/)
    if (assignMatch) {
      stored.add(assignMatch[1].trim())
    }

    // Augmented assignment: var += ...
    const augMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*(?:\+=|-=|\*=|\/=|%=)=/)
    if (augMatch) {
      stored.add(augMatch[1].trim())
    }

    // For loop: for var in ...:
    const forMatch = trimmed.match(/for\s+([a-zA-Z_]\w*)\s+in/)
    if (forMatch) {
      stored.add(forMatch[1].trim())
    }

    // Function def: def var(...)
    const defMatch = trimmed.match(/def\s+([a-zA-Z_]\w*)\s*\(/)
    if (defMatch) {
      stored.add(defMatch[1].trim())
    }
  }

  // Strip all strings (including prefixed strings: f"...", r"...", etc.)
  let noStrings = cleanCode.replace(/[frbFRB]*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '""')

  // Strip attribute accesses (.prop)
  noStrings = noStrings.replace(/\.[a-zA-Z_]\w*/g, '')

  const rawWords = noStrings.match(/\b[a-zA-Z_]\w*\b/g) || []
  const undefinedVars = new Set<string>()

  for (const w of rawWords) {
    if (!stored.has(w) && !PYTHON_BUILTINS_SET.has(w)) {
      undefinedVars.add(w)
    }
  }

  return undefinedVars
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

  // Convert Python booleans, None, logical operators, and attributes
  jsExpr = jsExpr
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!')
    .replace(/\.__name\b(?!_)/g, '.__name__')

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

type SingleRunResult = PythonExecutionResult & {
  undef: Set<string>
}

/**
 * Executes a single evaluation pass of a Python script with optional mock variable overrides.
 */
function runSingleScript(
  sourceCode: string,
  mockValues?: Record<string, unknown>
): SingleRunResult {
  const statements = splitIntoLogicalStatements(sourceCode)
  const scope: Record<string, unknown> = { ...getBuiltinScope() }
  const builtinKeys = new Set(Object.keys(scope))
  const output: string[] = []
  let lastExprValue: unknown = undefined

  const undef = findUndefinedVariables(sourceCode)
  const mockVars = new Set<string>()

  if (mockValues) {
    for (const [k, v] of Object.entries(mockValues)) {
      scope[k] = v
      mockVars.add(k)
    }
  } else if (undef.size > 0) {
    const primes = [3, 7, 11, 13, 17, 19, 23, 29]
    let idx = 0
    for (const v of Array.from(undef).sort()) {
      scope[v] = primes[idx++ % primes.length]
      mockVars.add(v)
    }
  }

  for (const stmt of statements) {
    const rawText = stmt.text.trim()
    if (!rawText || rawText.startsWith('#')) continue

    // Handle print(...)
    const printMatch = rawText.match(/^print\s*\(([\s\S]*)\)$/)
    if (printMatch) {
      const argsText = printMatch[1].trim()
      if (!argsText) {
        output.push('')
        continue
      }
      const argsList = splitArguments(argsText)
      try {
        const evaled = argsList.map((a) => formatPyValue(evaluateExpr(a, scope)))
        output.push(evaled.join(' '))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          stdout: output.join('\n'),
          stderr: `Traceback (most recent call last):\n  File "<string>", line ${stmt.startLine}, in <module>\n${msg}`,
          state: {},
          exprResult: null,
          exitCode: 1,
          undef,
        }
      }
      continue
    }

    // Handle assignment: var: type = expr OR var = expr
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
          exprResult: null,
          exitCode: 1,
          undef,
        }
      }
      continue
    }

    // Bare expression evaluation
    try {
      lastExprValue = evaluateExpr(rawText, scope)
      if (lastExprValue !== undefined && output.length === 0) {
        output.push(formatPyValue(lastExprValue))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        stdout: output.join('\n'),
        stderr: `Traceback (most recent call last):\n  File "<string>", line ${stmt.startLine}, in <module>\n${msg}`,
        state: {},
        exprResult: null,
        exitCode: 1,
        undef,
      }
    }
  }

  const state: Record<string, string> = {}
  for (const [k, v] of Object.entries(scope)) {
    if (mockVars.has(k) || builtinKeys.has(k) || PYTHON_BUILTINS_SET.has(k)) continue
    try {
      state[k] = typeof v === 'object' && v !== null ? canonicalStringify(v) : JSON.stringify(v)
    } catch {
      state[k] = String(v)
    }
  }

  return {
    success: true,
    stdout: output.join('\n'),
    stderr: '',
    state,
    exprResult: lastExprValue !== undefined ? formatPyValue(lastExprValue) : null,
    exitCode: 0,
    undef,
  }
}

/**
 * Lightweight JavaScript fallback evaluator for basic Python scripts.
 * Supports assignments, type annotations, arithmetic, strings, f-strings, comparisons,
 * dictionaries, lists, type inspection (`type(x).__name__`), and print statements.
 * Safe for both server-side and browser/offline execution.
 */
export function evaluatePythonJS(code: string): PythonExecutionResult {
  const firstRun = runSingleScript(code)
  if (!firstRun.success) {
    return firstRun
  }

  const testRuns: Array<{ out: string; state: Record<string, string>; expr: string | null }> = [
    { out: firstRun.stdout, state: firstRun.state ?? {}, expr: firstRun.exprResult ?? null },
  ]

  // If there were unbound variables, run a second test run with different prime values
  // to mathematically verify algebraic equivalence (e.g. x+y == y+x, but x-y != y-x)
  if (firstRun.undef && firstRun.undef.size > 0) {
    const primes2 = [5, 19, 29, 37, 47, 59]
    const mock2: Record<string, number> = {}
    let idx = 0
    for (const v of Array.from(firstRun.undef).sort()) {
      mock2[v] = primes2[idx++ % primes2.length]
    }
    const secondRun = runSingleScript(code, mock2)
    testRuns.push({
      out: secondRun.stdout,
      state: secondRun.state ?? {},
      expr: secondRun.exprResult ?? null,
    })
  }

  return {
    ...firstRun,
    testRuns,
  }
}

/**
 * Normalizes output representations such as `<class 'int'>` vs `<class: int>` vs `'int'`
 * to ensure fair comparison regardless of formatting differences.
 */
export function normalizeTypeOutput(str: string): string {
  return str
    .trim()
    .replace(/<class:?\s*['"]?(\w+)['"]?>/g, '$1')
    .replace(/\s+/g, ' ')
}

/**
 * Compares reference code execution results with student code execution results.
 * Verifies that the student's code runs without error and produces the equivalent result:
 * - Matching console stdout (for print-based programs or type inspection)
 * - Matching memory/variable states (for assignments and logic, e.g. fecha = "...", dictionaries, etc.)
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
      const outMatches =
        refRun.out === stuRun.out ||
        normalizeTypeOutput(refRun.out) === normalizeTypeOutput(stuRun.out)
      const exprMatches =
        refRun.expr === stuRun.expr ||
        normalizeTypeOutput(refRun.expr ?? '') === normalizeTypeOutput(stuRun.expr ?? '')
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
    const stdoutMatches =
      stuStdout === refStdout ||
      normalizeTypeOutput(stuStdout) === normalizeTypeOutput(refStdout)
    isSuccess = stdoutMatches && stateMatches
  } else if (refResult.exprResult !== undefined && refResult.exprResult !== null) {
    const exprMatches =
      studentResult.exprResult === refResult.exprResult ||
      normalizeTypeOutput(studentResult.exprResult ?? '') ===
        normalizeTypeOutput(refResult.exprResult ?? '')
    isSuccess = exprMatches && stateMatches
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
  if (
    refStdout !== '' &&
    stuStdout !== refStdout &&
    normalizeTypeOutput(stuStdout) !== normalizeTypeOutput(refStdout)
  ) {
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

