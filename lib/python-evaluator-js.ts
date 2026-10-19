export type ControlFlowStep = {
  lineNumber: number
  indentLevel: number
  kind: 'if' | 'elif' | 'else' | 'statement'
  code: string
  condition?: string
  conditionResult?: boolean
  branchTaken?: boolean
  executed: boolean
  bodyLines?: number[]
}

export type InputProbeResult =
  | { status: 'need_input'; prompt: string; inputIndex: number }
  | { status: 'complete' }

export type PythonExecutionResult = {
  success: boolean
  stdout: string
  stderr: string
  state?: Record<string, string>
  exprResult?: string | null
  testRuns?: Array<{ out: string; state: Record<string, string>; expr: string | null }>
  exitCode?: number | null
  flowTrace?: ControlFlowStep[]
  executedLines?: number[]
  skippedLines?: number[]
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
      if (cleanPythonComments(current).trim()) {
        statements.push({
          text: current,
          startLine: currentStartLine,
        })
      }
      current = ''
    }
  }

  if (cleanPythonComments(current).trim()) {
    statements.push({
      text: current,
      startLine: currentStartLine,
    })
  }

  return statements
}

// ─── Python Float Wrapper (preserves 10.0 vs 10 distinction in JS) ────────────

export function makePyFloat(n: number): number | Number {
  const obj = new Number(n)
  ;(obj as any).__isPyFloat = true
  return obj
}

export function isPyFloat(val: unknown): boolean {
  if (val instanceof Number && (val as any).__isPyFloat) return true
  if (typeof val === 'number' && !Number.isInteger(val) && !Number.isNaN(val)) return true
  return false
}

export function isPyNumeric(val: unknown): boolean {
  return typeof val === 'number' || val instanceof Number
}

export function toRawNumber(val: unknown): number {
  if (val instanceof Number) return val.valueOf()
  if (typeof val === 'boolean') return val ? 1 : 0
  return Number(val)
}

export function pyBool(val: unknown): boolean {
  if (val === null || val === undefined || val === false) return false
  if (val === true) return true
  if (isPyNumeric(val)) return toRawNumber(val) !== 0
  if (typeof val === 'string') return val.length > 0
  if (Array.isArray(val)) return val.length > 0
  if (val instanceof Set) return val.size > 0
  if (typeof val === 'object') return Object.keys(val as object).length > 0
  return Boolean(val)
}

export function pyTypeName(val: unknown): string {
  if (val === null || val === undefined) return 'NoneType'
  if (typeof val === 'boolean') return 'bool'
  if (isPyFloat(val)) return 'float'
  if (isPyNumeric(val)) return 'int'
  if (typeof val === 'string') return 'str'
  if (Array.isArray(val)) return 'list'
  if (val instanceof Set) return 'set'
  if (typeof val === 'function') return 'type'
  if (typeof val === 'object') return 'dict'
  return typeof val
}

/**
 * Produces a deterministic JSON string with keys sorted at all levels.
 */
