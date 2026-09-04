import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { createDormService, type DekanStaffCtx } from '@/features/dorms/server/service'
import { getApiError } from '@/server/http/api-error'

// The dekan's view of their dorm and its floor partition. `admin` is
// accepted for the transition (retired role, rides the dekan panel).
async function dekanCtx(
  request: NextRequest,
  roles: Parameters<typeof requireActiveStaff>[1] = ['dekan', 'admin'],
): Promise<DekanStaffCtx> {
  const { staff } = await requireActiveStaff(request, roles)
  return { id: staff.id, faculty: requirePickedFaculty(staff) }
}

export async function GET(request: NextRequest) {
  try {
    // A tarbiyachi views their building + floor partition read-only;
    // setting the dorm up and resolving floor claims stays dekan/admin.
    const staff = await dekanCtx(request, ['dekan', 'admin', 'tarbiyachi'])
    const number = request.nextUrl.searchParams.get('number')
    if (number !== null) {
      return NextResponse.json({ preview: await createDormService().preview(staff, number) })
    }
    const service = createDormService()
    // `dorm` (primary, or null) stays for back-compat with any caller that
    // only ever knew one building; `dorms` lists every building the faculty
    // holds (many-to-many, 202609300000) — a single-dorm faculty gets a
    // 1-item array, so this is a strict superset.
    const [dorm, dorms] = await Promise.all([service.getDekanDorm(staff), service.listDekanDorms(staff)])
    return NextResponse.json({ dorm, dorms })
  } catch (error) {
    console.error('Dekan dorm GET error:', error)
    const r = getApiError(error, "Yotoqxona ma'lumotini yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await dekanCtx(request)
    const body = await request.json().catch(() => null)
    return NextResponse.json(await createDormService().setUp(staff, body))
  } catch (error) {
    console.error('Dekan dorm POST error:', error)
    const r = getApiError(error, 'Yotoqxona sozlanmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const staff = await dekanCtx(request)
    const body = await request.json().catch(() => null)
    const service = createDormService()
    const dormId = typeof body?.dormId === 'string' ? body.dormId : undefined

    if (body?.action === 'resolve') {
      return NextResponse.json(await service.resolve(staff, Number(body.floor), Boolean(body.accept), dormId))
    }
    if (body?.action === 'withdraw') {
      return NextResponse.json({ dorm: await service.withdraw(staff, body.floors ?? [], dormId) })
    }
    if (body?.action === 'attendance-settings') {
      return NextResponse.json({ dorm: await service.patchOwnDorm(staff, body.settings ?? {}, dormId) })
    }
    if (body?.action === 'set-primary') {
      if (!dormId) return NextResponse.json({ error: 'dormId kerak' }, { status: 400 })
      return NextResponse.json({ dorms: await service.setPrimary(staff, dormId) })
    }
    if (body?.action === 'unlink') {
      if (!dormId) return NextResponse.json({ error: 'dormId kerak' }, { status: 400 })
      return NextResponse.json({ dorms: await service.unlinkDorm(staff, dormId) })
    }
    return NextResponse.json({ error: "Noma'lum amal" }, { status: 400 })
  } catch (error) {
    console.error('Dekan dorm PATCH error:', error)
    const r = getApiError(error, "Amalni bajarib bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
