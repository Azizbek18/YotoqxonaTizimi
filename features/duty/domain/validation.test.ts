import { describe, expect, it } from 'vitest'
import { normalizeCleaningSchedule } from './validation'

describe('normalizeCleaningSchedule', () => {
  it('keeps weekdays and trims assignee fields', () => {
    expect(normalizeCleaningSchedule({
      Dushanba: { id: ' 1 ', name: ' Ali ' },
      Yakshanba: null,
      injected: { id: '2', name: 'Bad' },
    })).toEqual({ Dushanba: { id: '1', name: 'Ali' }, Yakshanba: null })
  })

  it('rejects malformed assignees', () => {
    expect(() => normalizeCleaningSchedule({ Dushanba: { id: '', name: 'Ali' } }))
      .toThrow('to\'liq emas')
  })
})
