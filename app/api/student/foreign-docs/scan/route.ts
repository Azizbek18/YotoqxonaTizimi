import { NextRequest, NextResponse } from 'next/server'
import { aiVisionConfigured, aiVisionJson } from '@/lib/ai'
import { checkRateLimit } from '@/lib/security'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { MAX_UPLOAD_SIZE_BYTES, readMultipartForm } from '@/lib/upload-limits'
import { DOC_TYPES, type DocType } from '@/features/foreign-docs/types'
import { parseScanResult } from '@/features/foreign-docs/domain/scan'

const PROMPTS: Record<DocType, string> = {
  visa: "Bu O'zbekiston vizasi (yoki viza yozuvi) rasmi.",
  registration: "Bu yashash joyida vaqtincha ro'yxatga qo'yilganlik (propiska / registratsiya) hujjati.",
  lease: 'Bu uy-joy ijara shartnomasi.',
}

const FIELDS: Record<DocType, string> = {
  visa: '"number": viza raqami, "issuedOn": berilgan sana, "expiresOn": amal qilish muddati, "address": null',
  registration:
    '"number": null, "issuedOn": ro\'yxatga qo\'yilgan sana, "expiresOn": amal qilish muddati, "address": ro\'yxatga qo\'yilgan manzil',
  lease:
    '"number": shartnoma raqami, "issuedOn": shartnoma sanasi yoki boshlanishi, "expiresOn": shartnoma tugash sanasi, "address": ijaraga olingan uy manzili',
}

// Rasmdan sana/raqamni o'qib formani oldindan to'ldirish uchun yordamchi.
// Hech narsani saqlamaydi — talaba natijani ko'rib tasdiqlaydi.
export async function POST(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const throttle = await checkRateLimit(`foreign-doc-scan:${student.id}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Birozdan keyin urinib ko'ring." }, { status: 429 })
    }

    const form = await readMultipartForm(request)
    const docType = String(form.get('docType') ?? '') as DocType
    if (!DOC_TYPES.includes(docType)) {
      return NextResponse.json({ error: "Hujjat turi noto'g'ri" }, { status: 400 })
    }
    const file = form.get('file')
    if (!(file instanceof File) || file.size < 16) {
      return NextResponse.json({ error: 'Rasm yuklanmadi' }, { status: 400 })
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Faqat JPG, PNG yoki WebP rasm o‘qiladi' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: 'Rasm hajmi katta' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const rule = PERMIT_FILE_RULES[file.type]
    if (!rule || !hasAllowedSignature(buffer, rule.signatures)) {
      return NextResponse.json({ error: "Rasm formati qo'llab-quvvatlanmaydi" }, { status: 400 })
    }

    // AI ishlamasa ham forma qo'lda to'ldirilaveradi — xato emas, "o'qilmadi".
    if (!aiVisionConfigured()) {
      return NextResponse.json({ scan: null, skipped: true })
    }

    const prompt = `${PROMPTS[docType]} Rasmdan faqat quyidagi maydonlarni o'qing va toza JSON qaytaring (markdown yo'q): {${FIELDS[docType]}}. Sanalarni faqat YYYY-MM-DD ko'rinishida yozing. Aniq o'qib bo'lmagan yoki rasmda yo'q maydonni null qiling — taxmin qilmang.`
    try {
      const result = await aiVisionJson(
        {
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: buffer.toString('base64') } }] }],
          generationConfig: { responseMimeType: 'application/json' },
        },
        process.env.GEMINI_API_KEY,
      )
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      return NextResponse.json({ scan: parseScanResult(text, docType), skipped: false })
    } catch (error) {
      console.error('Foreign-doc scan failed:', error)
      return NextResponse.json({ scan: null, skipped: true })
    }
  } catch (error) {
    console.error('Foreign-doc scan error:', error)
    const r = getApiError(error, "Rasmni o'qib bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
