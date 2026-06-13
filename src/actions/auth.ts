'use server'

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession } from '@/lib/session'
import { sendPasswordResetEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'
import {
  SignUpSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  SignUpInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '@/lib/validations'

interface ActionResponse {
  success: boolean
  error?: string
}

export async function signupAction(data: SignUpInput): Promise<ActionResponse> {
  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown'
  const { allowed } = rateLimit(`signup:${ip}`, { max: 3, windowMs: 60 * 60 * 1000 })
  if (!allowed) {
    return { success: false, error: 'Too many registration attempts. Please try again later.' }
  }

  const validation = SignUpSchema.safeParse(data)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid registration details.',
    }
  }

  const { name, email, password } = validation.data

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return {
        success: false,
        error: 'An account with this email already exists.',
      }
    }

    // 3. Hash password
    const saltRounds = 8
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // 4. Create user in database
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      },
    })

    // 5. Create database session and set HTTP-only cookie
    await createSession(user.id)
  } catch (error: unknown) {
    console.error('Signup action error:', error)

    // Surface specific Prisma errors
    if (
      error instanceof Error &&
      'code' in error
    ) {
      const prismaError = error as Error & { code: string }

      // Unique constraint violation (e.g. email already exists — race condition)
      if (prismaError.code === 'P2002') {
        return {
          success: false,
          error: 'An account with this email already exists.',
        }
      }

      // Connection errors
      if (prismaError.code === 'P1001' || prismaError.code === 'P1002') {
        return {
          success: false,
          error: 'Unable to connect to the database. Please try again later.',
        }
      }
    }

    return {
      success: false,
      error: 'An unexpected error occurred during registration. Please try again.',
    }
  }

  // 6. Redirect to dashboard (outside try-catch block to allow redirect exception to propagate)
  redirect('/dashboard')
}

const DUMMY_HASH = '$2b$08$000000000000000000000000000000000000000000000'

export async function loginAction(data: LoginInput): Promise<ActionResponse> {
  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown'
  const { allowed } = rateLimit(`login:${ip}`, { max: 5, windowMs: 60 * 1000 })
  if (!allowed) {
    return { success: false, error: 'Too many login attempts. Please try again later.' }
  }

  const validation = LoginSchema.safeParse(data)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid login details.',
    }
  }

  const { email, password } = validation.data

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH)
      return {
        success: false,
        error: 'Invalid email or password.',
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Invalid email or password.',
      }
    }

    await createSession(user.id)
  } catch (error: unknown) {
    console.error('Login action error:', error)

    // Surface specific Prisma errors
    if (
      error instanceof Error &&
      'code' in error
    ) {
      const prismaError = error as Error & { code: string }

      // Connection errors
      if (prismaError.code === 'P1001' || prismaError.code === 'P1002') {
        return {
          success: false,
          error: 'Unable to connect to the database. Please try again later.',
        }
      }
    }

    return {
      success: false,
      error: 'An unexpected error occurred during login. Please try again.',
    }
  }

  // 5. Redirect to dashboard
  redirect('/dashboard')
}

export async function forgotPasswordAction(data: ForgotPasswordInput): Promise<ActionResponse> {
  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown'
  const { allowed } = rateLimit(`forgot-password:${ip}`, { max: 3, windowMs: 60 * 60 * 1000 })
  if (!allowed) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  const validation = ForgotPasswordSchema.safeParse(data)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid email address.',
    }
  }

  const { email } = validation.data

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (user) {
      await prisma.resetToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { expiresAt: new Date(0) },
      })

      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

      await prisma.resetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      })

      const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`
      await sendPasswordResetEmail(email, resetLink)
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  } catch (error) {
    console.error('Forgot password action error:', error)

    if (error instanceof Error && 'code' in error) {
      const prismaError = error as Error & { code: string }
      if (prismaError.code === 'P1001' || prismaError.code === 'P1002') {
        return {
          success: false,
          error: 'Unable to connect to the database. Please try again later.',
        }
      }
    }
  }

  return {
    success: true,
    error: undefined,
  }
}

export async function resetPasswordAction(data: ResetPasswordInput): Promise<ActionResponse> {
  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown'
  const { allowed } = rateLimit(`reset-password:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 })
  if (!allowed) {
    return { success: false, error: 'Too many attempts. Please try again later.' }
  }

  const validation = ResetPasswordSchema.safeParse(data)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid password.',
    }
  }

  const { token, password } = validation.data

  try {
    const resetToken = await prisma.resetToken.findUnique({
      where: { token },
    })

    if (!resetToken) {
      return {
        success: false,
        error: 'Invalid or expired reset link. Please request a new one.',
      }
    }

    if (resetToken.usedAt) {
      return {
        success: false,
        error: 'This reset link has already been used. Please request a new one.',
      }
    }

    if (new Date() > resetToken.expiresAt) {
      return {
        success: false,
        error: 'This reset link has expired. Please request a new one.',
      }
    }

    const hashedPassword = await bcrypt.hash(password, 8)

    await prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    }).catch(() => {})

    const [user] = await Promise.all([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.resetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    await createSession(user.id)
  } catch (error: unknown) {
    console.error('Reset password action error:', error)

    if (error instanceof Error && 'code' in error) {
      const prismaError = error as Error & { code: string }
      if (prismaError.code === 'P1001' || prismaError.code === 'P1002') {
        return {
          success: false,
          error: 'Unable to connect to the database. Please try again later.',
        }
      }
    }

    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }

  redirect('/dashboard')
}

export async function logoutAction(): Promise<void> {
  try {
    // Destroy DB session and clear cookie
    await deleteSession()
  } catch (error) {
    console.error('Logout action error:', error)
  }

  // Redirect to landing page
  redirect('/')
}
