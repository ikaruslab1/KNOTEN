import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogIn, BookOpen, User } from 'lucide-react'

export async function NavBar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('nombre, rol')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <BookOpen size={22} />
            <span>PyNodes</span>
          </Link>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            {user && profile ? (
              <>
                {profile.rol === 'profesor' && (
                  <Link
                    href="/profesor"
                    className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Panel del profesor
                  </Link>
                )}
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-1.5">
                  <User size={15} className="text-gray-500" />
                  <span className="text-sm text-gray-700 font-medium">{profile.nombre}</span>
                </div>
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="text-sm text-gray-500 hover:text-red-600 px-2 py-1 rounded-lg transition-colors"
                  >
                    Salir
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 px-4 py-1.5 rounded-xl transition-colors"
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
