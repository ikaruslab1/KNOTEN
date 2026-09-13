'use client'

import { useState, useCallback, useEffect, useMemo, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  GripVertical,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Edit2,
  Trash2,
  Plus,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  Code2,
  LayoutTemplate,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { splitPythonCode, getDefaultPositions, tokenizeLine, type SplitBlock } from '@/lib/code-splitter'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Activity = {
  id: string
  titulo: string
  enunciado: string | null
  resultado_esperado: string | null
  orden: number
  session_id: string
}

type Step = 1 | 2 | 3 | 4

type ToastState = 'idle' | 'saving' | 'success' | 'error'

type Props = {
  activityId: string
  initialActivity: Activity
  initialBlocks?: SplitBlock[]
}

// ─── Helper: reconstruct Python code from blocks ──────────────────────────────

function joinTokens(tokens: string[]): string {
  let line = ''
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const prev = i > 0 ? tokens[i - 1] : null

    if (i === 0) {
      line += t
      continue
    }

    // No space before: ')', ']', '}', ':', ',', '.', ';'
    if ([')', ']', '}', ':', ',', '.', ';'].includes(t)) {
      line += t
      continue
    }

    // No space after: '(', '[', '{', '.'
    if (prev && ['(', '[', '{', '.'].includes(prev)) {
      line += t
      continue
    }

    // No space before '(' if preceded by an identifier (function call / definition)
    if (t === '(' && prev && /^[a-zA-Z_]\w*$/.test(prev)) {
      line += t
      continue
    }

    line += ' ' + t
  }
  return line
}

function reconstructPythonCode(savedBlocks: SplitBlock[]): string {
  if (!savedBlocks || savedBlocks.length === 0) return ''
  const sorted = [...savedBlocks].sort((a, b) => a.orden_correcto - b.orden_correcto)
  const codeBlocks = sorted.filter((b) => b.tipo === 'codigo')
  if (codeBlocks.length === 0) return ''

  // Group by line: use line_index if available, or detect line change by posicion_y
  const lines: { indent: number; tokens: string[] }[] = []
  let currentTokens: string[] = []
  let currentIndent = codeBlocks[0].indent_level ?? 0
  const firstBlock = codeBlocks[0] as unknown as { line_index?: number; posicion_y?: number }
  let currentLineKey =
    firstBlock.line_index !== undefined
      ? firstBlock.line_index
      : firstBlock.posicion_y ?? 0

  for (const b of codeBlocks) {
    const bTyped = b as unknown as { line_index?: number; posicion_y?: number }
    const blockLineKey =
      bTyped.line_index !== undefined
        ? bTyped.line_index
        : bTyped.posicion_y !== undefined
        ? bTyped.posicion_y
        : null

    const isNewLine = blockLineKey !== null && blockLineKey !== currentLineKey

    if (isNewLine && currentTokens.length > 0) {
      lines.push({ indent: currentIndent, tokens: currentTokens })
      currentTokens = []
      currentIndent = b.indent_level ?? 0
      currentLineKey = blockLineKey
    }

    currentTokens.push(b.contenido ?? '')
  }

  if (currentTokens.length > 0) {
    lines.push({ indent: currentIndent, tokens: currentTokens })
  }

  return lines
    .map((l) => ' '.repeat(Math.max(0, l.indent) * 4) + joinTokens(l.tokens))
    .join('\n')
}

// ─── Helper: detect eliminated/missing characters from original tokens ────────

