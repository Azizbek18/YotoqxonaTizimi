import { afterEach, describe, expect, it } from 'vitest'
import { validateStaffId } from './staff-access'

const originalAllowedIds = process.env.DEKAN_ALLOWED_IDS

afterEach(() => {
  if (originalAllowedIds === undefined) delete process.env.DEKAN_ALLOWED_IDS
  else process.env.DEKAN_ALLOWED_IDS = originalAllowedIds
})

describe('dean staff ID allow-list', () => {
  it('rejects every ID when the legacy flow is explicitly disabled', () => {
    process.env.DEKAN_ALLOWED_IDS = 'disabled'
    expect(validateStaffId('disabled')).toBe(false)
    expect(validateStaffId('dean-123')).toBe(false)
  })

  it('still supports an explicit comma-separated allow-list', () => {
    process.env.DEKAN_ALLOWED_IDS = 'dean-123, dean-456'
    expect(validateStaffId('dean-456')).toBe(true)
    expect(validateStaffId('dean-789')).toBe(false)
  })
})
