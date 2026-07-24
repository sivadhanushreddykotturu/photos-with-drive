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

// ---------------------------------------------------------------------------
// Branded template shared by all transactional mail
// ---------------------------------------------------------------------------

type EmailTemplateOptions = {
  heading: string
  body: string
  code?: string
  footerNote?: string
}

function renderEmailTemplate({ heading, body, code, footerNote }: EmailTemplateOptions) {
  const codeBlock = code
    ? `<div style="margin:28px 0;padding:18px 24px;text-align:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;">
        <span style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#67e8f9;">${code}</span>
      </div>`
    : ''

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0B1026;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#131a3a;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px 32px;">
      <p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#67e8f9;">PHOTODRIVE</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#ffffff;">${heading}</h1>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#aab3d0;">${body}</p>
      ${codeBlock}
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#5f6b94;">${footerNote ?? 'If you did not request this, you can safely ignore this email.'}</p>
    </div>
    <p style="max-width:480px;margin:14px auto 0;text-align:center;font-size:11px;color:#465180;">Your photos stay in your drives — PhotoDrive is just the window.</p>
  </body>
</html>`
}

export async function sendLoginOtpEmail(to: string, code: string) {
  await sendEmail(
    to,
    `${code} is your PhotoDrive sign-in code`,
    renderEmailTemplate({
      heading: 'Your sign-in code',
      body: 'Enter this 6-digit code to sign in. It expires in <b>10 minutes</b>.',
      code,
    }),
  )
}

export async function sendVerificationEmail(to: string, code: string) {
  await sendEmail(
    to,
    `${code} — confirm your PhotoDrive account`,
    renderEmailTemplate({
      heading: 'Confirm your email',
      body: 'Welcome! Enter this 6-digit code to confirm your email and activate your account. It expires in <b>10 minutes</b>.',
      code,
    }),
  )
}

export async function sendPasswordResetEmail(to: string, code: string) {
  await sendEmail(
    to,
    `${code} — reset your PhotoDrive password`,
    renderEmailTemplate({
      heading: 'Reset your password',
      body: 'Enter this 6-digit code along with your new password. It expires in <b>10 minutes</b>.',
      code,
    }),
  )
}
