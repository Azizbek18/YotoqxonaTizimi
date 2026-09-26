import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { issueEmailProof, readEmailChallenge, verifyEmailChallenge } from '@/lib/email-proof'

// Step 2: exchange challenge + code for a short-lived proof token. Each
// challenge gets 5 guesses; sends are capped per email, so the 6-digit
// space can't be walked.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { challenge?: unknown; code?: unknown } | null
  const info = readEmailChallenge(body?.challenge)
  if (!info) return NextResponse.json({ error: 'So‘rov noto‘g‘ri.' }, { status: 400 })
  if (info.expired) {
    return NextResponse.json({ error: 'Kod muddati tugagan. Yangi kod so‘rang.', code: 'CODE_EXPIRED' }, { status: 400 })
  }

  const [byChallenge, byIp] = await Promise.all([
    checkRateLimit(`email-proof-verify:challenge:${info.nonce}`, 5, 15 * 60_000),
    checkRateLimit(`email-proof-verify:ip:${getClientIp(request)}`, 30, 15 * 60_000),
  ])
  if (!byChallenge.allowed || !byIp.allowed) {
    return NextResponse.json(
      { error: 'Urinishlar soni tugadi. Yangi kod so‘rang.', code: 'TOO_MANY_ATTEMPTS' },
      { status: 429 },
    )
  }

  const email = verifyEmailChallenge(body?.challenge, body?.code)
  if (!email) return NextResponse.json({ error: 'Kod noto‘g‘ri.' }, { status: 400 })
  return NextResponse.json({ email, ...issueEmailProof(email) })
}
