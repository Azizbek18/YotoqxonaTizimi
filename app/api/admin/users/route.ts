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
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
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
        .select('id, full_name, email, role, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('staff')
        .select('id, full_name, email, role, created_at')
        .order('created_at', { ascending: false }),
    ])

    if (studentsError) {
      return jsonError(studentsError.message, 500)
    }

    if (staffError) {
      return jsonError(staffError.message, 500)
    }

    const combined: AdminUserRow[] = [
      ...((students ?? []).map((user) => ({ ...user, updated_at: null, source: 'users' as const })) as AdminUserRow[]),
      ...((staff ?? []).map((user) => ({ ...user, updated_at: null, source: 'staff' as const })) as AdminUserRow[]),
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
    const role = body.role as UserRole
    const source = body.source as UserSource

    if (!id || !role || (source !== 'users' && source !== 'staff')) {
      return jsonError("So'rov ma'lumotlari noto'g'ri", 400)
    }

    if (source === 'users' && role !== 'talaba') {
      return jsonError("Talaba yozuvini staff roliga o'tkazib bo'lmaydi", 400)
    }

    if (source === 'staff' && role === 'talaba') {
      return jsonError("Staff yozuvini talaba roliga o'tkazib bo'lmaydi", 400)
    }

    const supabase = getServiceSupabase()
    const table = source === 'users' ? 'users' : 'staff'
    const { error } = await supabase
      .from(table)
      .update({ role })
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
