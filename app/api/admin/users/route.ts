import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'

type UserSource = 'users' | 'staff'
type UserRole = 'talaba' | 'tarbiyachi' | 'admin'

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
    phone: ((user.phone as string | null | undefined) ?? (user.phoneNumber as string | null | undefined)) ?? null,
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

function buildStudentUpdates(body: Record<string, unknown>) {
  const updates: Record<string, string | number | null> = {}

  const stringFields: Array<keyof AdminUserUpdates> = [
    'full_name',
    'faculty',
    'direction',
    'group',
    'room_number',
    'status',
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
    'gender',
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
      updates.phoneNumber = normalizedPhone
    }
  }

  if ('course' in body) {
    const normalizedCourse = normalizeOptionalNumber(body.course)
    if (normalizedCourse !== undefined) {
      updates.course = normalizedCourse
    }
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
  if (status !== undefined) updates.status = status

  const assignedGender = normalizeOptionalString(body.assigned_gender)
  if (assignedGender !== undefined) updates.assigned_gender = assignedGender

  if ('assigned_floor' in body) {
    const assignedFloor = normalizeOptionalNumber(body.assigned_floor)
    updates.assigned_floor = assignedFloor ?? null
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
      return jsonError(studentsError.message, 500)
    }

    if (staffError) {
      return jsonError(staffError.message, 500)
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

    const supabase = getServiceSupabase()
    const table = source === 'users' ? 'users' : 'staff'
    const updates =
      source === 'users'
        ? buildStudentUpdates(body as Record<string, unknown>)
        : buildStaffUpdates(body as Record<string, unknown>)

    if (role) {
      updates.role = role
    }

    if (Object.keys(updates).length === 0) {
      return jsonError("Yangilash uchun ma'lumot topilmadi", 400)
    }

    const { error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)

    if (error) {
      return jsonError(error.message, 400)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
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
    const table = source === 'users' ? 'users' : 'staff'

    const { error: dbError } = await supabase
      .from(table)
      .delete()
      .eq('id', id)

    if (dbError) {
      return jsonError(dbError.message, 400)
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(id)
    if (authError) {
      return jsonError(authError.message, 400)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin users DELETE xato:', error)
    return jsonError("Foydalanuvchini o'chirishda server xatosi yuz berdi", 500)
  }
}
