'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface FormData {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  grupo: string;
  semestre: string;
  carrera: string;
  correo_personal: string;
  correo_institucional: string;
  password: string;
  confirmPassword: string;
}

const INITIAL: FormData = {
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
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface FieldProps {
  id: keyof FormData;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: (id: keyof FormData, val: string) => void;
  error?: string;
}

function Field({
  id,
  label,
  type = 'text',
  placeholder,
  required = true,
  value,
  onChange,
  error,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {!required && <span className="ml-1 text-gray-400 text-xs">(opcional)</span>}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition',
          error ? 'border-red-400 bg-red-50' : 'border-gray-300'
        )}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

interface PasswordFieldProps {
  id: keyof FormData;
  label: string;
  value: string;
  onChange: (id: keyof FormData, val: string) => void;
  error?: string;
}

function PasswordField({ id, label, value, onChange, error }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
          placeholder="••••••••"
          className={cn(
            'w-full rounded-lg border px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition',
            error ? 'border-red-400 bg-red-50' : 'border-gray-300'
          )}
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export default function RegistroPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<FormData>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(id: keyof FormData, val: string) {
    setForm((prev) => ({ ...prev, [id]: val }));
    setFieldErrors((prev) => ({ ...prev, [id]: undefined }));
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof FormData, string>> = {};

    const requiredTextFields: (keyof FormData)[] = [
      'nombre',
      'apellido_paterno',
      'apellido_materno',
      'grupo',
      'semestre',
      'carrera',
      'correo_personal',
    ];

    for (const field of requiredTextFields) {
      if (!form[field].trim()) {
        errors[field] = 'Este campo es obligatorio';
      }
    }

    if (form.correo_personal && !isValidEmail(form.correo_personal)) {
      errors.correo_personal = 'Ingresa un correo válido';
    }

    if (form.correo_institucional && !isValidEmail(form.correo_institucional)) {
      errors.correo_institucional = 'Ingresa un correo institucional válido';
    }

    if (!form.password) {
      errors.password = 'Este campo es obligatorio';
    } else if (form.password.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres';
    }

    if (!form.confirmPassword) {
      errors.confirmPassword = 'Confirma tu contraseña';
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.correo_personal,
      password: form.password,
      options: {
        data: {
          nombre: form.nombre,
          apellido_paterno: form.apellido_paterno,
          apellido_materno: form.apellido_materno,
          grupo: form.grupo,
          semestre: form.semestre,
          carrera: form.carrera,
          correo_personal: form.correo_personal,
          correo_institucional: form.correo_institucional || null,
        },
      },
    });

    if (signUpError) {
      setSubmitError(signUpError.message ?? 'Ocurrió un error al registrarse. Intenta de nuevo.');
      setLoading(false);
      return;
    }

    // Send welcome email
    try {
      await fetch('/api/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido_paterno: form.apellido_paterno,
          apellido_materno: form.apellido_materno,
          grupo: form.grupo,
          semestre: form.semestre,
          carrera: form.carrera,
          correo_personal: form.correo_personal,
          correo_institucional: form.correo_institucional || null,
          password: form.password,
        }),
      });
    } catch {
      // Non-blocking — don't fail registration if welcome email fails
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
          <span className="text-3xl font-extrabold text-blue-600">PyNodes</span>
          <div className="mt-6 text-green-600 text-5xl">✓</div>
          <h2 className="text-xl font-bold text-gray-900 mt-4">¡Registro exitoso!</h2>
          <p className="text-gray-500 text-sm mt-2">Revisa tu correo para confirmar tu cuenta.</p>
          <Link
            href="/"
            className="mt-6 inline-block px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left — Form */}
      <div className="flex-1 flex items-start justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="mb-8">
            <Link href="/" className="text-2xl font-extrabold text-blue-600 tracking-tight">
              PyNodes
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Crea tu cuenta</h1>
            <p className="text-sm text-gray-500">Completa los siguientes campos para registrarte</p>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Row: nombre */}
            <Field
              id="nombre"
              label="Nombre(s)"
              placeholder="Ej. María"
              value={form.nombre}
              onChange={handleChange}
              error={fieldErrors.nombre}
            />

            {/* Row: apellidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                id="apellido_paterno"
                label="Apellido paterno"
                placeholder="Ej. García"
                value={form.apellido_paterno}
                onChange={handleChange}
                error={fieldErrors.apellido_paterno}
              />
              <Field
                id="apellido_materno"
                label="Apellido materno"
                placeholder="Ej. López"
                value={form.apellido_materno}
                onChange={handleChange}
                error={fieldErrors.apellido_materno}
              />
            </div>

            {/* Row: grupo + semestre */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                id="grupo"
                label="Grupo"
                placeholder="Ej. A"
                value={form.grupo}
                onChange={handleChange}
                error={fieldErrors.grupo}
              />
              <div>
                <label htmlFor="semestre" className="block text-sm font-medium text-gray-700 mb-1">
                  Semestre
                </label>
                <select
                  id="semestre"
                  required
                  value={form.semestre}
                  onChange={(e) => handleChange('semestre', e.target.value)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white',
                    fieldErrors.semestre ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  )}
                >
                  <option value="">Selecciona</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}°
                    </option>
                  ))}
                </select>
                {fieldErrors.semestre && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.semestre}</p>
                )}
              </div>
            </div>

            {/* Carrera */}
            <Field
              id="carrera"
              label="Carrera"
              placeholder="Ej. Ingeniería en Sistemas Computacionales"
              value={form.carrera}
              onChange={handleChange}
              error={fieldErrors.carrera}
            />

            {/* Correos */}
            <Field
              id="correo_personal"
              label="Correo personal"
              type="email"
              placeholder="tu@correo.com"
              value={form.correo_personal}
              onChange={handleChange}
              error={fieldErrors.correo_personal}
            />
            <Field
              id="correo_institucional"
              label="Correo institucional"
              type="email"
              placeholder="tu@estudiante.edu.mx"
              required={false}
              value={form.correo_institucional}
              onChange={handleChange}
              error={fieldErrors.correo_institucional}
            />

            {/* Passwords */}
            <PasswordField
              id="password"
              label="Contraseña"
              value={form.password}
              onChange={handleChange}
              error={fieldErrors.password}
            />
            <PasswordField
              id="confirmPassword"
              label="Confirmar contraseña"
              value={form.confirmPassword}
              onChange={handleChange}
              error={fieldErrors.confirmPassword}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Registrando...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>

      {/* Right — Branding (hidden on mobile) */}
      <div className="hidden lg:flex flex-col items-center justify-center w-96 bg-gradient-to-br from-blue-600 to-purple-600 text-white px-10 py-16 shrink-0">
        <div className="text-center">
          <span className="text-4xl font-extrabold tracking-tight">PyNodes</span>
          <p className="mt-4 text-blue-100 text-lg font-medium leading-snug">
            Aprende Python de forma visual
          </p>
          <p className="mt-3 text-blue-200 text-sm leading-relaxed">
            Conecta bloques de código, entiende la lógica y avanza a tu ritmo con actividades
            diseñadas por tus profesores.
          </p>

          {/* Decorative blocks */}
          <div className="mt-10 flex flex-col gap-3 w-full">
            {[
              { color: 'bg-blue-400', label: 'Variables' },
              { color: 'bg-purple-400', label: 'Funciones' },
              { color: 'bg-indigo-400', label: 'Ciclos' },
            ].map((block) => (
              <div
                key={block.label}
                className={cn(
                  'rounded-xl px-5 py-3 text-left text-sm font-semibold text-white opacity-80',
                  block.color
                )}
              >
                {block.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
