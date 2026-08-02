import { createHash, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import {
  PERMIT_FILE_RULES,
  canonicalizeFullName,
  hasAllowedSignature,
  isValidJshshir,
  isValidPassport,
  normalizeJshshir,
  normalizePassport,
} from '@/lib/permit-validation'
import { normalizeDirection } from '@/lib/directions'
import { isPermitFacultyValue } from '@/lib/faculties'
import { writeAuditLog } from '@/lib/audit-log'
import { verifyFileClaim } from '@/lib/receipt-claim'
import { MAX_UPLOAD_SIZE_BYTES, readMultipartForm } from '@/lib/upload-limits'
import { getApiError } from '@/server/http/api-error'

function value(form: FormData, name: string, maxLength = 200) {
  return String(form.get(name) ?? '').trim().slice(0, maxLength)
}

export async function POST(request: NextRequest) {
  const throttle = await checkRateLimit(`permit-submit:${getClientIp(request)}`, 5, 15 * 60_000)
  if (!throttle.allowed) {
    return NextResponse.json({ error: 'Juda ko‘p urinish. 15 daqiqadan keyin qayta urinib ko‘ring.' }, { status: 429 })
  }

  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > 4_400_000) {
      return NextResponse.json({ error: 'So‘rov hajmi 4 MB fayl chegarasidan oshmasligi kerak.' }, { status: 413 })
    }
    const form = await readMultipartForm(request)
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Yo‘llanma fayli topilmadi.' }, { status: 400 })
    }

    const passport = normalizePassport(form.get('passportSeries'))
    const jshshir = normalizeJshshir(form.get('jshshir'))
    const fullName = value(form, 'fullName', 160)
    const email = value(form, 'email', 254).toLowerCase()
    const phone = value(form, 'phone', 32)
    const gender = value(form, 'gender', 10)
    const faculty = value(form, 'faculty', 160).toLowerCase()
    // Yo'nalish endi ro'yxatdan tanlanadi — kanonik qiymatga keltiriladi, aks
    // holda bitta yo'nalish "amaliy-matematika" va "Amaliy matematika" bo'lib
    // ikkiga bo'linib ketadi (guruhlash, filtr va eksport buziladi).
    const direction = normalizeDirection(value(form, 'direction', 200))
    const course = Number(value(form, 'course', 1))

    if (!isValidPassport(passport) || !isValidJshshir(jshshir)) {
      return NextResponse.json({ error: 'Pasport yoki JShSHIR formati noto‘g‘ri.' }, { status: 400 })
    }
    if (fullName.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || phone.length < 7) {
      return NextResponse.json({ error: 'Shaxsiy ma’lumotlar to‘liq yoki to‘g‘ri kiritilmagan.' }, { status: 400 })
    }
    if (
      !['male', 'female'].includes(gender)
      || !isPermitFacultyValue(faculty)
      || !direction
      || !Number.isInteger(course)
      || course < 1
      || course > 6
    ) {
      return NextResponse.json({ error: 'Ta’lim ma’lumotlari noto‘g‘ri.' }, { status: 400 })
    }

    const fileRule = PERMIT_FILE_RULES[file.type]
    if (!fileRule || file.size < 16 || file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: 'Faqat PDF, JPG, PNG yoki WEBP (4 MB gacha) qabul qilinadi.' }, { status: file.size > MAX_UPLOAD_SIZE_BYTES ? 413 : 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasAllowedSignature(buffer, fileRule.signatures)) {
      return NextResponse.json({ error: 'Fayl tarkibi e’lon qilingan formatga mos emas.' }, { status: 400 })
    }
    if (file.type === 'image/webp' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
      return NextResponse.json({ error: 'WEBP fayl imzosi noto‘g‘ri.' }, { status: 400 })
    }

    // The AI precheck (/api/ai/yollanma-tekshiruv) and this submission are
    // two independent requests — without this, a caller could skip
    // straight here with no document check at all. The claim is an HMAC
    // signature over this exact file's hash, only issued by the precheck
    // when it actually passed (or explicitly fell back to manual review),
    // so it can't be forged or reused for a different file.
    const fileHash = createHash('sha256').update(buffer).digest('hex')
    // Bound to the exact identity the precheck validated this file against
    // (see /api/ai/yollanma-tekshiruv) — otherwise a real, AI-approved
    // document could be resubmitted here claiming a different F.I.Sh./
    // passport/JShSHIR than what was actually checked.
    const claimContext = {
      fullName: canonicalizeFullName(fullName),
      passport,
      jshshir,
    }
    if (!verifyFileClaim('permit', form.get('aiClaim'), fileHash, claimContext)) {
      return NextResponse.json({ error: 'Hujjat avval AI orqali tekshirilishi shart.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const duplicateChecks = await Promise.all([
      supabase.from('permit_requests').select('id').eq('passport_series', passport).maybeSingle(),
      supabase.from('permit_requests').select('id').eq('jshshir', jshshir).maybeSingle(),
      supabase.from('permit_requests').select('id').eq('email', email).maybeSingle(),
    ])
    if (duplicateChecks.some(({ data }) => Boolean(data))) {
      return NextResponse.json({ error: 'Bu pasport, JShSHIR yoki email bilan ariza avval yuborilgan.' }, { status: 409 })
    }
    const duplicateError = duplicateChecks.find(({ error }) => error)?.error
    if (duplicateError) throw duplicateError

    const storagePath = `${new Date().getUTCFullYear()}/${randomUUID()}.${fileRule.extension}`
    const { error: uploadError } = await supabase.storage.from('permits').upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })
    if (uploadError) throw uploadError

    const { error: insertError } = await supabase.from('permit_requests').insert({
      passport_series: passport,
      jshshir,
      full_name: fullName,
      email,
      phone,
      gender,
      faculty,
      direction,
      course,
      permit_url: storagePath,
      status: 'pending',
    })
    if (insertError) {
      await supabase.storage.from('permits').remove([storagePath])
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Bu ma’lumotlar bilan ariza avval yuborilgan.' }, { status: 409 })
      }
      throw insertError
    }

    await writeAuditLog({
      eventType: 'permit_request.created',
      status: 'success',
      ipAddress: getClientIp(request),
      targetRole: 'talaba',
      details: { faculty },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Permit submission failed:', error)
    const response = getApiError(error, 'Arizani saqlashda server xatoligi yuz berdi.')
    return NextResponse.json(response.body, { status: response.status })
  }
}
