'use client'

import { useState, useEffect } from 'react'
import { X, Smartphone, Apple, Monitor, Share2, PlusSquare, MoreVertical, Download, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PWAInstallModalProps {
  isOpen: boolean
  onClose: () => void
  deferredPrompt: any | null
  onDirectInstall?: () => void
}

type TabType = 'android' | 'ios' | 'desktop'

export default function PWAInstallModal({
  isOpen,
  onClose,
  deferredPrompt,
  onDirectInstall,
}: PWAInstallModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('android')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || ''
      if (/iPad|iPhone|iPod/.test(ua)) {
        setActiveTab('ios')
      } else if (/Android/.test(ua)) {
        setActiveTab('android')
      } else {
        setActiveTab('desktop')
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              K
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Instalar Knoten en tu dispositivo
              </h2>
              <p className="text-xs text-zinc-500">
                Aprende y programa sin conexión a internet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device selector tabs */}
        <div className="flex border-b border-zinc-200 bg-zinc-100/50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition',
              activeTab === 'android'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            )}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition',
              activeTab === 'ios'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            )}
          >
            <Apple className="w-4 h-4" />
            <span>iOS (iPhone / iPad)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('desktop')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition',
              activeTab === 'desktop'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            )}
          >
            <Monitor className="w-4 h-4" />
            <span>Computadora</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* ─── ANDROID TAB ─── */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              {deferredPrompt && (
                <div className="p-4 rounded-2xl bg-zinc-900 text-white flex items-center justify-between gap-3 shadow-md">
                  <div>
                    <h3 className="text-xs font-bold">Instalación automática</h3>
                    <p className="text-[11px] text-zinc-300">
                      Tu navegador soporta instalación directa con 1 clic.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onDirectInstall}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-100 transition shrink-0 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Instalar ahora</span>
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Pasos de instalación manual (Chrome / Edge / Firefox):
                </h3>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-xs text-zinc-800 font-medium">
                      Abre el menú de opciones del navegador
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
                      Toca el ícono de tres puntos <MoreVertical className="w-3.5 h-3.5 inline text-zinc-700" /> en la esquina superior derecha.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-xs text-zinc-800 font-medium">
                      Selecciona &quot;Instalar aplicación&quot; o &quot;Agregar a la pantalla principal&quot;
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Encontrarás esta opción a mitad del menú desplegable.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="text-xs text-zinc-800 font-medium">
                      Confirma la instalación
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Presiona el botón &quot;Instalar&quot; en el mensaje de confirmación. Knoten se agregará a tu cajón de aplicaciones.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── IOS TAB ─── */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs leading-relaxed">
                <span className="font-semibold text-zinc-900">Importante:</span> Para instalar en iPhone o iPad, debes abrir Knoten desde el navegador <span className="font-bold">Safari</span> de Apple.
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-xs text-zinc-800 font-medium flex items-center gap-1.5">
                      Toca el botón Compartir <Share2 className="w-4 h-4 text-zinc-900" />
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Se encuentra en la barra de herramientas inferior de Safari (ícono de cuadro con flecha hacia arriba).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-xs text-zinc-800 font-medium flex items-center gap-1.5">
                      Selecciona &quot;Agregar a inicio&quot; <PlusSquare className="w-4 h-4 text-zinc-900" />
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Desplázate hacia abajo en el menú que se despliega hasta encontrar la opción con el símbolo más.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="text-xs text-zinc-800 font-medium">
                      Toca en &quot;Agregar&quot;
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      En la esquina superior derecha. El ícono de Knoten aparecerá en la pantalla principal de tu iPhone o iPad y funcionará en pantalla completa sin internet.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── DESKTOP TAB ─── */}
          {activeTab === 'desktop' && (
            <div className="space-y-4">
              {deferredPrompt && (
                <div className="p-4 rounded-2xl bg-zinc-900 text-white flex items-center justify-between gap-3 shadow-md">
                  <div>
                    <h3 className="text-xs font-bold">Instalación rápida</h3>
                    <p className="text-[11px] text-zinc-300">
                      Instala Knoten como una app nativa en tu computadora.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onDirectInstall}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-100 transition shrink-0 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Instalar en la PC</span>
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-xs text-zinc-800 font-medium">
                      En la barra de direcciones de Chrome o Edge
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Haz clic en el ícono de instalar (pantalla con flecha hacia abajo o símbolo ⊕) a la derecha de la URL.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-xs text-zinc-800 font-medium">
                      O desde el menú del navegador
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Haz clic en los tres puntos ⋮ en la esquina superior derecha y selecciona &quot;Instalar Knoten...&quot;.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400 font-medium">
            Knoten PWA v1.0 • Modo offline
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-semibold transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
