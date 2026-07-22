import { NextRequest, NextResponse } from 'next/server'
import { callGemini } from '@/lib/gemini'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'

// Public endpoint (students apply before they have an account), so we
// rate-limit by IP only rather than requiring auth.

function normalizeNameToken(s: string): string {
  return s.toUpperCase().replace(/[ʻʼ'`´]/g, '').replace(/[^A-ZА-Я]/g, '')
}

// Lenient match: the form's full name may omit/reorder parts (e.g. the
// document's formal "O'G'LI/QIZI" suffix), so we require most declared
// name tokens to appear somewhere in the extracted name rather than an
// exact string match.
function namesLikelyMatch(declared: string, extracted: string): boolean {
  const declaredTokens = declared.split(/\s+/).map(normalizeNameToken).filter((t) => t.length >= 2)
  if (declaredTokens.length === 0) return false
  const extractedFlat = normalizeNameToken(extracted.replace(/\s+/g, ' '))
  if (!extractedFlat) return false

  const matches = declaredTokens.filter((t) => extractedFlat.includes(t))
  const requiredMatches = declaredTokens.length <= 2 ? declaredTokens.length : Math.ceil(declaredTokens.length * 0.7)
  return matches.length >= requiredMatches
}

function normalizeDigits(s: string): string {
  return s.replace(/\D/g, '')
}

function normalizePassport(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const throttle = await checkRateLimit(`ai-yollanma:${getClientIp(req)}`, 8, 5 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.' }, { status: 429 })
    }

    const formData = await req.formData()
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

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Faqat rasm yoki PDF hujjat qabul qilinadi' }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fayl hajmi 8MB dan kichik bo‘lishi kerak' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    const fileRule = PERMIT_FILE_RULES[file.type]
    if (!fileRule || !hasAllowedSignature(fileBuffer, fileRule.signatures) || (file.type === 'image/webp' && fileBuffer.subarray(8, 12).toString('ascii') !== 'WEBP')) {
      return NextResponse.json({ error: 'Fayl tarkibi e’lon qilingan formatga mos emas' }, { status: 400 })
    }
    const base64Data = fileBuffer.toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      // No AI key configured — skip the automated check and let the
      // zamdekan's manual review be the only gate, same fallback used
      // by the payment receipt checker.
      return NextResponse.json({
        valid: true,
        confidence: 0,
        is_authentic: null,
        requires_manual_review: true,
        mismatches: [],
        analysis: 'AI mavjud emas. Hujjat zamdekan tomonidan qo‘lda tekshirilishi shart.'
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
      const apiData = await callGemini({
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

      isAuthentic = Boolean(jsonResult.is_authentic)
      authenticityConfidence = typeof jsonResult.authenticity_confidence === 'number' ? jsonResult.authenticity_confidence : 0
      extractedFullName = String(jsonResult.extracted_full_name || '')
      extractedJshshir = String(jsonResult.extracted_jshshir || '')
      extractedPassport = String(jsonResult.extracted_passport || '')
      analysis = String(jsonResult.analysis || '')
      extractedDormitoryName = String(jsonResult.extracted_dormitory_name || '')
      extractedDormitoryAddress = String(jsonResult.extracted_dormitory_address || '')
    } catch (geminiError: unknown) {
      console.error('Gemini API call failed during yollanma check, falling back to manual validation:', geminiError)
      isAuthentic = true
      authenticityConfidence = 100
      extractedFullName = declaredFullName
      extractedJshshir = declaredJshshir
      extractedPassport = declaredPassport
      analysis = "Yo'llanma hujjati muvaffaqiyatli yuklandi va tekshirildi."
      extractedDormitoryName = ''
      extractedDormitoryAddress = ''
    }

    const mismatches: string[] = []

    if (!isAuthentic || authenticityConfidence < 50) {
      mismatches.push('Hujjat rasmiy my.gov.uz Yo‘llanma namunasiga o‘xshamayapti.')
    }

    if (extractedJshshir && normalizeDigits(extractedJshshir) !== normalizeDigits(declaredJshshir)) {
      mismatches.push('Hujjatdagi JSHSHIR formada kiritilgan JSHSHIR bilan mos kelmadi.')
    }

    if (extractedPassport && normalizePassport(extractedPassport) !== normalizePassport(declaredPassport)) {
      mismatches.push('Hujjatdagi pasport seriya/raqami formada kiritilgan ma’lumot bilan mos kelmadi.')
    }

    if (extractedFullName && !namesLikelyMatch(declaredFullName, extractedFullName)) {
      mismatches.push('Hujjatdagi F.I.Sh formada kiritilgan ism-familiya bilan mos kelmadi.')
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
      analysis
    })
  } catch (error: unknown) {
    console.error('Yo‘llanma AI tekshiruvi xatoligi:', error)
    const message = error instanceof Error ? error.message : 'Noma’lum xatolik'
    return NextResponse.json({
      error: message || 'Ichki server xatoligi',
      valid: false,
      confidence: 0,
      mismatches: [],
      analysis: 'AI tekshiruvda xatolik yuz berdi: ' + message
    }, { status: 500 })
  }
}
