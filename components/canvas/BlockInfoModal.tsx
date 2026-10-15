'use client'

import React, { useEffect, useState, useRef, useLayoutEffect } from 'react'
import {
  X,
  BookOpen,
  Code2,
  Terminal,
  Copy,
  Check,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PythonBlockDoc } from '@/lib/python-documentation'
import { PythonCodeHighlight } from '@/lib/python-syntax'

export interface BlockInfoModalProps {
  isOpen: boolean
  onClose: () => void
  doc: PythonBlockDoc | null
  position?: { x: number; y: number }
}

export default function BlockInfoModal({
  isOpen,
  onClose,
  doc,
  position,
}: BlockInfoModalProps) {
  const [copied, setCopied] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Detect mobile vs desktop view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Position calculation and clamping to viewport for desktop
  useLayoutEffect(() => {
    if (!isOpen || !position || isMobile) return

    const card = cardRef.current
    const width = card ? card.offsetWidth : 420
    const height = card ? card.offsetHeight : 520

    const padding = 16
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Desired anchor near mouse position with a comfortable offset
    let posX = position.x + 12
    let posY = position.y + 12

    // If it overflows right, show on left side of cursor
    if (posX + width + padding > vw) {
      posX = Math.max(padding, position.x - width - 12)
    }

    // If it overflows bottom, show above cursor
    if (posY + height + padding > vh) {
      posY = Math.max(padding, position.y - height - 12)
    }

    // Clamp inside viewport
    posX = Math.max(padding, Math.min(posX, vw - width - padding))
    posY = Math.max(padding, Math.min(posY, vh - height - padding))

    setCoords({ x: posX, y: posY })
  }, [isOpen, position, isMobile, doc])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Copy code snippet to clipboard
  const handleCopyExample = () => {
    if (!doc?.example) return
    navigator.clipboard.writeText(doc.example)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen || !doc) return null

  // Desktop Floating Popover
  if (!isMobile && position) {
    return (
      <div
        className="fixed inset-0 z-50 pointer-events-none"
        aria-modal="true"
        role="dialog"
      >
        {/* Invisible backdrop to dismiss on click outside */}
        <div
          className="fixed inset-0 pointer-events-auto bg-black/10 backdrop-blur-[0.5px]"
          onClick={onClose}
        />

        {/* Floating Card */}
        <div
          ref={cardRef}
          style={{
            top: `${coords.y}px`,
            left: `${coords.x}px`,
          }}
          className={cn(
            'pointer-events-auto absolute w-[420px] max-w-[calc(100vw-32px)] max-h-[85vh]',
            'bg-white rounded-2xl shadow-2xl border border-zinc-200/90 overflow-hidden',
            'flex flex-col animate-modal-zoom z-50 text-zinc-900 select-text'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-100 bg-zinc-50/70 shrink-0">
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                    doc.categoryBadge.bg
                  )}
                >
                  <Sparkles size={11} className="shrink-0" />
                  {doc.typeCategory}
                </span>

                {doc.runtimeValue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Valor en lienzo: {doc.runtimeValue.value}
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-zinc-900 truncate">
                {doc.title}
              </h3>
            </div>

            <button
              onClick={onClose}
              title="Cerrar (Esc)"
              className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-200/60 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-5 space-y-4 overflow-y-auto text-sm">
            {/* Visual Type Pill Box (type(x) display) */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-3.5 shadow-inner">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Terminal size={13} className="text-amber-400" />
                  <span>Inspección de tipo (función incorporada type)</span>
                </div>
              </div>

              <div className="flex items-baseline gap-2 font-mono flex-wrap">
                <span className="text-amber-400 font-semibold text-xs select-none">
                  type({doc.rawCode}) &rarr;
                </span>
                <span className="text-emerald-400 font-bold text-sm tracking-wide bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700">
                  {doc.typeString}
                </span>
              </div>

              {doc.typeExplanation && (
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed border-t border-zinc-800/80 pt-2">
                  {doc.typeExplanation}
                </p>
              )}
            </div>

            {/* Syntax / Signature */}
            {doc.syntax && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                  Sintaxis / Firma
                </span>
                <div className="bg-zinc-100 rounded-lg px-3 py-2 font-mono text-xs text-zinc-800 whitespace-pre overflow-x-auto border border-zinc-200/80">
                  {doc.syntax}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                Documentación
              </span>
              <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">
                {doc.description}
              </p>
            </div>

            {/* Properties Badges */}
            {doc.properties && doc.properties.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Propiedades clave
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {doc.properties.map((prop, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-2 flex flex-col"
                    >
                      <span className="text-[10px] text-zinc-400 uppercase font-medium">
                        {prop.label}
                      </span>
                      <span className="font-mono text-xs font-semibold text-zinc-800 break-words mt-0.5">
                        {prop.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Example Snippet */}
            {doc.example && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Code2 size={12} />
                    Ejemplo en Python
                  </span>
                  <button
                    onClick={handleCopyExample}
                    className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-zinc-100"
                    title="Copiar ejemplo"
                  >
                    {copied ? (
                      <>
                        <Check size={11} className="text-green-600" />
                        <span className="text-green-600 font-medium">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-zinc-950 text-zinc-100 rounded-xl p-3 font-mono text-xs whitespace-pre overflow-x-auto border border-zinc-800 shadow-inner">
                  <PythonCodeHighlight code={doc.example} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Mobile Bottom-Sheet Modal
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-modal-backdrop p-0 sm:p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={cn(
          'w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-zinc-200',
          'overflow-hidden max-h-[85vh] flex flex-col animate-modal-zoom text-zinc-900'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-100 bg-zinc-50 shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            <span
              className={cn(
                'inline-flex items-center gap-1 w-fit px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                doc.categoryBadge.bg
              )}
            >
              <Sparkles size={11} />
              {doc.typeCategory}
            </span>
            <h3 className="text-base font-bold text-zinc-900 truncate">
              {doc.title}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-sm">
          {/* Visual Type Pill Box */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5 font-mono">
              <Terminal size={13} className="text-amber-400" />
              <span>Inspección de tipo (type)</span>
            </div>
            <div className="flex items-baseline gap-2 font-mono flex-wrap">
              <span className="text-amber-400 font-semibold text-xs">
                type({doc.rawCode}) &rarr;
              </span>
              <span className="text-emerald-400 font-bold text-sm tracking-wide bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                {doc.typeString}
              </span>
            </div>
            {doc.typeExplanation && (
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed border-t border-zinc-800 pt-2">
                {doc.typeExplanation}
              </p>
            )}
          </div>

          {/* Syntax */}
          {doc.syntax && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                Sintaxis
              </span>
              <div className="bg-zinc-100 rounded-lg px-3 py-2 font-mono text-xs text-zinc-800 whitespace-pre overflow-x-auto">
                {doc.syntax}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
              Documentación
            </span>
            <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {doc.description}
            </p>
          </div>

          {/* Properties */}
          {doc.properties && doc.properties.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                Propiedades
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {doc.properties.map((prop, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-50 border border-zinc-200 rounded-lg p-2"
                  >
                    <span className="text-[10px] text-zinc-400 uppercase font-medium block">
                      {prop.label}
                    </span>
                    <span className="font-mono text-xs font-semibold text-zinc-800 break-words">
                      {prop.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Example */}
          {doc.example && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Ejemplo
                </span>
                <button
                  onClick={handleCopyExample}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
                >
                  {copied ? (
                    <Check size={12} className="text-green-600" />
                  ) : (
                    <Copy size={12} />
                  )}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
              <div className="bg-zinc-950 text-zinc-100 rounded-xl p-3 font-mono text-xs whitespace-pre overflow-x-auto border border-zinc-800">
                <PythonCodeHighlight code={doc.example} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
