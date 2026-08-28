import 'server-only'
import { createHash, randomInt } from 'crypto'

// No-ambiguity alphabet: no 0/O, 1/I/L, so a code read aloud or copied by
// hand doesn't get mistyped.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** A fresh invite code, formatted XXXX-XXXX-XXXX for readability. */
export function generateInviteCode(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`
}

/** Strip formatting and case so "ami7-k2m9-xqp8" and "AMI7K2M9XQP8" hash the same. */
export function normalizeInviteCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** sha256 hex of the normalized code — only this is ever stored. */
export function hashInviteCode(code: string): string {
  return createHash('sha256').update(normalizeInviteCode(code)).digest('hex')
}
