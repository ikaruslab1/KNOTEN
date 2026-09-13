'use client'

import { useRouter } from 'next/navigation'
import AuthModal from '@/components/auth/AuthModal'

export default function RegistroPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-zinc-900/50 flex items-center justify-center p-4">
      <AuthModal
        isOpen={true}
        onClose={() => router.push('/')}
        defaultTab="register"
      />
    </div>
  )
}
