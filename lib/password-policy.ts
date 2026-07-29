export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export function getPasswordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Parol ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} belgidan iborat bo‘lishi kerak`
  }
  if (!/[A-Z]/.test(password)) return 'Parolda kamida bitta katta harf bo‘lishi kerak'
  if (!/[a-z]/.test(password)) return 'Parolda kamida bitta kichik harf bo‘lishi kerak'
  if (!/\d/.test(password)) return 'Parolda kamida bitta raqam bo‘lishi kerak'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Parolda kamida bitta maxsus belgi bo‘lishi kerak'
  return null
}
