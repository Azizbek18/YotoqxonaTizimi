import { describe, expect, it } from 'vitest'
import { isPlaceholderValue } from './env-placeholders.mjs'

describe('production environment placeholder detection', () => {
  it.each(['', 'your-secret', 'replace-with-a-secret', 'change-me', 'placeholder', 'dean-001', 'dekan-001'])(
    'rejects %j',
    (value) => expect(isPlaceholderValue(value)).toBe(true),
  )

  it('accepts a real comma-separated dean id list', () => {
    expect(isPlaceholderValue('4d754c5d-3ef7-4dc9-a38d-84afcb514307')).toBe(false)
  })
})
