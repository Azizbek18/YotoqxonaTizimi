import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'
import { directionBelongsToFaculty, normalizeDirection } from '@/lib/directions'
import { isPermitFacultyValue } from '@/lib/faculties'
import { writeAuditLog } from '@/lib/audit-log'
import { MAX_UPLOAD_SIZE_BYTES, readMultipartForm } from '@/lib/upload-limits'
import { classifyPermitResubmission } from '@/lib/permit-resubmission'
import { getApiError } from '@/server/http/api-error'

// Foreign and privileged (imtiyozli) students don't get a my.gov.uz
// "yo'llanma" at all — they submit a filled Ariza + Tilxat instead (built
// client-side from this same data, see app/imtiyozli-ariza), backed by a
// passport photo rather than an AI-verified referral document. No AI check
// runs here: there's no official document format to verify against.
function value(form: FormData, name: string, maxLength = 200) {
  return String(form.get(name) ?? '').trim().slice(0, maxLength)
}

// Foreign ID/passport numbers don't follow the Uzbek AA1234567 pattern, so
// this only rules out empty/garbage input — not a specific format.
function isPlausibleIdNumber(value: string) {
  return value.length >= 4 && value.length <= 20 && /^[A-Z0-9\-\s]+$/i.test(value)
}

function isPlausiblePhone(value: string) {
  return value.replace(/[\s()-]/g, '').length >= 7 && value.length <= 32
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

    const idNumber = value(form, 'idNumber', 20).toUpperCase()
    const fullName = value(form, 'fullName', 160)
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

    if (!isPlausibleIdNumber(idNumber)) {
      return NextResponse.json({ error: 'Pasport/ID hujjat raqami noto‘g‘ri kiritildi.' }, { status: 400 })
    }
    if (fullName.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || !isPlausiblePhone(phone)) {
      return NextResponse.json({ error: 'Shaxsiy ma’lumotlar to‘liq yoki to‘g‘ri kiritilmagan.' }, { status: 400 })
    }
    if (!isPlausiblePhone(relativePhone)) {
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
      contentType: file.type,
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
      return NextResponse.json({ ok: true, resubmitted: true }, { status: 200 })
    }

    const { error: insertError } = await supabase.from('permit_requests').insert(fields)
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
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Imtiyozli submission failed:', error)
    const response = getApiError(error, 'Arizani saqlashda server xatoligi yuz berdi.')
    return NextResponse.json(response.body, { status: response.status })
  }
}
