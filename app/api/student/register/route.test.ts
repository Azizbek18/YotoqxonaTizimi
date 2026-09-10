import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const checkRateLimit = vi.fn()
const getServiceSupabase = vi.fn()
const createAuthUserSafely = vi.fn()
const deleteAuthUserSafely = vi.fn()
const updateAuthUserPasswordSafely = vi.fn()

vi.mock('@/lib/security', () => ({
  checkRateLimit,
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/supabase-admin-auth', () => ({
  createAuthUserSafely,
  deleteAuthUserSafely,
  updateAuthUserPasswordSafely,
}))

const { POST } = await import('./route')

const GOOD_PASSWORD = 'Abcdef123456!x'

// A tiny chainable stub. Every terminal (`maybeSingle`) pulls its canned
// result from `results[table]` (shift one per call).
function makeSupabase(
  results: Record<string, unknown[]>,
  capture: { userInsert?: Record<string, unknown>; permitUpdate?: Record<string, unknown> } = {},
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
    updateAuthUserPasswordSafely.mockResolvedValue({ error: null })
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

  it('both parents absent → rejected (need at least one contact)', async () => {
    getServiceSupabase.mockReturnValue(
      makeSupabase({ permit_requests: [APPROVED_FOREIGN_PERMIT] }),
    )
    const response = await POST(req(foreignBody({
      noFather: true, noMother: true, father_phone: '', mother_phone: '',
    })))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/ota yoki ona telefon/i)
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
})
