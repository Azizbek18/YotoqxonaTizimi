import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { aiVisionJson } from '@/lib/ai'
import { groqConfigured } from '@/lib/groq'
import { checkRateLimit, getClientIp } from '@/lib/security'
import {
  PERMIT_FILE_RULES,
  canonicalizeFullName,
  detectPermitFileMimeType,
  namesLikelyMatch,
  normalizeJshshir,
  normalizePassport,
} from '@/lib/permit-validation'
import { signFileClaim } from '@/lib/receipt-claim'
import { MAX_UPLOAD_SIZE_BYTES, readMultipartForm } from '@/lib/upload-limits'
import { getApiError } from '@/server/http/api-error'

// Public endpoint (students apply before they have an account), so we
// rate-limit by IP only rather than requiring auth.

function normalizeDigits(s: string): string {
  return s.replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const throttle = await checkRateLimit(`ai-yollanma:${getClientIp(req)}`, 8, 5 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.' }, { status: 429 })
    }

    const formData = await readMultipartForm(req)
    const file = formData.get('file') as File | null
    const declaredFullName = String(formData.get('fullName') || '').trim()
    const declaredJshshir = String(formData.get('jshshir') || '').trim()
    const declaredPassport = String(formData.get('passportSeries') || '').trim()

    if (!file) {
      return NextResponse.json({ error: 'Fayl yuklanmadi' }, { status: 400 })
    }
    if (!declaredFullName || !declaredJshshir || !declaredPassport) {
      return NextResponse.json({ error: 'Talaba ma’lumotlari to‘liq emas' }, { status: 400 })
    }

    // Bound into the claim below so it can only be redeemed for the exact
    // identity it was checked against — otherwise a real, AI-approved
    // document could be resubmitted under a different F.I.Sh./passport/
    // JShSHIR, since /api/permit-requests only checks the claim proves
    // *some* file passed, not which identity it was checked for.
    const claimContext = {
      fullName: canonicalizeFullName(declaredFullName),
      passport: normalizePassport(declaredPassport),
      jshshir: normalizeJshshir(declaredJshshir),
    }

    // Matches /api/permit-requests and the hosting platform's effective
    // request-body ceiling.
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: 'Fayl hajmi 4 MB dan oshmasligi kerak' }, { status: 413 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    const detectedMimeType = detectPermitFileMimeType(fileBuffer)
    if (!detectedMimeType || !PERMIT_FILE_RULES[detectedMimeType]) {
      return NextResponse.json({ error: 'Rasm formati qo‘llab-quvvatlanmaydi. iPhone rasmi (HEIC) bo‘lsa JPG ga o‘giring yoki skrinshot yuklang — PDF, JPG, PNG qabul qilinadi.' }, { status: 400 })
    }
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex')
    const base64Data = fileBuffer.toString('base64')
    const mimeType = detectedMimeType

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey && !groqConfigured()) {
      // No AI key configured — skip the automated check and let the
      // dekan's manual review be the only gate, same fallback used
      // by the payment receipt checker.
      return NextResponse.json({
        valid: true,
        confidence: 0,
        is_authentic: null,
        requires_manual_review: true,
        mismatches: [],
        analysis: 'AI mavjud emas. Hujjat dekan tomonidan qo‘lda tekshirilishi shart.',
        claim: signFileClaim('permit', fileHash, claimContext),
      })
    }

    const systemPrompt = `Siz O'zbekiston Respublikasi my.gov.uz davlat portalida generatsiya qilinadigan "YO'LLANMA" (talabalar turar joyiga yo'llanma) hujjatlarini tekshiradigan AI tizimisiz.

Rasmiy hujjat namunasi quyidagi tuzilishga ega bo'ladi:
- Yuqorida "my.gov.uz" logotipi va O'zbekiston Respublikasi Oliy ta'lim, fan va innovatsiyalar vazirligi emblemasi
- Hujjat raqami, hujjat berilgan sana, ariza raqami, JShSHIR
- Sarlavha: "YO'LLANMA / НАПРАВЛЕНИЕ"
- Maydonlar: Oliy ta'lim muassasasi, Talaba FISH, JSHSHIR raqami, Pasport seriya va raqami, Ta'lim yo'nalishi, Kursi, Imtiyozi, Talabalar turar joyi nomi, Hudud (shahar), Tuman, Talabalar turar joyi manzili, Blok
- Pastda amal qilish muddati haqida matn va litsenziyaga oid izoh
- O'ng pastda QR kod

VAZIFANGIZ:
1. Yuborilgan faylni tahlil qiling va bu hujjat yuqoridagi rasmiy formatga (joylashuv, maydonlar, umumiy ko'rinish) mos keladimi yoki yo'qligini baholang. Boshqa turdagi hujjat, tasodifiy rasm, screenshot yoki qo'lda tahrirlangan/soxta ko'rinadigan fayl bo'lsa past ball bering.
2. Hujjatdan quyidagi maydonlarni aniq o'qib oling (topilmasa bo'sh qatorda qoldiring):
   - Talaba FISH (to'liq)
   - JSHSHIR raqami (14 ta raqam)
   - Pasport seriya va raqami
   - Talabalar turar joyi nomi
   - Talabalar turar joyi manzili

Quyidagi JSON formatda javob qaytaring:
{
  "is_authentic": true,
  "authenticity_confidence": 90,
  "extracted_full_name": "MO'MINOV AZIZBEK ULUG'BEK O'G'LI",
  "extracted_jshshir": "51804055310015",
  "extracted_passport": "AD0970061",
  "extracted_dormitory_name": "Talabalar turar joyi 12",
  "extracted_dormitory_address": "Olmazor tumani Talabalar kochasi 69-uy",
  "analysis": "Qisqa xulosa"
}

MUHIM: Faqat va faqat toza JSON formatida javob bering.`

    let isAuthentic = true
    let authenticityConfidence = 100
    let extractedFullName = declaredFullName
    let extractedJshshir = declaredJshshir
    let extractedPassport = declaredPassport
    let analysis = ''
    let extractedDormitoryName = ''
    let extractedDormitoryAddress = ''

    try {
      const apiData = await aiVisionJson({
        contents: [{
          parts: [
            { text: systemPrompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      }, geminiApiKey)

      const textResponse = apiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonResult = JSON.parse(textResponse.trim())

      // Strict === true, not Boolean(...) — a loosely-formatted AI response
      // with is_authentic as the STRING "false" would otherwise come out
      // truthy (Boolean("false") === true), inverting the result.
      isAuthentic = jsonResult.is_authentic === true
      authenticityConfidence = typeof jsonResult.authenticity_confidence === 'number' ? jsonResult.authenticity_confidence : 0
      extractedFullName = String(jsonResult.extracted_full_name || '')
      extractedJshshir = String(jsonResult.extracted_jshshir || '')
      extractedPassport = String(jsonResult.extracted_passport || '')
      analysis = String(jsonResult.analysis || '')
      extractedDormitoryName = String(jsonResult.extracted_dormitory_name || '')
      extractedDormitoryAddress = String(jsonResult.extracted_dormitory_address || '')
    } catch (geminiError: unknown) {
      // Fail closed on the automated checks (don't fabricate a "verified"
      // result), but still let the submission through for dekan manual
      // review — same fallback used above when no API key is configured —
      // so an AI outage doesn't permanently block genuine applicants.
      console.error('Gemini API call failed during yollanma check, falling back to manual review:', geminiError)
      return NextResponse.json({
        valid: true,
        confidence: 0,
        is_authentic: null,
        requires_manual_review: true,
        mismatches: [],
        analysis: "AI tekshiruvi vaqtincha ishlamadi. Hujjat dekan tomonidan qo'lda tekshirilishi shart.",
        claim: signFileClaim('permit', fileHash, claimContext),
      })
    }

    const mismatches: string[] = []

    if (!isAuthentic || authenticityConfidence < 50) {
      mismatches.push('Hujjat rasmiy my.gov.uz Yo‘llanma namunasiga o‘xshamayapti.')
    }

    // Each check fails closed on a blank extraction (not just a mismatch) —
    // otherwise a document the AI can't read these fields from, but still
    // rates as "authentic-looking", would sail through with every identity
    // field unverified, letting a claim be issued for whatever identity the
    // caller declared in the form with nothing to contradict it.
    if (!extractedJshshir || normalizeDigits(extractedJshshir) !== normalizeDigits(declaredJshshir)) {
      mismatches.push('Hujjatdagi JSHSHIR aniqlanmadi yoki formada kiritilgan JSHSHIR bilan mos kelmadi.')
    }

    if (!extractedPassport || normalizePassport(extractedPassport) !== normalizePassport(declaredPassport)) {
      mismatches.push('Hujjatdagi pasport seriya/raqami aniqlanmadi yoki formada kiritilgan ma’lumot bilan mos kelmadi.')
    }

    if (!extractedFullName || !namesLikelyMatch(declaredFullName, extractedFullName)) {
      mismatches.push('Hujjatdagi F.I.Sh aniqlanmadi yoki formada kiritilgan ism-familiya bilan mos kelmadi.')
    }

    const valid = mismatches.length === 0

    return NextResponse.json({
      valid,
      confidence: authenticityConfidence,
      is_authentic: isAuthentic,
      mismatches,
      extracted: {
        full_name: extractedFullName,
        jshshir: extractedJshshir,
        passport_series: extractedPassport,
        dormitory_name: extractedDormitoryName,
        dormitory_address: extractedDormitoryAddress
      },
      analysis,
      claim: valid ? signFileClaim('permit', fileHash, claimContext) : null,
    })
  } catch (error: unknown) {
    console.error('Yo‘llanma AI tekshiruvi xatoligi:', error)
    const apiError = getApiError(error, 'Yo‘llanma tekshiruvida server xatoligi yuz berdi')
    return NextResponse.json({
      ...apiError.body,
      valid: false,
      confidence: 0,
      mismatches: [],
      analysis: 'AI tekshiruvni yakunlab bo‘lmadi',
    }, { status: apiError.status })
  }
}