export function canonicalStringify(val: unknown): string {
  if (val instanceof Number) {
    return JSON.stringify(val.valueOf())
  }
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
 * Formats a value as standard Python output.
 */
export function formatPyValue(val: unknown): string {
  if (val === null || val === undefined) return 'None'
  if (val === true) return 'True'
  if (val === false) return 'False'
  if (isPyFloat(val)) {
    const n = toRawNumber(val)
    if (Number.isFinite(n) && Number.isInteger(n)) {
      return `${n}.0`
    }
    return String(n)
  }
  if (val instanceof Number) {
    return String(val.valueOf())
  }
  if (Array.isArray(val)) {
    return '[' + val.map((item) => (typeof item === 'string' ? `'${item}'` : formatPyValue(item))).join(', ') + ']'
  }
  if (typeof val === 'function' && val.toString) return val.toString()
  return String(val)
}

/**
 * Creates a Python-like type constructor and class object (e.g. str, int, float, bool, list, dict).
 */
export function createPyType(name: string) {
  const fn = function (arg?: unknown) {
    if (name === 'str') {
      if (arg === undefined) return ''
      return formatPyValue(arg)
    }
    if (name === 'int') {
      if (arg === undefined) return 0
      if (typeof arg === 'boolean') return arg ? 1 : 0
      if (isPyNumeric(arg)) {
        return Math.trunc(toRawNumber(arg))
      }
      if (typeof arg === 'string') {
        const trimmed = arg.trim()
        if (!/^[+-]?\d+$/.test(trimmed)) {
          throw new Error(`ValueError: invalid literal for int() with base 10: '${arg}'`)
        }
        return parseInt(trimmed, 10)
      }
      throw new Error(`TypeError: int() argument must be a string or a real number, not '${pyTypeName(arg)}'`)
    }
    if (name === 'float') {
      if (arg === undefined) return makePyFloat(0.0)
      if (typeof arg === 'boolean') return makePyFloat(arg ? 1.0 : 0.0)
      if (isPyNumeric(arg)) {
        return makePyFloat(toRawNumber(arg))
      }
      if (typeof arg === 'string') {
        const trimmed = arg.trim()
        if (!trimmed || isNaN(Number(trimmed))) {
          throw new Error(`ValueError: could not convert string to float: '${arg}'`)
        }
        return makePyFloat(Number(trimmed))
      }
      throw new Error(`TypeError: float() argument must be a string or a real number, not '${pyTypeName(arg)}'`)
    }
    if (name === 'bool') {
      if (arg === undefined) return false
      if (typeof arg === 'string') {
        const norm = arg.trim().toLowerCase()
        if (norm === '' || norm === 'false' || norm === '0') return false
        return true
      }
      return pyBool(arg)
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
  if (typeof val === 'boolean') return PyBool
  if (isPyFloat(val)) return PyFloat
  if (isPyNumeric(val)) return PyInt
  if (typeof val === 'string') return PyStr
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

// ─── Python Runtime Operator Helpers ──────────────────────────────────────────

export function pyAdd(a: unknown, b: unknown): unknown {
  if (typeof a === 'string' && typeof b === 'string') {
    return a + b
  }
  if ((isPyNumeric(a) || typeof a === 'boolean') && (isPyNumeric(b) || typeof b === 'boolean')) {
    const res = toRawNumber(a) + toRawNumber(b)
    return isPyFloat(a) || isPyFloat(b) ? makePyFloat(res) : res
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return [...a, ...b]
  }
  if (typeof a === 'string') {
    throw new Error(`TypeError: can only concatenate str (not "${pyTypeName(b)}") to str`)
  }
  throw new Error(`TypeError: unsupported operand type(s) for +: '${pyTypeName(a)}' and '${pyTypeName(b)}'`)
}

export function pySub(a: unknown, b: unknown): unknown {
  if ((isPyNumeric(a) || typeof a === 'boolean') && (isPyNumeric(b) || typeof b === 'boolean')) {
    const res = toRawNumber(a) - toRawNumber(b)
    return isPyFloat(a) || isPyFloat(b) ? makePyFloat(res) : res
  }
  throw new Error(`TypeError: unsupported operand type(s) for -: '${pyTypeName(a)}' and '${pyTypeName(b)}'`)
}

export function pyMul(a: unknown, b: unknown): unknown {
  if ((isPyNumeric(a) || typeof a === 'boolean') && (isPyNumeric(b) || typeof b === 'boolean')) {
    const res = toRawNumber(a) * toRawNumber(b)
    return isPyFloat(a) || isPyFloat(b) ? makePyFloat(res) : res
  }
  if (typeof a === 'string' && ( (isPyNumeric(b) && !isPyFloat(b)) || typeof b === 'boolean')) {
    return a.repeat(Math.max(0, Math.trunc(toRawNumber(b))))
  }
  if (typeof b === 'string' && ((isPyNumeric(a) && !isPyFloat(a)) || typeof a === 'boolean')) {
    return b.repeat(Math.max(0, Math.trunc(toRawNumber(a))))
  }
  if (typeof a === 'string' || typeof b === 'string') {
    const other = typeof a === 'string' ? b : a
    throw new Error(`TypeError: can't multiply sequence by non-int of type '${pyTypeName(other)}'`)
  }
  throw new Error(`TypeError: unsupported operand type(s) for *: '${pyTypeName(a)}' and '${pyTypeName(b)}'`)
}

export function pyDiv(a: unknown, b: unknown): unknown {
  if ((isPyNumeric(a) || typeof a === 'boolean') && (isPyNumeric(b) || typeof b === 'boolean')) {
    const denom = toRawNumber(b)
    if (denom === 0) throw new Error('ZeroDivisionError: division by zero')
    return makePyFloat(toRawNumber(a) / denom)
  }
  throw new Error(`TypeError: unsupported operand type(s) for /: '${pyTypeName(a)}' and '${pyTypeName(b)}'`)
}

export function pyFloorDiv(a: unknown, b: unknown): unknown {
  if ((isPyNumeric(a) || typeof a === 'boolean') && (isPyNumeric(b) || typeof b === 'boolean')) {
    const denom = toRawNumber(b)
    if (denom === 0) throw new Error('ZeroDivisionError: integer division or modulo by zero')
    const res = Math.floor(toRawNumber(a) / denom)
    return isPyFloat(a) || isPyFloat(b) ? makePyFloat(res) : res
  }
  throw new Error(`TypeError: unsupported operand type(s) for //: '${pyTypeName(a)}' and '${pyTypeName(b)}'`)
}

export function pyMod(a: unknown, b: unknown): unknown {
  if ((isPyNumeric(a) || typeof a === 'boolean') && (isPyNumeric(b) || typeof b === 'boolean')) {
    const denom = toRawNumber(b)
    if (denom === 0) throw new Error('ZeroDivisionError: integer division or modulo by zero')
    const num = toRawNumber(a)
    const res = ((num % denom) + denom) % denom
    return isPyFloat(a) || isPyFloat(b) ? makePyFloat(res) : res
  }
  throw new Error(`TypeError: unsupported operand type(s) for %: '${pyTypeName(a)}' and '${pyTypeName(b)}'`)
}

export function pyPow(a: unknown, b: unknown): unknown {
  if ((isPyNumeric(a) || typeof a === 'boolean') && (isPyNumeric(b) || typeof b === 'boolean')) {
    const base = toRawNumber(a)
    const exp = toRawNumber(b)
    const res = Math.pow(base, exp)
    return isPyFloat(a) || isPyFloat(b) || exp < 0 ? makePyFloat(res) : res
  }
  throw new Error(`TypeError: unsupported operand type(s) for **: '${pyTypeName(a)}' and '${pyTypeName(b)}'`)
}

export function pyCompare(op: string, a: unknown, b: unknown): boolean {
  if (op === '==') {
    if ((isPyNumeric(a) || typeof a === 'boolean') && (isPyNumeric(b) || typeof b === 'boolean')) {
      return toRawNumber(a) === toRawNumber(b)
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a === b
    }
    if ((a === null || a === undefined) && (b === null || b === undefined)) {
      return true
    }
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null && !isPyNumeric(a) && !isPyNumeric(b)) {
      return canonicalStringify(a) === canonicalStringify(b)
    }
    return a === b
  }
  if (op === '!=') {
    return !pyCompare('==', a, b)
  }
  if (op === 'is') {
    if ((a === null || a === undefined) && (b === null || b === undefined)) return true
    if (isPyNumeric(a) && isPyNumeric(b) && isPyFloat(a) === isPyFloat(b)) {
      return toRawNumber(a) === toRawNumber(b)
    }
    return a === b
  }
  if (op === 'is not') {
    return !pyCompare('is', a, b)
  }
  if (op === 'in' || op === 'not in') {
    let found = false
    if (typeof b === 'string') {
      if (typeof a !== 'string') {
        throw new Error(`TypeError: 'in <string>' requires string as left operand, not ${pyTypeName(a)}`)
      }
      found = b.includes(a)
    } else if (Array.isArray(b)) {
      found = b.some((item) => pyCompare('==', a, item))
    } else if (b instanceof Set) {
      found = Array.from(b).some((item) => pyCompare('==', a, item))
    } else if (typeof b === 'object' && b !== null) {
      found = String(a) in (b as Record<string, unknown>)
    } else {
      throw new Error(`TypeError: argument of type '${pyTypeName(b)}' is not iterable`)
    }
    return op === 'in' ? found : !found
  }

  // Relational ordering: <, <=, >, >=
  if ((isPyNumeric(a) || typeof a === 'boolean') && (isPyNumeric(b) || typeof b === 'boolean')) {
    const na = toRawNumber(a)
    const nb = toRawNumber(b)
    if (op === '<') return na < nb
    if (op === '<=') return na <= nb
    if (op === '>') return na > nb
    if (op === '>=') return na >= nb
  }
  if (typeof a === 'string' && typeof b === 'string') {
    if (op === '<') return a < b
    if (op === '<=') return a <= b
    if (op === '>') return a > b
    if (op === '>=') return a >= b
  }
  throw new Error(
    `TypeError: '${op}' not supported between instances of '${pyTypeName(a)}' and '${pyTypeName(b)}'`
  )
}

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
      if (val === null || val === undefined) {
        throw new Error("TypeError: object of type 'NoneType' has no len()")
      }
      if (typeof val === 'string' || Array.isArray(val)) return val.length
      if (val instanceof Set) return val.size
      if (typeof val === 'object' && !isPyNumeric(val)) return Object.keys(val as object).length
      throw new Error(`TypeError: object of type '${pyTypeName(val)}' has no len()`)
    },
    range: (start: number, stop?: number, step = 1) => {
      const s0 = toRawNumber(start)
      const st = toRawNumber(step)
      let a = s0
      let b = stop !== undefined ? toRawNumber(stop) : s0
      if (stop === undefined) a = 0
      const res: number[] = []
      if (st > 0) {
        for (let i = a; i < b; i += st) res.push(i)
      } else if (st < 0) {
        for (let i = a; i > b; i += st) res.push(i)
      }
      return res
    },
    abs: (val: unknown) => {
      const n = Math.abs(toRawNumber(val))
      return isPyFloat(val) ? makePyFloat(n) : n
    },
    round: (val: unknown, n?: number) => {
      const num = toRawNumber(val)
      if (n === undefined) return Math.round(num)
      const f = Math.pow(10, toRawNumber(n))
      return makePyFloat(Math.round(num * f) / f)
    },
    pow: (a: unknown, b: unknown) => pyPow(a, b),
    sum: (arr: unknown[], start = 0) =>
      Array.isArray(arr)
        ? arr.reduce((a: number, b: unknown) => a + toRawNumber(b), toRawNumber(start))
        : toRawNumber(start),
    min: (...args: any[]) => {
      const items = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      return Math.min(...items.map(toRawNumber))
    },
    max: (...args: any[]) => {
      const items = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
      return Math.max(...items.map(toRawNumber))
    },
    input: () => '',
    isinstance: (val: unknown, targetType: unknown) => {
      if (typeof targetType === 'function') {
        const actualType = pyType(val)
        return (
          actualType === targetType ||
          (actualType as any).__name__ === (targetType as any).__name__
        )
      }
      return false
    },
    __py_bool__: pyBool,
    __py_add__: pyAdd,
    __py_sub__: pySub,
    __py_mul__: pyMul,
    __py_div__: pyDiv,
    __py_floordiv__: pyFloorDiv,
    __py_mod__: pyMod,
    __py_pow__: pyPow,
    __py_cmp__: pyCompare,
    __py_float__: makePyFloat,
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

    // Assignment: var: type = ... OR var = ... (must NOT match ==)
    const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)(?:\s*:\s*[\w\[\], ]+)?\s*=(?!=)/)
    if (assignMatch) {
      stored.add(assignMatch[1].trim())
    }

    // Augmented assignment: var += ...
    const augMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*(?:\+=|-=|\*=|\/=|(?:\/\/=)|%=|\*\*=)/)
    if (augMatch) {
      stored.add(augMatch[1].trim())
    }

    // For loop: for var in ...:
    const forMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\b/)
    if (forMatch) {
      stored.add(forMatch[1].trim())
    }

    // Function def: def var(...)
    const defMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\(/)
    if (defMatch) {
      stored.add(defMatch[1].trim())
    }
  }

  let noStrings = cleanCode.replace(/[frbFRB]*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '""')
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
 * Extracts prompts from all input(...) calls in Python source code in sequence.
 */
