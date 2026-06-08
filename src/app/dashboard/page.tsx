import { redirect } from 'next/navigation'
import { ShieldCheck, LogOut, User, Mail, Calendar, Key } from 'lucide-react'
import { getSession } from '@/lib/session'
import { logoutAction } from '@/actions/auth'

export default async function DashboardPage() {
  // Retrieve session server-side
  const sessionData = await getSession()

  // Fallback protection if middleware was bypassed
  if (!sessionData) {
    redirect('/login')
  }

  const { user, session } = sessionData

  // Format creation date
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Format session expiration
  const sessionExpires = new Date(session.expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
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

            {/* Session Information Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-xl">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Session Diagnostics</h2>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800">
                    <Key className="h-5 w-5 text-teal-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-500">Session Token (Truncated)</p>
                    <p className="truncate text-sm font-mono text-zinc-300">
                      {session.token.slice(0, 8)}...{session.token.slice(-8)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800">
                    <Calendar className="h-5 w-5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Session Expires</p>
                    <p className="text-sm font-medium text-white">{sessionExpires}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800 text-xs text-zinc-500">
                  <span className="font-semibold text-emerald-400">Security Note:</span> This session resides in the database and is verified server-side on every page load. The session cookie is protected with <code className="text-zinc-300">HttpOnly</code>, <code className="text-zinc-300">Secure</code>, and <code className="text-zinc-300">SameSite=Lax</code>.
                </div>
              </div>
            </div>
          </div>

          {/* Action Center Banner */}
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-gradient-to-r from-emerald-950/20 via-zinc-900/40 to-zinc-900/40 p-6 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-white">Need to close your session?</h3>
              <p className="text-xs text-zinc-400 mt-1">Logging out will delete the active session token from our database permanently.</p>
            </div>
            <form action={logoutAction}>
              <button
                id="btn_logout_dashboard"
                type="submit"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-zinc-800 border border-zinc-700 px-5 py-2.5 text-sm font-medium text-white transition duration-200 hover:bg-zinc-700 hover:border-zinc-600"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
