import Link from 'next/link'
import { getCurrentUser, getCurrentProfile } from '@/lib/supabase/server'
import { LogIn, Code2, User } from 'lucide-react'

export async function NavBar() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ])

  return (
    <header className="sticky top-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl text-zinc-900 tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              <Code2 size={18} />
            </div>
            <span>Knoten</span>
          </Link>

          {/* Nav actions */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {user ? (
              <>
                {profile?.rol === 'profesor' && (
                  <Link
                    href="/profesor"
                    className="text-xs sm:text-sm font-medium text-zinc-700 hover:text-zinc-900 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors shrink-0"
                  >
                    <span className="sm:hidden">Panel</span>
                    <span className="hidden sm:inline">Panel del profesor</span>
                  </Link>
                )}
                <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-100 border border-zinc-200 rounded-xl px-2 sm:px-3 py-1 sm:py-1.5">
                  <User size={14} className="text-zinc-600 shrink-0" />
                  <span className="text-xs sm:text-sm text-zinc-900 font-medium truncate max-w-[80px] sm:max-w-[160px]">
                    {profile?.nombre
                      ? `${profile.nombre} ${profile.apellido_paterno || ''}`.trim()
                      : user.email}
                  </span>
                  <span className="hidden md:inline text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 shrink-0">
                    {profile?.rol || 'estudiante'}
                  </span>
                </div>
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Salir
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-colors shadow-sm shrink-0"
              >
                <LogIn size={14} />
                Ingresar
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
