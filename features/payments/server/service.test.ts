import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyFileClaim = vi.fn()
const getSettings = vi.fn()

vi.mock('@/lib/receipt-claim', () => ({
  verifyFileClaim: (...args: unknown[]) => verifyFileClaim(...args),
}))
vi.mock('@/features/app-settings/server/service', () => ({
  createAppSettingsService: () => ({ get: getSettings }),
}))

const { createPaymentService } = await import('./service')

function paymentForm(transactionId: string | null = 'TRX-9A7B-4C2D') {
  const form = new FormData()
  const bytes = new Uint8Array(32)
  bytes.set([0x89, 0x50, 0x4e, 0x47])
  form.set('file', new File([bytes], 'receipt.png', { type: 'image/png' }))
  form.set('amount', '500000')
  form.set('year', '2026')
  form.set('months', JSON.stringify(['Sentabr']))
  form.set('validatedHash', 'signed-claim')
  if (transactionId !== null) form.set('transactionId', transactionId)
  return form
}

function repository() {
  return {
    listForStudent: vi.fn(),
    listAll: vi.fn(),
    countWaiting: vi.fn(),
    review: vi.fn(),
    claimReceipt: vi.fn(async () => ({ error: null })),
    releaseReceipt: vi.fn(async () => undefined),
    setReceiptPath: vi.fn(async () => undefined),
    uploadReceipt: vi.fn(async () => ({ error: null })),
    removeReceipt: vi.fn(async () => undefined),
    submitBatchAtomic: vi.fn(async () => ({
      data: [{ id: 'payment-1', month: 'Sentabr', year: 2026, status: 'waiting' }],
      error: null,
    })),
  }
}

describe('payment submission service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSettings.mockResolvedValue({ monthlyFee: 500000 })
    verifyFileClaim.mockReturnValue(true)
  })

  it('binds and atomically persists the AI-verified transaction id', async () => {
    const repo = repository()
    const result = await createPaymentService(repo as never).submit(
      { id: '00000000-0000-4000-8000-000000000001', full_name: 'Test Student' },
      paymentForm(),
    )

    expect(result.ok).toBe(true)
    expect(verifyFileClaim).toHaveBeenCalledWith(
      'payment',
      'signed-claim',
      expect.stringMatching(/^[0-9a-f]{64}$/),
      {
        userId: '00000000-0000-4000-8000-000000000001',
        amount: 500000,
        transactionId: 'TRX9A7B4C2D',
      },
    )
    expect(repo.submitBatchAtomic).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'TRX-9A7B-4C2D',
      normalizedTransactionId: 'TRX9A7B4C2D',
      aiReview: 'passed',
      months: ['Sentabr'],
      amounts: [500000],
    }))
  })

  it('accepts the real client shape without a transaction id when AI was down', async () => {
    const repo = repository()
    verifyFileClaim.mockImplementation((purpose: string) => purpose === 'payment-unverified')

    const result = await createPaymentService(repo as never).submit(
      { id: '00000000-0000-4000-8000-000000000001', full_name: 'Test Student' },
      paymentForm(null),
    )

    expect(result.ok).toBe(true)
    expect(verifyFileClaim).toHaveBeenCalledWith(
      'payment-unverified',
      'signed-claim',
      expect.stringMatching(/^[0-9a-f]{64}$/),
      { userId: '00000000-0000-4000-8000-000000000001', amount: 500000 },
    )
    expect(repo.submitBatchAtomic).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: '',
      normalizedTransactionId: '',
      aiReview: 'manual',
    }))
  })

  it('never accepts an unverified claim with a client-supplied transaction id', async () => {
    const repo = repository()
    verifyFileClaim.mockImplementation((purpose: string) => purpose === 'payment-unverified')

    await expect(createPaymentService(repo as never).submit(
      { id: '00000000-0000-4000-8000-000000000001', full_name: 'Test Student' },
      paymentForm(),
    )).rejects.toThrow('Chek avval AI orqali tekshirilishi shart')
    expect(repo.claimReceipt).not.toHaveBeenCalled()
    expect(repo.submitBatchAtomic).not.toHaveBeenCalled()
  })

  it('rejects when neither claim verifies', async () => {
    const repo = repository()
    verifyFileClaim.mockReturnValue(false)
    await expect(createPaymentService(repo as never).submit(
      { id: '00000000-0000-4000-8000-000000000001', full_name: 'Test Student' },
      paymentForm(),
    )).rejects.toThrow('Chek avval AI orqali tekshirilishi shart')
    expect(repo.submitBatchAtomic).not.toHaveBeenCalled()
  })

  it('rejects a missing or suspicious transaction id before reserving the receipt', async () => {
    const repo = repository()
    await expect(createPaymentService(repo as never).submit(
      { id: '00000000-0000-4000-8000-000000000001', full_name: 'Test Student' },
      paymentForm('TX12345678'),
    )).rejects.toThrow('Chek tranzaksiya raqami noto‘g‘ri')

    expect(repo.claimReceipt).not.toHaveBeenCalled()
    expect(repo.submitBatchAtomic).not.toHaveBeenCalled()
  })

  it('rejects a missing transaction id unless the unverified claim is valid', async () => {
    const repo = repository()
    verifyFileClaim.mockReturnValue(false)

    await expect(createPaymentService(repo as never).submit(
      { id: '00000000-0000-4000-8000-000000000001', full_name: 'Test Student' },
      paymentForm(null),
    )).rejects.toThrow('Chek avval AI orqali tekshirilishi shart')

    expect(repo.claimReceipt).not.toHaveBeenCalled()
    expect(repo.submitBatchAtomic).not.toHaveBeenCalled()
  })

  it('validates the fee against the student\'s own faculty', async () => {
    const repo = repository()
    await createPaymentService(repo as never).submit(
      { id: '00000000-0000-4000-8000-000000000001', full_name: 'S', faculty: 'fizika' },
      paymentForm(),
    )
    expect(getSettings).toHaveBeenCalledWith('fizika')
  })
})

describe('payment review / listing faculty scoping', () => {
  beforeEach(() => vi.clearAllMocks())

  it('threads the faculty through listAll, getSummary and review', async () => {
    const repo = repository()
    repo.listAll.mockResolvedValue([])
    repo.countWaiting.mockResolvedValue(3)
    repo.review.mockResolvedValue([{ id: 'p1' }])

    const service = createPaymentService(repo as never)
    await service.listAll(['kimyo'])
    await service.getSummary(['kimyo'])
    await service.review(['kimyo'], { ids: ['00000000-0000-4000-8000-000000000001'], status: 'approved', message: 'ok' })

    expect(repo.listAll).toHaveBeenCalledWith(['kimyo'], undefined)
    expect(repo.countWaiting).toHaveBeenCalledWith(['kimyo'])
    expect(repo.review).toHaveBeenCalledWith(['kimyo'], ['00000000-0000-4000-8000-000000000001'], 'approved', 'ok')
  })

  it('rejects the batch when a payment id is outside the faculty (fewer rows updated)', async () => {
    const repo = repository()
    repo.review.mockResolvedValue([]) // the other-faculty id matched nothing

    await expect(
      createPaymentService(repo as never).review(['kimyo'], { ids: ['00000000-0000-4000-8000-000000000001'], status: 'approved', message: 'ok' }),
    ).rejects.toMatchObject({ status: 409 })
  })
})
