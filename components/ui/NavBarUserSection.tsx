'use client'

import Link from 'next/link'
import { User, LogOut } from 'lucide-react'
import AuthTriggerButton from '@/components/auth/AuthTriggerButton'
import { useAuth } from '@/components/auth/AuthProvider'

interface NavBarUserSectionProps {
  initialUser?: {
    id: string
    email?: string
    [key: string]: any
  } | null
  initialProfile?: {
    id: string
    nombre?: string
    apellido_paterno?: string
    apellido_materno?: string | null
    rol?: string
    correo_personal?: string
    [key: string]: any
  } | null
}

export default function NavBarUserSection({
  initialUser,
  initialProfile,
}: NavBarUserSectionProps) {
  const { user: authUser, profile: authProfile, signOut, isLoading } = useAuth()

  // Use auth context if hydrated/available; otherwise fall back to server-rendered initial values
  const currentUser = authUser || (!isLoading ? null : initialUser)
  const currentProfile = authProfile || (!isLoading ? null : initialProfile)

  if (currentUser) {
    const displayName = currentProfile?.nombre
      ? `${currentProfile.nombre} ${currentProfile.apellido_paterno || ''}`.trim()
      : currentUser.email || 'Usuario'

    const role = currentProfile?.rol || 'estudiante'

    return (
      <>
        {role === 'profesor' && (
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
            {displayName}
          </span>
          <span className="hidden md:inline text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 shrink-0">
            {role}
          </span>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1"
          title="Cerrar sesión"
        >
          <LogOut size={13} className="sm:hidden" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </>
    )
  }

  return <AuthTriggerButton defaultTab="login" />
}
