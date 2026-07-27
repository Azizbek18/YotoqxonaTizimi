import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { extractReceiptPath } from '@/lib/safe-storage-url'

// The `receipts` bucket is private (see production-hardening migration);
// receipt images/PDFs are only reachable through this short-lived signed
// URL, scoped to the payment's owner or active admin/tarbiyachi staff.
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi.' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Noto‘g‘ri to‘lov identifikatori.' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const [{ data: payment }, { data: staff }] = await Promise.all([
    supabase.from('tolovlar').select('student_id, receipt_url').eq('id', id).maybeSingle(),
    supabase.from('staff').select('role, status').eq('id', user.id).maybeSingle(),
  ])
  if (!payment || !payment.receipt_url) {
    return NextResponse.json({ error: 'Kvitansiya topilmadi.' }, { status: 404 })
  }

  const isOwner = payment.student_id === user.id
  const isStaff = staff?.status === 'active' && (staff.role === 'admin' || staff.role === 'tarbiyachi')
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: 'Ruxsat berilmadi.' }, { status: 403 })
  }

  const path = extractReceiptPath(payment.receipt_url, payment.student_id)
  if (!path) {
    return NextResponse.json({ error: 'Kvitansiya manzili noto‘g‘ri.' }, { status: 500 })
  }

  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Kvitansiya havolasini yaratib bo‘lmadi.' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
