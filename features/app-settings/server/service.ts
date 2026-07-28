import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { Database } from '@/types/database.generated'
import type { AppSettings } from '../types'
import { createAppSettingsRepository, type AppSettingsRepository } from './repository'

type AppSettingsUpdate = Database['public']['Tables']['app_settings']['Update']

function parseAmount(value: unknown, field: string): number {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
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
  maxUploadSizeMb: { column: 'max_upload_size_mb', parse: (v) => parseCount(v, 'Fayl yuklash hajmi', 50) },
  warningThreshold: { column: 'warning_threshold', parse: (v) => parseCount(v, 'Ogohlantirish chegarasi', 20) },
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

    update(input: unknown): Promise<AppSettings> {
      return repository.update(parseUpdate(input))
    },
  }
}
