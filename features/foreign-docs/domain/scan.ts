// AI rasm o'qish natijasini tozalaydi: faqat haqiqiy sana va oqilona
// matnlar qoladi, qolgani null. Talaba baribir ko'rib tasdiqlaydi.
import type { DocType } from '../types'

export type ScanResult = {
  number: string | null
  issuedOn: string | null
  expiresOn: string | null
  address: string | null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function cleanDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!ISO_DATE.test(text)) return null
  const time = Date.parse(`${text}T00:00:00Z`)
  if (Number.isNaN(time)) return null
  const year = Number(text.slice(0, 4))
  if (year < 2000 || year > new Date().getUTCFullYear() + 20) return null
  return text
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.toLowerCase() === 'null') return null
  return text.slice(0, max)
}

export function parseScanResult(raw: string, docType: DocType): ScanResult | null {
  let text = raw.trim()
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?/, '').replace(/```$/, '').trim()
  let json: Record<string, unknown>
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') return null
    json = parsed as Record<string, unknown>
  } catch {
    return null
  }
  const issuedOn = cleanDate(json.issuedOn)
  let expiresOn = cleanDate(json.expiresOn)
  // Tugash sanasi berilgan sanadan oldin bo'lolmaydi — bunday natija ishonchsiz.
  if (issuedOn && expiresOn && issuedOn > expiresOn) expiresOn = null
  const result: ScanResult = {
    number: cleanText(json.number, 60),
    issuedOn,
    expiresOn,
    address: docType === 'visa' ? null : cleanText(json.address, 300),
  }
  return Object.values(result).every((v) => v === null) ? null : result
}
