import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/guards'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { PERMIT_FACULTIES, normalizeFaculty, permitFacultyLabel } from '@/lib/faculties'
import { getApiError } from '@/server/http/api-error'

// Superadmin-only: read / set every faculty's monthly + yearly contract fee
// from one table. `admin` is deliberately global here — the caller's own
// staff.faculty is irrelevant.
function errorResponse(error: unknown) {
  console.error('Faculty fees API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json({ fees: await createAppSettingsService().listFacultyFees() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const faculty = normalizeFaculty(typeof body.faculty === 'string' ? body.faculty : null)
    if (!faculty || !PERMIT_FACULTIES.some((f) => f.value === faculty)) {
      return NextResponse.json({ error: "Fakultet noto'g'ri" }, { status: 400 })
    }
    // Both fees are always sent together — the service checks that the
    // yearly amount is a whole multiple of the monthly one, and a partial
    // upsert onto a not-yet-configured faculty would leave the other fee null.
    if (typeof body.monthlyFee !== 'number' || typeof body.yearlyContractFee !== 'number') {
      return NextResponse.json({ error: 'Oylik va yillik summa talab qilinadi' }, { status: 400 })
    }

    const settings = await createAppSettingsService().update(
      { monthlyFee: body.monthlyFee, yearlyContractFee: body.yearlyContractFee },
      faculty,
    )
    return NextResponse.json({
      faculty,
      facultyLabel: permitFacultyLabel(faculty),
      monthlyFee: settings.monthlyFee,
      yearlyContractFee: settings.yearlyContractFee,
      configured: true,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
