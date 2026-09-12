import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogIn, Code2, User } from 'lucide-react'

export async function NavBar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: { nombre: string; apellido_paterno: string; rol: string } | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('nombre, apellido_paterno, rol')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
  }

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
          <div className="flex items-center gap-3">
            {user && profile ? (
              <>
                {profile.rol === 'profesor' && (
                  <Link
                    href="/profesor"
                    className="text-sm font-medium text-zinc-700 hover:text-zinc-900 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                  >
                    Panel del profesor
                  </Link>
                )}
                <div className="flex items-center gap-2 bg-zinc-100 border border-zinc-200 rounded-xl px-3 py-1.5">
                  <User size={15} className="text-zinc-600" />
                  <span className="text-sm text-zinc-900 font-medium">
                    {profile.nombre} {profile.apellido_paterno}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">
                    {profile.rol}
                  </span>
                </div>
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Salir
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                <LogIn size={15} />
                Ingresar
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
