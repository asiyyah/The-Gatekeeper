'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { LoginSchema, LoginInput } from '@/lib/validations'
import { loginAction } from '@/actions/auth'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    mode: 'onChange',
  })

  const onSubmit = async (data: LoginInput) => {
    setServerError(null)
    const result = await loginAction(data)
    if (!result.success && result.error) {
      setServerError(result.error)
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 py-12">
      {/* Background radial effects */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(40rem_40rem_at_50%_40%,theme(colors.zinc.900),theme(colors.zinc.950))]" />
      <div className="absolute top-10 left-1/2 -z-10 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[100px]" />

      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition duration-200">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <span className="font-semibold tracking-wider text-sm uppercase">The Gatekeeper</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Log in to your account</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Don't have an account?{' '}
            <Link href="/signup" id="link_to_signup" className="font-medium text-emerald-400 hover:underline">
              Register here
            </Link>
          </p>
        </div>

        {/* Card Form Wrapper */}
        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 backdrop-blur-xl shadow-xl shadow-black/50">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {/* Server Error Alert */}
            {serverError && (
              <div id="error_alert" className="flex items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{serverError}</p>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="input_email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Email Address
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="input_email"
                  type="email"
                  placeholder="name@example.com"
                  disabled={isSubmitting}
                  className={`block w-full rounded-xl border bg-zinc-950 py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 transition duration-200 ${
                    errors.email
                      ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-zinc-800 focus:border-emerald-500 focus:ring-emerald-500/20'
                  }`}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p id="error_email" className="mt-1.5 text-xs text-rose-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="input_password" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Password
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="input_password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={`block w-full rounded-xl border bg-zinc-950 py-3 pl-10 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 transition duration-200 ${
                    errors.password
                      ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-zinc-800 focus:border-emerald-500 focus:ring-emerald-500/20'
                  }`}
                  {...register('password')}
                />
                <button
                  id="btn_toggle_password"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 transition duration-150"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="error_password" className="mt-1.5 text-xs text-rose-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              id="btn_login_submit"
              type="submit"
              disabled={isSubmitting || !isValid}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                isSubmitting || !isValid
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-zinc-950 hover:from-emerald-400 hover:to-teal-500 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Log In'
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
