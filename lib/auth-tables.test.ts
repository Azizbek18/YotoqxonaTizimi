import { describe, expect, it, vi } from 'vitest'
import { findRoleByIdentity, getClaimsIdentity } from './auth-tables'

function clientWithStudent(status: string) {
  const result = { data: { role: 'talaba', status } }
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
  }
  return {
    from: (table: string) => table === 'users'
      ? builder
      : {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        },
  }
}

describe('student role resolution', () => {
  it.each(['pending', 'rejected', 'inactive'])('does not authorize %s students', async (status) => {
    const role = await findRoleByIdentity(
      clientWithStudent(status) as never,
      { id: 'student-id' },
    )
    expect(role).toBeNull()
  })

  it('authorizes only an active student', async () => {
    const role = await findRoleByIdentity(
      clientWithStudent('active') as never,
      { id: 'student-id' },
    )
    expect(role).toBe('talaba')
  })
})

describe('getClaimsIdentity', () => {
  const clientWith = (getClaims: () => unknown) =>
    ({ auth: { getClaims } }) as never

  it('returns the id and email from verified claims', async () => {
    const getClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'a@b.c' } },
      error: null,
    })
    expect(await getClaimsIdentity(clientWith(getClaims))).toEqual({ id: 'user-1', email: 'a@b.c' })
  })

  it('tolerates a claim set with no email', async () => {
    const getClaims = vi.fn().mockResolvedValue({
      data: { claims: { sub: 'user-2' } },
      error: null,
    })
    expect(await getClaimsIdentity(clientWith(getClaims))).toEqual({ id: 'user-2', email: null })
  })

  it('returns null when there is no session', async () => {
    const getClaims = vi.fn().mockResolvedValue({ data: null, error: null })
    expect(await getClaimsIdentity(clientWith(getClaims))).toBeNull()
  })

  it('returns null on a verification error', async () => {
    const getClaims = vi.fn().mockResolvedValue({ data: null, error: { message: 'invalid JWT' } })
    expect(await getClaimsIdentity(clientWith(getClaims))).toBeNull()
  })

  it('returns null when claims carry no sub', async () => {
    const getClaims = vi.fn().mockResolvedValue({ data: { claims: { email: 'a@b.c' } }, error: null })
    expect(await getClaimsIdentity(clientWith(getClaims))).toBeNull()
  })
})
