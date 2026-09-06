import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { sendPermitBlockedEmail } from '@/lib/email'
import { notifyPermitBlockedTelegram } from '@/lib/permit-telegram'

const NOTIFY_THROTTLE_MS = 24 * 60 * 60 * 1000

/**
 * A blocked (rejected-twice) applicant tried to submit again. Deliver the
 * "university working group's final rejection" message via email + Telegram.
 *
 * Best-effort: every failure is swallowed — the caller still returns the 403.
 * Throttled to once per 24h per application (`permit_requests.block_notified_at`)
 * so a persistent resubmitter can't spam their own inbox / the bot.
 */
export async function notifyPermitBlocked(permitRequestId: string): Promise<void> {
  try {
    const supabase = getServiceSupabase()
    const { data: permit, error } = await supabase
      .from('permit_requests')
      .select('email, full_name, block_notified_at, blocked')
      .eq('id', permitRequestId)
      .maybeSingle()
    if (error || !permit || !permit.blocked) return

    if (permit.block_notified_at
      && Date.now() - new Date(permit.block_notified_at).getTime() < NOTIFY_THROTTLE_MS) {
      return
    }

    // Reserve the throttle slot first so two near-simultaneous attempts don't
    // both send. A send failure below just means the next attempt (>24h) retries.
    const { error: markError } = await supabase
      .from('permit_requests')
      .update({ block_notified_at: new Date().toISOString() })
      .eq('id', permitRequestId)
    if (markError) return

    await Promise.allSettled([
      sendPermitBlockedEmail(permit.email, permit.full_name),
      notifyPermitBlockedTelegram(permitRequestId),
    ])
  } catch (err) {
    console.error('notifyPermitBlocked failed:', err)
  }
}
