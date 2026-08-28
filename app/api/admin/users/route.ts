import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'
import { ApiError } from '@/server/http/api-error'
import { normalizeDirection } from '@/lib/directions'
import type { StaffRow, UserRow } from '@/types/database.generated'
import { createAppSettingsService } from '@/features/app-settings/server/service'

type UserSource = 'users' | 'staff'
type UserRole = 'talaba' | 'tarbiyachi' | 'dekan' | 'admin'

export function resolveDeleteTarget(
  submittedSource: UserSource,
  student: { id: string } | null,
  staff: { id: string; role: string } | null,
): UserSource {
  if (student && staff) {
    throw new ApiError(409, "Hisob bir nechta profil jadvalida topildi; o'chirish xavfsizlik sabab to'xtatildi")
  }
  if (!student && !staff) throw new ApiError(404, 'Foydalanuvchi topilmadi')

  const resolvedSource: UserSource = staff ? 'staff' : 'users'
  if (submittedSource !== resolvedSource) {
    throw new ApiError(409, "Foydalanuvchi manbasi eskirgan yoki noto'g'ri")
  }
  if (staff?.role === 'dekan') {
    throw new ApiError(403, "Dekan profilini admin panelidan o'chirib bo'lmaydi")
  }
  return resolvedSource
}

type AdminUserRow = {
  id: string
  full_name: string
  email: string
  role: UserRole
  created_at: string
  updated_at?: string | null
  source: UserSource
  avatar_url?: string | null
  phone?: string | null
  faculty?: string | null
  direction?: string | null
  course?: number | null
  group?: string | number | null
  room_number?: string | null
  status?: string | null
  middle_name?: string | null
  region?: string | null
  district?: string | null
  mahalla?: string | null
  passport_series?: string | null
  jshshir?: string | null
  passport_date?: string | null
  birth_date?: string | null
  nationality?: string | null
  study_type?: string | null
  gender?: string | null
  father_full_name?: string | null
  father_workplace?: string | null
  father_phone?: string | null
  mother_full_name?: string | null
  mother_workplace?: string | null
  mother_phone?: string | null
  entry_date?: string | null
  assigned_floor?: number | null
  assigned_gender?: string | null
  is_floor_captain?: boolean | null
  warning_count?: number | null
}

type RawStudentRow = Record<string, unknown> & {
  id: string
  full_name: string
  email: string
  role: UserRole
  created_at: string
}

type AdminUserUpdates = {
  full_name?: string
  phone?: string
  faculty?: string
  direction?: string
  course?: number
  group?: string
  room_number?: string
  status?: string
  middle_name?: string
  region?: string
  district?: string
  mahalla?: string
  passport_series?: string
  jshshir?: string
  passport_date?: string
  birth_date?: string
  nationality?: string
  study_type?: string
  gender?: string
  father_full_name?: string
  father_workplace?: string
  father_phone?: string
  mother_full_name?: string
  mother_workplace?: string
  mother_phone?: string
  entry_date?: string
  assigned_floor?: number
  assigned_gender?: string
}

function mapStudentRow(user: RawStudentRow): AdminUserRow {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    created_at: String(user.created_at ?? ''),
    updated_at: null,
    source: 'users',
    avatar_url: (user.avatar_url as string | null | undefined) ?? null,
    phone: ((user.phone as string | null | undefined) ?? (user.phone_number as string | null | undefined)) ?? null,
    faculty: (user.faculty as string | null | undefined) ?? null,
    direction: (user.direction as string | null | undefined) ?? null,
    course: (user.course as number | null | undefined) ?? null,
    group: (user.group as string | number | null | undefined) ?? null,
    room_number: (user.room_number as string | null | undefined) ?? null,
    status: (user.status as string | null | undefined) ?? null,
    middle_name: (user.middle_name as string | null | undefined) ?? null,
    region: (user.region as string | null | undefined) ?? null,
    district: (user.district as string | null | undefined) ?? null,
    mahalla: (user.mahalla as string | null | undefined) ?? null,
    passport_series: (user.passport_series as string | null | undefined) ?? null,
    jshshir: (user.jshshir as string | null | undefined) ?? null,
    passport_date: (user.passport_date as string | null | undefined) ?? null,
    birth_date: (user.birth_date as string | null | undefined) ?? null,
    nationality: (user.nationality as string | null | undefined) ?? null,
    study_type: (user.study_type as string | null | undefined) ?? null,
    gender: (user.gender as string | null | undefined) ?? null,
    father_full_name: (user.father_full_name as string | null | undefined) ?? null,
    father_workplace: (user.father_workplace as string | null | undefined) ?? null,
    father_phone: (user.father_phone as string | null | undefined) ?? null,
    mother_full_name: (user.mother_full_name as string | null | undefined) ?? null,
    mother_workplace: (user.mother_workplace as string | null | undefined) ?? null,
    mother_phone: (user.mother_phone as string | null | undefined) ?? null,
    entry_date: (user.entry_date as string | null | undefined) ?? null,
    assigned_floor: (user.assigned_floor as number | null | undefined) ?? null,
    is_floor_captain: (user.is_floor_captain as boolean | null | undefined) ?? false,
    warning_count: (user.warning_count as number | null | undefined) ?? 0,
  }
}

