import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { PRIMARY_FACULTY } from '@/lib/faculties'
import type { Database } from '@/types/database.generated'
import type { AppSettings } from '../types'

type AppSettingsUpdate = Database['public']['Tables']['app_settings']['Update']

// Since P2 (202609150000) settings live in two tables: the two fee amounts
// stay per-faculty in `app_settings`; everything else — capacity, floors,
// TTJ name, every contact — is the building's, in `dorms`, reached through
// `faculty_dorm`. The merged `AppSettings` DTO is unchanged so every caller
// (~25 of them) is untouched.
const FEE_COLUMNS = 'monthly_fee, yearly_contract_fee'
const DORM_COLUMNS =
  'default_room_capacity, floor_count, tarbiyachi_name, tarbiyachi_phone, komendant_name, komendant_phone, doctor_name, doctor_phone, talaba_kengashi_raisi_ogil_name, talaba_kengashi_raisi_ogil_phone, talaba_kengashi_raisi_qiz_name, talaba_kengashi_raisi_qiz_phone, security_phone, max_upload_size_mb, warning_threshold, ttj_name'

const FEE_DEFAULTS = { monthlyFee: 300000, yearlyContractFee: 3000000 }
const DORM_DEFAULTS = {
  defaultRoomCapacity: 4,
  floorCount: 5,
  tarbiyachiName: '',
  tarbiyachiPhone: '',
  komendantName: '',
  komendantPhone: '',
  doctorName: '',
  doctorPhone: '',
  talabaKengashiRaisiOgilName: '',
  talabaKengashiRaisiOgilPhone: '',
  talabaKengashiRaisiQizName: '',
  talabaKengashiRaisiQizPhone: '',
  securityPhone: '',
  maxUploadSizeMb: 5,
  warningThreshold: 2,
}

function toFees(row: Record<string, unknown>) {
  return {
    monthlyFee: Number(row.monthly_fee),
    yearlyContractFee: Number(row.yearly_contract_fee),
  }
}

function toDormSettings(row: Record<string, unknown>) {
  return {
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

  // The faculty's OWN dorm — nothing else. Writes use this so a faculty
  // with no dorm of its own can never edit another building's row.
  async function ownDormId(faculty: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('faculty_dorm')
      .select('dorm_id')
      .eq('faculty', faculty)
      .maybeSingle()
    if (error) throw error
    return data?.dorm_id ?? null
  }

  // For reads only: fall back to the primary building while a faculty is
  // still being set up (matches the fee fallback and PRIMARY_FACULTY).
  async function resolveDormIdForRead(faculty: string): Promise<string | null> {
    const own = await ownDormId(faculty)
    if (own) return own
    if (faculty !== PRIMARY_FACULTY) return ownDormId(PRIMARY_FACULTY)
    return null
  }

  async function getFees(faculty: string) {
    const { data, error } = await supabase
      .from('app_settings')
      .select(FEE_COLUMNS)
      .eq('faculty', faculty)
      .maybeSingle()
    if (error) throw error
    if (data) return toFees(data as Record<string, unknown>)

    if (faculty !== PRIMARY_FACULTY) {
      const { data: fb } = await supabase
        .from('app_settings')
        .select(FEE_COLUMNS)
        .eq('faculty', PRIMARY_FACULTY)
        .maybeSingle()
      if (fb) return toFees(fb as Record<string, unknown>)
    }
    return { ...FEE_DEFAULTS }
  }

  async function getDormSettings(faculty: string) {
    const dormId = await resolveDormIdForRead(faculty)
    if (dormId) {
      const { data, error } = await supabase
        .from('dorms')
        .select(DORM_COLUMNS)
        .eq('id', dormId)
        .maybeSingle()
      if (error) throw error
      if (data) return toDormSettings(data as Record<string, unknown>)
    }
    return { ...DORM_DEFAULTS, ttjName: '' }
  }

  async function get(faculty: string = PRIMARY_FACULTY): Promise<AppSettings> {
    const [fees, dormSettings] = await Promise.all([getFees(faculty), getDormSettings(faculty)])
    return { ...dormSettings, ...fees }
  }

  return {
    get,

    async update(row: AppSettingsUpdate, faculty: string = PRIMARY_FACULTY): Promise<AppSettings> {
      const source = row as Record<string, unknown>
      const feeRow: Record<string, unknown> = {}
      const dormRow: Record<string, unknown> = {}
      for (const [column, value] of Object.entries(source)) {
        if (column === 'updated_at') continue
        if (column === 'monthly_fee' || column === 'yearly_contract_fee') feeRow[column] = value
        else dormRow[column] = value
      }

      if (Object.keys(feeRow).length > 0) {
        const { error } = await supabase
          .from('app_settings')
          .upsert(
            { faculty, ...feeRow, updated_at: new Date().toISOString() },
            { onConflict: 'faculty' },
          )
        if (error) throw error
      }

      if (Object.keys(dormRow).length > 0) {
        const dormId = await ownDormId(faculty)
        if (!dormId) throw new Error(`Fakultetга yotoqxona biriktirilmagan: ${faculty}`)
        const { error } = await supabase
          .from('dorms')
          .update({ ...dormRow, updated_at: new Date().toISOString() })
          .eq('id', dormId)
        if (error) throw error
      }

      return get(faculty)
    },
  }
}

export type AppSettingsRepository = ReturnType<typeof createAppSettingsRepository>
