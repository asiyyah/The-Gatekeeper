import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie')
  let token: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, curr) => {
      const parts = curr.trim().split('=')
      const key = parts[0]
      const value = parts.slice(1).join('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    token = cookies['session_token']
  }

  if (!token) {
    return NextResponse.json({ isValid: false }, { status: 401 })
  }

  try {
    const dbSession = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!dbSession) {
      return NextResponse.json({ isValid: false }, { status: 401 })
    }

    if (new Date() > dbSession.expiresAt) {
      // Session expired, remove it
      await prisma.session.delete({
        where: { token },
      }).catch(() => {})
      return NextResponse.json({ isValid: false }, { status: 401 })
    }

    return NextResponse.json({
      isValid: true,
      user: dbSession.user,
    })
  } catch (error) {
    console.error('Session validation error:', error)
    return NextResponse.json({ isValid: false }, { status: 500 })
  }
}
