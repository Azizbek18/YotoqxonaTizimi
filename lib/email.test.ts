import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ smtpSend: vi.fn(), createTransport: vi.fn() }))
vi.mock('nodemailer', () => ({ createTransport: mocks.createTransport }))

const fetchMock = vi.fn()

async function load() {
  vi.resetModules()
  return import('./email')
}

const quotaResponse = () =>
  new Response('{"statusCode":429,"message":"You have reached your daily email sending quota.","name":"daily_quota_exceeded"}', { status: 429 })

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.createTransport.mockReturnValue({ sendMail: mocks.smtpSend })
  mocks.smtpSend.mockResolvedValue({})
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('SMTP_HOST', 'smtp.gmail.com')
  vi.stubEnv('SMTP_USER', 'backup@gmail.com')
  vi.stubEnv('SMTP_PASS', 'abcd efgh ijkl mnop')
  vi.stubEnv('SMTP_2_HOST', '')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('sendMail provider chain', () => {
  it('uses Resend alone when it accepts the message', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    const { sendEmailVerificationCode } = await load()
    expect(await sendEmailVerificationCode('a@b.uz', '123456')).toEqual({ ok: true })
    expect(mocks.smtpSend).not.toHaveBeenCalled()
  })

  it('falls back to SMTP when the Resend daily quota is exhausted, then skips Resend', async () => {
    fetchMock.mockResolvedValue(quotaResponse())
    const { sendEmailVerificationCode } = await load()

    expect(await sendEmailVerificationCode('a@b.uz', '123456')).toEqual({ ok: true })
    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'backup@gmail.com', pass: 'abcdefghijklmnop' } }),
    )
    expect(mocks.smtpSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.uz', from: 'Yotoqxona tizimi <backup@gmail.com>', subject: 'Tasdiqlash kodi: 123456' }),
    )

    await sendEmailVerificationCode('c@d.uz', '654321')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.smtpSend).toHaveBeenCalledTimes(2)
  })

  it('tries the next SMTP account when one fails, and reports failure when all do', async () => {
    fetchMock.mockResolvedValue(quotaResponse())
    vi.stubEnv('SMTP_2_HOST', 'smtp-relay.brevo.com')
    vi.stubEnv('SMTP_2_PORT', '587')
    vi.stubEnv('SMTP_2_USER', 'brevo-user')
    vi.stubEnv('SMTP_2_PASS', 'brevo-pass')
    vi.stubEnv('SMTP_2_FROM', 'Yotoqxona <noreply@meningyotoqxonam.uz>')
    mocks.smtpSend.mockRejectedValueOnce(new Error('454 daily limit')).mockResolvedValueOnce({})
    const { sendEmailVerificationCode } = await load()

    expect(await sendEmailVerificationCode('a@b.uz', '123456')).toEqual({ ok: true })
    expect(mocks.createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ host: 'smtp-relay.brevo.com', port: 587, secure: false }))

    mocks.smtpSend.mockRejectedValue(new Error('down'))
    expect(await sendEmailVerificationCode('a@b.uz', '123456')).toEqual({ ok: false })
  })
})
