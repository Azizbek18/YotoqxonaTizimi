import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { ApiError } from '@/server/http/api-error'
import { PERMIT_FACULTIES, PRIMARY_FACULTY } from '@/lib/faculties'
import type { Database } from '@/types/database.generated'
import type { AppSettings, FacultyFee } from '../types'

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
  maxUploadSizeMb: 4,
  warningThreshold: 2,
}

function toFees(row: Record<string, unknown>) {
  return {
    monthlyFee: Number(row.monthly_fee),
    yearlyContractFee: Number(row.yearly_contract_fee),
  }
}

function num(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toDormSettings(row: Record<string, unknown>) {
  return {
    defaultRoomCapacity: num(row.default_room_capacity, DORM_DEFAULTS.defaultRoomCapacity),
    floorCount: num(row.floor_count, DORM_DEFAULTS.floorCount),
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
    maxUploadSizeMb: num(row.max_upload_size_mb, DORM_DEFAULTS.maxUploadSizeMb),
    warningThreshold: num(row.warning_threshold, DORM_DEFAULTS.warningThreshold),
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
      .eq('is_primary', true)
      .maybeSingle()
    if (error) throw error
    return data?.dorm_id ?? null
  }

  // Validates an EXPLICIT dormId belongs to the faculty (any of its
  // buildings, not just primary — a faculty holding several buildings,
  // 202609300000, must be able to name a non-primary one here). Same
  // defense-in-depth pattern as room-layout/room-assignment: a foreign
  // dormId is rejected outright (403), never silently substituted.
  async function validateOwnDormId(faculty: string, dormId: string): Promise<string> {
    const { data, error } = await supabase
      .from('faculty_dorm')
      .select('dorm_id')
      .eq('faculty', faculty)
      .eq('dorm_id', dormId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new ApiError(403, 'Bu yotoqxona sizning fakultetingizga tegishli emas')
    return data.dorm_id
  }

  // For reads only: fall back to the primary building while a faculty is
  // still being set up (matches the fee fallback and PRIMARY_FACULTY).
  // `ownDorm` says whether the id is the faculty's own — the TTJ building
  // number must never be borrowed from another building (see getDormSettings).
  // An explicit dormId (a specific building the dekan is looking at, e.g. a
  // non-primary one) takes priority over that fallback chain entirely.
  async function resolveDormIdForRead(faculty: string, dormId?: string): Promise<{ dormId: string | null; ownDorm: boolean }> {
    if (dormId) return { dormId: await validateOwnDormId(faculty, dormId), ownDorm: true }
    const own = await ownDormId(faculty)
    if (own) return { dormId: own, ownDorm: true }
    if (faculty !== PRIMARY_FACULTY) return { dormId: await ownDormId(PRIMARY_FACULTY), ownDorm: false }
    return { dormId: null, ownDorm: false }
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

  async function getDormSettings(faculty: string, dormId?: string) {
    try {
      const { dormId: resolvedDormId, ownDorm } = await resolveDormIdForRead(faculty, dormId)
      if (resolvedDormId) {
        const { data, error } = await supabase
          .from('dorms')
          .select(DORM_COLUMNS)
          .eq('id', resolvedDormId)
          .maybeSingle()
        if (error) throw error
        if (data) {
          const settings = toDormSettings(data as Record<string, unknown>)
          // ttj_name is the building's official number and lands on the
          // imtiyozli Ariza/Tilxat ("__-sonli talabalar turar joyi"). A
          // faculty with no dorm of its own must show a blank to fill in,
          // never the primary building's number.
          if (!ownDorm) settings.ttjName = ''
          return settings
        }
      }
    } catch (error) {
      // Deploy window: this code can go live a few minutes before
      // `supabase db push` creates `dorms` / `faculty_dorm`. While those
      // tables are missing, read the non-fee settings from the old
      // `app_settings` columns (still present until 202609150000 drops
      // them). Once the migrations land this branch is never taken.
      const fallback = await getDormSettingsFromAppSettings(faculty)
      if (fallback) return fallback
      console.error('Dorm settings lookup failed and legacy fallback empty:', error)
    }
    return { ...DORM_DEFAULTS, ttjName: '' }
  }

  async function getDormSettingsFromAppSettings(faculty: string) {
    const pick = async (f: string) => {
      const { data, error } = await supabase.from('app_settings').select('*').eq('faculty', f).maybeSingle()
      if (error) throw error
      const row = data as Record<string, unknown> | null
      // Only usable while 202609150000 hasn't dropped the columns yet.
      if (!row || row.floor_count == null) return null
      return toDormSettings(row)
    }
    try {
      return (await pick(faculty)) ?? (faculty !== PRIMARY_FACULTY ? await pick(PRIMARY_FACULTY) : null)
    } catch {
      return null
    }
  }

  async function get(faculty: string = PRIMARY_FACULTY, dormId?: string): Promise<AppSettings> {
    const [fees, dormSettings] = await Promise.all([getFees(faculty), getDormSettings(faculty, dormId)])
    return { ...dormSettings, ...fees }
  }

  // Every faculty's effective fee pair in one query — for the superadmin
  // fee table. A faculty with no row of its own shows the primary
  // building's fees (or the built-in default) and `configured: false`.
  async function listFacultyFees(): Promise<FacultyFee[]> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('faculty, monthly_fee, yearly_contract_fee')
    if (error) throw error
    const byFaculty = new Map(
      ((data ?? []) as Array<Record<string, unknown>>).map((row) => [
        String(row.faculty ?? '').trim().toLowerCase(),
        row,
      ]),
    )
    const primary = byFaculty.get(PRIMARY_FACULTY)
    return PERMIT_FACULTIES.map((f) => {
      const own = byFaculty.get(f.value)
      const src = own ?? primary
      return {
        faculty: f.value,
        facultyLabel: f.label,
        monthlyFee: src ? Number(src.monthly_fee) : FEE_DEFAULTS.monthlyFee,
        yearlyContractFee: src ? Number(src.yearly_contract_fee) : FEE_DEFAULTS.yearlyContractFee,
        configured: Boolean(own),
      }
    })
  }

  return {
    get,
    listFacultyFees,

    async update(row: AppSettingsUpdate, faculty: string = PRIMARY_FACULTY, dormId?: string): Promise<AppSettings> {
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
        // An explicit dormId (editing a SPECIFIC one of the faculty's
        // buildings, 202609300000) takes priority; omitted keeps writing to
        // the faculty's primary building, byte-identical to before this
        // parameter existed.
        const targetDormId = dormId ? await validateOwnDormId(faculty, dormId) : await ownDormId(faculty)
        if (!targetDormId) throw new Error(`Fakultetга yotoqxona biriktirilmagan: ${faculty}`)

        // Can't shrink the building below a floor a faculty has claimed —
        // that floor's dorm_floor row (and any rooms on it) would be
        // orphaned out of view.
        if (dormRow.floor_count !== undefined) {
          const nextCount = Number(dormRow.floor_count)
          const { data: claimed } = await supabase
            .from('dorm_floor')
            .select('floor_number')
            .eq('dorm_id', targetDormId)
            .gt('floor_number', nextCount)
            .order('floor_number', { ascending: false })
            .limit(1)
          if (claimed && claimed.length > 0) {
            throw new ApiError(
              409,
              `Qavatlar sonini kamaytirib bo‘lmaydi — ${claimed[0].floor_number}-qavat fakultetga biriktirilgan`,
            )
          }
        }

        const { error } = await supabase
          .from('dorms')
          .update({ ...dormRow, updated_at: new Date().toISOString() })
          .eq('id', targetDormId)
        if (error) throw error
      }

      return get(faculty, dormId)
    },
  }
}

export type AppSettingsRepository = ReturnType<typeof createAppSettingsRepository>
