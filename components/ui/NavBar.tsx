import Link from 'next/link'
import { getCurrentUser, getCurrentProfile } from '@/lib/supabase/server'
import { Code2 } from 'lucide-react'
import NavBarUserSection from './NavBarUserSection'

export async function NavBar() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ])

  return (
    <header className="sticky top-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200 animate-slide-down-fade">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl text-zinc-900 tracking-tight hover:opacity-85 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              <Code2 size={18} />
            </div>
            <span>Knoten</span>
          </Link>

          {/* Nav actions with offline hydration */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <NavBarUserSection initialUser={user} initialProfile={profile} />
          </div>
        </div>
      </div>
    </header>
  )
}
