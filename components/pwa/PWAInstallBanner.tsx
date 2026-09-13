'use client'

import { useState, useEffect } from 'react'
import { Download, X, HelpCircle, Smartphone } from 'lucide-react'
import PWAInstallModal from './PWAInstallModal'

const DISMISS_KEY = 'knoten_pwa_banner_dismissed'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

export default function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if app is already running in standalone mode (installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true

    if (isStandalone) {
      return
    }

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const timePassed = Date.now() - parseInt(dismissedAt, 10)
      if (timePassed < DISMISS_DURATION) {
        return
      }
    }

    // Check if iOS
    const ua = navigator.userAgent || ''
    const iosDetected = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsIOS(iosDetected)

    // Capture beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // If iOS or other browser, still show banner after 1.5 seconds if not installed
    const timer = setTimeout(() => {
      setShowBanner(true)
    }, 1500)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    setShowBanner(false)
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString())
    } catch {
      // Ignorar error de storage
    }
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowBanner(false)
      }
      setDeferredPrompt(null)
    } else {
      // iOS or browser without prompt: show instructions modal
      setShowModal(true)
    }
  }

  if (!showBanner) {
    return (
      <PWAInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        deferredPrompt={deferredPrompt}
        onDirectInstall={handleInstallClick}
      />
    )
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-zinc-900/95 text-white backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-zinc-700/80 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start gap-3">
          {/* App Icon badge */}
          <div className="w-10 h-10 rounded-xl bg-white text-zinc-950 font-black text-base flex items-center justify-center shrink-0 shadow-sm">
            K
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Instala Knoten en tu dispositivo</span>
              <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
            </h3>
            <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">
              Accede a tus cursos y resuelve actividades sin necesidad de conexión a internet.
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 font-bold text-xs transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isIOS ? 'Ver cómo instalar' : 'Instalar app'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Instrucciones</span>
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <PWAInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        deferredPrompt={deferredPrompt}
        onDirectInstall={handleInstallClick}
      />
    </>
  )
}
