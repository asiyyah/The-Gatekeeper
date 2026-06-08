import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('session_token')?.value

  let isAuthenticated = false

  if (sessionToken) {
    try {
      const validateUrl = new URL('/api/auth/validate-session', request.url)
      const res = await fetch(validateUrl, {
        headers: {
          cookie: `session_token=${sessionToken}`,
        },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        isAuthenticated = !!data.isValid
      }
    } catch (err) {
      console.error('Proxy session validation failed:', err)
    }
  }

  const isAuthRoute = pathname === '/login' || pathname === '/signup'
  const isProtectedRoute = pathname.startsWith('/dashboard')

  // Redirect unauthenticated users trying to access dashboard -> /login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users trying to access login/signup -> /dashboard
  if (isAuthRoute && isAuthenticated) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
}
