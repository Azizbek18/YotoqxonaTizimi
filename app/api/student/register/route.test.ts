import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const checkRateLimit = vi.fn()

vi.mock('@/lib/security', () => ({
  checkRateLimit,
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }))
vi.mock('@/lib/supabase-admin-auth', () => ({
  createAuthUserSafely: vi.fn(),
  deleteAuthUserSafely: vi.fn(),
}))

const { POST } = await import('./route')

describe('POST /api/student/register — xorijiy talaba', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({ allowed: true })
  })

  it('final submitda noMiddleName tanlovini saqlaydi va patronimik talab qilmaydi', async () => {
    const request = new NextRequest('http://localhost/api/student/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Stale client hint intentionally reproduces the reported bug. The
        // missing JSHSHIR must still select the approved foreign flow.
        applicationType: 'yollanma',
        passportSeries: 'A1234567',
        jshshir: '',
        email: 'murat@example.com',
        lastName: 'Atayev',
        firstName: 'Murat',
        middleName: '',
        noMiddleName: true,
        phone: '901234567',
        gender: 'male',
        faculty: 'AMIT',
        direction: 'Axborot tizimlari',
        // Stop after name validation, before any DB access.
        course: 0,
        passportDate: '2025-01-01',
        birthDate: '2000-01-01',
        entryDate: '2026-08-01',
      }),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/Kurs yoki sana/i)
    expect(body.error).not.toMatch(/Otasining ismi|shaxsiy.*to‘liq emas/i)
  })
})
