// Client + server umumiy ko'rinish helperlari (sof, server-only emas).

import type { ExpiryBucket } from '../types'

export type Tone = 'ok' | 'info' | 'warning' | 'danger'

export function bucketTone(bucket: ExpiryBucket): Tone {
  switch (bucket) {
    case 'ok':
      return 'ok'
    case 'soon':
      return 'info'
    case 'warning':
      return 'warning'
    case 'critical':
    case 'expired':
      return 'danger'
  }
}

/** "47 kun qoldi" / "Bugun tugaydi" / "5 kun oldin tugagan". */
export function countdownLabel(days: number): string {
  if (days > 0) return `${days} kun qoldi`
  if (days === 0) return 'Bugun tugaydi'
  return `${Math.abs(days)} kun oldin tugagan`
}

/** Countdown halqasi uchun to'ldirilgan ulush (0..1). 90 kundan uzoq — to'la. */
export function ringProgress(days: number): number {
  if (days <= 0) return 1
  if (days >= 90) return 0
  return 1 - days / 90
}
