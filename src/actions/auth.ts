'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession } from '@/lib/session'
import { SignUpSchema, LoginSchema, SignUpInput, LoginInput } from '@/lib/validations'

interface ActionResponse {
  success: boolean
  error?: string
}

export async function signupAction(data: SignUpInput): Promise<ActionResponse> {
  // 1. Server-side validation
  const validation = SignUpSchema.safeParse(data)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid registration details.',
    }
  }

  const { name, email, password } = validation.data

  try {
    // 2. Check if email is unique
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
    const saltRounds = 10
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
  } catch (error) {
    console.error('Signup action error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during registration. Please try again.',
    }
  }

  // 6. Redirect to dashboard (outside try-catch block to allow redirect exception to propagate)
  redirect('/dashboard')
}

export async function loginAction(data: LoginInput): Promise<ActionResponse> {
  // 1. Server-side validation
  const validation = LoginSchema.safeParse(data)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid login details.',
    }
  }

  const { email, password } = validation.data

  try {
    // 2. Retrieve user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      // Generic error message to prevent account discovery
      return {
        success: false,
        error: 'Invalid email or password.',
      }
    }

    // 3. Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Invalid email or password.',
      }
    }

    // 4. Create database session and set HTTP-only cookie
    await createSession(user.id)
  } catch (error) {
    console.error('Login action error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during login. Please try again.',
    }
  }

  // 5. Redirect to dashboard
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
