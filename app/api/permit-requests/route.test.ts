import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const checkRateLimit = vi.fn()
const classifyPermitResubmission = vi.fn()

vi.mock('@/lib/security', () => ({
  checkRateLimit,
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: vi.fn(() => ({})) }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/permit-resubmission', () => ({ classifyPermitResubmission }))
vi.mock('@/lib/permit-telegram', () => ({ issuePermitTelegramLinkSafely: vi.fn(async () => null) }))
vi.mock('@/lib/dekan-telegram', () => ({ notifyDekanNewPermit: vi.fn() }))
const saveStudentSignature = vi.fn(async () => {})
vi.mock('@/lib/permit-documents', async () => {
  const actual = await vi.importActual<typeof import('@/lib/permit-documents')>('@/lib/permit-documents')
  return { ...actual, saveStudentSignature }
})

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const { POST } = await import('./route')

// Every valid field the yo'llanma route needs to reach the Ariza/Tilxat
// checks. Individual tests override or drop one field at a time.
function baseFields(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    passportSeries: 'AA1234567',
    jshshir: '12345678901234',
    fullName: 'Testov Talaba Sinov',
    email: 'talaba@example.com',
    phone: '+998901234567',
    gender: 'male',
    faculty: 'amit',
    direction: 'suniy-intellekt',
    course: '1',
    studyType: 'grant',
    originRegion: 'Andijon',
    relativePhone: '+998911234567',
    studentSignature: PNG,
    ...overrides,
  }
  return fields
}

function request(fields: Record<string, string>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return new NextRequest('http://localhost/api/permit-requests', { method: 'POST', body: form })
}

describe('POST /api/permit-requests — Ariza/Tilxat maydonlari', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({ allowed: true })
    // Default: identity is a fresh, non-conflicting applicant.
    classifyPermitResubmission.mockResolvedValue({ action: 'conflict', message: 'stop-here' })
  })

  it("ta'lim shakli yuborilmasa 400 qaytaradi", async () => {
    const fields = baseFields()
    delete fields.studyType
    const response = await POST(request(fields))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/Ta.?lim shaklini tanlang/i)
  })

  it("ta'lim shakli noto'g'ri qiymat bilan 400 qaytaradi", async () => {
    const response = await POST(request(baseFields({ studyType: 'stipendiya' })))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/Ta.?lim shaklini tanlang/i)
  })

  it("ro'yxatda yo'q viloyat bilan 400 qaytaradi", async () => {
    const response = await POST(request(baseFields({ originRegion: 'Xatlon' })))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/viloyat/i)
  })

  it("viloyat umuman yuborilmasa 400 qaytaradi", async () => {
    const fields = baseFields()
    delete fields.originRegion
    const response = await POST(request(fields))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/viloyat/i)
  })

  it("yaqin qarindosh telefoni noto'g'ri bo'lsa 400 qaytaradi", async () => {
    const response = await POST(request(baseFields({ relativePhone: '123' })))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/qarindosh/i)
  })

  it("qarindosh telefoni umuman yuborilmasa 400 qaytaradi", async () => {
    const fields = baseFields()
    delete fields.relativePhone
    const response = await POST(request(fields))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/qarindosh/i)
  })

  it("barcha yangi maydonlar to'g'ri bo'lsa validatsiyadan o'tadi", async () => {
    // classify -> conflict, so a clean pass lands on 409 (not a 400 validation
    // error) — proof the three new checks accepted the input.
    const response = await POST(request(baseFields()))
    expect(response.status).toBe(409)
    expect(classifyPermitResubmission).toHaveBeenCalledWith(
      expect.anything(),
      { passport: 'AA1234567', jshshir: '12345678901234', email: 'talaba@example.com' },
      expect.objectContaining({ allowPendingEdit: false }),
    )
  })

  it("hujjatsiz yangi ariza validatsiyadan o'tib, keyin fayl yo'qligidan 400 bo'ladi", async () => {
    classifyPermitResubmission.mockResolvedValue({ action: 'insert' })
    const response = await POST(request(baseFields()))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toMatch(/Yo.?llanma fayli topilmadi/i)
  })

  it('imzosiz yangi ariza 400 qaytaradi', async () => {
    classifyPermitResubmission.mockResolvedValue({ action: 'insert' })
    const fields = baseFields()
    delete fields.studentSignature
    const response = await POST(request(fields))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/imzolang/i)
  })

  it("noto'g'ri formatdagi imzo 400 qaytaradi", async () => {
    const response = await POST(request(baseFields({ studentSignature: 'data:image/jpeg;base64,zzz' })))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/Imzo tasviri/i)
  })
})
