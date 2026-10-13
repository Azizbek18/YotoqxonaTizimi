import { ApiError } from '@/server/http/api-error'
import {
  LEAVE_AUTO_MAX_DAYS,
  LEAVE_MAX_ADVANCE_DAYS,
  LEAVE_MAX_DAYS,
  type HomeLeaveInput,
  type LeaveDestinationKind,
} from './types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KINDS: readonly LeaveDestinationKind[] = ['uy', 'qarindosh', 'boshqa']

/** YYYY-MM-DD ikki sana orasidagi kun farqi (UTC, soat siljishisiz). */
export function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** Ketish va qaytish kunlarini ham hisoblab, ariza necha kunga ekani. */
export function leaveDays(startsOn: string, endsOn: string): number {
  return dayDiff(startsOn, endsOn) + 1
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function cleanCoord(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null
}

/** Foydalanuvchi kiritganini tekshiradi. `today` — Toshkent sanasi (YYYY-MM-DD). */
export function parseLeaveInput(raw: unknown, today: string): HomeLeaveInput {
  if (!raw || typeof raw !== 'object') throw new ApiError(400, "So'rov noto'g'ri")
  const b = raw as Record<string, unknown>

  const kind = b.destinationKind as LeaveDestinationKind
  if (!KINDS.includes(kind)) throw new ApiError(400, 'Qayerga ketishingizni tanlang')

  const destinationAddress = cleanText(b.destinationAddress, 300)
  if (destinationAddress.length < 5) throw new ApiError(400, 'Borish manzilini kiriting')

  const contactName = cleanText(b.contactName, 120)
  if (contactName.length < 3) throw new ApiError(400, 'U yerdagi aloqa shaxsining ismini kiriting')

  const contactPhone = cleanText(b.contactPhone, 24).replace(/[^\d+]/g, '')
  if (!/^\+?\d{9,15}$/.test(contactPhone)) throw new ApiError(400, 'Aloqa shaxsining telefon raqamini to‘g‘ri kiriting')

  const startsOn = typeof b.startsOn === 'string' ? b.startsOn : ''
  const endsOn = typeof b.endsOn === 'string' ? b.endsOn : ''
  if (!DATE_RE.test(startsOn) || !DATE_RE.test(endsOn) || Number.isNaN(Date.parse(startsOn)) || Number.isNaN(Date.parse(endsOn))) {
    throw new ApiError(400, 'Sanalarni kiriting')
  }
  if (startsOn < today) throw new ApiError(400, 'Ketish sanasi o‘tib ketgan')
  if (dayDiff(today, startsOn) > LEAVE_MAX_ADVANCE_DAYS) {
    throw new ApiError(400, `Ketish sanasi ${LEAVE_MAX_ADVANCE_DAYS} kundan uzoq bo‘lmasin`)
  }
  if (endsOn < startsOn) throw new ApiError(400, 'Qaytish sanasi ketish sanasidan oldin bo‘lmasin')
  if (leaveDays(startsOn, endsOn) > LEAVE_MAX_DAYS) {
    throw new ApiError(400, `Ariza ${LEAVE_MAX_DAYS} kundan uzoq muddatga berilmaydi — dekanatga murojaat qiling`)
  }

  if (b.consent !== true) throw new ApiError(400, 'Mas‘uliyatni o‘z zimmangizga olishingizni tasdiqlang')

  return {
    destinationKind: kind,
    destinationAddress,
    destinationLat: cleanCoord(b.destinationLat, -90, 90),
    destinationLng: cleanCoord(b.destinationLng, -180, 180),
    contactName,
    contactPhone,
    reason: cleanText(b.reason, 300) || undefined,
    startsOn,
    endsOn,
    consent: true,
  }
}

/**
 * Ariza darrov kuchga kiradimi yoki dekan ko'rishi kerakmi.
 * Tarbiyachilarga yuk bo'lmasligi uchun odatiy qisqa ketish tekshiruvsiz;
 * faqat uzoq muddat yoki oldin shubhali bo'lgan talaba dekanga boradi.
 */
export function initialLeaveStatus(days: number, hadSuspiciousLeave: boolean): 'active' | 'pending' {
  return days > LEAVE_AUTO_MAX_DAYS || hadSuspiciousLeave ? 'pending' : 'active'
}

/** Ariza bugun amalda (talaba yo'qlamada "Uyda")mi? */
export function leaveInEffect(
  leave: { status: string; starts_on: string; ends_on: string },
  today: string,
): boolean {
  return leave.status === 'active' && leave.starts_on <= today && today <= leave.ends_on
}

/** Ikki nuqta orasidagi masofa (km, haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
