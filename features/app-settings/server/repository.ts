import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { Database } from '@/types/database.generated'
import type { AppSettings } from '../types'

type AppSettingsUpdate = Database['public']['Tables']['app_settings']['Update']

const COLUMNS = 'monthly_fee, yearly_contract_fee, default_room_capacity, floor_count, tarbiyachi_name, tarbiyachi_phone, komendant_name, komendant_phone, doctor_name, doctor_phone, talaba_kengashi_raisi_ogil_name, talaba_kengashi_raisi_ogil_phone, talaba_kengashi_raisi_qiz_name, talaba_kengashi_raisi_qiz_phone, security_phone, max_upload_size_mb, warning_threshold, ttj_name'

function toAppSettings(row: Record<string, unknown>): AppSettings {
  return {
    monthlyFee: Number(row.monthly_fee),
    yearlyContractFee: Number(row.yearly_contract_fee),
    defaultRoomCapacity: Number(row.default_room_capacity),
    floorCount: Number(row.floor_count),
    tarbiyachiName: String(row.tarbiyachi_name ?? ''),
    tarbiyachiPhone: String(row.tarbiyachi_phone ?? ''),
    komendantName: String(row.komendant_name ?? ''),
    komendantPhone: String(row.komendant_phone ?? ''),
    doctorName: String(row.doctor_name ?? ''),
    doctorPhone: String(row.doctor_phone ?? ''),
    talabaKengashiRaisiOgilName: String(row.talaba_kengashi_raisi_ogil_name ?? ''),
    talabaKengashiRaisiOgilPhone: String(row.talaba_kengashi_raisi_ogil_phone ?? ''),
    talabaKengashiRaisiQizName: String(row.talaba_kengashi_raisi_qiz_name ?? ''),
    talabaKengashiRaisiQizPhone: String(row.talaba_kengashi_raisi_qiz_phone ?? ''),
    securityPhone: String(row.security_phone ?? ''),
    maxUploadSizeMb: Number(row.max_upload_size_mb),
    warningThreshold: Number(row.warning_threshold),
    ttjName: String(row.ttj_name ?? ''),
  }
}

export function createAppSettingsRepository() {
  const supabase = getServiceSupabase()

  return {
    async get() {
      const { data, error } = await supabase.from('app_settings').select(COLUMNS).eq('id', 1).single()
      if (error) throw error
      return toAppSettings(data as Record<string, unknown>)
    },

    async update(row: AppSettingsUpdate) {
      const { data, error } = await supabase.from('app_settings').update(row).eq('id', 1).select(COLUMNS).single()
      if (error) throw error
      return toAppSettings(data as Record<string, unknown>)
    },
  }
}

export type AppSettingsRepository = ReturnType<typeof createAppSettingsRepository>