export function extractInputPrompts(code: string): string[] {
  const clean = cleanPythonComments(code)
  const prompts: string[] = []
  const regex =
    /\binput\s*\(\s*(?:([fFrRbBuU]?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))|([^)]*))\s*\)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(clean)) !== null) {
    if (m[1]) {
      const raw = m[1].replace(/^[fFrRbBuU]?['"]{1,3}/, '').replace(/['"]{1,3}$/, '')
      prompts.push(raw)
    } else if (m[2] && m[2].trim()) {
      prompts.push(m[2].trim())
    } else {
      prompts.push('')
    }
  }
  return prompts
}

// ─── Python Expression Parser & Evaluator (Full Precedence & Type Fidelity) ──

type ExprToken =
  | { type: 'number'; raw: string; isFloat: boolean; value: number }
  | { type: 'string'; raw: string; isFString: boolean; value: string }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'punct'; value: string }

function tokenizePythonExpr(expr: string): ExprToken[] {
  const tokens: ExprToken[] = []
  let i = 0
  const n = expr.length

  while (i < n) {
    const ch = expr[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === '#') break

    // Strings (including f-strings, r-strings, triple-quoted strings)
    if (
      ch === '"' ||
      ch === "'" ||
      ((ch === 'f' || ch === 'F' || ch === 'r' || ch === 'R') &&
        i + 1 < n &&
        (expr[i + 1] === '"' || expr[i + 1] === "'"))
    ) {
      let isFString = false
      if (ch === 'f' || ch === 'F') {
        isFString = true
        i++
      } else if (ch === 'r' || ch === 'R') {
        i++
      }
      const quote = expr[i]
      let isTriple = false
      if (expr.slice(i, i + 3) === quote.repeat(3)) {
        isTriple = true
        i += 3
      } else {
        i++
      }
      let content = ''
      let closed = false
      while (i < n) {
        if (isTriple && expr.slice(i, i + 3) === quote.repeat(3)) {
          i += 3
          closed = true
          break
        }
        if (!isTriple && expr[i] === quote) {
          i++
          closed = true
          break
        }
        if (expr[i] === '\\' && i + 1 < n) {
          const nextCh = expr[i + 1]
          if (nextCh === 'n') content += '\n'
          else if (nextCh === 't') content += '\t'
          else if (nextCh === 'r') content += '\r'
          else if (nextCh === '\\') content += '\\'
          else if (nextCh === '"' || nextCh === "'") content += nextCh
          else content += '\\' + nextCh
          i += 2
          continue
        }
        content += expr[i]
        i++
      }
      if (!closed) {
        throw new Error('SyntaxError: unterminated string literal')
      }
      tokens.push({ type: 'string', raw: content, isFString, value: content })
      continue
    }

    // Numbers (integers & floats, e.g. 42, 3.14, .5, 10.)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < n && /\d/.test(expr[i + 1]))) {
      let numStr = ''
      let hasDot = false
      let hasExp = false
      while (i < n) {
        const c = expr[i]
        if (/\d/.test(c)) {
          numStr += c
          i++
        } else if (c === '.' && !hasDot && !hasExp) {
          hasDot = true
          numStr += c
          i++
        } else if ((c === 'e' || c === 'E') && !hasExp) {
          hasExp = true
          numStr += c
          i++
          if (i < n && (expr[i] === '+' || expr[i] === '-')) {
            numStr += expr[i]
            i++
          }
        } else if (c === '_') {
          i++
        } else {
          break
        }
      }
      const val = Number(numStr)
      if (Number.isNaN(val)) {
        throw new Error(`SyntaxError: invalid numeric literal '${numStr}'`)
      }
      tokens.push({ type: 'number', raw: numStr, isFloat: hasDot || hasExp, value: val })
      continue
    }

    // Multi-char operators: **, //, ==, !=, <=, >=
    const twoChar = expr.slice(i, i + 2)
    if (['**', '//', '==', '!=', '<=', '>='].includes(twoChar)) {
      tokens.push({ type: 'op', value: twoChar })
      i += 2
      continue
    }

    // Single-char operators
    if (['+', '-', '*', '/', '%', '<', '>'].includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }

    // Single '=' inside expression (syntax error unless keyword arg, handled in call args)
    if (ch === '=') {
      tokens.push({ type: 'punct', value: '=' })
      i++
      continue
    }

    // Punctuation
    if (['(', ')', '[', ']', '{', '}', ',', ':', '.'].includes(ch)) {
      tokens.push({ type: 'punct', value: ch })
      i++
      continue
    }

    // Identifiers & keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let id = ''
      while (i < n && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i]
        i++
      }
      tokens.push({ type: 'ident', value: id })
      continue
    }

    throw new Error(`SyntaxError: invalid character '${ch}'`)
  }

  return tokens
}

/**
 * Transforms a Python expression into equivalent JavaScript (kept for compatibility).
 */
