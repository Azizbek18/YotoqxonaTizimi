import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { extractReceiptPath } from '@/lib/safe-storage-url'
import { staffDormFaculties } from '@/server/auth/faculty'
import { normalizeFaculty } from '@/lib/faculties'

// The `receipts` bucket is private (see production-hardening migration);
// receipt images/PDFs are only reachable through this short-lived signed
// URL, scoped to the payment's owner or an active administrator.
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi.' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Noto‘g‘ri to‘lov identifikatori.' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const [paymentResult, staffResult] = await Promise.all([
    supabase.from('tolovlar').select('student_id, receipt_url, faculty').eq('id', id).maybeSingle(),
    supabase.from('staff').select('role, status, faculty').eq('id', user.id).maybeSingle(),
  ])
  if (paymentResult.error || staffResult.error) {
    console.error('Receipt authorization lookup failed:', paymentResult.error ?? staffResult.error)
    return NextResponse.json({ error: 'Kvitansiyani tekshirib bo‘lmadi.' }, { status: 500 })
  }
  const payment = paymentResult.data
  const staff = staffResult.data
  if (!payment || !payment.receipt_url) {
    return NextResponse.json({ error: 'Kvitansiya topilmadi.' }, { status: 404 })
  }

  // Who may open a receipt: its owner, a superadmin, and — scoped to their
  // own students — the staff who actually review receipts. Approving lives in
  // /api/tarbiyachi/payments and the dekan gets a read-only list through
  // /api/dekan/students/payments, but this endpoint used to admit `admin`
  // only, so every reviewer got a 403 and had to approve the receipt without
  // ever seeing it.
  const isOwner = payment.student_id === user.id
  const role = staff?.status === 'active' ? staff.role : null
  const paymentFaculty = normalizeFaculty(payment.faculty)

  let allowed = isOwner || role === 'admin'
  if (!allowed && paymentFaculty && (role === 'tarbiyachi' || role === 'dekan')) {
    if (role === 'tarbiyachi') {
      // Same scope the tarbiyachi's own payment list uses: every faculty
      // living in their building, not just their own.
      const faculties = await staffDormFaculties(user.id, staff!.faculty)
      allowed = faculties.some((f) => normalizeFaculty(f) === paymentFaculty)
    } else {
      allowed = normalizeFaculty(staff!.faculty) === paymentFaculty
    }
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Ruxsat berilmadi.' }, { status: 403 })
  }

  const path = extractReceiptPath(payment.receipt_url, payment.student_id)
  if (!path) {
    return NextResponse.json({ error: 'Kvitansiya manzili noto‘g‘ri.' }, { status: 500 })
  }

  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(path, 60, path.toLowerCase().endsWith('.pdf') ? { download: true } : undefined)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Kvitansiya havolasini yaratib bo‘lmadi.' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
