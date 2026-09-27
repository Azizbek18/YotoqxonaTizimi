import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { isValidEmail } from '@/lib/permit-validation'
import { issueEmailChallenge, normalizeProofEmail } from '@/lib/email-proof'
import { sendEmailVerificationCode } from '@/lib/email'
import { domainAcceptsMail } from '@/lib/email-domain'

// Step 1 of email-ownership proof: mail a 6-digit code, hand the caller the
// signed challenge. Never reveals whether an account/permit uses the email.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null
  const email = normalizeProofEmail(body?.email)
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Email formati noto‘g‘ri.' }, { status: 400 })
  }

  // Reject a domain that can't receive mail at all before spending a real
  // Resend/SMTP send on it — doesn't count against the attempt limits below,
  // so a typo never eats into the budget for the correct retry.
  const domain = email.slice(email.lastIndexOf('@') + 1)
  if (!(await domainAcceptsMail(domain))) {
    return NextResponse.json(
      { error: 'Bu email domeni topilmadi. Manzilni tekshirib qayta kiriting (masalan @gmail.com to‘g‘ri yozilganiga ishonch hosil qiling).' },
      { status: 400 },
    )
  }

  const ip = getClientIp(request)
  const [byIp, byEmail] = await Promise.all([
    checkRateLimit(`email-proof-send:ip:${ip}`, 10, 15 * 60_000),
    checkRateLimit(`email-proof-send:email:${email}`, 3, 10 * 60_000),
  ])
  if (!byIp.allowed || !byEmail.allowed) {
    return NextResponse.json(
      { error: 'Kod juda ko‘p so‘raldi. Bir necha daqiqadan keyin qayta urinib ko‘ring.' },
      { status: 429 },
    )
  }

  const { code, challenge } = issueEmailChallenge(email)
  const sent = await sendEmailVerificationCode(email, code)
  if (!sent.ok) {
    if (process.env.NODE_ENV !== 'production') {
      // Local dev has no RESEND_API_KEY — surface the code so the flow is testable.
      console.info(`[email-proof] ${email} → ${code}`)
      return NextResponse.json({ challenge, devCode: code })
    }
    return NextResponse.json({ error: 'Kodni yuborib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.' }, { status: 502 })
  }
  return NextResponse.json({ challenge })
}
