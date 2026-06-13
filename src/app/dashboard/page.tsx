import { redirect } from 'next/navigation'
import { ShieldCheck, LogOut, User, Mail, Calendar } from 'lucide-react'
import { getSession } from '@/lib/session'
import { logoutAction } from '@/actions/auth'

export default async function DashboardPage() {
  // Retrieve session server-side
  const sessionData = await getSession()

  // Fallback protection if middleware was bypassed
  if (!sessionData) {
    redirect('/login')
  }

  const { user } = sessionData

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <main className="relative flex min-h-screen flex-col bg-zinc-950 text-white">
      {/* Background glow effects */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_50rem_at_50%_0%,theme(colors.zinc.900),theme(colors.zinc.950))]" />
      <div className="absolute top-0 right-1/4 -z-10 h-[350px] w-[350px] rounded-full bg-emerald-500/5 blur-[120px]" />
      <div className="absolute top-0 left-1/4 -z-10 h-[350px] w-[350px] rounded-full bg-blue-500/5 blur-[120px]" />

      {/* Navigation Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <span className="text-sm font-semibold tracking-wider uppercase text-zinc-200">The Gatekeeper</span>
          </div>
          <form action={logoutAction}>
            <button
              id="btn_logout_header"
              type="submit"
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-400 transition duration-200 hover:bg-zinc-800 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
        <div className="max-w-3xl">
          {/* Welcome Title */}
          <h1 id="welcome_message" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Welcome back, {user.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            You are securely logged into your dashboard. This page is protected by database session validation.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* User Profile Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-xl">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Profile Details</h2>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800">
                    <User className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Full Name</p>
                    <p className="text-sm font-medium text-white">{user.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800">
                    <Mail className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Email Address</p>
                    <p className="text-sm font-medium text-white">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800">
                    <Calendar className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Registered On</p>
                    <p className="text-sm font-medium text-white">{memberSince}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
