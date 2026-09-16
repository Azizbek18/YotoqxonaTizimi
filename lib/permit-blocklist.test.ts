import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  update: vi.fn(),
  sendPermitBlockedEmail: vi.fn(),
  notifyPermitBlockedTelegram: vi.fn(),
}))

vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      update: mocks.update,
    }),
  }),
}))
vi.mock('@/lib/email', () => ({ sendPermitBlockedEmail: mocks.sendPermitBlockedEmail }))
vi.mock('@/lib/permit-telegram', () => ({ notifyPermitBlockedTelegram: mocks.notifyPermitBlockedTelegram }))

const { notifyPermitBlocked } = await import('./permit-blocklist')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.update.mockReturnValue({ eq: async () => ({ error: null }) })
  mocks.sendPermitBlockedEmail.mockResolvedValue(undefined)
  mocks.notifyPermitBlockedTelegram.mockResolvedValue(true)
})

describe('notifyPermitBlocked', () => {
  it('does nothing when the permit lookup errors', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error('db down') })
    await notifyPermitBlocked('perm1')
    expect(mocks.sendPermitBlockedEmail).not.toHaveBeenCalled()
  })

  it('does nothing when the permit is not actually blocked', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { blocked: false, email: 'a@b.com', full_name: 'A' }, error: null })
    await notifyPermitBlocked('perm1')
    expect(mocks.sendPermitBlockedEmail).not.toHaveBeenCalled()
  })

  it('is throttled to once per 24h per application', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { blocked: true, email: 'a@b.com', full_name: 'A', block_notified_at: new Date().toISOString() },
      error: null,
    })
    await notifyPermitBlocked('perm1')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.sendPermitBlockedEmail).not.toHaveBeenCalled()
  })

  it('sends after the 24h throttle window has passed', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    mocks.maybeSingle.mockResolvedValue({
      data: { blocked: true, email: 'a@b.com', full_name: 'A', block_notified_at: twoDaysAgo },
      error: null,
    })
    await notifyPermitBlocked('perm1')
    expect(mocks.sendPermitBlockedEmail).toHaveBeenCalledWith('a@b.com', 'A')
    expect(mocks.notifyPermitBlockedTelegram).toHaveBeenCalledWith('perm1')
  })

  it('reserves the throttle slot before sending, and skips sending if that update fails', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { blocked: true, email: 'a@b.com', full_name: 'A', block_notified_at: null },
      error: null,
    })
    mocks.update.mockReturnValue({ eq: async () => ({ error: new Error('write failed') }) })
    await notifyPermitBlocked('perm1')
    expect(mocks.sendPermitBlockedEmail).not.toHaveBeenCalled()
  })

  it('never throws even when both notification channels fail', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { blocked: true, email: 'a@b.com', full_name: 'A', block_notified_at: null },
      error: null,
    })
    mocks.sendPermitBlockedEmail.mockRejectedValue(new Error('smtp down'))
    mocks.notifyPermitBlockedTelegram.mockRejectedValue(new Error('bot down'))
    await expect(notifyPermitBlocked('perm1')).resolves.toBeUndefined()
  })

  it('swallows an unexpected exception from the lookup itself', async () => {
    mocks.maybeSingle.mockRejectedValue(new Error('network blip'))
    await expect(notifyPermitBlocked('perm1')).resolves.toBeUndefined()
  })
})
