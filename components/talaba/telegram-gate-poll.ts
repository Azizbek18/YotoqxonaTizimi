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
