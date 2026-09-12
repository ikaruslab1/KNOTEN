'use client'

import { useState, useCallback } from 'react'
import { ArrowUp, ArrowDown, ChevronRight, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { splitPythonCode, type SplitBlock } from '@/lib/code-splitter'
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActivityBuilder({ activityId, initialActivity }: Props) {
  const supabase = createClient()

  // ── Wizard state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1)
  const [code, setCode] = useState('')
  const [blocks, setBlocks] = useState<SplitBlock[]>([])
  const [enunciado, setEnunciado] = useState(initialActivity.enunciado ?? '')
  const [resultadoEsperado, setResultadoEsperado] = useState(
    initialActivity.resultado_esperado ?? ''
  )
  const [toast, setToast] = useState<ToastState>('idle')
  const [toastMsg, setToastMsg] = useState('')

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

      // 2. INSERT new blocks
      const blockRows = blocks.map((b) => ({
        activity_id: activityId,
        tipo: b.tipo,
        contenido: b.contenido,
        orden_correcto: b.orden_correcto,
        indent_level: b.indent_level,
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
          source_handle: 'bottom',
          target_handle: 'top',
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

      setToast('success')
      setToastMsg('Actividad guardada correctamente.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar.'
      setToast('error')
      setToastMsg(msg)
    }

    setTimeout(() => setToast('idle'), 3500)
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
      <StepIndicator current={step} />

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
              className="min-h-64 rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
            />
            <p className="text-xs text-gray-400">
              La tecla Tab inserta 4 espacios. Las líneas en blanco son ignoradas.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={goToStep2}
              disabled={!code.trim()}
              className={cn(
                'flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition',
                !code.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700',
              )}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ── Step 2/3: Block preview + reorder ───────────────────────────────── */}
      {step === 2 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Vista previa de bloques
            </h2>
            <p className="text-sm text-gray-500">
              Usa las flechas para ajustar el orden si es necesario.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {blocks.map((block, index) => (
              <BlockCard
                key={index}
                block={block}
                index={index}
                total={blocks.length}
                onMove={moveBlock}
              />
            ))}
          </div>

          {blocks.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">
              No se encontraron bloques. Vuelve y verifica el código.
            </p>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={blocks.length === 0}
              className={cn(
                'flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition',
                blocks.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700',
              )}
            >
              Confirmar bloques
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ── Step 4: Enunciado + resultado ────────────────────────────────────── */}
      {step === 4 && (
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Enunciado y resultado esperado
            </h2>
            <p className="text-sm text-gray-500">
              Escribe las instrucciones para el alumno y el resultado que verá en
              la terminal.
            </p>
          </div>

          {/* Enunciado */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="enunciado"
              className="text-sm font-medium text-gray-700"
            >
              Enunciado / Instrucciones del problema
            </label>
            <textarea
              id="enunciado"
              value={enunciado}
              onChange={(e) => setEnunciado(e.target.value)}
              rows={5}
              placeholder="Escribe las instrucciones que verá el alumno…"
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
            />
          </div>

          {/* Resultado esperado */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="resultado"
              className="text-sm font-medium text-gray-700"
            >
              Resultado esperado{' '}
              <span className="font-normal text-gray-400">
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
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
            />
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
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
            'fixed bottom-6 right-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg transition-all',
            toast === 'success' ? 'bg-green-600' : 'bg-red-600',
          )}
        >
          {toast === 'success' && <CheckCircle2 className="h-4 w-4" />}
          {toastMsg}
        </div>
      )}
    </div>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
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
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition',
                  done
                    ? 'bg-blue-600 text-white'
                    : active
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-gray-200 text-gray-500',
                )}
              >
                {s.n === 4 ? 3 : s.n}
              </span>
              <span
                className={cn(
                  'hidden text-xs font-medium sm:block',
                  active ? 'text-blue-700' : done ? 'text-gray-500' : 'text-gray-400',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-px flex-1 transition',
                  done ? 'bg-blue-400' : 'bg-gray-200',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ─── Block Card ───────────────────────────────────────────────────────────────

type BlockCardProps = {
  block: SplitBlock
  index: number
  total: number
  onMove: (index: number, direction: 'up' | 'down') => void
}

function BlockCard({ block, index, total, onMove }: BlockCardProps) {
  const isCodigo = block.tipo === 'codigo'

  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {/* Number badge */}
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
        {index + 1}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-medium',
              isCodigo ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700',
            )}
          >
            {isCodigo ? 'código' : 'indentación'}
          </span>
          {block.indent_level > 0 && (
            <span className="text-xs text-gray-400">nivel {block.indent_level}</span>
          )}
        </div>
        <pre className="overflow-x-auto whitespace-pre font-mono text-xs text-gray-800 leading-relaxed">
          {block.contenido || <span className="italic text-gray-400">(vacío)</span>}
        </pre>
      </div>

      {/* Reorder arrows */}
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onMove(index, 'up')}
          disabled={index === 0}
          className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Subir bloque"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 'down')}
          disabled={index === total - 1}
          className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Bajar bloque"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
