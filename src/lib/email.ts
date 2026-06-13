const FROM_NAME = 'The Gatekeeper'
const FROM_EMAIL = 'noreply@gatekeeper.demo'

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const subject = 'Reset Your Password — The Gatekeeper'
  const body = [
    `We received a request to reset the password for your account (${email}).`,
    '',
    `Click the link below to reset your password. This link expires in 1 hour.`,
    '',
    resetLink,
    '',
    'If you did not request a password reset, you can safely ignore this email.',
    '',
    '— The Gatekeeper Security Team',
  ].join('\n')

  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with a real email service (Resend, SendGrid, etc.)
    // Example with Resend:
    // await resend.emails.send({
    //   from: `${FROM_NAME} <${FROM_EMAIL}>`,
    //   to: email,
    //   subject,
    //   text: body,
    // })
    console.log(`[EMAIL] To: ${email} | Subject: ${subject}`)
    console.log(`[EMAIL] Body:\n${body}`)
    return
  }

  console.log('='.repeat(60))
  console.log(`  PASSWORD RESET LINK — ${email}`)
  console.log('='.repeat(60))
  console.log(`  ${resetLink}`)
  console.log('='.repeat(60))
}
