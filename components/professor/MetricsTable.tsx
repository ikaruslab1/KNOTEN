'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { MetricsRow } from '@/app/profesor/metricas/page'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = keyof Pick<
  MetricsRow,
  'nombre' | 'carrera' | 'actividad_titulo' | 'intentos' | 'completado' | 'fecha_completado'
>

type SortDir = 'asc' | 'desc'

type Props = {
  rows: MetricsRow[]
  courses: { id: string; nombre: string }[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MetricsTable({ rows, courses }: Props) {
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('nombre')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Filter by course
  const filtered = useMemo(
    () =>
      selectedCourse === 'all'
        ? rows
        : rows.filter((r) => r.course_id === selectedCourse),
    [rows, selectedCourse]
  )

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? ''
      const bVal = b[sortKey] ?? ''

      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return sortDir === 'asc'
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal)
      }

      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()

      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
    )
  }

  const thClass =
    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 select-none'
  const thBtnClass =
    'flex items-center gap-1.5 hover:text-gray-900 transition-colors cursor-pointer'

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Course selector */}
        {courses.length > 1 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="course-filter"
              className="text-sm font-medium text-gray-700"
            >
              Curso:
            </label>
            <select
              id="course-filter"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">Todos los cursos</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="ml-auto text-xs text-gray-400">
          {sorted.length} registro{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className={thClass}>
                <button
                  type="button"
                  className={thBtnClass}
                  onClick={() => toggleSort('nombre')}
                >
                  Nombre del alumno <SortIcon col="nombre" />
                </button>
              </th>
              <th className={thClass}>
                <button
                  type="button"
                  className={thBtnClass}
                  onClick={() => toggleSort('carrera')}
                >
                  Carrera <SortIcon col="carrera" />
                </button>
              </th>
              <th className={thClass}>
                <button
                  type="button"
                  className={thBtnClass}
                  onClick={() => toggleSort('actividad_titulo')}
                >
                  Actividad <SortIcon col="actividad_titulo" />
                </button>
              </th>
              <th className={thClass}>
                <button
                  type="button"
                  className={thBtnClass}
                  onClick={() => toggleSort('intentos')}
                >
                  Intentos <SortIcon col="intentos" />
                </button>
              </th>
              <th className={thClass}>
                <button
                  type="button"
                  className={thBtnClass}
                  onClick={() => toggleSort('completado')}
                >
                  Completado <SortIcon col="completado" />
                </button>
              </th>
              <th className={thClass}>
                <button
                  type="button"
                  className={thBtnClass}
                  onClick={() => toggleSort('fecha_completado')}
                >
                  Fecha <SortIcon col="fecha_completado" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                  No hay datos para mostrar.
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={`${row.student_id}-${row.actividad_id}`}
                  className={cn(
                    'transition hover:bg-gray-50',
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {row.nombre}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {row.carrera ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {row.actividad_titulo}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium">
                      {row.intentos}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.completado ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Sí
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <XCircle className="h-4 w-4" />
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {row.fecha_completado ? formatDate(row.fecha_completado) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
