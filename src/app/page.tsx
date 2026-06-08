import Link from 'next/link'
import { ShieldCheck, Lock, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 py-12 md:py-24">
      {/* Background glow effects */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_50%_30%,theme(colors.zinc.900),theme(colors.zinc.950))]" />
      <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px] md:h-[600px] md:w-[600px]" />
      <div className="absolute top-1/4 left-1/3 -z-10 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[100px]" />

      <div className="w-full max-w-xl text-center">
        {/* Shield Icon Decoration */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/40">
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
          The <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">Gatekeeper</span>
        </h1>

        {/* Hero Description */}
        <p className="mt-6 text-lg leading-8 text-zinc-400">
          Behind this door lies user accounts, settings, personal data, and private work.
          A production-quality security system featuring database-backed session management, password strength verification, and route protection.
        </p>

        {/* Glassmorphic Portal Entry Card */}
        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 text-left">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Security Status</h2>
              <p className="text-xs text-zinc-500">All systems operational</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Secure
            </span>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            {/* Log In Button */}
            <Link
              id="btn_login_home"
              href="/login"
              className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 py-3 text-center text-sm font-medium text-white shadow-sm transition duration-200 hover:bg-zinc-700 hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600"
            >
              Log In
            </Link>

            {/* Sign Up Button */}
            <Link
              id="btn_signup_home"
              href="/signup"
              className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-center text-sm font-semibold text-zinc-950 shadow-md transition duration-200 hover:from-emerald-400 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              Sign Up
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="mt-12 flex items-center justify-center gap-2 text-xs text-zinc-600">
          <Lock className="h-3.5 w-3.5" />
          <span>Encrypted with SHA-256 & bcryptjs</span>
        </div>
      </div>
    </main>
  )
}
