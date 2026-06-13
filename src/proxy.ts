import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('__Host-session_token')?.value

  let isAuthenticated = false

  if (sessionToken) {
    try {
      const validateUrl = new URL('/api/auth/validate-session', request.url)
      const res = await fetch(validateUrl, {
        headers: {
          cookie: `__Host-session_token=${sessionToken}`,
          'x-internal-request': 'true',
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

  const isGuestRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'
  const isProtectedRoute = pathname.startsWith('/dashboard')

  // Redirect unauthenticated users trying to access dashboard -> /login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users trying to access guest-only pages -> /dashboard
  if (isGuestRoute && isAuthenticated) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/forgot-password', '/reset-password'],
}
