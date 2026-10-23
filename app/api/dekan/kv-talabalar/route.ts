import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'
import { daysLeft, tashkentToday } from '@/features/foreign-docs/domain/expiry'
import { isUzbekCountry, pickCurrentDoc } from '@/features/foreign-docs/domain/international'
import type { DocStatus } from '@/features/foreign-docs/types'

type KvDocTerm = { expires_on: string; days_left: number; status: DocStatus }
type Pickable = { status: DocStatus; expiresOn: string }

const COLUMNS = 'id, full_name, email, phone_number, gender, faculty, direction, course, group, hemis_student_id, country, residence_address, residence_lat, residence_lng, status, off_campus_verified_by, off_campus_verified_at, created_at'

// Dekan's read-only list of KV-talaba (off-campus student) accounts. They
// register themselves and are active at once — there is no approval step, so
// `pending` is normally empty (kept only so an old row is never hidden).
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)
    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('users')
      .select(COLUMNS)
      .eq('role', 'talaba')
      .eq('is_off_campus', true)
      .ilike('faculty', faculty)
      .order('created_at', { ascending: false })

    if (error) throw error

    const rows = data ?? []

    // Har talabaning eng yaqin (yoki o'tib ketgan) hujjat muddati — viza,
    // propiska va ijara ichidan eng kichik "qolgan kun". Hujjati yo'q = null.
    const worstDays = new Map<string, number>()
    const docCounts = new Map<string, number>()
    // Kartadagi viza / propiska qatori uchun har turning joriy hujjati.
    const byType = new Map<string, { visa: Pickable[]; registration: Pickable[] }>()
    const today = tashkentToday()
    if (rows.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from('foreign_student_documents')
        .select('student_id, doc_type, status, expires_on')
        .in('student_id', rows.map((s) => s.id))
        .neq('status', 'cancelled')
      if (docsError) throw docsError
      for (const doc of docs ?? []) {
        const d = daysLeft(doc.expires_on, today)
        const prev = worstDays.get(doc.student_id)
        if (prev === undefined || d < prev) worstDays.set(doc.student_id, d)
        docCounts.set(doc.student_id, (docCounts.get(doc.student_id) ?? 0) + 1)
        if (doc.doc_type === 'visa' || doc.doc_type === 'registration') {
          const entry = byType.get(doc.student_id) ?? { visa: [], registration: [] }
          entry[doc.doc_type as 'visa' | 'registration'].push({ status: doc.status as DocStatus, expiresOn: doc.expires_on })
          byType.set(doc.student_id, entry)
        }
      }
    }
    const term = (docs: Pickable[] | undefined): KvDocTerm | null => {
      const current = pickCurrentDoc(docs ?? [])
      return current
        ? { expires_on: current.expiresOn, days_left: daysLeft(current.expiresOn, today), status: current.status }
        : null
    }
    const students = rows.map((s) => {
      const docs = byType.get(s.id)
      const visa = term(docs?.visa)
      return {
        ...s,
        docs_worst_days: worstDays.get(s.id) ?? null,
        docs_count: docCounts.get(s.id) ?? 0,
        visa,
        registration: term(docs?.registration),
        // Viza faqat xorijiy fuqaroga kerak; mamlakat bo'sh bo'lsa ham, vizasi bor bo'lsa ko'rsatamiz.
        needs_visa: visa !== null || (Boolean(s.country?.trim()) && !isUzbekCountry(s.country)),
      }
    })
    return NextResponse.json({
      ok: true,
      pending: students.filter((s) => s.status === 'pending'),
      active: students.filter((s) => s.status === 'active'),
    })
  } catch (error) {
    console.error('KV-talaba list GET failed:', error)
    const response = getApiError(error, "Ro'yxatni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
