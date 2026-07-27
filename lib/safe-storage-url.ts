import 'server-only'

const LEGACY_PUBLIC_PREFIX = '/storage/v1/object/public/receipts/'

// Receipt rows store either a bare storage object path (current format,
// since the `receipts` bucket became private) or a legacy
// `https://.../object/public/receipts/...` URL from before that change.
// Both are normalized to a path and required to fall under `studentId`'s
// own folder, so a malformed/forged value can't point at another
// student's object.
export function extractReceiptPath(value: unknown, studentId: string): string | null {
  if (typeof value !== 'string' || !value) return null
  const requiredPrefix = `${studentId}/`

  if (/^https?:\/\//i.test(value)) {
    let target: URL
    try {
      target = new URL(value)
    } catch {
      return null
    }
    if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash) {
      return null
    }
    const idx = target.pathname.indexOf(LEGACY_PUBLIC_PREFIX)
    if (idx === -1) return null
    const path = decodeURIComponent(target.pathname.slice(idx + LEGACY_PUBLIC_PREFIX.length))
    return path.startsWith(requiredPrefix) ? path : null
  }

  return value.startsWith(requiredPrefix) ? value : null
}
