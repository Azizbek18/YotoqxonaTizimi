import { NextRequest, NextResponse } from 'next/server'
import { callGemini } from '@/lib/gemini'
import { getRequestUser } from '@/lib/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

type ChatMessage = {
  role?: string
  text?: string
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    const throttle = checkRateLimit(`ai-chat:${user.id}:${getClientIp(req)}`, 20, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p so‘rov. Keyinroq urinib ko‘ring.' }, { status: 429 })
    }

    const { message, history } = await req.json() as { message?: string; history?: ChatMessage[] }
    if (!message) {
      return NextResponse.json({ error: 'message kiritilishi shart' }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY

    // Dormitory rules context for AI System Instructions
    const systemInstruction = `Siz O'zbekiston Milliy Universiteti Talabalar Yotoqxonasining aqlli virtual yordamchisisiz (ismingiz "Yotoqxona AI").
Vazifangiz talabalarga yotoqxona tartib-qoidalari, to'lovlar, arizalar va kundalik masalalarda yordam berishdir.
Siz faqat o'zbek tilida, do'stona, aniq va xushmuomala ohangda javob berishingiz kerak.

Mavjud ma'lumotlar ro'yxati (savollarga javob berishda foydalaning):
1. **Kirish-chiqish tartibi**: Yotoqxonaga kirish-chiqish 06:00 dan 23:00 gacha. Sukunat (tinchlik) vaqti 22:00 dan 07:00 gacha.
2. **To'lovlar**: Bir oylik turarjoy to'lovi 300,000 UZS. Yillik shartnoma summasi 3,000,000 UZS (10 oy uchun). To'lov cheklarini talaba "To'lov qilish" sahifasida yuklab, tasdiqlash uchun yuborishi mumkin.
3. **Arizalar**: Talaba o'z arizalarini (masalan: xonani o'zgartirish, texnik ta'mir, tushuntirish xati) dashboarddagi "Ariza Yozish" bo'limida yozib yuborishi mumkin. AI arizani chiroyli va rasmiy tilda yozishga yordam beradi.
4. **Taqiqlar**: Yotoqxona hududida spirtli ichimliklar, tamaki mahsulotlari, ruxsatsiz isitgichlar, elektr plitkalaridan foydalanish taqiqlanadi. Tartibni buzganlarning intizom ko'rsatkichi tushib ketadi. 3 ta ogohlantirish olgan talaba yotoqxonadan chiqariladi.

Muhim: sizda quyidagilar haqida real ma'lumot YO'Q — bunday savol kelsa, o'ylab topmang, aniq ko'rsatilgan ilova bo'limiga yo'naltiring:
- Xodimlar (komendant, tarbiyachi, shifokor) ismi/telefoni — talabaga "Navbat" sahifasidagi qavat sardori/ma'muriyat kartochkasiga qarashni tavsiya qiling.
- Tozalik/navbatchilik jadvali — talabaga shaxsiy Dashboard sahifasidagi "Navbatchilik" bo'limini tekshirishni tavsiya qiling, chunki bu har bir xona uchun individual.
- Texnik nosozlik yoki shaxsiy holatlar — ariza yozishni tavsiya qiling.

Javoblaringizni iloji boricha qisqa, tushunarli va chiroyli emojilar bilan bezab bering.`

    if (geminiApiKey) {
      try {
        // Format conversational history for Gemini
        const formattedContents: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = []

        // If there's prior history, map it to Gemini structure (user/model)
        if (Array.isArray(history)) {
          for (const msg of history) {
            if (!msg.text) continue
            formattedContents.push({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.text }]
            })
          }
        }

        // Add the current user message
        formattedContents.push({
          role: 'user',
          parts: [{ text: message }]
        })

        const apiData = await callGemini({
          contents: formattedContents,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          }
        }, geminiApiKey)

        const aiReply = apiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Kechirasiz, javobni shakllantirishda xatolik yuz berdi.'

        return NextResponse.json({ reply: aiReply })

      } catch (error: unknown) {
        console.error('Gemini chat failed, using fallback:', error)
        return NextResponse.json({
          reply: `🤖 Salom! [Gemini ulanish xatosi] Hozirda serverda texnik ishlar ketmoqda. Ammo men sizga quyidagicha yordam bera olaman:
- 🚪 Kirish-chiqish 06:00 dan 23:00 gacha.
- 💳 To'lov oyiga 300,000 UZS.
- 📞 Qavat sardori va ma'muriyat aloqasini "Navbat" sahifasidan ko'rishingiz mumkin.
Sizga qanday yordam bera olaman?`
        })
      }
    } else {
      // Offline fallback simulator if GEMINI_API_KEY is not defined
      let reply = '🤖 Salom! Men sizning yotoqxona AI yordamchingizman. Loyihada GEMINI_API_KEY sozlanmaganligi sababli cheklangan rejimda javob beryapman. Qanday yordam kerak?'
      const lower = message.toLowerCase()
      if (lower.includes('to\'lov') || lower.includes('tolov') || lower.includes('pul') || lower.includes('kontrakt')) {
        reply = '💳 Yotoqxona to\'lovi oyiga **300,000 UZS**ni tashkil etadi. Yillik jami shartnoma 10 oy uchun **3,000,000 UZS**. To\'lov chekini shaxsiy kabinetingizdagi "To\'lov qilish" bo\'limidan yuklashingiz mumkin.'
      } else if (lower.includes('kirish') || lower.includes('chiqish') || lower.includes('vaqt') || lower.includes('yopiladi')) {
        reply = '🚪 Yotoqxonaga kirish-chiqish vaqti soat **06:00 dan 23:00 gacha**. Sukunat vaqti 22:00 dan 07:00 gacha. Iltimos, vaqtida yetib keling!'
      } else if (lower.includes('komendant') || lower.includes('tarbiyachi') || lower.includes('sardor') || lower.includes('boshliq') || lower.includes('navbatchi')) {
        reply = '📞 Qavat sardoringiz va ma\'muriyat aloqa ma\'lumotlari shaxsiy kabinetingizdagi "Navbat" sahifasida ko\'rsatilgan — u yerda to\'g\'ridan-to\'g\'ri qo\'ng\'iroq qilish tugmasi ham bor.'
      } else if (lower.includes('shifokor') || lower.includes('kasal') || lower.includes('tibbiy') || lower.includes('doktor')) {
        reply = '🏥 Tibbiy yordam bo\'yicha aniq ma\'lumot uchun qavat sardoringiz yoki ma\'muriyatga murojaat qiling — bu ma\'lumot mendan mavjud emas.'
      } else if (lower.includes('navbatchilik') || lower.includes('tozalik') || lower.includes('supur')) {
        reply = '🧹 Sizning xonangiz uchun tozalik navbatchilik jadvalini shaxsiy Dashboard sahifasidagi "Navbatchilik" bo\'limidan ko\'rishingiz mumkin — u har bir xona uchun individual tuzilgan.'
      }
      return NextResponse.json({ reply })
    }

  } catch (error: unknown) {
    console.error('Chat API Error:', error)
    const message = error instanceof Error ? error.message : 'Ichki server xatoligi'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
