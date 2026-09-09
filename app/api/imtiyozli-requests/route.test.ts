import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SIGNATURE_PNG as PNG } from '../../../test/fixtures/signature-png'

const checkRateLimit = vi.fn()
const classifyPermitResubmission = vi.fn()

vi.mock('@/lib/security', () => ({
  checkRateLimit,
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: vi.fn(() => ({})) }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/permit-resubmission', () => ({ classifyPermitResubmission }))
vi.mock('@/lib/permit-blocklist', () => ({ notifyPermitBlocked: vi.fn() }))
vi.mock('@/lib/permit-telegram', () => ({ issuePermitTelegramLinkSafely: vi.fn(async () => null) }))
vi.mock('@/lib/dekan-telegram', () => ({ notifyDekanNewPermit: vi.fn() }))
vi.mock('@/lib/permit-documents', async () => {
  const actual = await vi.importActual<typeof import('@/lib/permit-documents')>('@/lib/permit-documents')
  return { ...actual, saveStudentSignature: vi.fn(async () => {}) }
})

const { POST } = await import('./route')

// A foreign applicant with no patronymic: parts + the "no patronymic" box.
function baseFields(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    idNumber: 'A1234567',
    lastName: 'Atayeva',
    firstName: 'Merjen',
    middleName: '',
    noMiddleName: 'true',
    email: 'merjen@example.com',
    phone: '+998901234567',
    relativePhone: '+998911234567',
    gender: 'female',
    faculty: 'amit',
    direction: 'suniy-intellekt',
    course: '2',
    studyType: 'kontrakt',
    originCountry: 'Turkmaniston',
    originRegion: 'Dashoguz',
    studentSignature: PNG,
    ...overrides,
  }
  return fields
}

function request(fields: Record<string, string>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return new NextRequest('http://localhost/api/imtiyozli-requests', { method: 'POST', body: form })
}

describe('POST /api/imtiyozli-requests — F.I.Sh tozalash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({ allowed: true })
    // A clean pass reaches classify and stops on a canned conflict — proof the
    // name checks accepted (or rejected) the input before any DB write.
    classifyPermitResubmission.mockResolvedValue({ action: 'conflict', message: 'stop-here' })
  })

  it('bitta birlashgan token bo‘lgan F.I.Sh ni rad etadi', async () => {
    const fields = baseFields()
    delete fields.lastName
    delete fields.firstName
    delete fields.middleName
    delete fields.noMiddleName
    fields.fullName = 'BABAYEVAGULZIRE'
    const response = await POST(request(fields))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/F\.I\.Sh/i)
  })

  it('Sharif maydonidagi "XXX" ni otasining ismi yo‘q deb qabul qiladi', async () => {
    const response = await POST(request(baseFields({
      middleName: 'XXX', noMiddleName: 'false',
    })))
    // Name accepted -> reaches classify -> canned conflict (409), not a 400.
    expect(response.status).toBe(409)
  })

  it('toza ikki qismli F.I.Sh (otasining ismi yo‘q) validatsiyadan o‘tadi', async () => {
    const response = await POST(request(baseFields()))
    expect(response.status).toBe(409)
    expect(classifyPermitResubmission).toHaveBeenCalled()
  })
})
