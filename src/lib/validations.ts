import { z } from 'zod'

export const SignUpSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters.' })
    .max(128, { message: 'Password must be at most 128 characters.' })
    .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter.' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number.' }),
})

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'Reset token is required.' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters.' })
    .max(128, { message: 'Password must be at most 128 characters.' })
    .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter.' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number.' }),
})

export type SignUpInput = z.infer<typeof SignUpSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
