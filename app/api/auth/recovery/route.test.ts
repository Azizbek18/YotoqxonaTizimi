import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: () => 'test-ip',
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: mocks.resetPasswordForEmail } }),
}))

import { POST } from './route'

describe('password recovery route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test-key'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.meningyotoqxonam.uz'
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4 })
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
  })

  it('uses the canonical production redirect origin', async () => {
    const response = await POST(new NextRequest('https://preview.example/api/auth/recovery', {
      method: 'POST',
      body: JSON.stringify({ email: 'Student@iCloud.com' }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('student@icloud.com', {
      redirectTo: 'https://www.meningyotoqxonam.uz/auth/confirm',
    })
  })

  it('surfaces a provider failure instead of claiming the message was sent', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: new Error('SMTP unavailable') })

    const response = await POST(new NextRequest('http://localhost/api/auth/recovery', {
      method: 'POST',
      body: JSON.stringify({ email: 'student@example.com' }),
    }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'Xatni yuborib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.',
    })
  })
})