function mapStaffRow(user: Record<string, unknown> & {
  id: string
  full_name: string
  email: string
  role: UserRole
  created_at: string
}): AdminUserRow {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    created_at: String(user.created_at ?? ''),
    updated_at: null,
    source: 'staff',
    phone: ((user.phone as string | null | undefined) ?? (user.phone_number as string | null | undefined)) ?? null,
    status: (user.status as string | null | undefined) ?? null,
    assigned_floor: (user.assigned_floor as number | null | undefined) ?? null,
    assigned_gender: (user.assigned_gender as string | null | undefined) ?? null,
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

// Bounded integer variant for fields where a negative, fractional, or
// absurdly large value would either be nonsensical (course, floor) or
// silently corrupt downstream logic that assumes a small whole number.
// Returns `null` (invalid) distinctly from `undefined` (field not sent).
function normalizeBoundedInt(value: unknown, min: number, max: number): number | null | undefined {
  const parsed = normalizeOptionalNumber(value)
  if (parsed === undefined) return undefined
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null
  return parsed
}

const VALID_STATUSES = new Set(['pending', 'active', 'rejected'])
const VALID_GENDERS = new Set(['male', 'female'])

function buildStudentUpdates(body: Record<string, unknown>) {
  const updates: Record<string, string | number | boolean | null> = {}

  const stringFields: Array<keyof AdminUserUpdates> = [
    'full_name',
    'faculty',
    'group',
    'room_number',
    'middle_name',
    'region',
    'district',
    'mahalla',
    'passport_series',
    'jshshir',
    'passport_date',
    'birth_date',
    'nationality',
    'study_type',
    'father_full_name',
    'father_workplace',
    'father_phone',
    'mother_full_name',
    'mother_workplace',
    'mother_phone',
    'entry_date',
  ]

  for (const field of stringFields) {
    if (field in body) {
      const normalized = normalizeOptionalString(body[field])
      if (normalized !== undefined) {
        updates[field] = normalized
      }
    }
  }

  if ('phone' in body) {
    const normalizedPhone = normalizeOptionalString(body.phone)
    if (normalizedPhone !== undefined) {
      updates.phone_number = normalizedPhone
    }
  }

  // Yo'nalish kanonik ro'yxatdan bo'lishi shart — bo'lmasa bir yo'nalish
  // ikki xil yozuvda saqlanib, guruhlash/filtr/eksport buziladi.
  if ('direction' in body) {
    const rawDirection = normalizeOptionalString(body.direction)
    if (rawDirection !== undefined) {
      if (rawDirection === null) {
        updates.direction = null
      } else {
        const canonical = normalizeDirection(rawDirection)
        if (!canonical) throw new ApiError(400, "Yo'nalish noto'g'ri")
        updates.direction = canonical
      }
    }
  }

  if ('status' in body) {
    const status = normalizeOptionalString(body.status)
    if (status !== undefined) {
      if (status === null || !VALID_STATUSES.has(status)) throw new ApiError(400, "Status noto'g'ri")
      updates.status = status
    }
  }

  if ('gender' in body) {
    const gender = normalizeOptionalString(body.gender)
    if (gender !== undefined) {
      if (gender === null || !VALID_GENDERS.has(gender)) throw new ApiError(400, "Jins noto'g'ri")
      updates.gender = gender
    }
  }

  if ('course' in body) {
    const course = normalizeBoundedInt(body.course, 1, 6)
    if (course === null) throw new ApiError(400, "Kurs noto'g'ri")
    if (course !== undefined) updates.course = course
  }

  if ('is_floor_captain' in body) {
    updates.is_floor_captain = Boolean(body.is_floor_captain)
  }

  if ('assigned_floor' in body) {
    if (body.assigned_floor === null || body.assigned_floor === '') {
      updates.assigned_floor = null
    } else {
      const floor = normalizeBoundedInt(body.assigned_floor, 1, 50)
      if (floor === null) throw new ApiError(400, "Qavat noto'g'ri")
      updates.assigned_floor = floor ?? null
    }
  }

  if ('warning_count' in body) {
    const warningCount = normalizeBoundedInt(body.warning_count, 0, 1000)
    if (warningCount === null) throw new ApiError(400, "Ogohlantirishlar soni noto'g'ri")
    updates.warning_count = warningCount ?? 0
  }

  return updates
}

function buildStaffUpdates(body: Record<string, unknown>) {
  const updates: Record<string, string | number | null> = {}

  const fullName = normalizeOptionalString(body.full_name)
  if (fullName !== undefined) updates.full_name = fullName

  const phone = normalizeOptionalString(body.phone)
  if (phone !== undefined) updates.phone_number = phone

  const status = normalizeOptionalString(body.status)
  if (status !== undefined) {
    if (status === null || !VALID_STATUSES.has(status)) throw new ApiError(400, "Status noto'g'ri")
    updates.status = status
  }

  const assignedGender = normalizeOptionalString(body.assigned_gender)
  if (assignedGender !== undefined) {
    if (assignedGender === null || !VALID_GENDERS.has(assignedGender)) throw new ApiError(400, "Jins noto'g'ri")
    updates.assigned_gender = assignedGender
  }

  if ('assigned_floor' in body) {
    if (body.assigned_floor === null || body.assigned_floor === '') {
      updates.assigned_floor = null
    } else {
      const assignedFloor = normalizeBoundedInt(body.assigned_floor, 1, 50)
      if (assignedFloor === null) throw new ApiError(400, "Qavat noto'g'ri")
      updates.assigned_floor = assignedFloor ?? null
    }
  }

  return updates
}

export async function GET() {
  try {
    const { session, isAdmin } = await getAdminSession()

    if (!session?.user?.id) {
      return jsonError('Autentifikatsiya talab qilinadi', 401)
    }

    if (!isAdmin) {
      return jsonError('Admin huquqi talab qilinadi', 403)
    }

    const supabase = getServiceSupabase()

    const [{ data: students, error: studentsError }, { data: staff, error: staffError }] = await Promise.all([
      supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('staff')
        .select('id, full_name, email, role, created_at, phone_number, status, assigned_floor, assigned_gender')
        .order('created_at', { ascending: false }),
    ])

    if (studentsError) {
      console.error('Admin student lookup failed:', studentsError)
      return jsonError('Talabalarni yuklab bo‘lmadi', 500)
    }

    if (staffError) {
      console.error('Admin staff lookup failed:', staffError)
      return jsonError('Xodimlarni yuklab bo‘lmadi', 500)
    }

    const combined: AdminUserRow[] = [
      ...((students ?? []).map((user) => mapStudentRow(user as RawStudentRow)) as AdminUserRow[]),
      ...((staff ?? []).map((user) => mapStaffRow(user as Record<string, unknown> & {
        id: string
        full_name: string
        email: string
        role: UserRole
        created_at: string
      })) as AdminUserRow[]),
    ].sort((a, b) => {
      const aTime = new Date(a.created_at ?? 0).getTime()
      const bTime = new Date(b.created_at ?? 0).getTime()
      return bTime - aTime
    })

    return NextResponse.json({ ok: true, users: combined })
  } catch (error) {
    console.error('Admin users GET xato:', error)
    return jsonError('Foydalanuvchilarni yuklashda server xatosi yuz berdi', 500)
  }
}

export async function PATCH(request: Request) {
  try {
    const { session, isAdmin } = await getAdminSession()

    if (!session?.user?.id) {
      return jsonError('Autentifikatsiya talab qilinadi', 401)
    }

    if (!isAdmin) {
      return jsonError('Admin huquqi talab qilinadi', 403)
    }

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const role = body.role as UserRole | undefined
    const source = body.source as UserSource

    if (!id || (source !== 'users' && source !== 'staff')) {
      return jsonError("So'rov ma'lumotlari noto'g'ri", 400)
    }

    if (source === 'users' && role && role !== 'talaba') {
      return jsonError("Talaba yozuvini staff roliga o'tkazib bo'lmaydi", 400)
    }

    if (source === 'staff' && role === 'talaba') {
      return jsonError("Staff yozuvini talaba roliga o'tkazib bo'lmaydi", 400)
    }

    // Dekan admindan yuqori lavozim: bu rolga faqat maxfiy ro'yxatdan
    // o'tish oqimi (portal link + register kod + ruxsat etilgan ID) orqali
    // tayinlanadi, admin panelidan emas.
    if (role === 'dekan') {
      return jsonError("Dekan roli faqat rasmiy ro'yxatdan o'tish orqali beriladi", 403)
    }

    if (role && !['talaba', 'tarbiyachi', 'admin'].includes(role)) {
      return jsonError("Noto'g'ri rol", 400)
    }

    const supabase = getServiceSupabase()

    let existingStaff: {
      role: string
      status: string | null
      assigned_floor: number | null
      assigned_gender: string | null
    } | null = null
    if (source === 'staff') {
      const { data, error: existingError } = await supabase
        .from('staff')
        .select('role, status, assigned_floor, assigned_gender')
        .eq('id', id)
        .maybeSingle()
      existingStaff = data

      if (existingError) {
        console.error('Admin staff scope lookup failed:', existingError)
        return jsonError('Xodim profilini tekshirib bo‘lmadi', 500)
      }

      if (existingStaff?.role === 'dekan') {
        return jsonError("Dekan profilini admin panelidan o'zgartirib bo'lmaydi", 403)
      }
    }

    const updates =
      source === 'users'
        ? buildStudentUpdates(body as Record<string, unknown>)
        : buildStaffUpdates(body as Record<string, unknown>)

    if (role) {
      updates.role = role
    }

    if (source === 'staff' && existingStaff) {
      const effectiveRole = typeof updates.role === 'string' ? updates.role : existingStaff.role
      const effectiveStatus = typeof updates.status === 'string' ? updates.status : existingStaff.status
      const effectiveFloor = 'assigned_floor' in updates
        ? updates.assigned_floor
        : existingStaff.assigned_floor
      const effectiveGender = 'assigned_gender' in updates
        ? updates.assigned_gender
        : existingStaff.assigned_gender

      if (effectiveRole === 'tarbiyachi' && effectiveStatus === 'active') {
        const { floorCount } = await createAppSettingsService().get()
        if (
          typeof effectiveFloor !== 'number'
          || !Number.isInteger(effectiveFloor)
          || effectiveFloor < 1
          || effectiveFloor > floorCount
        ) {
          return jsonError(`Faol tarbiyachi uchun 1–${floorCount} oralig‘idagi qavat majburiy`, 400)
        }
        if (effectiveGender !== 'male' && effectiveGender !== 'female') {
          return jsonError('Faol tarbiyachi uchun jins doirasi majburiy', 400)
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return jsonError("Yangilash uchun ma'lumot topilmadi", 400)
    }

    if (source === 'users' && updates.is_floor_captain === true) {
      // is_floor_captain=true is only meaningful together with a floor and
      // a gender — the uniqueness guarantee (users_floor_captain_unique_idx
      // on (faculty, assigned_floor, gender) WHERE is_floor_captain) doesn't
      // catch NULLs (SQL never treats NULL = NULL), so without this check an
      // admin could create multiple "captain" rows with no floor/gender at
      // all, none of which would ever conflict with each other.
      // promote_floor_captain derives the faculty (building) from the target
      // student's own users.faculty and demotes only that building's
      // current captain for the floor/gender.
      const { data: currentUser } = await supabase
        .from('users')
        .select('assigned_floor, gender')
        .eq('id', id)
        .maybeSingle()

      const effectiveAssignedFloor = 'assigned_floor' in updates
        ? (typeof updates.assigned_floor === 'number' ? updates.assigned_floor : null)
        : (currentUser?.assigned_floor ?? null)
      // Uses updates.gender (this same request's new value) when present —
      // not just currentUser's pre-update gender — so a request that
      // changes floor/gender AND promotes to captain in one call demotes
      // the *correct* (new) bucket's existing captain, not the old one.
      const effectiveGender = 'gender' in updates
        ? (typeof updates.gender === 'string' ? updates.gender : null)
        : (currentUser?.gender ?? null)

      if (!effectiveAssignedFloor || !effectiveGender) {
        return jsonError("Sardor tayinlash uchun talabaga qavat va jins belgilangan bo'lishi shart", 400)
      }

      // Demoting the previous captain and writing this user's own
      // assigned_floor/gender/is_floor_captain happens in a single atomic
      // RPC call (see 202607280012) — two separate UPDATEs here would let
      // a failure on the second leave the floor with no captain at all,
      // and updates.gender wouldn't actually reach the users row until the
      // later generic update ran (a second non-atomic step).
      const { error: promoteError } = await supabase.rpc('promote_floor_captain', {
        p_user_id: id,
        p_assigned_floor: effectiveAssignedFloor,
        p_gender: effectiveGender,
        p_is_captain: true,
      })
      if (promoteError) {
        console.error('Floor captain promotion failed:', promoteError)
        return jsonError('Qavat sardorini tayinlab bo‘lmadi', 500)
      }

      delete updates.assigned_floor
      delete updates.gender
      delete updates.is_floor_captain
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true })
    }

    const { error } = source === 'users'
      ? await supabase.from('users').update(updates as Partial<UserRow>).eq('id', id)
      : await supabase.from('staff').update(updates as Partial<StaffRow>).eq('id', id)

    if (error) {
      if (error.code === '23505' && source === 'users' && updates.is_floor_captain === true) {
        return jsonError("Bu qavat va jins uchun sardor allaqachon tayinlangan", 409)
      }
      console.error('Admin user update failed:', error)
      return jsonError('Foydalanuvchini yangilab bo‘lmadi', 500)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status)
    }
    console.error('Admin users PATCH xato:', error)
    return jsonError("Foydalanuvchini yangilashda server xatosi yuz berdi", 500)
  }
}

