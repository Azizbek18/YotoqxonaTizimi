import { describe, expect, it } from 'vitest'
import { getPasswordPolicyError } from './password-policy'

describe('password policy', () => {
  it('accepts a strong password', () => {
    expect(getPasswordPolicyError('SecurePass123!')).toBeNull()
  })

  it.each([
    'Short1!',
    'alllowercase123!',
    'ALLUPPERCASE123!',
    'NoNumbersHere!',
    'NoSymbolsHere123',
  ])('rejects a weak password: %s', (password) => {
    expect(getPasswordPolicyError(password)).not.toBeNull()
  })
})
