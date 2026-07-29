import { describe, expect, it } from 'vitest'
import { findRoleByIdentity } from './auth-tables'

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
