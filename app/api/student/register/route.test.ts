import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const checkRateLimit = vi.fn()
const getServiceSupabase = vi.fn()
const createAuthUserSafely = vi.fn()
const deleteAuthUserSafely = vi.fn()
const findAuthUserByEmailSafely = vi.fn()
const isDuplicateAuthUserError = vi.fn((error: { code?: string } | null) => error?.code === 'email_exists')
const updateAuthUserPasswordSafely = vi.fn()
const revokeOtherUserSessions = vi.fn()

vi.mock('@/lib/security', () => ({
  checkRateLimit,
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/auth-devices', () => ({ revokeOtherUserSessions }))
vi.mock('@/lib/supabase-admin-auth', () => ({
  createAuthUserSafely,
  deleteAuthUserSafely,
  findAuthUserByEmailSafely,
  isDuplicateAuthUserError,
  updateAuthUserPasswordSafely,
}))

const { POST } = await import('./route')

const GOOD_PASSWORD = 'Abcdef123456!x'

// A tiny chainable stub. Every terminal (`maybeSingle`) pulls its canned
// result from `results[table]` (shift one per call).
function makeSupabase(
  results: Record<string, unknown[]>,
  capture: {
    userInsert?: Record<string, unknown>
    userUpdate?: Record<string, unknown>
    permitUpdate?: Record<string, unknown>
  } = {},
) {
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'order']) chain[m] = () => chain
    chain.maybeSingle = async () => (results[table]?.shift() ?? { data: null, error: null })
    chain.insert = async (row: Record<string, unknown>) => {
      if (table === 'users') capture.userInsert = row
      return results[`${table}:insert`]?.shift() ?? { error: null }
    }
    chain.update = (row: Record<string, unknown>) => {
      if (table === 'permit_requests') capture.permitUpdate = row
      if (table === 'users') capture.userUpdate = row
      return { eq: async () => results[`${table}:update`]?.shift() ?? { error: null } }
    }
    return chain
  }
  return { from: (t: string) => builder(t) }
}

function foreignBody(over: Record<string, unknown> = {}) {
  return {
    applicationType: 'imtiyozli',
    passportSeries: 'A1234567',
    jshshir: '',
    email: 'murat@example.com',
    password: GOOD_PASSWORD,
    lastName: 'Atayev',
    firstName: 'Murat',
    middleName: '',
    noMiddleName: true,
    phone: '+998901234567',
    father_phone: '+998901112233',
    mother_phone: '+998901112244',
    gender: 'male',
    faculty: 'AMIT',
    direction: 'Axborot tizimlari',
    course: 1,
    passportDate: '2005-01-01',
    birthDate: '2004-01-01',
    entryDate: '2026-08-01',
    ...over,
  }
}

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/student/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const APPROVED_FOREIGN_PERMIT = {
  data: {
    email: 'murat@example.com',
    full_name: 'Atayev Murat',
    gender: 'male',
    faculty: 'AMIT',
    direction: 'Axborot tizimlari',
    course: 1,
    room_number: '12',
    dorm_id: 'dorm-amit-1',
    status: 'approved',
    origin_country: 'Turkmaniston',
    origin_region: 'Dashoguz',
    study_type: 'grant',
    application_type: 'imtiyozli',
  },
  error: null,
}

