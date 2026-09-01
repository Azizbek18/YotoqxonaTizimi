import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import {
  PERMIT_FILE_RULES,
  buildFullName,
  detectPermitFileMimeType,
  getNamePartError,
  isValidJoinedFullName,
  isPlausibleInternationalPhone,
  isValidEmail,
  isValidForeignIdNumber,
  normalizeForeignIdNumber,
} from '@/lib/permit-validation'
import { cyrillicToLatin } from '@/lib/transliterate'
import { directionBelongsToFaculty, normalizeDirection } from '@/lib/directions'
import { isPermitFacultyValue } from '@/lib/faculties'
import { writeAuditLog } from '@/lib/audit-log'
import { MAX_UPLOAD_SIZE_BYTES, readMultipartForm } from '@/lib/upload-limits'
import { classifyPermitResubmission } from '@/lib/permit-resubmission'
import { getApiError } from '@/server/http/api-error'
import { issuePermitTelegramLinkSafely } from '@/lib/permit-telegram'
import { notifyDekanNewPermit } from '@/lib/dekan-telegram'

// Foreign and privileged (imtiyozli) students don't get a my.gov.uz
// "yo'llanma" at all — they submit a filled Ariza + Tilxat instead (built
// client-side from this same data, see app/imtiyozli-ariza), backed by a
// passport photo rather than an AI-verified referral document. No AI check
// runs here: there's no official document format to verify against.
function value(form: FormData, name: string, maxLength = 200) {
  return String(form.get(name) ?? '').trim().slice(0, maxLength)
}

export async function POST(request: NextRequest) {
  const throttle = await checkRateLimit(`imtiyozli-submit:${getClientIp(request)}`, 5, 15 * 60_000)
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
      return NextResponse.json({ error: 'Pasport rasmi topilmadi.' }, { status: 400 })
    }

    const idNumber = normalizeForeignIdNumber(form.get('idNumber'))
    // F.I.Sh: three fields; a foreign applicant with no patronymic sends an
    // empty middleName + noMiddleName='true'.
    const lastName = value(form, 'lastName', 80)
    const firstName = value(form, 'firstName', 80)
    const middleName = value(form, 'middleName', 80)
    const noMiddleName = String(form.get('noMiddleName') ?? '') === 'true'
    const hasNameParts = Boolean(lastName || firstName || middleName)
    const fullName = hasNameParts
      ? buildFullName({ lastName, firstName, middleName: noMiddleName ? '' : middleName })
      : cyrillicToLatin(value(form, 'fullName', 160))
    const email = value(form, 'email', 254).toLowerCase()
    const phone = value(form, 'phone', 32)
    const relativePhone = value(form, 'relativePhone', 32)
    const gender = value(form, 'gender', 10)
    const faculty = value(form, 'faculty', 160).toLowerCase()
    const direction = normalizeDirection(value(form, 'direction', 200))
    const course = Number(value(form, 'course', 1))
    const studyType = value(form, 'studyType', 20)
    const originCountry = value(form, 'originCountry', 120)
    const originRegion = value(form, 'originRegion', 120)

    if (!isValidForeignIdNumber(idNumber)) {
      return NextResponse.json({ error: 'Pasport/ID hujjat raqami noto‘g‘ri kiritildi.' }, { status: 400 })
    }
    const nameError = hasNameParts
      ? (getNamePartError(lastName, 'Familiya') || getNamePartError(firstName, 'Ism') || (noMiddleName ? null : getNamePartError(middleName, 'Otasining ismi')))
      : (isValidJoinedFullName(fullName, noMiddleName ? 2 : 3) ? null : 'F.I.Sh to‘liq kiriting: Familiya, Ism va Otasining ismi.')
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }
    if (!isValidEmail(email) || !isPlausibleInternationalPhone(phone)) {
      return NextResponse.json({ error: 'Shaxsiy ma’lumotlar to‘liq yoki to‘g‘ri kiritilmagan.' }, { status: 400 })
    }
    if (!isPlausibleInternationalPhone(relativePhone)) {
      return NextResponse.json({ error: 'Yaqin qarindoshning telefon raqami noto‘g‘ri.' }, { status: 400 })
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
    if (!['grant', 'kontrakt'].includes(studyType)) {
      return NextResponse.json({ error: 'Ta’lim shaklini tanlang.' }, { status: 400 })
    }
    if (!originCountry || !originRegion) {
      return NextResponse.json({ error: 'Qaysi davlat/viloyatdan kelganingizni kiriting.' }, { status: 400 })
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

    const supabase = getServiceSupabase()

    // jshshir is always NULL for imtiyozli — the identity anchor is the
    // (foreign) ID number. A rejected applicant told to re-upload must be
    // able to resubmit despite the UNIQUE(passport_series)/UNIQUE(email).
    const outcome = await classifyPermitResubmission(supabase, { passport: idNumber, jshshir: null, email })
    if (outcome.action === 'conflict') {
      return NextResponse.json({ error: outcome.message }, { status: 409 })
    }

    const storagePath = `imtiyozli/${new Date().getUTCFullYear()}/${randomUUID()}.${fileRule.extension}`
    const { error: uploadError } = await supabase.storage.from('permits').upload(storagePath, buffer, {
      contentType: detectedMimeType,
      upsert: false,
    })
    if (uploadError) throw uploadError

    const nowIso = new Date().toISOString()
    const fields = {
      application_type: 'imtiyozli' as const,
      passport_series: idNumber,
      jshshir: null,
      full_name: fullName,
      email,
      phone,
      relative_phone: relativePhone,
      gender,
      faculty,
      direction,
      course,
      study_type: studyType,
      origin_country: originCountry,
      origin_region: originRegion,
      permit_url: storagePath,
      status: 'pending' as const,
      // No official document format to verify against — the dean reviews the
      // Ariza + Tilxat + passport photo by hand regardless.
      ai_review: 'skipped' as const,
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
        eventType: 'imtiyozli_request.resubmitted',
        status: 'success',
        ipAddress: getClientIp(request),
        targetRole: 'talaba',
        details: { faculty },
      })
      const telegram = await issuePermitTelegramLinkSafely(reopened.id)
      await notifyDekanNewPermit({ fullName, faculty, direction, course, applicationType: 'imtiyozli', resubmitted: true })
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
      eventType: 'imtiyozli_request.created',
      status: 'success',
      ipAddress: getClientIp(request),
      targetRole: 'talaba',
      details: { faculty },
    })
    const telegram = await issuePermitTelegramLinkSafely(inserted.id)
    await notifyDekanNewPermit({ fullName, faculty, direction, course, applicationType: 'imtiyozli' })
    return NextResponse.json({ ok: true, telegram, permitRequestId: inserted.id }, { status: 201 })
  } catch (error) {
    console.error('Imtiyozli submission failed:', error)
    const response = getApiError(error, 'Arizani saqlashda server xatoligi yuz berdi.')
    return NextResponse.json(response.body, { status: response.status })
  }
}
