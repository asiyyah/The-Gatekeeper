import { cookies } from 'next/headers'
import crypto from 'crypto'
import { prisma } from './prisma'

const SESSION_COOKIE_NAME = '__Host-session_token'
const SESSION_EXPIRY_DAYS = 7

export async function createSession(userId: string) {
  // 1. Generate secure random token
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  // 2. Store session in database
  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  })

  // 3. Set HTTP-only secure cookie
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    expires: expiresAt,
    path: '/',
  })

  return token
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  // Look up session in DB and include user
  const dbSession = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
    },
  })

  if (!dbSession) {
    return null
  }

  // Check if session has expired
  if (new Date() > dbSession.expiresAt) {
    // Clean up expired session from DB
    await prisma.session.delete({
      where: { token },
    }).catch(() => {}) // Ignore errors if already deleted

    // Clear cookie
    cookieStore.delete(SESSION_COOKIE_NAME)
    return null
  }

  return {
    session: {
      id: dbSession.id,
      token: dbSession.token,
      expiresAt: dbSession.expiresAt,
    },
    user: dbSession.user,
  }
}

export async function deleteSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    // Delete session from DB
    await prisma.session.delete({
      where: { token },
    }).catch(() => {}) // Ignore errors if session was not found
  }

  // Always delete cookie
  cookieStore.delete(SESSION_COOKIE_NAME)
}
