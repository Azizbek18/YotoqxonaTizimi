// Toshkent vaqti — UTC+5, yil bo'yi o'zgarmas (DST yo'q). Yo'qlama oynasi
// dorms jadvalida mahalliy `time` sifatida saqlanadi; cron va sessiya
// yopilishi shu yerdagi yordamchilar orqali hisoblanadi.

const TASHKENT_OFFSET_MINUTES = 5 * 60

/**
 * A Date whose UTC fields spell out Toshkent wall-clock time. Read it with
 * `.getUTCHours()` / `.getUTCDate()` etc. — never `.getHours()`.
 */
export function tashkentNow(base: Date = new Date()): Date {
  return new Date(base.getTime() + TASHKENT_OFFSET_MINUTES * 60_000)
}

/** Toshkent calendar date, `YYYY-MM-DD`. */
export function tashkentDateString(base: Date = new Date()): string {
  return tashkentNow(base).toISOString().slice(0, 10)
}

/** Minutes past midnight, Toshkent. */
export function tashkentMinutesOfDay(base: Date = new Date()): number {
  const t = tashkentNow(base)
  return t.getUTCHours() * 60 + t.getUTCMinutes()
}

function parseHm(hm: string): number {
  const [h = '0', m = '0'] = String(hm).split(':')
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

/**
 * True when Toshkent now is inside [openTime, closeTime). A window whose
 * close is not after its open (e.g. 23:00 → 01:00) is treated as crossing
 * midnight.
 */
export function isWithinAttendanceWindow(
  openTime: string,
  closeTime: string,
  base: Date = new Date(),
): boolean {
  const now = tashkentMinutesOfDay(base)
  const open = parseHm(openTime)
  const close = parseHm(closeTime)
  return close > open ? now >= open && now < close : now >= open || now < close
}

/**
 * True only in the first `graceMinutes` of the window — the cron uses this to
 * open the nightly session and fire the "yo'qlama boshlandi" push exactly
 * once per night, however often it runs.
 */
export function attendanceWindowJustOpened(
  openTime: string,
  base: Date = new Date(),
  graceMinutes = 20,
): boolean {
  const now = tashkentMinutesOfDay(base)
  const open = parseHm(openTime)
  return now >= open && now < open + graceMinutes
}

/** The UTC instant for a Toshkent calendar date at a Toshkent wall-clock time. */
export function tashkentInstant(dateStr: string, timeStr: string): Date {
  const [h = '0', m = '0'] = String(timeStr).split(':')
  const hh = String(Number(h) || 0).padStart(2, '0')
  const mm = String(Number(m) || 0).padStart(2, '0')
  return new Date(`${dateStr}T${hh}:${mm}:00+05:00`)
}

/**
 * When a session opened on `scheduledFor` (Toshkent date) should auto-close.
 * If the close time is not after the open time, it lands on the next day.
 */
export function attendanceClosesAt(
  scheduledFor: string,
  openTime: string,
  closeTime: string,
): Date {
  const crossesMidnight = parseHm(closeTime) <= parseHm(openTime)
  const dateStr = crossesMidnight
    ? tashkentDateString(new Date(tashkentInstant(scheduledFor, '12:00').getTime() + 24 * 60 * 60_000))
    : scheduledFor
  return tashkentInstant(dateStr, closeTime)
}
