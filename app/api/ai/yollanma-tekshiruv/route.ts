import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { aiVisionConfigured, aiVisionJson } from '@/lib/ai'
import { checkRateLimit, getClientIp } from '@/lib/security'
import {
  PERMIT_FILE_RULES,
  canonicalizeFullName,
  detectPermitFileMimeType,
  normalizeJshshir,
  normalizePassport,
} from '@/lib/permit-validation'
import { signFileClaim } from '@/lib/receipt-claim'
import { evaluatePermitDocument, type PermitDocumentAiResult } from '@/lib/permit-document-ai'
import { MAX_UPLOAD_SIZE_BYTES, readMultipartForm } from '@/lib/upload-limits'
import { getApiError } from '@/server/http/api-error'

// Public endpoint (students apply before they have an account), so we
// rate-limit by IP only rather than requiring auth.

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
    if (!aiVisionConfigured()) {
      return NextResponse.json({
        error: 'Yo‘llanmani AI orqali tekshirish vaqtincha ishlamayapti. Birozdan keyin qayta urinib ko‘ring.',
        valid: false,
        confidence: 0,
        mismatches: [],
        retryable: true,
        claim: null,
      }, { status: 503 })
    }

    const systemPrompt = `Siz O'zbekiston Respublikasi my.gov.uz davlat portalida generatsiya qilinadigan "YO'LLANMA" (talabalar turar joyiga yo'llanma) hujjatlarini tekshiradigan AI tizimisiz.

Rasmiy hujjatning BARQAROR MAKET BELGILARI:
- Bir sahifali A4 ko'rinish; yuqori chapda my.gov.uz, yuqorida vazirlik nomi/emblemasi
- Yuqori qismda hujjat raqami/sana/ariza raqami va qabul qiluvchi talaba rekvizitlari
- Markazda katta ikki tilli "YO'LLANMA / НАПРАВЛЕНИЕ" sarlavhasi
- Pastma-past yorliqli maydonlar: Oliy ta'lim muassasasi, Talaba FISH, JSHSHIR, Pasport, Ta'lim yo'nalishi, Kursi, Imtiyozi, TTJ nomi va manzili, Blok
- Pastda amal qilish muddati va huquqiy izoh; eng past o'ngda QR kod

Talabaning ismi, raqamlari, universitet, TTJ, manzil, blok va ayrim matnlar har bir hujjatda boshqacha bo'lishi tabiiy. Ularni maket nomuvofiqligi deb hisoblamang. To'liq sahifa aniq ko'rinadigan foto yoki skrinshot ham qabul qilinadi; kesilgan, qisman ko'ringan yoki boshqa hujjat qabul qilinmaydi.

VAZIFANGIZ:
1. Fayl aynan my.gov.uz talabalar turar joyi yo'llanmasimi va yuqoridagi maket to'liq ko'rinadimi, baholang. Boshqa hujjat, odam rasmi, chek, ekran menyusi, tasodifiy rasm yoki kesilgan sahifani rad eting.
2. Hujjatdan quyidagi maydonlarni aniq o'qib oling (topilmasa bo'sh qatorda qoldiring):
   - Talaba FISH (to'liq)
   - JSHSHIR raqami (14 ta raqam)
   - Pasport seriya va raqami
   - Talabalar turar joyi nomi
   - Talabalar turar joyi manzili

Quyidagi JSON formatda javob qaytaring:
{
  "document_type": "dormitory_referral",
  "matches_reference_layout": true,
  "has_mygov_header": true,
  "has_ministry_header": true,
  "has_bilingual_title": true,
  "has_student_identity_section": true,
  "has_qr_code": true,
  "document_confidence": 90,
  "extracted_full_name": "MO'MINOV AZIZBEK ULUG'BEK O'G'LI",
  "extracted_jshshir": "51804055310015",
  "extracted_passport": "AD0970061",
  "extracted_dormitory_name": "Talabalar turar joyi 12",
  "extracted_dormitory_address": "Olmazor tumani Talabalar kochasi 69-uy",
  "analysis": "Qisqa xulosa"
}

MUHIM: document_type faqat hujjat aynan TTJ yo'llanmasi bo'lsa "dormitory_referral" bo'lsin. Ishonchingiz bo'lmasa yoki belgi ko'rinmasa boolean maydonni false qiling. Faqat toza JSON qaytaring.`

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
      const jsonResult = JSON.parse(textResponse.trim()) as PermitDocumentAiResult
      const evaluated = evaluatePermitDocument(jsonResult, {
        fullName: declaredFullName,
        jshshir: declaredJshshir,
        passport: declaredPassport,
      })

      return NextResponse.json({
        valid: evaluated.valid,
        confidence: evaluated.confidence,
        mismatches: evaluated.mismatches,
        extracted: {
          full_name: evaluated.extracted.fullName,
          jshshir: evaluated.extracted.jshshir,
          passport_series: evaluated.extracted.passport,
          dormitory_name: evaluated.extracted.dormitoryName,
          dormitory_address: evaluated.extracted.dormitoryAddress,
        },
        structure: evaluated.structure,
        analysis: evaluated.analysis,
        claim: evaluated.valid ? signFileClaim('permit', fileHash, claimContext) : null,
      })
    } catch (geminiError: unknown) {
      console.error('AI call failed during yollanma check:', geminiError)
      return NextResponse.json({
        error: 'Yo‘llanmani AI orqali tekshirib bo‘lmadi. Internetni tekshirib, birozdan keyin qayta urinib ko‘ring.',
        valid: false,
        confidence: 0,
        mismatches: [],
        retryable: true,
        claim: null,
      }, { status: 503 })
    }
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
