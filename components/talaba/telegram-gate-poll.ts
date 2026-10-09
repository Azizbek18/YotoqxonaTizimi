// Poll schedule for the "link the Telegram bot" gate. A blocked student can sit
// on that dialog for a long time, and every status check is a full serverless
// invocation (auth + DB lookups) on a tight compute budget — so back off
// instead of hitting the server every few seconds forever. Coming back from
// Telegram fires `focus` / `visibilitychange`, which re-checks immediately and
// resets the schedule, so a student who just pressed START is never kept waiting.
export const GATE_POLL_FIRST_MS = 30_000
export const GATE_POLL_MAX_MS = 180_000

/** Delay before the next status check after `attempt` checks without a link (0-based). */
export function gatePollDelay(attempt: number): number {
  const safe = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0
  return Math.min(GATE_POLL_FIRST_MS * 2 ** safe, GATE_POLL_MAX_MS)
}

// A student who is already linked stays linked, yet every full page load used to
// ask the server again (a serverless call that also re-issues a deep link). Remember
// "linked" per account for a few hours and skip that call. Worst case — someone
// unlinks the bot — the gate reappears after the TTL instead of instantly.
export const LINKED_FLAG_TTL_MS = 6 * 60 * 60_000

type FlagStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const linkedFlagKey = (userId: string) => `tg-linked:${userId}`

export function readLinkedFlag(storage: FlagStorage | null, userId: string, now = Date.now()): boolean {
  if (!storage) return false
  try {
    const raw = storage.getItem(linkedFlagKey(userId))
    const at = raw ? Number(raw) : NaN
    if (Number.isFinite(at) && now - at >= 0 && now - at < LINKED_FLAG_TTL_MS) return true
    if (raw) storage.removeItem(linkedFlagKey(userId))
  } catch { /* storage blocked: just ask the server */ }
  return false
}

export function writeLinkedFlag(storage: FlagStorage | null, userId: string, now = Date.now()) {
  try { storage?.setItem(linkedFlagKey(userId), String(now)) } catch { /* ignore */ }
}