function findMissingCodeElements(
  originalTokens: string[],
  currentBlockContents: string[]
): string[] {
  const remainingBlocks = [...currentBlockContents]
  const unmatchedTokens: string[] = []

  for (const token of originalTokens) {
    // 1. Exact match with an entire block
    const exactIdx = remainingBlocks.indexOf(token)
    if (exactIdx !== -1) {
      remainingBlocks.splice(exactIdx, 1)
      continue
    }

    // 2. Exact substring within any block
    const substrIdx = remainingBlocks.findIndex((b) => b.includes(token))
    if (substrIdx !== -1) {
      continue
    }

    unmatchedTokens.push(token)
  }

  if (unmatchedTokens.length === 0) return []

  const missingPieces: string[] = []

  for (const token of unmatchedTokens) {
    const covered = new Array(token.length).fill(false)

    for (const block of currentBlockContents) {
      if (!block) continue

      // If token is completely inside block
      if (block.includes(token)) {
        covered.fill(true)
        break
      }

      // If block is a substring inside token
      if (token.includes(block)) {
        let start = token.indexOf(block)
        while (start !== -1) {
          for (let i = start; i < start + block.length; i++) {
            covered[i] = true
          }
          start = token.indexOf(block, start + 1)
        }
        continue
      }

      // Significant common prefix (>= 3 chars)
      let commonPrefixLen = 0
      while (
        commonPrefixLen < token.length &&
        commonPrefixLen < block.length &&
        token[commonPrefixLen] === block[commonPrefixLen]
      ) {
        commonPrefixLen++
      }
      if (commonPrefixLen >= 3) {
        for (let i = 0; i < commonPrefixLen; i++) {
          covered[i] = true
        }
      }

      // Significant common suffix (>= 3 chars)
      let commonSuffixLen = 0
      while (
        commonSuffixLen < token.length &&
        commonSuffixLen < block.length &&
        token[token.length - 1 - commonSuffixLen] === block[block.length - 1 - commonSuffixLen]
      ) {
        commonSuffixLen++
      }
      if (commonSuffixLen >= 3) {
        for (let i = token.length - commonSuffixLen; i < token.length; i++) {
          covered[i] = true
        }
      }
    }

    // Extract contiguous uncovered segments
    let segStart = -1
    for (let i = 0; i <= token.length; i++) {
      if (i < token.length && !covered[i]) {
        if (segStart === -1) segStart = i
      } else {
        if (segStart !== -1) {
          const missingSeg = token.substring(segStart, i)
          if (missingSeg.length > 0) {
            missingPieces.push(missingSeg)
          }
          segStart = -1
        }
      }
    }
  }

  return missingPieces
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActivityBuilder({ activityId, initialActivity, initialBlocks = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Compute initial state from existing saved data
  const sortedInitial = [...initialBlocks].sort((a, b) => a.orden_correcto - b.orden_correcto)
  const initialCode = reconstructPythonCode(sortedInitial)

  // ── Wizard state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1)
  const [code, setCode] = useState(initialCode)
  const [blocks, setBlocks] = useState<SplitBlock[]>(sortedInitial)
  const [enunciado, setEnunciado] = useState(initialActivity.enunciado ?? '')
  const [resultadoEsperado, setResultadoEsperado] = useState(
    initialActivity.resultado_esperado ?? ''
  )
  const [toast, setToast] = useState<ToastState>('idle')
  const [toastMsg, setToastMsg] = useState('')
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    setBlocks((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next.map((b, i) => ({ ...b, orden_correcto: i }))
    })
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [])

  // Sync state if activityId or props change (e.g. clicking chip navigation)
  useEffect(() => {
    const sorted = [...initialBlocks].sort((a, b) => a.orden_correcto - b.orden_correcto)
    setCode(reconstructPythonCode(sorted))
    setBlocks(sorted)
    setEnunciado(initialActivity.enunciado ?? '')
    setResultadoEsperado(initialActivity.resultado_esperado ?? '')
    setStep(1)
  }, [activityId, initialActivity, initialBlocks])

  // ── Step Navigation ───────────────────────────────────────────────────────
  function handleSelectStep(targetStep: Step) {
    if (targetStep === 1) {
      setStep(1)
    } else if (targetStep === 2) {
      if (blocks.length === 0 && code.trim()) {
        const split = splitPythonCode(code)
        setBlocks(split)
      }
      if (blocks.length > 0 || code.trim()) {
        setStep(2)
      }
    } else if (targetStep === 4) {
      if (blocks.length === 0 && code.trim()) {
        const split = splitPythonCode(code)
        setBlocks(split)
      }
      setStep(4)
    }
  }

  // ── Step 1 → 2: split the code ────────────────────────────────────────────
  function goToStep2() {
    const split = splitPythonCode(code)
    setBlocks(split)
    setStep(2)
  }

  // ── Step 2: reorder blocks ────────────────────────────────────────────────
  const moveBlock = useCallback((index: number, direction: 'up' | 'down') => {
    setBlocks((prev) => {
      const next = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((b, i) => ({ ...b, orden_correcto: i }))
    })
  }, [])

  // ── Step 2: edit, delete, add, reset blocks ───────────────────────────────
  const handleEditBlock = useCallback(
    (
      index: number,
      newContent: string,
      newType: SplitBlock['tipo'],
      newIndentLevel?: number
    ) => {
      setBlocks((prev) => {
        const next = [...prev]
        if (!next[index]) return prev
        next[index] = {
          ...next[index],
          contenido: newContent,
          tipo: newType,
          indent_level:
            newIndentLevel !== undefined
              ? newIndentLevel
              : next[index].indent_level,
        }
        return next
      })
    },
    []
  )

  const handleDeleteBlock = useCallback((index: number) => {
    setBlocks((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.map((b, i) => ({ ...b, orden_correcto: i }))
    })
  }, [])

  const handleInsertBlock = useCallback(
    (
      insertIndex: number,
      tipo: 'codigo' | 'indentacion',
      initialContent: string = ''
    ) => {
      setBlocks((prev) => {
        const prevNeighbor = prev[insertIndex - 1]
        const nextNeighbor = prev[insertIndex]
        const nextLine = prevNeighbor
          ? (prevNeighbor.line_index ?? 0)
          : (nextNeighbor?.line_index ?? 0)
        const nextIndent = prevNeighbor
          ? (prevNeighbor.indent_level ?? 0)
          : (nextNeighbor?.indent_level ?? 0)

        const newBlock: SplitBlock = {
          tipo,
          contenido: initialContent,
          orden_correcto: insertIndex,
          indent_level: nextIndent,
          line_index: nextLine,
        }

        const next = [...prev]
        next.splice(insertIndex, 0, newBlock)
        return next.map((b, i) => ({ ...b, orden_correcto: i }))
      })
      setActiveInsertIndex(null)
    },
    []
  )

  const handleAddBlock = useCallback(
    (tipo: 'codigo' | 'indentacion', initialContent: string = '') => {
      setBlocks((prev) => {
        const lastBlock = prev[prev.length - 1]
        const nextOrder = prev.length
        const nextLine = lastBlock ? (lastBlock.line_index ?? 0) : 0
        const nextIndent = lastBlock ? (lastBlock.indent_level ?? 0) : 0
        const newBlock: SplitBlock = {
          tipo,
          contenido: initialContent,
          orden_correcto: nextOrder,
          indent_level: nextIndent,
          line_index: nextLine,
        }
        return [...prev, newBlock]
      })
    },
    []
  )

  const handleResetBlocks = useCallback(() => {
    if (!code.trim()) return
    const split = splitPythonCode(code)
    setBlocks(split)
  }, [code])

  // ── Step 2: Missing Elements Analysis (Original Step 1 Code vs Current Blocks) ─
  const originalTokens = useMemo(() => {
    if (!code.trim()) return []
    const lines = code.split('\n')
    const tokens: string[] = []
    for (const line of lines) {
      if (line.trim() === '') continue
      const lineTokens = tokenizeLine(line)
      tokens.push(...lineTokens)
    }
    return tokens
  }, [code])

  const missingTokens = useMemo(() => {
    if (originalTokens.length === 0) return []
    const currentContents = blocks
      .filter((b) => b.tipo === 'codigo' && b.contenido !== undefined)
      .map((b) => b.contenido)

    return findMissingCodeElements(originalTokens, currentContents)
  }, [originalTokens, blocks])

  const originalIndentCount = useMemo(() => {
    return splitPythonCode(code).filter((b) => b.tipo === 'indentacion').length
  }, [code])

  const currentIndentCount = useMemo(() => {
    return blocks.filter((b) => b.tipo === 'indentacion').length
  }, [blocks])

  const missingIndentCount = Math.max(0, originalIndentCount - currentIndentCount)

  // ── Step 4: save ──────────────────────────────────────────────────────────
  async function handleSave() {
    setToast('saving')

    try {
      // 1. DELETE existing blocks (cascades connections via FK)
      const { error: deleteBlocksErr } = await supabase
        .from('blocks')
        .delete()
        .eq('activity_id', activityId)

      if (deleteBlocksErr) throw deleteBlocksErr

      // Also delete orphan connections (just in case RLS prevents cascade)
      await supabase.from('connections').delete().eq('activity_id', activityId)

      // 2. INSERT new blocks with positions
      const positions = getDefaultPositions(blocks)
      const blockRows = blocks.map((b, i) => ({
        activity_id: activityId,
        tipo: b.tipo,
        contenido: b.contenido,
        orden_correcto: b.orden_correcto,
        indent_level: b.indent_level,
        posicion_x: positions[i]?.x ?? (100 + (b.indent_level ?? 0) * 40),
        posicion_y: positions[i]?.y ?? (100 + i * 80),
      }))

      const { data: insertedBlocks, error: blocksInsertErr } = await supabase
        .from('blocks')
        .insert(blockRows)
        .select('id, orden_correcto')

      if (blocksInsertErr || !insertedBlocks) throw blocksInsertErr ?? new Error('No blocks returned.')

      // Sort by orden_correcto to build sequential connections
      const sorted = [...insertedBlocks].sort(
        (a, b) => a.orden_correcto - b.orden_correcto
      )

      // 3. INSERT sequential connections
      if (sorted.length > 1) {
        const connectionRows = sorted.slice(0, -1).map((src, i) => ({
          activity_id: activityId,
          source_block_id: src.id,
          target_block_id: sorted[i + 1].id,
          source_handle: null,
          target_handle: null,
          orden: i,
        }))

        const { error: connErr } = await supabase
          .from('connections')
          .insert(connectionRows)

        if (connErr) throw connErr
      }

      // 4. UPDATE activity enunciado + resultado_esperado
      const { error: updateErr } = await supabase
        .from('activities')
        .update({
          enunciado: enunciado.trim() || null,
          resultado_esperado: resultadoEsperado.trim() || null,
        })
        .eq('id', activityId)

      if (updateErr) throw updateErr

      router.refresh()
      setToast('success')
      setToastMsg('Actividad guardada correctamente.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar.'
      setToast('error')
      setToastMsg(msg)
    }

    setTimeout(() => setToast('idle'), 4000)
  }

  // ── Keyboard handler: Tab → 4 spaces in the code textarea ─────────────────
  function handleCodeKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newValue = ta.value.substring(0, start) + '    ' + ta.value.substring(end)
      setCode(newValue)
      // Restore cursor
      requestAnimationFrame(() => {
        ta.selectionStart = start + 4
        ta.selectionEnd = start + 4
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Progress indicator */}
      <StepIndicator current={step} onSelectStep={handleSelectStep} />

      {/* ── Step 1: Code input ──────────────────────────────────────────────── */}
      {step === 1 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="code-input"
              className="text-sm font-medium text-gray-700"
            >
              Pega o escribe el código Python de la actividad
            </label>
            <textarea
              id="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleCodeKeyDown}
              spellCheck={false}
              placeholder={"def saludo(nombre):\n    print(f'Hola, {nombre}!')\n\nsaludo('Mundo')"}
              className="min-h-64 rounded-xl border border-zinc-300 bg-white px-4 py-3 font-mono text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15 resize-y"
            />
            <p className="text-xs text-zinc-400">
              La tecla Tab inserta 4 espacios. Las líneas en blanco son ignoradas.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={goToStep2}
              disabled={!code.trim()}
              className={cn(
                'flex items-center gap-1.5 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition',
                !code.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800',
              )}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ── Step 2/3: Block preview + manual editing + reorder ───────────────── */}
      {step === 2 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Vista previa y edición manual de bloques
            </h2>
            <p className="text-sm text-zinc-500">
              Puedes editar el texto de cada bloque, eliminar los que quieras agrupar o añadir nuevos. El sistema verificará automáticamente que no olvides ningún elemento del código original.
            </p>
          </div>

          {/* Real-time missing elements banner */}
          {missingTokens.length > 0 || missingIndentCount > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-amber-900">
                    Elementos o caracteres del código original que faltan por reescribir
                  </h3>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Eliminaste o modificaste bloques y los siguientes caracteres aún no han sido escritos en ningún bloque. Puedes escribirlos dentro de otro bloque o hacer clic para agregarlos:
                  </p>

                  {missingTokens.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                      {missingTokens.map((token, idx) => (
                        <button
                          key={`${token}-${idx}`}
                          type="button"
                          onClick={() => handleAddBlock('codigo', token)}
                          title="Haz clic para agregar este elemento como nuevo bloque"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-950 font-mono text-xs font-semibold hover:bg-amber-100 hover:border-amber-400 transition cursor-pointer shadow-xs group"
                        >
                          <span>{token}</span>
                          <Plus className="w-3 h-3 text-amber-500 group-hover:text-amber-800" />
                        </button>
                      ))}
                    </div>
                  )}

                  {missingIndentCount > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium text-amber-800">
                        Faltan {missingIndentCount} bloque(s) de indentación:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddBlock('indentacion', '')}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition shadow-xs"
                      >
                        <Plus className="w-3 h-3" /> Agregar indentación
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Todos los elementos del código original están presentes en los bloques.</span>
            </div>
          )}

          {/* List of blocks */}
          <div className="flex flex-col gap-1">
            {blocks.length > 0 && (
              <InsertBlockDivider
                index={0}
                activeInsertIndex={activeInsertIndex}
                setActiveInsertIndex={setActiveInsertIndex}
                onInsert={handleInsertBlock}
              />
            )}
            {blocks.map((block, index) => (
              <Fragment key={`${index}-${block.orden_correcto}`}>
                <BlockCard
                  block={block}
                  index={index}
                  total={blocks.length}
                  onMove={moveBlock}
                  onEdit={handleEditBlock}
                  onDelete={handleDeleteBlock}
                  onDragStart={(idx) => setDraggedIndex(idx)}
                  onDragOver={(idx) => setDragOverIndex(idx)}
                  onDragEnd={() => {
                    setDraggedIndex(null)
                    setDragOverIndex(null)
                  }}
                  onDrop={(targetIdx) => {
                    if (draggedIndex !== null) {
                      handleReorder(draggedIndex, targetIdx)
                    }
                  }}
                  isDragging={draggedIndex === index}
                  isDragOver={dragOverIndex === index && draggedIndex !== index}
                />
                <InsertBlockDivider
                  index={index + 1}
                  activeInsertIndex={activeInsertIndex}
                  setActiveInsertIndex={setActiveInsertIndex}
                  onInsert={handleInsertBlock}
                />
              </Fragment>
            ))}
          </div>

          {blocks.length === 0 && (
            <p className="text-center text-sm text-zinc-400 py-8">
              No hay bloques. Puedes agregar uno nuevo o restablecer la división automática.
            </p>
          )}

          {/* Add block & Reset toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAddBlock('codigo', '')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-500" />
                Agregar bloque de código
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('indentacion', '')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-500" />
                Agregar indentación
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetBlocks}
              title="Volver a generar los bloques automáticamente según el código del Paso 1"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-xs font-medium transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer división automática
            </button>
          </div>

          {/* Step navigation */}
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver
            </button>

            <div className="flex items-center gap-3">
              {missingTokens.length > 0 && (
                <span className="text-xs text-amber-600 font-medium hidden sm:inline">
                  ⚠️ Faltan {missingTokens.length} elemento(s)
                </span>
              )}
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={blocks.length === 0}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition',
                  blocks.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800',
                )}
              >
                Confirmar bloques
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Step 4: Enunciado + resultado ────────────────────────────────────── */}
      {step === 4 && (
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Enunciado y resultado esperado
            </h2>
            <p className="text-sm text-zinc-500">
              Escribe las instrucciones para el alumno y el resultado que verá en
              la terminal.
            </p>
          </div>

          {/* Enunciado */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="enunciado"
              className="text-sm font-medium text-zinc-700"
            >
              Enunciado / Instrucciones del problema
            </label>
            <textarea
              id="enunciado"
              value={enunciado}
              onChange={(e) => setEnunciado(e.target.value)}
              rows={5}
              placeholder="Escribe las instrucciones que verá el alumno…"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15 resize-y"
            />
          </div>

          {/* Resultado esperado */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="resultado"
              className="text-sm font-medium text-zinc-700"
            >
              Resultado esperado{' '}
              <span className="font-normal text-zinc-400">
                (lo que verá el alumno en la terminal)
              </span>
            </label>
            <textarea
              id="resultado"
              value={resultadoEsperado}
              onChange={(e) => setResultadoEsperado(e.target.value)}
              rows={4}
              spellCheck={false}
              placeholder={"Hola, Mundo!"}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-mono text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15 resize-y"
            />
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            Se guardarán <strong>{blocks.length}</strong> bloque
            {blocks.length !== 1 ? 's' : ''} para esta actividad.
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={toast === 'saving'}
              className={cn(
                'flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition',
                toast === 'saving'
                  ? 'opacity-70 cursor-not-allowed'
                  : 'hover:bg-green-700',
              )}
            >
              {toast === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
              {toast === 'saving' ? 'Guardando…' : 'Guardar actividad'}
            </button>
          </div>
        </section>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast !== 'idle' && toast !== 'saving' && (
        <div
          className={cn(
            'fixed bottom-6 right-6 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium text-white shadow-xl transition-all z-50',
            toast === 'success' ? 'bg-zinc-900 border border-zinc-700' : 'bg-red-600',
          )}
        >
          {toast === 'success' && <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />}
          <span>{toastMsg}</span>
          {toast === 'success' && (
            <Link
              href={`/actividad/${activityId}`}
              target="_blank"
              className="ml-2 inline-flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1 text-xs font-semibold text-white transition border border-zinc-600"
            >
              Probar en el lienzo ↗
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  current,
  onSelectStep,
}: {
  current: Step
  onSelectStep: (step: Step) => void
}) {
  const steps: Array<{ n: Step; label: string }> = [
    { n: 1, label: 'Código' },
    { n: 2, label: 'Bloques' },
    { n: 4, label: 'Enunciado' },
  ]

  // Map actual step number to display index
  const displayIndex = current === 1 ? 0 : current === 2 ? 1 : 2

  return (
    <ol className="flex items-center gap-0">
      {steps.map((s, i) => {
        const active = displayIndex === i
        const done = displayIndex > i
        return (
          <li key={s.n} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => onSelectStep(s.n)}
              className="flex items-center gap-2 group cursor-pointer text-left focus:outline-none"
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition group-hover:scale-105',
                  done
                    ? 'bg-zinc-900 text-white'
                    : active
                    ? 'bg-zinc-900 text-white ring-4 ring-zinc-200'
                    : 'bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300',
                )}
              >
                {s.n === 4 ? 3 : s.n}
              </span>
              <span
                className={cn(
                  'hidden text-xs font-medium sm:block transition',
                  active
                    ? 'text-zinc-900 font-bold'
                    : done
                    ? 'text-zinc-600'
                    : 'text-zinc-400 group-hover:text-zinc-700',
                )}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-px flex-1 transition',
                  done ? 'bg-zinc-900' : 'bg-zinc-200',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ─── Insert Block Divider ───────────────────────────────────────────────────

type InsertBlockDividerProps = {
  index: number
  activeInsertIndex: number | null
  setActiveInsertIndex: (index: number | null) => void
  onInsert: (index: number, tipo: 'codigo' | 'indentacion', initialContent?: string) => void
}

function InsertBlockDivider({
  index,
  activeInsertIndex,
  setActiveInsertIndex,
  onInsert,
}: InsertBlockDividerProps) {
  const isOpen = activeInsertIndex === index
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveInsertIndex(null)
      }
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveInsertIndex(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, setActiveInsertIndex])

  if (isOpen) {
    return (
      <div
        ref={menuRef}
        className="relative z-10 flex items-center justify-center gap-2 py-1.5 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="h-px bg-zinc-300 flex-1" />
        <div className="inline-flex items-center gap-1.5 bg-white border border-zinc-300 rounded-xl p-1.5 shadow-md">
          <span className="text-[11px] font-semibold text-zinc-500 pl-2 pr-1 select-none">
            Insertar en #{index + 1}:
          </span>
          <button
            type="button"
            onClick={() => onInsert(index, 'codigo')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Bloque de código
          </button>
          <button
            type="button"
            onClick={() => onInsert(index, 'indentacion')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Indentación
          </button>
          <button
            type="button"
            onClick={() => setActiveInsertIndex(null)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer ml-0.5"
            title="Cancelar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="h-px bg-zinc-300 flex-1" />
      </div>
    )
  }

  return (
    <div className="group/insert relative flex items-center justify-center py-1 -my-0.5 transition-all">
      <div className="h-px bg-transparent group-hover/insert:bg-zinc-200 flex-1 transition-colors duration-150" />
      <button
        type="button"
        onClick={() => setActiveInsertIndex(isOpen ? null : index)}
        className="mx-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed border-zinc-300 bg-white text-zinc-400 hover:text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 hover:shadow-2xs text-[11px] font-medium transition-all cursor-pointer opacity-70 hover:opacity-100 group-hover/insert:opacity-100 group-hover/insert:border-zinc-400"
        title={`Insertar bloque en la posición ${index + 1}`}
      >
        <Plus className="w-3 h-3 text-zinc-500 group-hover/insert:text-zinc-900" />
        <span className="text-[11px] text-zinc-500 group-hover/insert:text-zinc-800">
          Insertar
        </span>
      </button>
      <div className="h-px bg-transparent group-hover/insert:bg-zinc-200 flex-1 transition-colors duration-150" />
    </div>
  )
}

// ─── Block Card ───────────────────────────────────────────────────────────────

type BlockCardProps = {
  block: SplitBlock
  index: number
  total: number
  onMove?: (index: number, direction: 'up' | 'down') => void
  onEdit: (
    index: number,
    newContent: string,
    newType: SplitBlock['tipo'],
    newIndentLevel?: number
  ) => void
  onDelete: (index: number) => void
  onDragStart?: (index: number) => void
  onDragOver?: (index: number, e: React.DragEvent) => void
  onDragEnd?: () => void
  onDrop?: (index: number) => void
  isDragging?: boolean
  isDragOver?: boolean
}

function BlockCard({
  block,
  index,
  total,
  onMove,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragging,
  isDragOver,
}: BlockCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState(block.contenido)
  const [draftType, setDraftType] = useState<SplitBlock['tipo']>(block.tipo)
  const [draftIndent, setDraftIndent] = useState<number>(block.indent_level ?? 0)

  useEffect(() => {
    setDraftContent(block.contenido)
    setDraftType(block.tipo)
    setDraftIndent(block.indent_level ?? 0)
  }, [block.contenido, block.tipo, block.indent_level])

  const handleSave = () => {
    onEdit(index, draftContent, draftType, draftIndent)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setDraftContent(block.contenido)
    setDraftType(block.tipo)
    setDraftIndent(block.indent_level ?? 0)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const isCodigo = block.tipo === 'codigo'

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => {
        if (isEditing) return
        e.dataTransfer.setData('text/plain', String(index))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(index)
      }}
      onDragOver={(e) => {
        if (isEditing) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOver?.(index, e)
      }}
      onDragEnd={() => {
        onDragEnd?.()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop?.(index)
      }}
      className={cn(
        'group flex items-start gap-3 rounded-xl border p-3 shadow-xs transition-all duration-150 select-none',
        isDragging && 'opacity-40 border-dashed border-zinc-400 bg-zinc-100/60',
        isDragOver && !isDragging && 'border-zinc-900 ring-2 ring-zinc-900/20 bg-zinc-50 shadow-md scale-[1.01]',
        isEditing
          ? 'border-zinc-900 bg-zinc-50/50 ring-2 ring-zinc-900/10 cursor-default'
          : !isDragOver && !isDragging && 'border-zinc-200 bg-white hover:border-zinc-300'
      )}
    >
      {/* Number badge */}
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-900">
        {index + 1}
      </span>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              {/* Type selector toggle */}
              <div className="inline-flex rounded-lg border border-zinc-300 bg-zinc-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDraftType('codigo')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium transition cursor-pointer',
                    draftType === 'codigo'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  )}
                >
                  código
                </button>
                <button
                  type="button"
                  onClick={() => setDraftType('indentacion')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium transition cursor-pointer',
                    draftType === 'indentacion'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  )}
                >
                  indentación
                </button>
              </div>

              {/* Indent level control */}
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <span>Indent:</span>
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={draftIndent}
                  onChange={(e) =>
                    setDraftIndent(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="w-12 px-1.5 py-0.5 rounded border border-zinc-300 bg-white font-mono text-xs text-center"
                />
              </div>
            </>
          ) : (
            <>
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-medium',
                  isCodigo
                    ? 'bg-zinc-100 text-zinc-700'
                    : 'bg-zinc-200 text-zinc-800'
                )}
              >
                {isCodigo ? 'código' : 'indentación'}
              </span>
              {block.line_index !== undefined && (
                <span className="rounded-md bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                  línea {block.line_index + 1}
                </span>
              )}
              {block.indent_level > 0 && (
                <span className="text-xs text-zinc-400">
                  nivel {block.indent_level}
                </span>
              )}
            </>
          )}
        </div>

        {/* Text editor or display */}
        {isEditing ? (
          <div className="space-y-2 mt-1">
            {draftType === 'codigo' ? (
              <input
                type="text"
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="Escribe el contenido del bloque..."
                className="w-full font-mono text-xs text-zinc-900 bg-white border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 shadow-inner"
              />
            ) : (
              <p className="text-xs text-zinc-400 italic">
                (Bloque de indentación visual - sin texto)
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Guardar
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-300 bg-white text-zinc-600 text-xs font-medium hover:bg-zinc-100 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar
              </button>
              <span className="text-[11px] text-zinc-400 ml-1">
                Enter para guardar, Esc para cancelar
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <pre
              onClick={() => setIsEditing(true)}
              className="overflow-x-auto whitespace-pre font-mono text-xs text-zinc-900 leading-relaxed font-medium bg-zinc-50/60 hover:bg-zinc-100/80 rounded px-2 py-1 max-w-full cursor-pointer transition"
              title="Haz clic para editar"
            >
              {block.contenido || (
                <span className="italic text-zinc-400 font-normal">
                  (bloque vacío)
                </span>
              )}
            </pre>
          </div>
        )}
      </div>

      {/* Action buttons on the right */}
      {!isEditing && (
        <div className="flex items-center gap-1 shrink-0">
          {/* Edit button */}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            title="Editar contenido del bloque"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition cursor-pointer"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={() => onDelete(index)}
            title="Eliminar bloque"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <div className="w-px h-4 bg-zinc-200 mx-0.5" />

          {/* Drag handle */}
          <div
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition cursor-grab active:cursor-grabbing"
            title="Arrastra para cambiar de lugar el bloque"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  )
}
