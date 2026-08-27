import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { Database } from '@/types/database.generated'
import type { AppSettings } from '../types'
import { createAppSettingsRepository, type AppSettingsRepository } from './repository'

type AppSettingsUpdate = Database['public']['Tables']['app_settings']['Update']

// Whole so'm, positive — matches what features/payments/server/service.ts
// actually requires (Number.isSafeInteger(amount) && amount >= 1). A zero
// or fractional fee here would make every payment submission fail that
// check downstream, since amount is required to equal monthlyFee * months.
function parseAmount(value: unknown, field: string): number {
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000_000) {
    throw new ApiError(400, `${field} noto'g'ri`)
  }
  return amount
}

function parseCount(value: unknown, field: string, max: number): number {
  const count = Number(value)
  if (!Number.isInteger(count) || count < 1 || count > max) {
    throw new ApiError(400, `${field} noto'g'ri`)
  }
  return count
}

function parseText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new ApiError(400, `${field} noto'g'ri`)
  return value.trim().slice(0, maxLength)
}

const UPDATABLE_FIELDS: Record<keyof AppSettings, { column: string; parse: (value: unknown) => unknown }> = {
  monthlyFee: { column: 'monthly_fee', parse: (v) => parseAmount(v, 'Oylik to\'lov summasi') },
  yearlyContractFee: { column: 'yearly_contract_fee', parse: (v) => parseAmount(v, 'Yillik shartnoma summasi') },
  defaultRoomCapacity: { column: 'default_room_capacity', parse: (v) => parseCount(v, 'Xona sig\'imi', 20) },
  floorCount: { column: 'floor_count', parse: (v) => parseCount(v, 'Qavatlar soni', 50) },
  tarbiyachiName: { column: 'tarbiyachi_name', parse: (v) => parseText(v, 'Tarbiyachi ismi', 100) },
  tarbiyachiPhone: { column: 'tarbiyachi_phone', parse: (v) => parseText(v, 'Tarbiyachi telefoni', 30) },
  komendantName: { column: 'komendant_name', parse: (v) => parseText(v, 'Komendant ismi', 100) },
  komendantPhone: { column: 'komendant_phone', parse: (v) => parseText(v, 'Komendant telefoni', 30) },
  doctorName: { column: 'doctor_name', parse: (v) => parseText(v, 'Shifokor ismi', 100) },
  doctorPhone: { column: 'doctor_phone', parse: (v) => parseText(v, 'Shifokor telefoni', 30) },
  talabaKengashiRaisiOgilName: { column: 'talaba_kengashi_raisi_ogil_name', parse: (v) => parseText(v, 'Talaba kengashi raisi (o\'g\'il) ismi', 100) },
  talabaKengashiRaisiOgilPhone: { column: 'talaba_kengashi_raisi_ogil_phone', parse: (v) => parseText(v, 'Talaba kengashi raisi (o\'g\'il) telefoni', 30) },
  talabaKengashiRaisiQizName: { column: 'talaba_kengashi_raisi_qiz_name', parse: (v) => parseText(v, 'Talaba kengashi raisi (qiz) ismi', 100) },
  talabaKengashiRaisiQizPhone: { column: 'talaba_kengashi_raisi_qiz_phone', parse: (v) => parseText(v, 'Talaba kengashi raisi (qiz) telefoni', 30) },
  securityPhone: { column: 'security_phone', parse: (v) => parseText(v, 'Xavfsizlik telefoni', 30) },
  maxUploadSizeMb: { column: 'max_upload_size_mb', parse: (v) => parseCount(v, 'Fayl yuklash hajmi', 4) },
  warningThreshold: { column: 'warning_threshold', parse: (v) => parseCount(v, 'Ogohlantirish chegarasi', 20) },
  // Allowed to be empty on purpose — the dekan gets reminded elsewhere
  // (dekan/layout.tsx banner) rather than being blocked from saving other
  // settings just because this one isn't filled in yet.
  ttjName: { column: 'ttj_name', parse: (v) => parseText(v, 'TTJ nomi', 60) },
}

function parseUpdate(input: unknown): AppSettingsUpdate {
  if (!input || typeof input !== 'object') throw new ApiError(400, "So'rov noto'g'ri")
  const source = input as Record<string, unknown>

  const row: Record<string, unknown> = {}
  for (const [field, { column, parse }] of Object.entries(UPDATABLE_FIELDS) as Array<
    [keyof AppSettings, (typeof UPDATABLE_FIELDS)[keyof AppSettings]]
  >) {
    if (field in source) row[column] = parse(source[field])
  }
  if (Object.keys(row).length === 0) throw new ApiError(400, "O'zgartiriladigan maydon topilmadi")
  row.updated_at = new Date().toISOString()
  return row as AppSettingsUpdate
}

export function createAppSettingsService(repository: AppSettingsRepository = createAppSettingsRepository()) {
  return {
    get(): Promise<AppSettings> {
      return repository.get()
    },

    async update(input: unknown): Promise<AppSettings> {
      const row = parseUpdate(input)

      // yearlyContractFee must stay a whole multiple of monthlyFee — the
      // payment endpoint requires monthlyFee * months exactly, while the
      // student dashboard shows progress as paidAmount / yearlyContractFee;
      // an inconsistent pair would make those two disagree about what
      // "fully paid" means. Merge against the current row so a partial
      // update (changing only one of the two fields) is still checked
      // against the other's actual current value, not a stale default.
      if ('monthly_fee' in row || 'yearly_contract_fee' in row) {
        const current = await repository.get()
        const monthlyFee = 'monthly_fee' in row ? Number(row.monthly_fee) : current.monthlyFee
        const yearlyContractFee = 'yearly_contract_fee' in row ? Number(row.yearly_contract_fee) : current.yearlyContractFee
        if (yearlyContractFee % monthlyFee !== 0) {
          throw new ApiError(400, "Yillik shartnoma summasi oylik to'lovning butun karralisi bo'lishi kerak")
        }
      }

      return repository.update(row)
    },
  }
}