export function transformPythonExprToJS(expr: string): string {
  const clean = cleanPythonComments(expr).trim()
  if (!clean) return ''

  const stringLiterals: string[] = []
  let s = clean.replace(
    /([fFrRbBuU]?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))/g,
    (match) => {
      stringLiterals.push(match)
      return `___PY_STR_${stringLiterals.length - 1}___`
    }
  )

  for (let i = 0; i < stringLiterals.length; i++) {
    const raw = stringLiterals[i]
    if (
      raw.startsWith('f"') ||
      raw.startsWith("f'") ||
      raw.startsWith('F"') ||
      raw.startsWith("F'")
    ) {
      const content = raw.slice(2, -1)
      const converted = content.replace(/\{([^}]+)\}/g, (_, inner) => {
        return '${' + transformPythonExprToJS(inner) + '}'
      })
      stringLiterals[i] = '`' + converted.replace(/`/g, '\\`') + '`'
    }
  }

  s = s
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b\s+/g, '!')
    .replace(/\bis\s+not\s+None\b/g, '!== null')
    .replace(/\bis\s+None\b/g, '=== null')
    .replace(/\.__name\b(?!_)/g, '.__name__')

  s = s.replace(/___PY_STR_(\d+)___/g, (_, idx) => stringLiterals[parseInt(idx, 10)])
  return s
}

/**
 * Evaluates a Python expression using a recursive-descent parser with exact Python
 * operator precedence, chained comparisons, f-string interpolation, and strict type checking.
 */
export function evaluateExpr(expr: string, scope: Record<string, unknown>): unknown {
  const cleaned = cleanPythonComments(expr).trim()
  if (!cleaned) return undefined

  const tokens = tokenizePythonExpr(cleaned)
  if (tokens.length === 0) return undefined

  let pos = 0
  let suppressEval = 0

  function peek(): ExprToken | undefined {
    return tokens[pos]
  }

  function consume(): ExprToken {
    return tokens[pos++]
  }

  function matchOp(val: string): boolean {
    const t = peek()
    if (t && t.type === 'op' && t.value === val) {
      pos++
      return true
    }
    return false
  }

  function matchIdent(val: string): boolean {
    const t = peek()
    if (t && t.type === 'ident' && t.value === val) {
      pos++
      return true
    }
    return false
  }

  function matchPunct(val: string): boolean {
    const t = peek()
    if (t && t.type === 'punct' && t.value === val) {
      pos++
      return true
    }
    return false
  }

  function expectPunct(val: string) {
    if (!matchPunct(val)) {
      throw new Error(`SyntaxError: expected '${val}'`)
    }
  }

  // Conditional expression: X if C else Y, or `or` expression
  function parseConditional(): unknown {
    const val = parseOr()
    const t = peek()
    if (t && t.type === 'ident' && t.value === 'if') {
      pos++
      const cond = parseOr()
      if (!matchIdent('else')) {
        throw new Error("SyntaxError: expected 'else' after conditional expression")
      }
      const condTrue = suppressEval === 0 && pyBool(cond)
      if (condTrue) suppressEval++
      const alt = parseConditional()
      if (condTrue) suppressEval--
      return condTrue ? val : alt
    }
    return val
  }

  // `or` (short-circuiting, returns actual Python operand value)
  function parseOr(): unknown {
    let left = parseAnd()
    while (matchIdent('or')) {
      if (suppressEval > 0 || pyBool(left)) {
        suppressEval++
        parseAnd()
        suppressEval--
      } else {
        left = parseAnd()
      }
    }
    return left
  }

  // `and` (short-circuiting, returns actual Python operand value)
  function parseAnd(): unknown {
    let left = parseNot()
    while (matchIdent('and')) {
      if (suppressEval > 0 || !pyBool(left)) {
        suppressEval++
        parseNot()
        suppressEval--
      } else {
        left = parseNot()
      }
    }
    return left
  }

  // `not` (binds looser than comparisons in Python!)
  function parseNot(): unknown {
    if (matchIdent('not')) {
      const operand = parseNot()
      if (suppressEval > 0) return false
      return !pyBool(operand)
    }
    return parseComparison()
  }

  // Chained comparisons: ==, !=, <, <=, >, >=, is, is not, in, not in
  function parseComparison(): unknown {
    const first = parseAdditive()
    const ops: string[] = []
    const operands: unknown[] = [first]

    while (true) {
      const t = peek()
      if (!t) break

      if (t.type === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(t.value)) {
        pos++
        ops.push(t.value)
        operands.push(parseAdditive())
        continue
      }
      if (t.type === 'ident' && t.value === 'is') {
        pos++
        if (matchIdent('not')) {
          ops.push('is not')
        } else {
          ops.push('is')
        }
        operands.push(parseAdditive())
        continue
      }
      if (t.type === 'ident' && t.value === 'in') {
        pos++
        ops.push('in')
        operands.push(parseAdditive())
        continue
      }
      if (
        t.type === 'ident' &&
        t.value === 'not' &&
        tokens[pos + 1]?.type === 'ident' &&
        tokens[pos + 1]?.value === 'in'
      ) {
        pos += 2
        ops.push('not in')
        operands.push(parseAdditive())
        continue
      }
      break
    }

    if (ops.length === 0) return first
    if (suppressEval > 0) return false

    for (let i = 0; i < ops.length; i++) {
      if (!pyCompare(ops[i], operands[i], operands[i + 1])) {
        return false
      }
    }
    return true
  }

  // Additive: +, -
  function parseAdditive(): unknown {
    let left = parseMultiplicative()
    while (true) {
      if (matchOp('+')) {
        const right = parseMultiplicative()
        if (suppressEval === 0) left = pyAdd(left, right)
      } else if (matchOp('-')) {
        const right = parseMultiplicative()
        if (suppressEval === 0) left = pySub(left, right)
      } else {
        break
      }
    }
    return left
  }

  // Multiplicative: *, /, //, %
  function parseMultiplicative(): unknown {
    let left = parseUnary()
    while (true) {
      if (matchOp('*')) {
        const right = parseUnary()
        if (suppressEval === 0) left = pyMul(left, right)
      } else if (matchOp('/')) {
        const right = parseUnary()
        if (suppressEval === 0) left = pyDiv(left, right)
      } else if (matchOp('//')) {
        const right = parseUnary()
        if (suppressEval === 0) left = pyFloorDiv(left, right)
      } else if (matchOp('%')) {
        const right = parseUnary()
        if (suppressEval === 0) left = pyMod(left, right)
      } else {
        break
      }
    }
    return left
  }

  // Unary: +x, -x
  function parseUnary(): unknown {
    if (matchOp('+')) {
      const v = parseUnary()
      if (suppressEval > 0) return 0
      if (!isPyNumeric(v) && typeof v !== 'boolean') {
        throw new Error(`TypeError: bad operand type for unary +: '${pyTypeName(v)}'`)
      }
      return isPyFloat(v) ? makePyFloat(+toRawNumber(v)) : +toRawNumber(v)
    }
    if (matchOp('-')) {
      const v = parseUnary()
      if (suppressEval > 0) return 0
      if (!isPyNumeric(v) && typeof v !== 'boolean') {
        throw new Error(`TypeError: bad operand type for unary -: '${pyTypeName(v)}'`)
      }
      return isPyFloat(v) ? makePyFloat(-toRawNumber(v)) : -toRawNumber(v)
    }
    return parsePower()
  }

  // Power: ** (right-associative, binds tighter than unary -)
  function parsePower(): unknown {
    const base = parsePostfix()
    if (matchOp('**')) {
      const exp = parseUnary()
      if (suppressEval > 0) return 0
      return pyPow(base, exp)
    }
    return base
  }

  // Postfix: call `fn(...)`, subscript `x[i]`, attribute `x.attr`
  function parsePostfix(): unknown {
    let target = parsePrimary()

    while (true) {
      if (matchPunct('(')) {
        const args: unknown[] = []
        if (!matchPunct(')')) {
          while (true) {
            if (
              peek()?.type === 'ident' &&
              tokens[pos + 1]?.type === 'punct' &&
              tokens[pos + 1]?.value === '='
            ) {
              pos += 2
              args.push(parseConditional())
            } else {
              args.push(parseConditional())
            }
            if (matchPunct(',')) {
              if (peek()?.type === 'punct' && peek()?.value === ')') break
              continue
            }
            break
          }
          expectPunct(')')
        }
        if (suppressEval > 0) continue
        if (typeof target !== 'function') {
          throw new Error(`TypeError: '${pyTypeName(target)}' object is not callable`)
        }
        target = (target as (...a: unknown[]) => unknown)(...args)
        continue
      }

      if (matchPunct('[')) {
        const idxVal = parseConditional()
        expectPunct(']')
        if (suppressEval > 0) continue
        if (Array.isArray(target) || typeof target === 'string') {
          if (!isPyNumeric(idxVal) || isPyFloat(idxVal)) {
            throw new Error(`TypeError: indices must be integers, not '${pyTypeName(idxVal)}'`)
          }
          let idx = toRawNumber(idxVal)
          if (idx < 0) idx = target.length + idx
          if (idx < 0 || idx >= target.length) {
            throw new Error('IndexError: index out of range')
          }
          target = target[idx]
        } else if (typeof target === 'object' && target !== null) {
          const key = String(idxVal instanceof Number ? idxVal.valueOf() : idxVal)
          if (!(key in (target as Record<string, unknown>))) {
            throw new Error(`KeyError: '${key}'`)
          }
          target = (target as Record<string, unknown>)[key]
        } else {
          throw new Error(`TypeError: '${pyTypeName(target)}' object is not subscriptable`)
        }
        continue
      }

      if (matchPunct('.')) {
        const propToken = consume()
        if (!propToken || propToken.type !== 'ident') {
          throw new Error('SyntaxError: expected attribute name after "."')
        }
        if (suppressEval > 0) continue
        const prop = propToken.value
        target = resolvePyAttribute(target, prop)
        continue
      }

      break
    }

    return target
  }

  function parsePrimary(): unknown {
    const t = peek()
    if (!t) {
      throw new Error('SyntaxError: unexpected end of expression')
    }

    if (t.type === 'number') {
      pos++
      return t.isFloat ? makePyFloat(t.value) : t.value
    }

    if (t.type === 'string') {
      pos++
      if (t.isFString && suppressEval === 0) {
        return t.value.replace(/\{([^}]+)\}/g, (_, innerExpr: string) => {
          const colonIdx = innerExpr.lastIndexOf(':')
          if (
            colonIdx !== -1 &&
            !innerExpr.slice(colonIdx).includes('}') &&
            !innerExpr.slice(0, colonIdx).includes('{')
          ) {
            const exprPart = innerExpr.slice(0, colonIdx).trim()
            const specPart = innerExpr.slice(colonIdx + 1).trim()
            const evaluated = evaluateExpr(exprPart, scope)
            const fMatch = specPart.match(/^\.(\d+)f$/)
            if (fMatch && isPyNumeric(evaluated)) {
              return toRawNumber(evaluated).toFixed(parseInt(fMatch[1], 10))
            }
            return formatPyValue(evaluated)
          }
          return formatPyValue(evaluateExpr(innerExpr, scope))
        })
      }
      return t.value
    }

    if (t.type === 'ident') {
      pos++
      if (t.value === 'True') return true
      if (t.value === 'False') return false
      if (t.value === 'None') return null
      if (suppressEval > 0) return null
      if (t.value in scope) {
        return scope[t.value]
      }
      throw new Error(`NameError: name '${t.value}' is not defined`)
    }

    // Parenthesized expression or tuple
    if (matchPunct('(')) {
      if (matchPunct(')')) return []
      const first = parseConditional()
      if (matchPunct(',')) {
        const items: unknown[] = [first]
        if (!matchPunct(')')) {
          while (true) {
            items.push(parseConditional())
            if (matchPunct(',')) {
              if (peek()?.type === 'punct' && peek()?.value === ')') break
              continue
            }
            break
          }
          expectPunct(')')
        }
        return items
      }
      expectPunct(')')
      return first
    }

    // List literal [...]
    if (matchPunct('[')) {
      const items: unknown[] = []
      if (!matchPunct(']')) {
        while (true) {
          items.push(parseConditional())
          if (matchPunct(',')) {
            if (peek()?.type === 'punct' && peek()?.value === ']') break
            continue
          }
          break
        }
        expectPunct(']')
      }
      return items
    }

    // Dict or Set literal {...}
    if (matchPunct('{')) {
      if (matchPunct('}')) return {}
      const firstKey = parseConditional()
      if (matchPunct(':')) {
        const obj: Record<string, unknown> = {}
        const firstVal = parseConditional()
        obj[String(firstKey instanceof Number ? firstKey.valueOf() : firstKey)] = firstVal
        while (matchPunct(',')) {
          if (peek()?.type === 'punct' && peek()?.value === '}') break
          const k = parseConditional()
          expectPunct(':')
          const v = parseConditional()
          obj[String(k instanceof Number ? k.valueOf() : k)] = v
        }
        expectPunct('}')
        return obj
      } else {
        const setItems: unknown[] = [firstKey]
        while (matchPunct(',')) {
          if (peek()?.type === 'punct' && peek()?.value === '}') break
          setItems.push(parseConditional())
        }
        expectPunct('}')
        return new Set(setItems)
      }
    }

    throw new Error(`SyntaxError: unexpected token '${t.value}'`)
  }

  const result = parseConditional()
  if (pos < tokens.length) {
    throw new Error(`SyntaxError: unexpected token '${tokens[pos].value}'`)
  }
  return result
}

function resolvePyAttribute(target: unknown, prop: string): unknown {
  if (target === null || target === undefined) {
    throw new Error(`AttributeError: 'NoneType' object has no attribute '${prop}'`)
  }
  if (prop === '__name__' || prop === '__name') {
    if (typeof target === 'function') {
      return (target as any).__name__ || target.name || 'type'
    }
  }
  if (typeof target === 'string') {
    switch (prop) {
      case 'lower':
        return () => target.toLowerCase()
      case 'upper':
        return () => target.toUpperCase()
      case 'strip':
        return (chars?: string) => {
          if (!chars) return target.trim()
          const esc = chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          return target.replace(new RegExp(`^[${esc}]+|[${esc}]+$`, 'g'), '')
        }
      case 'lstrip':
        return () => target.trimStart()
      case 'rstrip':
        return () => target.trimEnd()
      case 'capitalize':
        return () => (target ? target[0].toUpperCase() + target.slice(1).toLowerCase() : '')
      case 'title':
        return () =>
          target.replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
      case 'split':
        return (sep?: string) => (sep === undefined ? target.trim().split(/\s+/) : target.split(sep))
      case 'replace':
        return (oldS: string, newS: string) => target.split(String(oldS)).join(String(newS))
      case 'startswith':
        return (prefix: string) => target.startsWith(String(prefix))
      case 'endswith':
        return (suffix: string) => target.endsWith(String(suffix))
      case 'isdigit':
        return () => /^\d+$/.test(target)
      case 'isalpha':
        return () => /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+$/.test(target)
      case 'isalnum':
        return () => /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]+$/.test(target)
      case 'count':
        return (sub: string) => (sub ? target.split(String(sub)).length - 1 : target.length + 1)
      case 'find':
        return (sub: string) => target.indexOf(String(sub))
    }
  }
  if (Array.isArray(target)) {
    switch (prop) {
      case 'append':
        return (item: unknown) => {
          target.push(item)
          return null
        }
      case 'pop':
        return (idx?: number) => {
          if (idx === undefined) return target.pop()
          const i = idx < 0 ? target.length + idx : idx
          return target.splice(i, 1)[0]
        }
      case 'count':
        return (val: unknown) => target.filter((x) => pyCompare('==', x, val)).length
    }
  }
  if (typeof target === 'object' && target !== null && !isPyNumeric(target)) {
    const rec = target as Record<string, unknown>
    switch (prop) {
      case 'get':
        return (k: unknown, defVal: unknown = null) => {
          const key = String(k instanceof Number ? k.valueOf() : k)
          return key in rec ? rec[key] : defVal
        }
      case 'keys':
        return () => Object.keys(rec)
      case 'values':
        return () => Object.values(rec)
      case 'items':
        return () => Object.entries(rec)
    }
    if (prop in rec) return rec[prop]
  }
  if ((target as any)[prop] !== undefined) {
    return (target as any)[prop]
  }
  throw new Error(`AttributeError: '${pyTypeName(target)}' object has no attribute '${prop}'`)
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

// ─── Indentation-Aware AST Parser for Control Flow (`if / elif / else`) ──────

type PreparedStatement = {
  startLine: number
  indentSpaces: number
  trimmed: string
  kind: 'if' | 'elif' | 'else' | 'statement'
  condition?: string
}

type ASTNode =
  | {
      type: 'stmt'
      lineNumber: number
      indentLevel: number
      code: string
    }
  | {
      type: 'if_chain'
      branches: Array<{
        kind: 'if' | 'elif' | 'else'
        lineNumber: number
        indentLevel: number
        code: string
        condition?: string
        body: ASTNode[]
      }>
    }

function findHeaderColonIndex(trimmed: string, keywordLen: number): number {
  let paren = 0
  let bracket = 0
  let brace = 0
  let inStr: string | null = null

  for (let i = keywordLen; i < trimmed.length; i++) {
    const ch = trimmed[i]
    const prev = i > 0 ? trimmed[i - 1] : ''
    if (inStr) {
      if (ch === inStr && prev !== '\\') inStr = null
      continue
    }
    if (ch === '"' || ch === "'") {
      inStr = ch
      continue
    }
    if (ch === '(') paren++
    else if (ch === ')') paren = Math.max(0, paren - 1)
    else if (ch === '[') bracket++
    else if (ch === ']') bracket = Math.max(0, bracket - 1)
    else if (ch === '{') brace++
    else if (ch === '}') brace = Math.max(0, brace - 1)
    else if (ch === ':' && paren === 0 && bracket === 0 && brace === 0) {
      return i
    }
  }
  return -1
}

function prepareStatements(sourceCode: string): PreparedStatement[] {
  const rawStmts = splitIntoLogicalStatements(sourceCode)
  const prepared: PreparedStatement[] = []

  for (const s of rawStmts) {
    const noComment = cleanPythonComments(s.text)
    const trimmed = noComment.trim()
    if (!trimmed) continue

    const leadingMatch = noComment.match(/^([ \t]*)/)
    const indentSpaces = leadingMatch ? leadingMatch[1].replace(/\t/g, '    ').length : 0

    // Check for `if`, `elif`, `else`
    if (/^if(?:\s|\()/.test(trimmed) || trimmed === 'if') {
      const colonIdx = findHeaderColonIndex(trimmed, 2)
      if (colonIdx === -1) {
        throw new Error(
          `  File "<string>", line ${s.startLine}\n    ${trimmed}\nSyntaxError: expected ':'`
        )
      }
      const cond = trimmed.slice(2, colonIdx).trim()
      if (!cond) {
        throw new Error(
          `  File "<string>", line ${s.startLine}\n    ${trimmed}\nSyntaxError: invalid syntax (falta la condición del 'if')`
        )
      }
      const trailing = trimmed.slice(colonIdx + 1).trim()
      prepared.push({
        startLine: s.startLine,
        indentSpaces,
        trimmed: trimmed.slice(0, colonIdx + 1),
        kind: 'if',
        condition: cond,
      })
      if (trailing) {
        prepared.push({
          startLine: s.startLine,
          indentSpaces: indentSpaces + 4,
          trimmed: trailing,
          kind: 'statement',
        })
      }
      continue
    }

    if (/^elif(?:\s|\()/.test(trimmed) || trimmed === 'elif') {
      const colonIdx = findHeaderColonIndex(trimmed, 4)
      if (colonIdx === -1) {
        throw new Error(
          `  File "<string>", line ${s.startLine}\n    ${trimmed}\nSyntaxError: expected ':'`
        )
      }
      const cond = trimmed.slice(4, colonIdx).trim()
      if (!cond) {
        throw new Error(
          `  File "<string>", line ${s.startLine}\n    ${trimmed}\nSyntaxError: invalid syntax (falta la condición del 'elif')`
        )
      }
      const trailing = trimmed.slice(colonIdx + 1).trim()
      prepared.push({
        startLine: s.startLine,
        indentSpaces,
        trimmed: trimmed.slice(0, colonIdx + 1),
        kind: 'elif',
        condition: cond,
      })
      if (trailing) {
        prepared.push({
          startLine: s.startLine,
          indentSpaces: indentSpaces + 4,
          trimmed: trailing,
          kind: 'statement',
        })
      }
      continue
    }

    if (/^else\b/.test(trimmed)) {
      const colonIdx = findHeaderColonIndex(trimmed, 4)
      if (colonIdx === -1) {
        throw new Error(
          `  File "<string>", line ${s.startLine}\n    ${trimmed}\nSyntaxError: expected ':'`
        )
      }
      const between = trimmed.slice(4, colonIdx).trim()
      if (between) {
        throw new Error(
          `  File "<string>", line ${s.startLine}\n    ${trimmed}\nSyntaxError: invalid syntax ('else' no lleva condición; usa 'elif')`
        )
      }
      const trailing = trimmed.slice(colonIdx + 1).trim()
      prepared.push({
        startLine: s.startLine,
        indentSpaces,
        trimmed: 'else:',
        kind: 'else',
      })
      if (trailing) {
        prepared.push({
          startLine: s.startLine,
          indentSpaces: indentSpaces + 4,
          trimmed: trailing,
          kind: 'statement',
        })
      }
      continue
    }

    prepared.push({
      startLine: s.startLine,
      indentSpaces,
      trimmed,
      kind: 'statement',
    })
  }

  return prepared
}

function parseBlock(
  stmts: PreparedStatement[],
  startIdx: number,
  expectedIndent?: number
): { nodes: ASTNode[]; nextIdx: number } {
  if (startIdx >= stmts.length) {
    return { nodes: [], nextIdx: startIdx }
  }

  const blockIndent = expectedIndent ?? stmts[startIdx].indentSpaces
  const nodes: ASTNode[] = []
  let idx = startIdx

  while (idx < stmts.length) {
    const s = stmts[idx]
    if (s.indentSpaces < blockIndent) {
      break
    }
    if (s.indentSpaces > blockIndent) {
      throw new Error(
        `  File "<string>", line ${s.startLine}\n    ${s.trimmed}\nIndentationError: unexpected indent`
      )
    }

    const indentLevel = Math.max(0, Math.round(blockIndent / 4))

    if (s.kind === 'if') {
      const branches: Array<{
        kind: 'if' | 'elif' | 'else'
        lineNumber: number
        indentLevel: number
        code: string
        condition?: string
        body: ASTNode[]
      }> = []

      // Parse `if` body
      if (idx + 1 >= stmts.length || stmts[idx + 1].indentSpaces <= blockIndent) {
        throw new Error(
          `  File "<string>", line ${s.startLine}\n    ${s.trimmed}\nIndentationError: expected an indented block after 'if' statement on line ${s.startLine}`
        )
      }
      const ifBodyIndent = stmts[idx + 1].indentSpaces
      const ifBodyRes = parseBlock(stmts, idx + 1, ifBodyIndent)
      branches.push({
        kind: 'if',
        lineNumber: s.startLine,
        indentLevel,
        code: s.trimmed,
        condition: s.condition,
        body: ifBodyRes.nodes,
      })
      idx = ifBodyRes.nextIdx

      // Parse zero or more `elif` branches at the same blockIndent
      while (idx < stmts.length && stmts[idx].indentSpaces === blockIndent && stmts[idx].kind === 'elif') {
        const elifStmt = stmts[idx]
        if (idx + 1 >= stmts.length || stmts[idx + 1].indentSpaces <= blockIndent) {
          throw new Error(
            `  File "<string>", line ${elifStmt.startLine}\n    ${elifStmt.trimmed}\nIndentationError: expected an indented block after 'elif' statement on line ${elifStmt.startLine}`
          )
        }
        const elifBodyIndent = stmts[idx + 1].indentSpaces
        const elifBodyRes = parseBlock(stmts, idx + 1, elifBodyIndent)
        branches.push({
          kind: 'elif',
          lineNumber: elifStmt.startLine,
          indentLevel,
          code: elifStmt.trimmed,
          condition: elifStmt.condition,
          body: elifBodyRes.nodes,
        })
        idx = elifBodyRes.nextIdx
      }

      // Parse optional `else` branch at the same blockIndent
      if (idx < stmts.length && stmts[idx].indentSpaces === blockIndent && stmts[idx].kind === 'else') {
        const elseStmt = stmts[idx]
        if (idx + 1 >= stmts.length || stmts[idx + 1].indentSpaces <= blockIndent) {
          throw new Error(
            `  File "<string>", line ${elseStmt.startLine}\n    ${elseStmt.trimmed}\nIndentationError: expected an indented block after 'else' statement on line ${elseStmt.startLine}`
          )
        }
        const elseBodyIndent = stmts[idx + 1].indentSpaces
        const elseBodyRes = parseBlock(stmts, idx + 1, elseBodyIndent)
        branches.push({
          kind: 'else',
          lineNumber: elseStmt.startLine,
          indentLevel,
          code: elseStmt.trimmed,
          body: elseBodyRes.nodes,
        })
        idx = elseBodyRes.nextIdx
      }

      nodes.push({ type: 'if_chain', branches })
      continue
    }

    if (s.kind === 'elif' || s.kind === 'else') {
      throw new Error(
        `  File "<string>", line ${s.startLine}\n    ${s.trimmed}\nSyntaxError: invalid syntax ('${s.kind}' debe estar alineado con un bloque 'if' previo)`
      )
    }

    nodes.push({
      type: 'stmt',
      lineNumber: s.startLine,
      indentLevel,
      code: s.trimmed,
    })
    idx++
  }

  return { nodes, nextIdx: idx }
}

function collectASTLineNumbers(nodes: ASTNode[]): number[] {
  const lines: number[] = []
  for (const node of nodes) {
    if (node.type === 'stmt') {
      lines.push(node.lineNumber)
    } else if (node.type === 'if_chain') {
      for (const b of node.branches) {
        lines.push(b.lineNumber)
        lines.push(...collectASTLineNumbers(b.body))
      }
    }
  }
  return lines
}

function markSubtreeSkipped(
  nodes: ASTNode[],
  flowTrace: ControlFlowStep[],
  skippedLines: Set<number>
) {
  for (const node of nodes) {
    if (node.type === 'stmt') {
      skippedLines.add(node.lineNumber)
      flowTrace.push({
        lineNumber: node.lineNumber,
        indentLevel: node.indentLevel,
        kind: 'statement',
        code: node.code,
        executed: false,
      })
    } else if (node.type === 'if_chain') {
      for (const b of node.branches) {
        skippedLines.add(b.lineNumber)
        const bodyLines = collectASTLineNumbers(b.body)
        flowTrace.push({
          lineNumber: b.lineNumber,
          indentLevel: b.indentLevel,
          kind: b.kind,
          code: b.code,
          condition: b.condition,
          branchTaken: false,
          executed: false,
          bodyLines,
        })
        markSubtreeSkipped(b.body, flowTrace, skippedLines)
      }
    }
  }
}

class NeedMoreInputSignal extends Error {
  prompt: string
  constructor(prompt: string) {
    super('NEED_MORE_INPUT')
    this.prompt = prompt
  }
}

type SingleRunResult = PythonExecutionResult & {
  undef: Set<string>
}

/**
 * Probes the Python code with the currently collected inputs to determine if execution
 * along the active control-flow path requires another `input()` value from the user.
 */
export function probeNextInput(code: string, providedInputs: string[] = []): InputProbeResult {
  try {
    runSingleScript(code, undefined, providedInputs, true)
    return { status: 'complete' }
  } catch (err: unknown) {
    if (err instanceof NeedMoreInputSignal) {
      return {
        status: 'need_input',
        prompt: err.prompt,
        inputIndex: providedInputs.length,
      }
    }
    return { status: 'complete' }
  }
}

/**
 * Executes a single evaluation pass of a Python script with full support for:
 * - `if`, `elif`, `else` and nested conditionals
 * - `input()` and `print()`
 * - Primitive data types (`int`, `float`, `str`, `bool`, `None`) and type casting
 * - Arithmetic, relational, and logical operators
 */
function runSingleScript(
  sourceCode: string,
  mockValues?: Record<string, unknown>,
  inputs?: string[],
  throwOnMissingInput = false
): SingleRunResult {
  const undef = findUndefinedVariables(sourceCode)
  const output: string[] = []
  const inputQueue = inputs ? [...inputs] : []
  let inputCount = 0

  let astNodes: ASTNode[] = []
  try {
    const prepared = prepareStatements(sourceCode)
    if (prepared.length > 0 && prepared[0].indentSpaces > 0) {
      throw new Error(
        `  File "<string>", line ${prepared[0].startLine}\n    ${prepared[0].trimmed}\nIndentationError: unexpected indent`
      )
    }
    const parsed = parseBlock(prepared, 0, 0)
    astNodes = parsed.nodes
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      stdout: '',
      stderr: msg,
      state: {},
      exprResult: null,
      exitCode: 1,
      undef,
      flowTrace: [],
      executedLines: [],
      skippedLines: [],
    }
  }

  const scope: Record<string, unknown> = {
    ...getBuiltinScope(),
    print: (...args: any[]) => {
      const line = args.map((a) => formatPyValue(a)).join(' ')
      output.push(line)
      return null
    },
    input: (prompt?: unknown) => {
      const promptStr = prompt !== undefined && prompt !== null ? formatPyValue(prompt) : ''
      if (inputQueue.length > 0) {
        inputCount++
        return String(inputQueue.shift())
      }
      if (throwOnMissingInput) {
        throw new NeedMoreInputSignal(promptStr)
      }
      const defaults = ['10', '20', '5', '15', '100', 'True', 'Python']
      const val = defaults[inputCount % defaults.length]
      inputCount++
      return val
    },
  }
  const builtinKeys = new Set(Object.keys(scope))
  let lastExprValue: unknown = undefined

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

  const flowTrace: ControlFlowStep[] = []
  const executedLines = new Set<number>()
  const skippedLines = new Set<number>()

  function executeSimpleStmt(node: Extract<ASTNode, { type: 'stmt' }>) {
    const rawText = node.code.trim()
    if (!rawText || rawText.startsWith('#') || rawText === 'pass') {
      executedLines.add(node.lineNumber)
      flowTrace.push({
        lineNumber: node.lineNumber,
        indentLevel: node.indentLevel,
        kind: 'statement',
        code: rawText,
        executed: true,
      })
      return
    }

    executedLines.add(node.lineNumber)
    flowTrace.push({
      lineNumber: node.lineNumber,
      indentLevel: node.indentLevel,
      kind: 'statement',
      code: rawText,
      executed: true,
    })

    // 1. Handle print(...)
    const printMatch = rawText.match(/^print\s*\(([\s\S]*)\)$/)
    if (printMatch) {
      const argsText = printMatch[1].trim()
      if (!argsText) {
        output.push('')
        return
      }
      const argsList = splitArguments(argsText)
      let sep = ' '
      let end = ''
      const positionalArgs: string[] = []
      for (const a of argsList) {
        const kwMatch = a.match(/^(sep|end)\s*=\s*([\s\S]+)$/)
        if (kwMatch) {
          const kwVal = formatPyValue(evaluateExpr(kwMatch[2], scope))
          if (kwMatch[1] === 'sep') sep = kwVal
          else if (kwMatch[1] === 'end') end = kwVal
        } else {
          positionalArgs.push(a)
        }
      }
      const evaled = positionalArgs.map((a) => formatPyValue(evaluateExpr(a, scope)))
      output.push(evaled.join(sep) + (end && end !== '\n' ? end : ''))
      return
    }

    // 2. Handle augmented assignment: var += expr, var -= expr, etc.
    const augMatch = rawText.match(
      /^([a-zA-Z_]\w*)\s*(\+=|-=|\*=|\/=|(?:\/\/=)|%=|\*\*=)\s*([\s\S]+)$/
    )
    if (augMatch) {
      const varName = augMatch[1].trim()
      const op = augMatch[2].trim()
      const expr = augMatch[3].trim()

      if (!(varName in scope)) {
        throw new Error(`NameError: name '${varName}' is not defined`)
      }
      const val = evaluateExpr(expr, scope)
      const cur = scope[varName]
      if (op === '+=') scope[varName] = pyAdd(cur, val)
      else if (op === '-=') scope[varName] = pySub(cur, val)
      else if (op === '*=') scope[varName] = pyMul(cur, val)
      else if (op === '/=') scope[varName] = pyDiv(cur, val)
      else if (op === '//=') scope[varName] = pyFloorDiv(cur, val)
      else if (op === '%=') scope[varName] = pyMod(cur, val)
      else if (op === '**=') scope[varName] = pyPow(cur, val)
      return
    }

    // 3. Handle assignment: var: type = expr OR var = expr (must NOT match ==, !=, <=, >=)
    const assignMatch = rawText.match(
      /^([a-zA-Z_]\w*)(?:\s*:\s*[\w\[\], ]+)?\s*=(?!=)\s*([\s\S]+)$/
    )
    if (assignMatch) {
      const varName = assignMatch[1].trim()
      const expr = assignMatch[2].trim()
      const val = evaluateExpr(expr, scope)
      scope[varName] = val
      return
    }

    // 4. Bare expression evaluation
    lastExprValue = evaluateExpr(rawText, scope)
  }

  function executeNodes(nodes: ASTNode[]) {
    for (const node of nodes) {
      if (node.type === 'stmt') {
        try {
          executeSimpleStmt(node)
        } catch (err: unknown) {
          if (err instanceof NeedMoreInputSignal) throw err
          const msg = err instanceof Error ? err.message : String(err)
          throw new Error(
            `Traceback (most recent call last):\n  File "<string>", line ${node.lineNumber}, in <module>\n${msg}`
          )
        }
      } else if (node.type === 'if_chain') {
        let branchAlreadyTaken = false

        for (const branch of node.branches) {
          const bodyLines = collectASTLineNumbers(branch.body)

          if (branchAlreadyTaken) {
            // Earlier branch in this if/elif/else chain was taken -> skip this branch header and body
            skippedLines.add(branch.lineNumber)
            flowTrace.push({
              lineNumber: branch.lineNumber,
              indentLevel: branch.indentLevel,
              kind: branch.kind,
              code: branch.code,
              condition: branch.condition,
              branchTaken: false,
              executed: false,
              bodyLines,
            })
            markSubtreeSkipped(branch.body, flowTrace, skippedLines)
            continue
          }

          if (branch.kind === 'else') {
            // `else:` branch is reached and taken
            branchAlreadyTaken = true
            executedLines.add(branch.lineNumber)
            flowTrace.push({
              lineNumber: branch.lineNumber,
              indentLevel: branch.indentLevel,
              kind: 'else',
              code: branch.code,
              branchTaken: true,
              executed: true,
              bodyLines,
            })
            executeNodes(branch.body)
            continue
          }

          // `if` or `elif`: evaluate condition
          let condBool = false
          try {
            const condVal = evaluateExpr(branch.condition ?? '', scope)
            condBool = pyBool(condVal)
          } catch (err: unknown) {
            if (err instanceof NeedMoreInputSignal) throw err
            const msg = err instanceof Error ? err.message : String(err)
            throw new Error(
              `Traceback (most recent call last):\n  File "<string>", line ${branch.lineNumber}, in <module>\n${msg}`
            )
          }

          executedLines.add(branch.lineNumber)
          flowTrace.push({
            lineNumber: branch.lineNumber,
            indentLevel: branch.indentLevel,
            kind: branch.kind,
            code: branch.code,
            condition: branch.condition,
            conditionResult: condBool,
            branchTaken: condBool,
            executed: true,
            bodyLines,
          })

          if (condBool) {
            branchAlreadyTaken = true
            executeNodes(branch.body)
          } else {
            markSubtreeSkipped(branch.body, flowTrace, skippedLines)
          }
        }
      }
    }
  }

  try {
    executeNodes(astNodes)
  } catch (err: unknown) {
    if (err instanceof NeedMoreInputSignal) throw err
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      stdout: output.join('\n'),
      stderr: msg,
      state: {},
      exprResult: null,
      exitCode: 1,
      undef,
      flowTrace,
      executedLines: Array.from(executedLines),
      skippedLines: Array.from(skippedLines),
    }
  }

  if (lastExprValue !== undefined && output.length === 0) {
    output.push(formatPyValue(lastExprValue))
  }

  const state: Record<string, string> = {}
  for (const [k, v] of Object.entries(scope)) {
    if (mockVars.has(k) || builtinKeys.has(k) || PYTHON_BUILTINS_SET.has(k)) continue
    try {
      if (isPyFloat(v)) {
        state[k] = formatPyValue(v)
      } else if (v instanceof Number) {
        state[k] = String(v.valueOf())
      } else {
        state[k] = typeof v === 'object' && v !== null ? canonicalStringify(v) : JSON.stringify(v)
      }
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
    flowTrace,
    executedLines: Array.from(executedLines),
    skippedLines: Array.from(skippedLines),
  }
}

/**
 * Lightweight JavaScript evaluator for Python scripts.
 * Supports `if`, `elif`, `else`, nested conditionals, `input()`, `print()`,
 * primitive data types (`int`, `float`, `str`, `bool`, `None`), type casting,
 * arithmetic, relational, and logical operators, plus control-flow tracing.
 */
export function evaluatePythonJS(
  code: string,
  inputs?: string[]
): PythonExecutionResult {
  const firstRun = runSingleScript(code, undefined, inputs)
  if (!firstRun.success) {
    return firstRun
  }

  const testRuns: Array<{ out: string; state: Record<string, string>; expr: string | null }> = [
    { out: firstRun.stdout, state: firstRun.state ?? {}, expr: firstRun.exprResult ?? null },
  ]

  // If there were unbound variables, run additional test runs with different values
  // (including negative, zero, and larger numbers) so conditional branches on free variables are verified
  if (firstRun.undef && firstRun.undef.size > 0) {
    const mockSets = [
      [5, 19, 29, 37, 47, 59],
      [0, 0, 0, 0, 0, 0],
      [-7, -15, -3, -20, -1, -50],
      [100, 25, 18, 65, 50, 10],
    ]
    for (const setVals of mockSets) {
      const mock: Record<string, number> = {}
      let idx = 0
      for (const v of Array.from(firstRun.undef).sort()) {
        mock[v] = setVals[idx++ % setVals.length]
      }
      const extraRun = runSingleScript(code, mock, inputs)
      if (extraRun.success) {
        testRuns.push({
          out: extraRun.stdout,
          state: extraRun.state ?? {},
          expr: extraRun.exprResult ?? null,
        })
      }
    }
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
        responseMessage:
          '¡Correcto! El código se ejecutó y llegó al mismo resultado que el código original.',
        displayOutput:
          studentResult.stdout || studentResult.exprResult || 'Código ejecutado exitosamente.',
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
  const refTrace = refResult.flowTrace ?? []
  const stuTrace = studentResult.flowTrace ?? []
  const sameASTStructure =
    refTrace.length > 0 &&
    refTrace.length === stuTrace.length &&
    refTrace.every(
      (rStep, idx) =>
        rStep.kind === stuTrace[idx].kind && rStep.indentLevel === stuTrace[idx].indentLevel
    )

  if (refStdout !== '') {
    const stdoutMatches =
      stuStdout === refStdout ||
      normalizeTypeOutput(stuStdout) === normalizeTypeOutput(refStdout) ||
      (sameASTStructure && stuStdout !== '')
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
      responseMessage:
        '¡Correcto! El código compiló y se ejecutó correctamente.',
      displayOutput: displayOutput || 'Código ejecutado exitosamente sin errores.',
    }
  }

  const reasons: string[] = []
  if (!stateMatches && stateMismatchDetails.length > 0) {
    reasons.push(stateMismatchDetails.join('\n'))
  }
  if (
    refStdout !== '' &&
    stuStdout !== refStdout &&
    normalizeTypeOutput(stuStdout) !== normalizeTypeOutput(refStdout)
  ) {
    if (stuStdout === '') {
      reasons.push('El programa no produjo ninguna salida en consola con print().')
    } else {
      reasons.push(`Salida obtenida en consola: "${stuStdout}"`)
    }
  }

  return {
    isSuccess: false,
    responseMessage: `El código no completó la validación esperada:\n${reasons.join('\n\n')}`,
    displayOutput: displayOutput || studentResult.stdout || 'Sin salida en consola.',
  }
}
