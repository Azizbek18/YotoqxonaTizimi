export const PLACEHOLDER_PATTERN = /^(your-|replace-with|change-?me|changeme|placeholder\b|example\b)/i

const KNOWN_PLACEHOLDER_VALUES = new Set([
  'dean-001',
  'dekan-001',
])

export function isPlaceholderValue(value) {
  const normalized = String(value ?? '').trim()
  return !normalized
    || PLACEHOLDER_PATTERN.test(normalized)
    || normalized.toLowerCase().includes('replace-with')
    || KNOWN_PLACEHOLDER_VALUES.has(normalized.toLowerCase())
}
