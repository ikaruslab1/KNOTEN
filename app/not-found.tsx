import Link from 'next/link'
import { AlertCircle, Home, BookOpen } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4 text-zinc-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Página no encontrada</h2>
        <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
          El contenido que buscas no existe, ha sido movido o eliminado.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Link
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition"
          >
            <Home className="w-4 h-4" />
            Ir al inicio
          </Link>
          <Link
            href="/profesor"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition"
          >
            <BookOpen className="w-4 h-4" />
            Mis Cursos
          </Link>
        </div>
      </div>
    </div>
  )
}
