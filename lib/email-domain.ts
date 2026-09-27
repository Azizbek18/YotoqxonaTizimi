import 'server-only'
import { resolveMx, resolve4 } from 'node:dns/promises'

// A quick, free check that an email's domain can receive mail at all — no
// third-party API, just DNS. Meant to stop a real Resend/SMTP send (a paid,
// quota-limited resource) from being burned on a mistyped domain
// ("gmial.com", "gmail.con") before we ever try.
//
// This only proves the DOMAIN exists and accepts mail, never that a specific
// mailbox does — Gmail et al. don't allow verifying that without actually
// sending. It stays deliberately fail-open: any DNS error other than a
// confirmed "no such domain" is treated as acceptable, so a resolver hiccup
// never blocks a real applicant.
function isNotFound(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code
  return code === 'ENOTFOUND' || code === 'ENODATA'
}

export async function domainAcceptsMail(domain: string): Promise<boolean> {
  if (!domain) return false
  try {
    const records = await resolveMx(domain)
    if (records.length > 0) return true
  } catch (error) {
    if (!isNotFound(error)) return true
  }
  // No MX — some domains still take mail via a bare A record (RFC 5321
  // fallback). Only a confirmed missing domain fails the check.
  try {
    const records = await resolve4(domain)
    return records.length > 0
  } catch (error) {
    return !isNotFound(error)
  }
}
