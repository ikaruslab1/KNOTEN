'use client'

import { useState } from 'react'
import { LogIn } from 'lucide-react'
import AuthModal from './AuthModal'
import { cn } from '@/lib/utils'

interface AuthTriggerButtonProps {
  className?: string
  defaultTab?: 'login' | 'register'
  children?: React.ReactNode
}

export default function AuthTriggerButton({
  className,
  defaultTab = 'login',
  children,
}: AuthTriggerButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 text-xs sm:text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 active:scale-95 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer',
          className
        )}
      >
        {children ? (
          children
        ) : (
          <>
            <LogIn size={14} />
            <span>Ingresar</span>
          </>
        )}
      </button>

      <AuthModal
        isOpen={open}
        onClose={() => setOpen(false)}
        defaultTab={defaultTab}
      />
    </>
  )
}