describe('POST /api/student/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({ allowed: true })
    createAuthUserSafely.mockResolvedValue({ data: { user: { id: 'new-user-1' } }, error: null })
    findAuthUserByEmailSafely.mockResolvedValue({ user: null, error: null })
    updateAuthUserPasswordSafely.mockResolvedValue({ error: null })
    revokeOtherUserSessions.mockResolvedValue(0)
  })

  it('stale client hint: missing JSHSHIR still selects the foreign flow, bails at course', async () => {
    const response = await POST(req(foreignBody({ applicationType: 'yollanma', course: 0 })))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/Kurs yoki sana/i)
    expect(body.error).not.toMatch(/Otasining ismi|shaxsiy.*to‘liq emas/i)
  })

  it('rejects a weak password before any DB access', async () => {
    const response = await POST(req(foreignBody({ password: 'short' })))
    expect(response.status).toBe(400)
    expect(getServiceSupabase).not.toHaveBeenCalled()
    expect(createAuthUserSafely).not.toHaveBeenCalled()
  })

  it('imtiyozli happy path: uses the submitted password, carries origin into users', async () => {
    const capture: { userInsert?: Record<string, unknown> } = {}
    getServiceSupabase.mockReturnValue(
      makeSupabase(
        {
          permit_requests: [APPROVED_FOREIGN_PERMIT],
          users: [{ data: null, error: null }],
        },
        capture,
      ),
    )

    const response = await POST(req(foreignBody()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(createAuthUserSafely).toHaveBeenCalledWith('murat@example.com', GOOD_PASSWORD, expect.objectContaining({ role: 'talaba' }))
    expect(capture.userInsert).toMatchObject({
      country: 'Turkmaniston',
      region: 'Dashoguz',
      district: null,
      mahalla: null,
      jshshir: null,
      study_type: 'grant',
      status: 'pending',
      room_number: '12',
      dorm_id: 'dorm-amit-1',
      phone_number: '+998901234567',
    })
  })

  it('blocked-layout dorm: trusts permit.assigned_floor instead of re-querying floor_room_layout', async () => {
    // Regression for the bug found investigating cross-gender rooming in a
    // blocked-layout dorm: room numbers repeat on every floor of every
    // block, so a floor_room_layout lookup scoped to just room_number +
    // dorm_id + block still matches every floor and is ambiguous.
    // assign_permit_room_atomic already resolves and stores the real floor
    // on the permit at assignment time, so the route must trust that value
    // instead of re-deriving it.
    const capture: { userInsert?: Record<string, unknown> } = {}
    getServiceSupabase.mockReturnValue(
      makeSupabase(
        {
          permit_requests: [{
            data: { ...APPROVED_FOREIGN_PERMIT.data, room_number: '2', block: 'A', assigned_floor: 12 },
            error: null,
          }],
          users: [{ data: null, error: null }],
        },
        capture,
      ),
    )

    const response = await POST(req(foreignBody()))

    expect(response.status).toBe(200)
    expect(capture.userInsert).toMatchObject({
      room_number: '2',
      block: 'A',
      assigned_floor: 12,
    })
  })

  it('blocked-layout dorm: an ambiguous floor_room_layout match (multiple floors share the room number) does not 500 when permit.assigned_floor is trusted', async () => {
    // Regression for the exact prod failure: floor_room_layout.maybeSingle()
    // errors (PGRST116) when more than one row matches. That table is never
    // even queried once permit.assigned_floor is present.
    const capture: { userInsert?: Record<string, unknown> } = {}
    const layoutQuery = vi.fn()
    getServiceSupabase.mockReturnValue({
      from: (table: string) => {
        if (table === 'floor_room_layout') {
          layoutQuery()
          throw new Error('floor_room_layout should not be queried when permit.assigned_floor is set')
        }
        return makeSupabase(
          {
            permit_requests: [{
              data: { ...APPROVED_FOREIGN_PERMIT.data, room_number: '3', block: 'A', assigned_floor: 11 },
              error: null,
            }],
            users: [{ data: null, error: null }],
          },
          capture,
        ).from(table)
      },
    })

    const response = await POST(req(foreignBody()))

    expect(response.status).toBe(200)
    expect(layoutQuery).not.toHaveBeenCalled()
    expect(capture.userInsert).toMatchObject({ room_number: '3', block: 'A', assigned_floor: 11 })
  })

  it('simple-layout dorm: no floor_room_layout row falls back to the rooms-per-floor formula', async () => {
    const capture: { userInsert?: Record<string, unknown> } = {}
    getServiceSupabase.mockReturnValue(
      makeSupabase(
        { permit_requests: [APPROVED_FOREIGN_PERMIT], users: [{ data: null, error: null }] },
        capture,
      ),
    )

    const response = await POST(req(foreignBody()))

    expect(response.status).toBe(200)
    expect(capture.userInsert).toMatchObject({ room_number: '12', block: null, assigned_floor: 1 })
  })

  it('keeps a foreign (+993) phone number instead of forcing +998', async () => {
    const capture: { userInsert?: Record<string, unknown> } = {}
    getServiceSupabase.mockReturnValue(
      makeSupabase(
        { permit_requests: [APPROVED_FOREIGN_PERMIT], users: [{ data: null, error: null }] },
        capture,
      ),
    )

    const response = await POST(req(foreignBody({
      phone: '+99365123456', father_phone: '+99365111111', mother_phone: '99365222222',
    })))

    expect(response.status).toBe(200)
    expect(capture.userInsert).toMatchObject({
      phone_number: '+99365123456',
      father_phone: '+99365111111',
      mother_phone: '+99365222222',
    })
  })

  it('rejects a phone that is too short', async () => {
    getServiceSupabase.mockReturnValue(
      makeSupabase({ permit_requests: [APPROVED_FOREIGN_PERMIT] }),
    )
    const response = await POST(req(foreignBody({ phone: '12345' })))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/shaxsiy va ta.lim/i)
  })

  it('absent father: no father phone/workplace required, marker stored, mother is the contact', async () => {
    const capture: { userInsert?: Record<string, unknown> } = {}
    getServiceSupabase.mockReturnValue(
      makeSupabase(
        { permit_requests: [APPROVED_FOREIGN_PERMIT], users: [{ data: null, error: null }] },
        capture,
      ),
    )

    const response = await POST(req(foreignBody({
      noFather: true, father_phone: '', father_workplace: '', father_full_name: '',
      mother_phone: '+998901112244',
    })))

    expect(response.status).toBe(200)
    expect(capture.userInsert).toMatchObject({
      father_phone: null,
      father_workplace: "Vafot etgan yoki aloqa yo'q",
      mother_phone: '+998901112244',
    })
  })

  it('both parents absent → accepted, both markers stored, no parent phones', async () => {
    const capture: { userInsert?: Record<string, unknown> } = {}
    getServiceSupabase.mockReturnValue(
      makeSupabase(
        { permit_requests: [APPROVED_FOREIGN_PERMIT], users: [{ data: null, error: null }] },
        capture,
      ),
    )
    const response = await POST(req(foreignBody({
      noFather: true, noMother: true, father_phone: '', mother_phone: '',
      father_workplace: '', mother_workplace: '',
    })))
    expect(response.status).toBe(200)
    expect(capture.userInsert).toMatchObject({
      father_phone: null,
      father_workplace: "Vafot etgan yoki aloqa yo'q",
      mother_phone: null,
      mother_workplace: "Vafot etgan yoki aloqa yo'q",
    })
  })

  it('present parent with a missing phone → rejected', async () => {
    getServiceSupabase.mockReturnValue(
      makeSupabase({ permit_requests: [APPROVED_FOREIGN_PERMIT] }),
    )
    const response = await POST(req(foreignBody({
      noFather: true, father_phone: '', noMother: false, mother_phone: '',
    })))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/telefon/i)
  })

  it('malformed permit name: accepts the wizard-corrected F.I.Sh and writes it back onto the permit', async () => {
    const capture: { userInsert?: Record<string, unknown>; permitUpdate?: Record<string, unknown> } = {}
    getServiceSupabase.mockReturnValue(
      makeSupabase(
        {
          permit_requests: [{
            data: { ...APPROVED_FOREIGN_PERMIT.data, full_name: 'BABAYEVAGULZIRE' },
            error: null,
          }],
          users: [{ data: null, error: null }],
        },
        capture,
      ),
    )

    const response = await POST(req(foreignBody({
      lastName: 'Babayeva', firstName: 'Gulzire', middleName: '', noMiddleName: true,
      email: 'murat@example.com',
    })))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(capture.userInsert).toMatchObject({ full_name: 'Babayeva Gulzire' })
    expect(capture.permitUpdate).toEqual({ full_name: 'Babayeva Gulzire' })
  })

  it('re-registration: updates the pending account password', async () => {
    getServiceSupabase.mockReturnValue(
      makeSupabase({
        permit_requests: [APPROVED_FOREIGN_PERMIT],
        users: [{ data: { id: 'existing-1', email: 'murat@example.com', role: 'talaba', status: 'pending' }, error: null }],
      }),
    )

    const response = await POST(req(foreignBody()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(updateAuthUserPasswordSafely).toHaveBeenCalledWith('existing-1', GOOD_PASSWORD)
    expect(createAuthUserSafely).not.toHaveBeenCalled()
  })

  it('recovers an orphaned pending Auth user after an ambiguous create response', async () => {
    const capture: { userInsert?: Record<string, unknown> } = {}
    getServiceSupabase.mockReturnValue(
      makeSupabase(
        {
          permit_requests: [APPROVED_FOREIGN_PERMIT],
          users: [
            { data: null, error: null },
            { data: null, error: null },
          ],
        },
        capture,
      ),
    )
    createAuthUserSafely.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email already exists', status: 422, code: 'email_exists' },
    })
    findAuthUserByEmailSafely.mockResolvedValue({
      user: {
        id: 'orphan-auth-1',
        email: 'murat@example.com',
        user_metadata: { role: 'talaba', registration_pending: true },
      },
      error: null,
    })

    const response = await POST(req(foreignBody()))

    expect(response.status).toBe(200)
    expect(updateAuthUserPasswordSafely).toHaveBeenCalledWith('orphan-auth-1', GOOD_PASSWORD)
    expect(capture.userInsert).toMatchObject({ id: 'orphan-auth-1', email: 'murat@example.com' })
  })

  it('returns a retryable service error instead of falsely claiming the email exists', async () => {
    getServiceSupabase.mockReturnValue(
      makeSupabase({ permit_requests: [APPROVED_FOREIGN_PERMIT], users: [{ data: null, error: null }] }),
    )
    createAuthUserSafely.mockResolvedValue({
      data: { user: null },
      error: { message: 'fetch failed', code: 'auth_network_error' },
    })

    const response = await POST(req(foreignBody()))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toMatch(/vaqtincha/i)
    expect(body.error).not.toMatch(/email bilan akkaunt mavjud/i)
  })

  it('converts a mistaken KV-talaba account on the permit email instead of failing with email_exists', async () => {
    // Prod 2026-09-23: approved dorm applicants who had first used the
    // off-campus KV form got "Bu email bilan akkaunt avval yaratilgan" — the
    // KV row has no passport, so the passport lookup missed it.
    const capture: { userInsert?: Record<string, unknown>; userUpdate?: Record<string, unknown> } = {}
    getServiceSupabase.mockReturnValue(
      makeSupabase(
        {
          permit_requests: [APPROVED_FOREIGN_PERMIT],
          users: [
            { data: null, error: null },
            { data: { id: 'kv-1', role: 'talaba', is_off_campus: true, passport_series: null }, error: null },
          ],
        },
        capture,
      ),
    )

    const response = await POST(req(foreignBody()))

    expect(response.status).toBe(200)
    expect(createAuthUserSafely).not.toHaveBeenCalled()
    expect(capture.userInsert).toBeUndefined()
    expect(capture.userUpdate).toMatchObject({
      passport_series: 'A1234567',
      jshshir: null,
      is_off_campus: false,
      off_campus_verified_by: null,
      status: 'pending',
      room_number: '12',
      dorm_id: 'dorm-amit-1',
    })
    expect(capture.userUpdate).not.toHaveProperty('id')
    expect(updateAuthUserPasswordSafely).toHaveBeenCalledWith('kv-1', GOOD_PASSWORD)
    expect(revokeOtherUserSessions).toHaveBeenCalledWith('kv-1', null)
  })

  it('still 409s when the permit email belongs to a real (non-KV) account', async () => {
    getServiceSupabase.mockReturnValue(
      makeSupabase({
        permit_requests: [APPROVED_FOREIGN_PERMIT],
        users: [
          { data: null, error: null },
          { data: { id: 'other-1', role: 'talaba', is_off_campus: false, passport_series: 'B7654321' }, error: null },
        ],
      }),
    )

    const response = await POST(req(foreignBody()))

    expect(response.status).toBe(409)
    expect(updateAuthUserPasswordSafely).not.toHaveBeenCalled()
    expect(createAuthUserSafely).not.toHaveBeenCalled()
  })
})
