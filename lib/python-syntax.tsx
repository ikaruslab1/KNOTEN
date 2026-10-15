import React, { memo } from 'react'

export type PythonTokenType =
  | 'keyword-control'
  | 'keyword-def'
  | 'keyword-operator'
  | 'data-string'
  | 'data-number'
  | 'data-boolean'
  | 'data-none'
  | 'builtin'
  | 'function-def'
  | 'class-def'
  | 'function-call'
  | 'operator'
  | 'punctuation'
  | 'comment'
  | 'identifier'
  | 'whitespace'
  | 'unknown'

export const KEYWORDS_CONTROL = new Set([
  'if',
  'elif',
  'else',
  'for',
  'while',
  'break',
  'continue',
  'return',
  'yield',
  'try',
  'except',
  'finally',
  'raise',
  'pass',
  'assert',
  'with',
  'match',
  'case',
])

export const KEYWORDS_DEF = new Set([
  'def',
  'class',
  'lambda',
  'import',
  'from',
  'as',
  'global',
  'nonlocal',
  'del',
  'async',
  'await',
])

export const KEYWORDS_OPERATOR = new Set(['in', 'is', 'and', 'or', 'not'])

export const PYTHON_BUILTINS = new Set([
  // I/O & system
  'print',
  'input',
  'open',
  'help',
  'dir',
  'id',
  'type',
  'eval',
  'exec',
  'format',
  'repr',
  // Iterables & sequences
  'len',
  'range',
  'enumerate',
  'zip',
  'map',
  'filter',
  'sorted',
  'reversed',
  'any',
  'all',
  'sum',
  'min',
  'max',
  'abs',
  'round',
  'pow',
  'divmod',
  'next',
  'iter',
  // Types & constructors
  'int',
  'float',
  'str',
  'bool',
  'list',
  'dict',
  'set',
  'tuple',
  'bytes',
  'bytearray',
  'complex',
  'frozenset',
  'memoryview',
  'object',
  'slice',
  // Numeric converters
  'bin',
  'oct',
  'hex',
  'ord',
  'chr',
  // OOP & inspection
  'isinstance',
  'issubclass',
  'hasattr',
  'getattr',
  'setattr',
  'delattr',
  'callable',
  'super',
  // Common built-in exceptions
  'Exception',
  'BaseException',
  'ValueError',
  'TypeError',
  'IndexError',
  'KeyError',
  'ZeroDivisionError',
  'FileNotFoundError',
  'StopIteration',
  'NameError',
  'AttributeError',
  'ImportError',
  'SyntaxError',
  'KeyboardInterrupt',
  'RuntimeError',
])

export const OPERATORS = new Set([
  '+',
  '-',
  '*',
  '/',
  '//',
  '%',
  '**',
  '=',
  '+=',
  '-=',
  '*=',
  '/=',
  '//=',
  '%=',
  '**=',
  '==',
  '!=',
  '<=',
  '>=',
  '<',
  '>',
  '->',
  '&',
  '|',
  '^',
  '~',
  '<<',
  '>>',
  '@',
  '&=',
  '|=',
  '^=',
  '<<=',
  '>>=',
])

export const PUNCTUATION = new Set([
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  ':',
  ',',
  '.',
  ';',
])

/**
 * Visual styling classes corresponding to code editor syntax themes (VS Code Light+ / GitHub Light).
 * Uses rich semantic colors that contrast clearly against white backgrounds.
 */
export const PYTHON_TOKEN_CLASSES: Record<PythonTokenType, string> = {
  // Palabras reservadas (Keywords)
  'keyword-control': 'text-purple-600 font-semibold', // if, for, while, return, try, else...
  'keyword-def': 'text-blue-600 font-semibold', // def, class, import, from, lambda...
  'keyword-operator': 'text-purple-600 font-semibold', // in, is, and, or, not

  // Datos (Literals / Data)
  'data-string': 'text-emerald-600 font-medium', // "texto", 'texto', """..."""
  'data-number': 'text-cyan-700 font-medium', // 42, 3.14, 0xFF, 0b101
  'data-boolean': 'text-indigo-600 font-semibold', // True, False
  'data-none': 'text-indigo-600 font-semibold', // None

  // Funciones, clases y contenido de Python
  builtin: 'text-amber-600 font-semibold', // print, len, range, int, str...
  'function-def': 'text-amber-600 font-semibold', // def mi_funcion(...)
  'class-def': 'text-teal-700 font-semibold', // class MiClase:
  'function-call': 'text-amber-600 font-medium', // mi_funcion(...)
  operator: 'text-pink-600 font-semibold', // +, -, *, /, ==, !=, =, ->
  punctuation: 'text-zinc-500 font-normal', // (, ), [, ], :, ,, .
  comment: 'text-zinc-400 italic', // # comentario
  identifier: 'text-zinc-800 font-medium', // variables, parámetros
  whitespace: '',
  unknown: 'text-zinc-800 font-medium',
}

const TOKEN_REGEX =
  /([fFrRbBuU]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n\r]|\\.)*"|'(?:[^'\\\n\r]|\\.)*'))|(#[^\r\n]*)|(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d+[._\d]*\.\d+[_\d]*(?:[eE][+-]?\d+)?[jJ]?|\d+[_\d]*(?:[eE][+-]?\d+)[jJ]?|\.\d+[_\d]*(?:[eE][+-]?\d+)?[jJ]?|\d+[_\d]*[jJ]?))|(\*\*=|--|\+\+|\/\/=|<<=|>>=|\*\*|\/\/|<<|>>|->|==|!=|<=|>=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=)|([a-zA-Z_]\w*)|([+\-*/%=<>!&|^~():,.[\]{}@])|(\s+)|(.)/g

