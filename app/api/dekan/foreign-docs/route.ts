import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'
import { createForeignDocsService } from '@/features/foreign-docs/server/service'
import type { ForeignDocInput, ForeignDocStaffPatch } from '@/features/foreign-docs/types'

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const rows = await createForeignDocsService().listForFaculty(requirePickedFaculty(staff))
    return NextResponse.json({ docs: rows })
  } catch (error) {
    console.error('Dekan foreign-docs GET error:', error)
    const r = getApiError(error, "Ma'lumotlarni yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)
    const throttle = await checkRateLimit(`dekan-foreign-doc:${staff.id}`, 40, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Noto'g'ri identifikator" }, { status: 400 })
    }
    const patch = (await request.json().catch(() => null)) as ForeignDocStaffPatch | null
    if (!patch || typeof patch !== 'object') {
      return NextResponse.json({ error: "So'rov noto'g'ri" }, { status: 400 })
    }
    const doc = await createForeignDocsService().patchByStaff(id, faculty, patch, staff.id)
    return NextResponse.json({ doc })
  } catch (error) {
    console.error('Dekan foreign-docs PATCH error:', error)
    const r = getApiError(error, "Hujjatni yangilab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)
    const body = (await request.json().catch(() => null)) as
      | ({ studentId?: string } & ForeignDocInput)
      | null
    const studentId = typeof body?.studentId === 'string' ? body.studentId.trim() : ''
    if (!studentId) return NextResponse.json({ error: 'Talaba tanlanmagan' }, { status: 400 })
    const role = staff.role === 'admin' ? 'admin' : 'dekan'
    const doc = await createForeignDocsService().addByStaff(studentId, faculty, body as ForeignDocInput, role)
    return NextResponse.json({ doc })
  } catch (error) {
    console.error('Dekan foreign-docs POST error:', error)
    const r = getApiError(error, "Hujjat qo'shib bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
