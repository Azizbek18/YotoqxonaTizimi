export const PERMIT_FILE_RULES: Record<string, { extension: string; signatures: number[][] }> = {
  'application/pdf': { extension: 'pdf', signatures: [[0x25, 0x50, 0x44, 0x46]] },
  'image/jpeg': { extension: 'jpg', signatures: [[0xff, 0xd8, 0xff]] },
  'image/png': { extension: 'png', signatures: [[0x89, 0x50, 0x4e, 0x47]] },
  'image/webp': { extension: 'webp', signatures: [[0x52, 0x49, 0x46, 0x46]] },
}

export function normalizePassport(input: unknown) {
  return String(input ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
}

export function normalizeJshshir(input: unknown) {
  return String(input ?? '').replace(/\D/g, '').slice(0, 14)
}

export function isValidPassport(value: string) {
  return /^[A-Z]{2}\d{7}$/.test(value)
}

export function isValidJshshir(value: string) {
  return /^\d{14}$/.test(value)
}

export function hasAllowedSignature(buffer: Uint8Array, signatures: number[][]) {
  return signatures.some((signature) => signature.every((byte, index) => buffer[index] === byte))
}