export interface HighlightedToken {
  text: string
  type: PythonTokenType
  className: string
}

/**
 * Tokenizes and classifies any Python code string (from single tokens to multi-line code)
 * into constituent syntactic tokens with code editor highlighting classes.
 */
export function tokenizePython(code: string | null | undefined): HighlightedToken[] {
  if (code === null || code === undefined || code === '') {
    return []
  }

  TOKEN_REGEX.lastIndex = 0
  const rawTokens: string[] = []
  let match: RegExpExecArray | null

  while ((match = TOKEN_REGEX.exec(code)) !== null) {
    rawTokens.push(match[0])
  }

  const result: HighlightedToken[] = []

  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i]

    // 1. Whitespace
    if (/^\s+$/.test(t)) {
      result.push({ text: t, type: 'whitespace', className: PYTHON_TOKEN_CLASSES.whitespace })
      continue
    }

    // 2. Comments
    if (t.startsWith('#')) {
      result.push({ text: t, type: 'comment', className: PYTHON_TOKEN_CLASSES.comment })
      continue
    }

    // 3. String literals (including quotes, triple quotes, and prefixes)
    if (
      /^[fFrRbBuU]{0,2}("""|'''|"|')/.test(t) ||
      t === '"' ||
      t === "'" ||
      t.startsWith('"') ||
      t.startsWith("'")
    ) {
      result.push({ text: t, type: 'data-string', className: PYTHON_TOKEN_CLASSES['data-string'] })
      continue
    }

    // 4. Number literals
    if (
      /^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d+[._\d]*\.\d+[_\d]*(?:[eE][+-]?\d+)?[jJ]?|\d+[_\d]*(?:[eE][+-]?\d+)[jJ]?|\.\d+[_\d]*(?:[eE][+-]?\d+)?[jJ]?|\d+[_\d]*[jJ]?))$/.test(
        t
      )
    ) {
      result.push({ text: t, type: 'data-number', className: PYTHON_TOKEN_CLASSES['data-number'] })
      continue
    }

    // 5. Booleans and None (Data Literals)
    if (t === 'True' || t === 'False') {
      result.push({ text: t, type: 'data-boolean', className: PYTHON_TOKEN_CLASSES['data-boolean'] })
      continue
    }

    if (t === 'None') {
      result.push({ text: t, type: 'data-none', className: PYTHON_TOKEN_CLASSES['data-none'] })
      continue
    }

    // 6. Keywords
    if (KEYWORDS_CONTROL.has(t)) {
      result.push({
        text: t,
        type: 'keyword-control',
        className: PYTHON_TOKEN_CLASSES['keyword-control'],
      })
      continue
    }

    if (KEYWORDS_DEF.has(t)) {
      result.push({ text: t, type: 'keyword-def', className: PYTHON_TOKEN_CLASSES['keyword-def'] })
      continue
    }

    if (KEYWORDS_OPERATOR.has(t)) {
      result.push({
        text: t,
        type: 'keyword-operator',
        className: PYTHON_TOKEN_CLASSES['keyword-operator'],
      })
      continue
    }

    // 7. Built-in functions and types
    if (PYTHON_BUILTINS.has(t)) {
      result.push({ text: t, type: 'builtin', className: PYTHON_TOKEN_CLASSES.builtin })
      continue
    }

    // 8. Operators
    if (OPERATORS.has(t)) {
      result.push({ text: t, type: 'operator', className: PYTHON_TOKEN_CLASSES.operator })
      continue
    }

    // 9. Punctuation & Delimiters
    if (PUNCTUATION.has(t)) {
      result.push({ text: t, type: 'punctuation', className: PYTHON_TOKEN_CLASSES.punctuation })
      continue
    }

    // 10. Contextual Identifier Checks
    let prevNonWs: string | null = null
    for (let p = i - 1; p >= 0; p--) {
      if (!/^\s+$/.test(rawTokens[p])) {
        prevNonWs = rawTokens[p]
        break
      }
    }

    let nextNonWs: string | null = null
    for (let n = i + 1; n < rawTokens.length; n++) {
      if (!/^\s+$/.test(rawTokens[n])) {
        nextNonWs = rawTokens[n]
        break
      }
    }

    if (prevNonWs === 'def') {
      result.push({
        text: t,
        type: 'function-def',
        className: PYTHON_TOKEN_CLASSES['function-def'],
      })
      continue
    }

    if (prevNonWs === 'class') {
      result.push({
        text: t,
        type: 'class-def',
        className: PYTHON_TOKEN_CLASSES['class-def'],
      })
      continue
    }

    if (nextNonWs === '(') {
      result.push({
        text: t,
        type: 'function-call',
        className: PYTHON_TOKEN_CLASSES['function-call'],
      })
      continue
    }

    // 11. General Identifier (variable, attribute, parameter)
    if (/^[a-zA-Z_]\w*$/.test(t)) {
      result.push({ text: t, type: 'identifier', className: PYTHON_TOKEN_CLASSES.identifier })
      continue
    }

    // 12. Fallback
    result.push({ text: t, type: 'unknown', className: PYTHON_TOKEN_CLASSES.unknown })
  }

  return result
}

/**
 * React Component to render syntax-highlighted Python code.
 * Works seamlessly for single token nodes or multi-token code blocks.
 */
export const PythonCodeHighlight = memo(function PythonCodeHighlight({
  code,
  className,
}: {
  code: string | null | undefined
  className?: string
}) {
  if (!code && code !== '0') {
    return null
  }

  const tokens = tokenizePython(code)

  return (
    <span className={className}>
      {tokens.map((token, idx) => (
        <span key={idx} className={token.className}>
          {token.text}
        </span>
      ))}
    </span>
  )
})

export default PythonCodeHighlight
