import { createHash, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import {
  PERMIT_FILE_RULES,
  buildFullName,
  canonicalizeFullName,
  detectPermitFileMimeType,
  getNamePartError,
  isValidJoinedFullName,
  isValidJshshir,
  isValidPassport,
  normalizeJshshir,
  normalizePassport,
} from '@/lib/permit-validation'
import { cyrillicToLatin } from '@/lib/transliterate'
import { directionBelongsToFaculty, normalizeDirection } from '@/lib/directions'
import { isPermitFacultyValue } from '@/lib/faculties'
import { writeAuditLog } from '@/lib/audit-log'
import { verifyFileClaim } from '@/lib/receipt-claim'
import { MAX_UPLOAD_SIZE_BYTES, readMultipartForm } from '@/lib/upload-limits'
import { classifyPermitResubmission } from '@/lib/permit-resubmission'
import { getApiError } from '@/server/http/api-error'
import { issuePermitTelegramLinkSafely } from '@/lib/permit-telegram'
import { notifyDekanNewPermit } from '@/lib/dekan-telegram'

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
    // F.I.Sh: either three separate fields (imtiyozli-ariza) or one
    // "Familiya Ism Sharif" string (ruxsatnoma-yuborish). Either way it is
    // normalised to the canonical joined form + checked for 3 real parts.
    const lastName = value(form, 'lastName', 80)
    const firstName = value(form, 'firstName', 80)
    const middleName = value(form, 'middleName', 80)
    const hasNameParts = Boolean(lastName || firstName || middleName)
    const fullName = hasNameParts
      ? buildFullName({ lastName, firstName, middleName })
      : cyrillicToLatin(value(form, 'fullName', 160))
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
    const nameError = hasNameParts
      ? (getNamePartError(lastName, 'Familiya') || getNamePartError(firstName, 'Ism') || getNamePartError(middleName, 'Otasining ismi'))
      : (isValidJoinedFullName(fullName, 3) ? null : "F.I.Sh to‘liq kiriting: Familiya, Ism va Otasining ismi (kamida 3 so‘z).")
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email) || phone.length < 7) {
      return NextResponse.json({ error: 'Shaxsiy ma’lumotlar to‘liq yoki to‘g‘ri kiritilmagan.' }, { status: 400 })
    }
    if (
      !['male', 'female'].includes(gender)
      || !isPermitFacultyValue(faculty)
      || !direction
      || !directionBelongsToFaculty(faculty, direction)
      || !Number.isInteger(course)
      || course < 1
      || course > 6
    ) {
      return NextResponse.json({ error: 'Ta’lim ma’lumotlari noto‘g‘ri.' }, { status: 400 })
    }

    if (file.size < 16 || file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: 'Faqat PDF, JPG, PNG yoki WEBP (4 MB gacha) qabul qilinadi.' }, { status: file.size > MAX_UPLOAD_SIZE_BYTES ? 413 : 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const detectedMimeType = detectPermitFileMimeType(buffer)
    if (!detectedMimeType) {
      return NextResponse.json({ error: 'Rasm formati qo‘llab-quvvatlanmaydi. iPhone rasmi (HEIC) bo‘lsa JPG ga o‘giring yoki skrinshot yuklang — PDF, JPG, PNG qabul qilinadi.' }, { status: 400 })
    }
    const fileRule = PERMIT_FILE_RULES[detectedMimeType]

    // The AI precheck (/api/ai/yollanma-tekshiruv) and this submission are
    // two independent requests — without this, a caller could skip
    // straight here with no document check at all. The claim is an HMAC
    // signature over this exact file's hash, only issued by the precheck
    // when the document and identity checks actually passed,
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
    // 'permit' = the AI ran and the document/identity checks passed.
    // 'permit-unverified' = every AI provider was down, so the precheck
    // waved it through for mandatory manual review (same HMAC/hash/identity
    // binding, only the content gate is skipped). A genuine "not a referral"
    // verdict issues no claim at all and never reaches here.
    const aiClaim = form.get('aiClaim')
    let aiReview: 'passed' | 'manual'
    if (verifyFileClaim('permit', aiClaim, fileHash, claimContext)) {
      aiReview = 'passed'
    } else if (verifyFileClaim('permit-unverified', aiClaim, fileHash, claimContext)) {
      aiReview = 'manual'
    } else {
      return NextResponse.json({ error: 'Hujjat avval AI orqali tekshirilishi shart.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    // A rejected applicant who was told to re-upload the real yo'llanma
    // must be able to resubmit — the UNIQUE constraints on passport/jshshir/
    // email would otherwise lock them out forever.
    const outcome = await classifyPermitResubmission(supabase, { passport, jshshir, email })
    if (outcome.action === 'conflict') {
      return NextResponse.json({ error: outcome.message }, { status: 409 })
    }

    const storagePath = `${new Date().getUTCFullYear()}/${randomUUID()}.${fileRule.extension}`
    const { error: uploadError } = await supabase.storage.from('permits').upload(storagePath, buffer, {
      contentType: detectedMimeType,
      upsert: false,
    })
    if (uploadError) throw uploadError

    const nowIso = new Date().toISOString()
    const fields = {
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
      status: 'pending' as const,
      application_type: 'yollanma' as const,
      ai_review: aiReview,
    }

    if (outcome.action === 'reopen') {
      const { data: reopened, error: reopenError } = await supabase
        .from('permit_requests')
        .update({ ...fields, reject_reason: null, room_number: null, dorm_id: null, created_at: nowIso, updated_at: nowIso })
        .eq('id', outcome.rowId)
        .eq('status', 'rejected')
        .select('id')
        .maybeSingle()
      if (reopenError) {
        await supabase.storage.from('permits').remove([storagePath])
        if (reopenError.code === '23505') {
          return NextResponse.json({ error: 'Bu email boshqa ariza bilan band.' }, { status: 409 })
        }
        throw reopenError
      }
      if (!reopened) {
        await supabase.storage.from('permits').remove([storagePath])
        return NextResponse.json({ error: 'Ariza holati o‘zgardi — sahifani yangilang.' }, { status: 409 })
      }
      if (outcome.oldPermitPath && outcome.oldPermitPath !== storagePath) {
        await supabase.storage.from('permits').remove([outcome.oldPermitPath])
      }
      await writeAuditLog({
        eventType: 'permit_request.resubmitted',
        status: 'success',
        ipAddress: getClientIp(request),
        targetRole: 'talaba',
        details: { faculty },
      })
      const telegram = await issuePermitTelegramLinkSafely(reopened.id)
      await notifyDekanNewPermit({ fullName, faculty, direction, course, applicationType: 'yollanma', resubmitted: true })
      return NextResponse.json({ ok: true, resubmitted: true, telegram, permitRequestId: reopened.id }, { status: 200 })
    }

    const { data: inserted, error: insertError } = await supabase.from('permit_requests').insert(fields).select('id').single()
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
    const telegram = await issuePermitTelegramLinkSafely(inserted.id)
    await notifyDekanNewPermit({ fullName, faculty, direction, course, applicationType: 'yollanma' })
    return NextResponse.json({ ok: true, telegram, permitRequestId: inserted.id }, { status: 201 })
  } catch (error) {
    console.error('Permit submission failed:', error)
    const response = getApiError(error, 'Arizani saqlashda server xatoligi yuz berdi.')
    return NextResponse.json(response.body, { status: response.status })
  }
}