export async function DELETE(request: Request) {
  try {
    const { session, isAdmin } = await getAdminSession()

    if (!session?.user?.id) {
      return jsonError('Autentifikatsiya talab qilinadi', 401)
    }

    if (!isAdmin) {
      return jsonError('Admin huquqi talab qilinadi', 403)
    }

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const source = body.source as UserSource

    if (!id || (source !== 'users' && source !== 'staff')) {
      return jsonError("So'rov ma'lumotlari noto'g'ri", 400)
    }

    if (id === session.user.id) {
      return jsonError("O'zingizni o'chirib bo'lmaydi", 400)
    }

    const supabase = getServiceSupabase()
    // `source` comes from the browser and cannot decide which authorization
    // rules apply. Resolve the target from the database first, then require
    // the submitted source to match that server-side result.
    const [studentResult, staffResult] = await Promise.all([
      supabase
        .from('users')
        .select('id')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('staff')
        .select('id, role')
        .eq('id', id)
        .maybeSingle(),
    ])

    if (studentResult.error || staffResult.error) {
      console.error('Admin delete target lookup failed:', studentResult.error ?? staffResult.error)
      return jsonError('Foydalanuvchini tekshirib bo‘lmadi', 500)
    }
    const table = resolveDeleteTarget(source, studentResult.data, staffResult.data)

    // Auth account first, profile row second: these are two separate
    // systems with no shared transaction, so whichever step runs first is
    // the one that can leave a dangling remnant if the second step fails.
    // A dangling profile row (auth gone, row still there) is inert data an
    // admin can clean up later; a dangling auth account (profile gone, auth
    // still there) is a "ghost" that can still log in with none of the
    // active-profile checks finding a row — the worse failure mode of the
    // two, so it's the one we avoid by ordering this way.
    const { error: authError } = await supabase.auth.admin.deleteUser(id)
    if (authError) {
      console.error('Admin Auth user delete failed:', authError)
      return jsonError("Hisobni o'chirib bo'lmadi", 500)
    }

    const { error: dbError } = await supabase
      .from(table)
      .delete()
      .eq('id', id)

    if (dbError) {
      console.error(`Admin users DELETE: auth user ${id} was deleted but profile row cleanup failed:`, dbError)
      return jsonError(
        "Hisob o'chirildi, lekin profil yozuvini tozalashda xatolik yuz berdi. Administratorga murojaat qiling.",
        500,
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status)
    }
    console.error('Admin users DELETE xato:', error)
    return jsonError("Foydalanuvchini o'chirishda server xatosi yuz berdi", 500)
  }
}
