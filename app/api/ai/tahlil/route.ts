import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { callGemini } from '@/lib/gemini'
import { getRequestUser } from '@/lib/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { assertSafeReceiptUrl, fetchReceipt } from '@/lib/safe-storage-url'

// Looks up `role` for the given identity in `table`, trying `id` then
// `email` as two safe, parameterized lookups — never interpolate
// user-controlled values into a single `.or()` filter string (PostgREST's
// or() mini-language treats commas/dots as syntax, so raw interpolation
// there is an injection vector).
async function canAnalyzePayment(userId: string, studentId: string) {
  const supabase = getServiceSupabase()
  if (userId === studentId) {
    const { data: student } = await supabase
      .from('users')
      .select('role, status')
      .eq('id', userId)
      .maybeSingle()
    return student?.role === 'talaba' && student.status === 'active'
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()
  return staff?.role === 'admin' && staff.status === 'active'
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    const throttle = await checkRateLimit(`ai-tahlil:${user.id}:${getClientIp(req)}`, 20, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p AI tahlil so‘rovi. Keyinroq urinib ko‘ring.' }, { status: 429 })
    }

    const { paymentId } = await req.json() as { paymentId?: string }
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId kiritilishi shart' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    // 1. Fetch the payment record
    const { data: record, error: fetchError } = await supabase
      .from('tolovlar')
      .select('id, student_id, student_name, month, year, amount, receipt_url')
      .eq('id', paymentId)
      .single()

    if (fetchError || !record) {
      return NextResponse.json({ error: 'To\'lov yozuvi topilmadi' }, { status: 404 })
    }

    if (!(await canAnalyzePayment(user.id, record.student_id))) {
      return NextResponse.json({ error: 'Ushbu to‘lovni tahlil qilishga ruxsat yo‘q' }, { status: 403 })
    }

    const receiptUrl = assertSafeReceiptUrl(record.receipt_url, record.student_id)
    if (!receiptUrl) {
      return NextResponse.json({ error: 'Ushbu to\'lovda yuklangan chek/kvitansiya mavjud emas' }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'AI tekshiruv xizmati vaqtincha mavjud emas' }, { status: 503 })
    }

    let aiConfidence = 95
    let aiExtractedAmount = record.amount
    let aiTransactionId: string | null = null
    let aiAnalysis = ''

    try {
        // 2. Download receipt file from the public URL
        const { buffer, mimeType } = await fetchReceipt(receiptUrl)
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
          return NextResponse.json({ error: 'Chek fayli formati qo‘llab-quvvatlanmaydi' }, { status: 400 })
        }
        const base64Data = buffer.toString('base64')

        // 3. Prepare Prompt for Gemini to also extract transaction_id
        const systemPrompt = `Siz to'lov cheklarini tahlil qiladigan va soxtalikni aniqlaydigan AI audit mutaxassissiz. 
Sizga yuborilgan to'lov cheki (rasm yoki PDF) haqiqiyligini tekshiring, undagi to'lov summasini (UZS da) va to'lov sanasini, shuningdek tranzaksiya raqamini (transaction_id) aniqlang.
Quyidagi JSON formatda javob qaytaring:
{
  "confidence": 95, // haqiqiylik darajasi foizda (0 dan 100 gacha, agar chek tushunarsiz, soxta yoki mos kelmasa past foiz bering)
  "extracted_amount": 900000, // chekda ko'rsatilgan haqiqiy to'lov summasi faqat raqamlarda (UZS da). Agar summani aniqlab bo'lmasa, null bering.
  "transaction_id": "TX99281726", // chekdagi unikal tranzaksiya raqami/IDsi (Click/Payme tranzaksiya IDsi, to'lov raqami yoki xizmat ko'rsatuvchining unikal raqami). Agar topilmasa yoki aniqlab bo'lmasa, null bering.
  "analysis": "Chek Click to'lov tizimidan olingan bo'lib, haqiqiy ko'rinadi. Tranzaksiya raqami va sana ko'rinib turibdi." // o'zbek tilida qisqa tahlil va izoh
}

MUHIM: Faqat va faqat toza JSON formatida javob bering, hech qanday markdown formatlash yoki qo'shimcha tushuntirish qo'shmang.`

        // 4. Call Gemini 2.5 Flash API via fetch
        const apiData = await callGemini({
          contents: [
            {
              parts: [
                {
                  text: systemPrompt
                },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }, geminiApiKey)
        const textResponse = apiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // 5. Parse Gemini response
        const jsonResult = JSON.parse(textResponse.trim())
        aiConfidence = typeof jsonResult.confidence === 'number' ? jsonResult.confidence : 95
        aiExtractedAmount = typeof jsonResult.extracted_amount === 'number' ? jsonResult.extracted_amount : record.amount
        aiTransactionId = jsonResult.transaction_id ? String(jsonResult.transaction_id) : null
        aiAnalysis = jsonResult.analysis || 'Tahlil muvaffaqiyatli yakunlandi.'

    } catch (geminiError: unknown) {
      console.error('Gemini processing failed:', geminiError)
      return NextResponse.json({ error: 'AI tahlili yakunlanmadi; to‘lov qo‘lda tekshiriladi' }, { status: 502 })
    }

    // 5.5 Check for duplicate transaction IDs in the database
    if (aiTransactionId) {
      const { data: duplicateRecords, error: dupError } = await supabase
        .from('tolovlar')
        .select('id, student_name, month, year')
        .eq('transaction_id', aiTransactionId)
        .neq('id', paymentId) // Exclude current payment
        .neq('receipt_url', receiptUrl) // Exclude same batch uploads
        .limit(1)


      if (!dupError && duplicateRecords && duplicateRecords.length > 0) {
        const dup = duplicateRecords[0]
        aiConfidence = 10 // Flag confidence extremely low for duplicates
        aiAnalysis = `⚠️ DIQQAT: TAKRORAN YUKLANGAN CHEK (DUPLICATE DETECTION)! \n\nUshbu chekdagi tranzaksiya raqami (${aiTransactionId}) tizimdagi boshqa to'lovda allaqachon ro'yxatdan o'tgan! \n\nUshbu chek avval talaba "${dup.student_name}" tomonidan ${dup.month} ${dup.year} oyi to'lovi uchun ishlatilgan. Soxtalik va firibgarlik ehtimoli juda yuqori.`
      }
    }

    // 6. Update the database record with the results including transaction_id
    const { error: updateError } = await supabase
      .from('tolovlar')
      .update({
        ai_confidence: aiConfidence,
        ai_extracted_amount: aiExtractedAmount,
        ai_analysis: aiAnalysis,
        transaction_id: aiTransactionId
      })
      .eq('id', paymentId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      ai_confidence: aiConfidence,
      ai_extracted_amount: aiExtractedAmount,
      ai_analysis: aiAnalysis
    })

  } catch (error: unknown) {
    console.error('AI analysis API error:', error)
    const message = error instanceof Error ? error.message : 'Ichki server xatoligi'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
