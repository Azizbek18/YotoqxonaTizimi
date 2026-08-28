import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { PRIMARY_FACULTY } from '@/lib/faculties'
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
    // A faculty with no per-faculty row yet reads the primary building's
    // settings — the transition state until every faculty's dorm data is
    // populated (multi-faculty migration, Bosqich 3).
    async get(faculty: string = PRIMARY_FACULTY) {
      const { data, error } = await supabase
        .from('app_settings')
        .select(COLUMNS)
        .eq('faculty', faculty)
        .maybeSingle()
      if (error) throw error
      if (data) return toAppSettings(data as Record<string, unknown>)

      if (faculty !== PRIMARY_FACULTY) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('app_settings')
          .select(COLUMNS)
          .eq('faculty', PRIMARY_FACULTY)
          .maybeSingle()
        if (fallbackError) throw fallbackError
        if (fallback) return toAppSettings(fallback as Record<string, unknown>)
      }
      throw new Error(`app_settings qatori topilmadi: ${faculty}`)
    },

    async update(row: AppSettingsUpdate, faculty: string = PRIMARY_FACULTY) {
      const { data, error } = await supabase
        .from('app_settings')
        .update(row)
        .eq('faculty', faculty)
        .select(COLUMNS)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error(`app_settings qatori topilmadi: ${faculty}`)
      return toAppSettings(data as Record<string, unknown>)
    },
  }
}

export type AppSettingsRepository = ReturnType<typeof createAppSettingsRepository>
