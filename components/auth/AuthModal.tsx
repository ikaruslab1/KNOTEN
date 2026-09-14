'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  LogIn,
  UserPlus,
  Loader2,
  Code2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveOfflineSession } from '@/lib/offline/auth-session'
import { cn } from '@/lib/utils'

export type AuthTab = 'login' | 'register'

interface AuthModalProps {
  isOpen?: boolean
  onClose?: () => void
  defaultTab?: AuthTab
}

interface RegisterFormData {
  nombre: string
  apellido_paterno: string
  apellido_materno: string
  grupo: string
  semestre: string
  carrera: string
  correo_personal: string
  correo_institucional: string
  password: string
  confirmPassword: string
}

const INITIAL_REGISTER: RegisterFormData = {
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  grupo: '',
  semestre: '',
  carrera: '',
  correo_personal: '',
  correo_institucional: '',
  password: '',
  confirmPassword: '',
}

export default function AuthModal({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  defaultTab = 'login',
}: AuthModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isControlled = controlledIsOpen !== undefined
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen

  const [activeTab, setActiveTab] = useState<AuthTab>(defaultTab)
  const [direction, setDirection] = useState<'down' | 'up'>('down')

  // Login form states
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Register form states
  const [registerData, setRegisterData] = useState<RegisterFormData>(INITIAL_REGISTER)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const modalRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  // Listen to global open event
  useEffect(() => {
    const handleOpenAuth = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab)
      }
      setInternalIsOpen(true)
    }

    window.addEventListener('knoten:open-auth', handleOpenAuth)
    return () => window.removeEventListener('knoten:open-auth', handleOpenAuth)
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleClose = () => {
    if (controlledOnClose) {
      controlledOnClose()
    } else {
      setInternalIsOpen(false)
    }
    setLoginError(null)
    setRegisterError(null)
  }

  const switchTab = (tab: AuthTab) => {
    if (tab === activeTab) return
    setDirection(tab === 'register' ? 'down' : 'up')
    setActiveTab(tab)
    setLoginError(null)
    setRegisterError(null)
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      })

      if (error) {
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          setLoginError(
            'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada o spam.'
          )
        } else {
          setLoginError('Correo o contraseña incorrectos. Verifica tus datos.')
        }
        setLoginLoading(false)
        return
      }

      if (data.session && data.user) {
        // Fetch profile to persist offline
        let profileData: any = null
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, nombre, apellido_paterno, apellido_materno, rol, correo_personal')
            .eq('id', data.user.id)
            .maybeSingle()
          profileData = prof
        } catch {}

        saveOfflineSession(data.user, profileData || {})
        handleClose()
        window.location.reload()
      }
    } catch {
      setLoginError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegisterChange = (field: keyof RegisterFormData, value: string) => {
    setRegisterData((prev) => ({ ...prev, [field]: value }))
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterError(null)

    if (registerData.password.length < 8) {
      setRegisterError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (registerData.password !== registerData.confirmPassword) {
      setRegisterError('Las contraseñas no coinciden.')
      return
    }

    setRegisterLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: registerData.correo_personal.trim(),
        password: registerData.password,
        options: {
          data: {
            nombre: registerData.nombre.trim(),
            apellido_paterno: registerData.apellido_paterno.trim(),
            apellido_materno: registerData.apellido_materno.trim(),
            grupo: registerData.grupo.trim(),
            semestre: registerData.semestre.trim(),
            carrera: registerData.carrera.trim(),
            correo_personal: registerData.correo_personal.trim(),
            correo_institucional: registerData.correo_institucional.trim(),
          },
        },
      })

      if (error) {
        setRegisterError(error.message || 'Error al crear la cuenta.')
        setRegisterLoading(false)
        return
      }

      if (data.user) {
        saveOfflineSession(data.user, {
          id: data.user.id,
          nombre: registerData.nombre.trim(),
          apellido_paterno: registerData.apellido_paterno.trim(),
          apellido_materno: registerData.apellido_materno.trim(),
          rol: 'estudiante',
          correo_personal: registerData.correo_personal.trim(),
          grupo: registerData.grupo.trim(),
          semestre: registerData.semestre.trim(),
          carrera: registerData.carrera.trim(),
        })
      }

      // Send welcome email
      fetch('/api/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...registerData,
          password: registerData.password,
        }),
      }).catch(() => {})

      setRegisterSuccess(true)
    } catch {
      setRegisterError('Error al registrar usuario. Intenta de nuevo.')
    } finally {
      setRegisterLoading(false)
    }
  }

  if (!isOpen || !mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl border border-zinc-200 shadow-2xl w-full max-w-md my-auto overflow-hidden animate-modal-zoom transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 pb-0 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs">
              <Code2 size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-900 tracking-tight">Knoten</h2>
              <p className="text-xs text-zinc-500">Programación visual en Python</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-800 p-1.5 rounded-xl hover:bg-zinc-100 transition cursor-pointer"
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 sm:px-6 pt-5">
          <div className="flex p-1 bg-zinc-100 rounded-2xl border border-zinc-200">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none',
                activeTab === 'login'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              )}
            >
              <LogIn size={15} />
              <span>Iniciar sesión</span>
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none',
                activeTab === 'register'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              )}
            >
              <UserPlus size={15} />
              <span>Registrarse</span>
            </button>
          </div>
        </div>

        {/* Form Body with Smooth Vertical Transition */}
        <div className="p-5 sm:p-6 overflow-hidden">
          {activeTab === 'login' ? (
            <div
              key="login-view"
              className={cn(
                direction === 'up' ? 'animate-form-slide-top' : 'animate-form-slide-bottom'
              )}
            >
              {loginError && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Correo personal
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition bg-zinc-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 pr-10 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition bg-zinc-50/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
                      tabIndex={-1}
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full mt-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white text-xs sm:text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Ingresando...</span>
                    </>
                  ) : (
                    <span>Iniciar sesión</span>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className="text-xs text-zinc-500 hover:text-zinc-900 transition font-medium"
                >
                  ¿No tienes cuenta? <span className="underline font-semibold">Regístrate gratis</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              key="register-view"
              className={cn(
                direction === 'down' ? 'animate-form-slide-bottom' : 'animate-form-slide-top'
              )}
            >
              {registerSuccess ? (
                <div className="text-center py-6 space-y-3">
                  <CheckCircle2 size={44} className="text-emerald-600 mx-auto stroke-[2]" />
                  <h3 className="font-bold text-base text-zinc-900">¡Registro exitoso!</h3>
                  <p className="text-xs text-zinc-600 max-w-xs mx-auto leading-relaxed">
                    Hemos enviado los detalles a tu correo electrónico. Ya puedes iniciar sesión con
                    tu nueva cuenta.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterSuccess(false)
                      switchTab('login')
                    }}
                    className="mt-2 px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition"
                  >
                    Ir a iniciar sesión
                  </button>
                </div>
              ) : (
                <>
                  {registerError && (
                    <div className="mb-3 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                      {registerError}
                    </div>
                  )}

                  <form
                    onSubmit={handleRegisterSubmit}
                    className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                          Nombre(s)
                        </label>
                        <input
                          type="text"
                          required
                          value={registerData.nombre}
                          onChange={(e) => handleRegisterChange('nombre', e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                          Apellido Paterno
                        </label>
                        <input
                          type="text"
                          required
                          value={registerData.apellido_paterno}
                          onChange={(e) => handleRegisterChange('apellido_paterno', e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                          Apellido Materno
                        </label>
                        <input
                          type="text"
                          required
                          value={registerData.apellido_materno}
                          onChange={(e) => handleRegisterChange('apellido_materno', e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                          Grupo
                        </label>
                        <input
                          type="text"
                          required
                          value={registerData.grupo}
                          onChange={(e) => handleRegisterChange('grupo', e.target.value)}
                          placeholder="Ej. 301"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                          Semestre
                        </label>
                        <select
                          required
                          value={registerData.semestre}
                          onChange={(e) => handleRegisterChange('semestre', e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                        >
                          <option value="">Selecciona...</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => (
                            <option key={s} value={String(s)}>
                              Semestre {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                          Carrera
                        </label>
                        <input
                          type="text"
                          required
                          value={registerData.carrera}
                          onChange={(e) => handleRegisterChange('carrera', e.target.value)}
                          placeholder="Ej. Sistemas"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                        Correo personal
                      </label>
                      <input
                        type="email"
                        required
                        value={registerData.correo_personal}
                        onChange={(e) => handleRegisterChange('correo_personal', e.target.value)}
                        placeholder="tu@correo.com"
                        className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                        Correo institucional <span className="text-zinc-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="email"
                        value={registerData.correo_institucional}
                        onChange={(e) => handleRegisterChange('correo_institucional', e.target.value)}
                        placeholder="alumno@instituto.edu.mx"
                        className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                          Contraseña
                        </label>
                        <input
                          type={showRegisterPassword ? 'text' : 'password'}
                          required
                          value={registerData.password}
                          onChange={(e) => handleRegisterChange('password', e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">
                          Confirmar
                        </label>
                        <input
                          type={showRegisterPassword ? 'text' : 'password'}
                          required
                          value={registerData.confirmPassword}
                          onChange={(e) => handleRegisterChange('confirmPassword', e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 bg-zinc-50/50"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={registerLoading}
                      className="w-full mt-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white text-xs sm:text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {registerLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Registrando...</span>
                        </>
                      ) : (
                        <span>Completar registro</span>
                      )}
                    </button>
                  </form>
                </>
              )}

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="text-xs text-zinc-500 hover:text-zinc-900 transition font-medium"
                >
                  ¿Ya tienes cuenta? <span className="underline font-semibold">Inicia sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
