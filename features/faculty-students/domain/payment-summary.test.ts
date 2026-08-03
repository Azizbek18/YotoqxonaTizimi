import { describe, expect, it } from 'vitest'
import { buildPaySummaries, formatSum } from './payment-summary'
import type { FacultyPaymentRecord } from '../types'

const FEE = 1_000_000

const payment = (overrides: Partial<FacultyPaymentRecord> = {}): FacultyPaymentRecord => ({
  id: 'p1',
  student_id: 's1',
  month: 'Yanvar',
  year: 2026,
  amount: FEE,
  status: 'approved',
  has_receipt: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('buildPaySummaries', () => {
  it('gives every student a baseline entry even with no payments at all', () => {
    const summaries = buildPaySummaries([{ id: 's1' }, { id: 's2' }], [], FEE)

    expect([...summaries.keys()]).toEqual(['s1', 's2'])
    expect(summaries.get('s1')).toEqual({
      paid: 0,
      waiting: 0,
      remaining: FEE,
      contractFee: FEE,
      progressPercent: 0,
      state: 'none',
      hasWaiting: false,
    })
  })

  it('counts both "paid" and "approved" as money actually received', () => {
    const summaries = buildPaySummaries(
      [{ id: 's1' }],
      [
        payment({ id: 'a', status: 'paid', amount: 300_000 }),
        payment({ id: 'b', status: 'approved', amount: 200_000 }),
      ],
      FEE,
    )

    const summary = summaries.get('s1')!
    expect(summary.paid).toBe(500_000)
    expect(summary.remaining).toBe(500_000)
    expect(summary.hasWaiting).toBe(false)
  })

  it('counts both "waiting" and "pending" as awaiting review, not as paid', () => {
    const summaries = buildPaySummaries(
      [{ id: 's1' }],
      [
        payment({ id: 'a', status: 'waiting', amount: 400_000 }),
        payment({ id: 'b', status: 'pending', amount: 100_000 }),
      ],
      FEE,
    )

    const summary = summaries.get('s1')!
    expect(summary.waiting).toBe(500_000)
    expect(summary.hasWaiting).toBe(true)
    // Debt is measured against approved money only — a pending receipt
    // must not quietly clear someone's qarz.
    expect(summary.paid).toBe(0)
    expect(summary.remaining).toBe(FEE)
    expect(summary.state).toBe('none')
  })

  it('ignores rejected payments entirely', () => {
    const summaries = buildPaySummaries(
      [{ id: 's1' }],
      [payment({ status: 'rejected', amount: FEE })],
      FEE,
    )

    const summary = summaries.get('s1')!
    expect(summary.paid).toBe(0)
    expect(summary.waiting).toBe(0)
    expect(summary.hasWaiting).toBe(false)
    expect(summary.state).toBe('none')
  })

  it('drops payments belonging to a student outside the given list', () => {
    const summaries = buildPaySummaries(
      [{ id: 's1' }],
      [payment({ student_id: 'someone-else', amount: FEE })],
      FEE,
    )

    expect(summaries.size).toBe(1)
    expect(summaries.get('s1')!.paid).toBe(0)
  })

  describe('state boundaries', () => {
    const stateFor = (paid: number) =>
      buildPaySummaries([{ id: 's1' }], paid ? [payment({ amount: paid })] : [], FEE).get('s1')!

    it('treats paying exactly the contract fee as fully paid', () => {
      const summary = stateFor(FEE)
      expect(summary.state).toBe('paid')
      expect(summary.remaining).toBe(0)
      expect(summary.progressPercent).toBe(100)
    })

    it('treats one so\'m short of the fee as partial', () => {
      expect(stateFor(FEE - 1).state).toBe('partial')
    })

    it('treats a single so\'m as partial, not none', () => {
      const summary = stateFor(1)
      expect(summary.state).toBe('partial')
      expect(summary.progressPercent).toBe(0)
    })

    it('treats nothing paid as none', () => {
      expect(stateFor(0).state).toBe('none')
    })
  })

  it('clamps an overpayment instead of reporting negative debt or >100%', () => {
    const summary = buildPaySummaries(
      [{ id: 's1' }],
      [payment({ amount: FEE * 2 })],
      FEE,
    ).get('s1')!

    expect(summary.paid).toBe(FEE * 2)
    expect(summary.remaining).toBe(0)
    expect(summary.progressPercent).toBe(100)
    expect(summary.state).toBe('paid')
  })

  it('rounds the progress percentage to a whole number', () => {
    const summary = buildPaySummaries([{ id: 's1' }], [payment({ amount: 1 })], 3).get('s1')!
    // 1/3 = 33.33% → 33, never 33.333333333333336 in the UI.
    expect(summary.progressPercent).toBe(33)
  })

  it('survives a zero contract fee without dividing by zero', () => {
    const summary = buildPaySummaries([{ id: 's1' }], [], 0).get('s1')!

    expect(summary.progressPercent).toBe(0)
    expect(summary.remaining).toBe(0)
    expect(Number.isNaN(summary.progressPercent)).toBe(false)
    // With nothing owed, nothing is outstanding — callers are expected to
    // hold off rendering until the real fee setting has loaded.
    expect(summary.state).toBe('paid')
  })
})

describe('formatSum', () => {
  it('renders a thousands-separated sum with the currency suffix', () => {
    expect(formatSum(16_800_000)).toBe(`${(16_800_000).toLocaleString('uz-UZ')} so'm`)
    expect(formatSum(0)).toBe(`${(0).toLocaleString('uz-UZ')} so'm`)
  })
})
