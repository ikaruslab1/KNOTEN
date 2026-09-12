'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

function LoginForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = searchParams.get('confirmed') === 'true';

  useEffect(() => {
    // If already logged in, redirect
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const next = searchParams.get('next') ?? '/';
        window.location.href = next;
      }
    });
  }, [searchParams, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password,
    });

    if (signInError) {
      if (signInError.message?.toLowerCase().includes('email not confirmed')) {
        setError(
          'Tu correo electrónico aún no ha sido confirmado. Por favor revisa tu bandeja de entrada o spam y haz clic en el enlace de activación.'
        );
      } else {
        setError('Correo o contraseña incorrectos. Verifica tus credenciales e intenta de nuevo.');
      }
      setLoading(false);
      return;
    }

    if (data.session) {
      // Force full reload to update server components and headers immediately
      const next = searchParams.get('next') ?? '/';
      window.location.href = next;
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 sm:p-10">
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-block text-3xl font-extrabold text-zinc-900 tracking-tight">
          Knoten
        </Link>
        <p className="text-zinc-500 text-sm mt-1">Inicia sesión en tu cuenta</p>
      </div>

      {/* Email confirmed banner */}
      {isConfirmed && (
        <div className="mb-5 rounded-xl bg-zinc-100 border border-zinc-300 p-4 text-sm text-zinc-800 flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-zinc-900 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-zinc-900">¡Correo confirmado!</p>
            <p className="text-xs text-zinc-600 mt-0.5">
              Tu cuenta ha sido activada correctamente. Ingresa tu correo y contraseña para acceder.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="correo" className="block text-sm font-medium text-zinc-700 mb-1">
            Correo personal
          </label>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition bg-white"
            placeholder="tu@correo.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 pr-10 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition bg-white"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-zinc-900 text-white font-semibold text-sm hover:bg-zinc-800 active:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500 mt-6">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="text-zinc-900 underline font-medium hover:text-zinc-700">
          Regístrate aquí
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="w-full max-w-md h-96 bg-white rounded-2xl border border-zinc-200 animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
