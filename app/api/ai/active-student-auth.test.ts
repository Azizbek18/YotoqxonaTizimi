import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const protectedRoutes = [
  new URL('./chat/route.ts', import.meta.url),
  new URL('./photo-check/route.ts', import.meta.url),
  new URL('./tekshiruv/route.ts', import.meta.url),
]

describe('student AI endpoint authorization', () => {
  it.each(protectedRoutes)('requires an active student in %s', (route) => {
    const source = readFileSync(route, 'utf8')
    expect(source).toContain('requireActiveStudent(req)')
    expect(source).not.toContain('getRequestUser(req)')
  })
})
