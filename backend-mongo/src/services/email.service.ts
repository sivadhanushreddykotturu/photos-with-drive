import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

async function sendWithBrevo(to: string, subject: string, html: string) {
  const senderEmail = env.EMAIL_FROM.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? env.EMAIL_FROM
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: 'PhotoDrive' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Brevo API failed with status ${response.status}: ${body}`)
  }
}

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
  if (env.BREVO_API_KEY) return sendWithBrevo(to, subject, html)
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

export async function sendLoginOtpEmail(to: string, code: string) {
  const html = `
    <p>Your PhotoDrive sign-in code:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;font-family:monospace">${code}</p>
    <p>It expires in 10 minutes. If you didn't try to sign in, you can ignore this email.</p>
  `
  await sendEmail(to, `${code} is your PhotoDrive sign-in code`, html)
}
