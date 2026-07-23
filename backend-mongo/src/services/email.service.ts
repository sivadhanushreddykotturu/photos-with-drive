import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

async function sendWithResend(to: string, subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
  })
  if (!response.ok) {
    throw new Error(`Resend API failed with status ${response.status}`)
  }
}

async function sendWithSmtp(to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
  await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html })
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (env.RESEND_API_KEY) return sendWithResend(to, subject, html)
  if (env.SMTP_HOST) return sendWithSmtp(to, subject, html)
  // Dev fallback: no provider configured — log instead of sending.
  console.log(`[email:dev] To: ${to} | Subject: ${subject}\n${html}`)
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = `
    <p>You requested a password reset.</p>
    <p><a href="${resetUrl}">Click here to reset your password</a></p>
    <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
  `
  await sendEmail(to, 'Reset your password', html)
}
