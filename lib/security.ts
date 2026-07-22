import 'server-only'
import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

type RateRecord = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateRecord>()
const RATE_LIMIT_PREFIX = 'mtalaba:ratelimit:'
const MAX_LOCAL_RATE_LIMIT_KEYS = 10_000

function pruneLocalBuckets(now: number) {
  if (buckets.size < MAX_LOCAL_RATE_LIMIT_KEYS) return
  for (const [key, record] of buckets) {
    if (record.resetAt <= now) buckets.delete(key)
  }
  while (buckets.size >= MAX_LOCAL_RATE_LIMIT_KEYS) {
    const oldestKey = buckets.keys().next().value as string | undefined
    if (!oldestKey) break
    buckets.delete(oldestKey)
  }
}

export function safeEqual(a: string | undefined, b: string | undefined) {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function getClientIp(request: Request | NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

async function checkDistributedRateLimit(key: string, limit: number, windowMs: number) {
  const url = process.env.RATE_LIMIT_REDIS_REST_URL?.replace(/\/$/, '')
  const token = process.env.RATE_LIMIT_REDIS_REST_TOKEN
  if (!url || !token) return null

  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', `${RATE_LIMIT_PREFIX}${key}`],
      ['PEXPIRE', `${RATE_LIMIT_PREFIX}${key}`, windowMs, 'NX'],
    ]),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Rate limit store returned ${response.status}`)
  const result = await response.json() as Array<{ result?: number }>
  const count = Number(result[0]?.result ?? limit + 1)
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  try {
    const distributed = await checkDistributedRateLimit(key, limit, windowMs)
    if (distributed) return distributed
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.error('Distributed rate limiter unavailable:', error)
      return { allowed: false, remaining: 0 }
    }
  }

  const now = Date.now()
  pruneLocalBuckets(now)
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  existing.count += 1
  buckets.set(key, existing)
  return { allowed: true, remaining: limit - existing.count }
}
