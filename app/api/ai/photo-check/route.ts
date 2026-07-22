import { NextRequest, NextResponse } from 'next/server'
import { callGemini } from '@/lib/gemini'
import { getRequestUser } from '@/lib/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    const throttle = await checkRateLimit(`ai-photo:${user.id}:${getClientIp(req)}`, 12, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p rasm tekshirildi. Keyinroq urinib ko‘ring.' }, { status: 429 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Rasm yuklanmadi' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Faqat JPEG, PNG yoki WebP rasmlar qabul qilinadi' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Rasm hajmi 5MB dan kichik bo‘lishi kerak' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rule = PERMIT_FILE_RULES[file.type]
    if (!rule || !hasAllowedSignature(buffer, rule.signatures) || (file.type === 'image/webp' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP')) {
      return NextResponse.json({ error: 'Rasm faylining haqiqiy formati noto‘g‘ri' }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({
        is_human: false,
        confidence: 0,
        description: 'Rasmni tekshirish xizmati vaqtincha mavjud emas.',
        reason: 'AI tekshiruvi bajarilmadi',
      }, { status: 503 })
    }

    // Read file as base64
    const base64Data = buffer.toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const systemPrompt = `Siz talabalar tomonidan profil uchun yuklanadigan shaxsiy 3x4 formatdagi rasmlarni (portret) tekshiradigan AI tizimisiz.
Sizga yuborilgan rasmni tahlil qiling va quyidagi shartlarni tekshiring:
1. Rasmda aniq inson yuzi va shaxsi (portret/portrait) tasvirlangan bo'lishi kerak.
2. Rasmda hayvonlar, narsalar, tabiat ko'rinishlari, multfilm qahramonlari, matnlar, kitoblar, to'lov cheklari yoki boshqa inson bo'lmagan narsalar bo'lmasligi kerak.
3. Rasm talabaning shaxsiy portreti (3x4 yoki passport formatidagi rasm) sifatida foydalanishga mos kelishi kerak.

Quyidagi JSON formatda javob qaytaring:
{
  "is_human": true,
  "confidence": 95,
  "description": "Rasm tahlilining qisqa tavsifi (o'zbek tilida).",
  "reason": null
}

Agar rasmda inson yuzi aniqlanmasa, yoki u profil rasmi uchun butunlay mos kelmasa (masalan, hayvon, narsa, tabiat ko'rinishi, multfilm, chizilgan rasm, yoki to'lov cheki bo'lsa), unda quyidagicha javob bering:
{
  "is_human": false,
  "confidence": 90,
  "description": "Yuklangan rasmda inson yuzi aniqlanmadi.",
  "reason": "Rasmning rad etilishining aniq sababi (o'zbek tilida). Masalan: Rasmda inson yuzi o'rniga hayvon tasvirlangan yoki faqat matn ko'rsatilgan."
}

MUHIM: Faqat va faqat toza JSON formatida javob bering. Hech qanday markdown (masalan \`\`\`json ...) bloklarisiz.`

    let isHuman = true
    let confidence = 100
    let description = ''
    let reason: string | null = null

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

      // Parse response
      let cleanText = textResponse.trim()
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim()
      }

      const jsonResult = JSON.parse(cleanText)
      isHuman = jsonResult.is_human === true
      confidence = typeof jsonResult.confidence === 'number' ? jsonResult.confidence : 50
      description = jsonResult.description || ''
      reason = jsonResult.reason || null
    } catch (geminiError: unknown) {
      console.error('Gemini API call failed during photo check:', geminiError)
      return NextResponse.json({
        is_human: false,
        confidence: 0,
        description: 'Rasmni tekshirib bo‘lmadi. Keyinroq qayta urinib ko‘ring.',
        reason: 'AI tekshiruvi bajarilmadi',
      }, { status: 502 })
    }

    return NextResponse.json({
      is_human: isHuman,
      confidence,
      description,
      reason
    })

  } catch (error: unknown) {
    console.error('AI rasm tekshiruv xatoligi:', error)
    const message = error instanceof Error ? error.message : 'Noma\'lum xatolik'
    return NextResponse.json({
      error: message || 'Ichki server xatoligi',
      is_human: false,
      confidence: 0,
      description: 'AI tekshiruvda xatolik yuz berdi: ' + message,
      reason: 'Tizim xatoligi'
    }, { status: 500 })
  }
}
