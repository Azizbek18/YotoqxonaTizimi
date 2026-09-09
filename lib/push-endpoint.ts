// Only browser push services may receive server-side push requests. Never
// accept arbitrary HTTPS URLs: subscriptions are supplied by the client.
const PUSH_HOSTS = ['fcm.googleapis.com']
const PUSH_DOMAINS = ['push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

export function getSafePushEndpoint(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\\]/.test(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null
    const allowed = PUSH_HOSTS.includes(url.hostname)
      || PUSH_DOMAINS.some((domain) => url.hostname.endsWith(`.${domain}`))
    // Pass the canonical URL to web-push as well, so its legacy URL parser
    // cannot interpret an untrusted input differently from this validator.
    return allowed ? url.href : null
  } catch {
    return null
  }
}
