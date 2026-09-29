import { Resend } from "resend"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL ?? "Kinsa <onboarding@resend.dev>"
}

export function renderTemplate(
  template: string,
  values: Record<string, string>
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? "")
}

export async function sendInviteEmail(input: {
  to: string
  workerName: string
  organisationName: string
  inviteUrl: string
}) {
  const resend = getResend()
  if (!resend) return
  await resend.emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `You're invited to ${input.organisationName} on Kinsa`,
    text: `Hello ${input.workerName},\n\n${input.organisationName} invited you to view your staff compliance record in Kinsa.\n\nAccept the invite: ${input.inviteUrl}\n`,
  })
}

export async function sendReminderEmail(input: {
  to: string
  subject: string
  body: string
}) {
  const resend = getResend()
  if (!resend) {
    return { sent: false as const, reason: "RESEND_API_KEY is not configured" }
  }
  await resend.emails.send({
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    text: input.body,
  })
  return { sent: true as const }
}
