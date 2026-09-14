import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { AuthProvider } from '@/components/auth/AuthProvider'
import PWAProvider from '@/components/pwa/PWAProvider'

export const metadata: Metadata = {
  title: 'Knoten — Programación Visual en Python',
  description: 'Plataforma educativa de programación visual mediante nodos en Python. Funciona sin conexión a internet.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Knoten',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#18181b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Knoten" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ToastProvider>
            <PWAProvider>
              {children}
            </PWAProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
