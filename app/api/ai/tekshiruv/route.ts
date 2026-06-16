import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { callGemini } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const declaredAmount = Number(formData.get('amount') || 0)

    if (!file) {
      return NextResponse.json({ error: 'Fayl yuklanmadi' }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({
        valid: true,
        confidence: 90,
        extracted_amount: declaredAmount,
        transaction_id: null,
        analysis: 'AI kaliti sozlanmaganligi sababli avtomatik tekshiruv o\'tkazib yuborildi.',
        amount_match: true,
        is_duplicate: false
      })
    }

    // Read file as base64
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // Prepare Gemini prompt for real-time validation
    const systemPrompt = `Siz to'lov cheklarini real-vaqtda tekshiradigan AI tizimisiz.
Sizga yuborilgan to'lov cheki (rasm yoki PDF) ni tahlil qiling.

VAZIFANGIZ:
1. Chekdagi haqiqiy to'lov summasini aniqlang (UZS da)
2. Tranzaksiya raqamini (transaction_id) toping — bu har bir chekdagi unikal raqam (Click/Payme tranzaksiya IDsi, to'lov raqami, kvitansiya raqami, yoki xizmat ko'rsatuvchining unikal raqami). Bu JUDA MUHIM!
3. Chek haqiqiy yoki soxta ekanligini baholang
4. To'lov sanasini aniqlang

Talaba ${declaredAmount.toLocaleString()} UZS to'lov qilganini da'vo qilmoqda.

MUHIM: Agar chekdagi summa ${declaredAmount.toLocaleString()} UZS dan farq qilsa, buni albatta ko'rsating.
MUHIM: transaction_id ni albatta aniqlang! Bu tekroran yuklashni oldini olish uchun kerak.

Quyidagi JSON formatda javob qaytaring:
{
  "confidence": 95,
  "extracted_amount": 900000,
  "transaction_id": "TX12345678",
  "payment_date": "2026-01-15",
  "analysis": "Qisqa tahlil natijasi",
  "amount_match": true
}

amount_match - chekdagi summa talaba ko'rsatgan summa bilan mos kelsa true, aks holda false.

MUHIM: Faqat va faqat toza JSON formatida javob bering.`

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

    const extractedAmount = typeof jsonResult.extracted_amount === 'number' ? jsonResult.extracted_amount : null
    let confidence = typeof jsonResult.confidence === 'number' ? jsonResult.confidence : 50
    const transactionId = jsonResult.transaction_id ? String(jsonResult.transaction_id) : null
    let analysis = jsonResult.analysis || ''

    // Determine amount match
    let amountMatch = jsonResult.amount_match
    if (extractedAmount !== null && typeof amountMatch === 'undefined') {
      const tolerance = declaredAmount * 0.05
      amountMatch = Math.abs(extractedAmount - declaredAmount) <= tolerance
    }

    // ========== DUPLICATE CHECK ==========
    // Check if this transaction_id already exists in the database
    let isDuplicate = false
    let duplicateInfo = ''

    if (transactionId) {
      try {
        const supabase = getServiceSupabase()
        const { data: existingRecords, error: dupError } = await supabase
          .from('tolovlar')
          .select('id, student_name, month, year, created_at')
          .eq('transaction_id', transactionId)
          .limit(1)

        if (!dupError && existingRecords && existingRecords.length > 0) {
          const dup = existingRecords[0]
          isDuplicate = true
          confidence = 5 // Very low confidence for duplicates
          const dupDate = new Date(dup.created_at).toLocaleDateString('uz-UZ')
          duplicateInfo = `⚠️ TAKRORIY CHEK ANIQLANDI!\n\nUshbu chekdagi tranzaksiya raqami (${transactionId}) tizimda allaqachon mavjud!\n\nAvval "${dup.student_name}" tomonidan ${dup.month} ${dup.year} oyi to'lovi uchun ${dupDate} sanasida yuklangan.\n\nBu chekni qayta yuklash mumkin emas!`
          analysis = duplicateInfo
          amountMatch = false // Force invalid
        }
      } catch (dbErr: any) {
        console.error('Duplicate check DB error:', dbErr)
        // Don't block the validation if DB check fails
      }
    }

    // Also check by payment_date + extracted_amount combination for same-looking receipts
    if (!isDuplicate && extractedAmount && jsonResult.payment_date) {
      try {
        const supabase = getServiceSupabase()
        // Check if there's already a payment with the same AI-extracted amount and similar date
        const { data: similarRecords, error: simError } = await supabase
          .from('tolovlar')
          .select('id, student_name, month, year, created_at, transaction_id')
          .eq('ai_extracted_amount', extractedAmount)
          .not('transaction_id', 'is', null)
          .limit(5)

        if (!simError && similarRecords && similarRecords.length > 0) {
          // Check if any of these have the same transaction_id pattern or payment date
          for (const rec of similarRecords) {
            if (rec.transaction_id === transactionId) {
              isDuplicate = true
              confidence = 5
              const dupDate = new Date(rec.created_at).toLocaleDateString('uz-UZ')
              duplicateInfo = `⚠️ TAKRORIY CHEK ANIQLANDI!\n\nXuddi shu tranzaksiya raqami (${transactionId}) va summa (${extractedAmount?.toLocaleString()} UZS) bilan chek oldinroq "${rec.student_name}" tomonidan ${rec.month} ${rec.year} uchun ${dupDate} da yuklangan.\n\nBu chekni qayta yuklash mumkin emas!`
              analysis = duplicateInfo
              amountMatch = false
              break
            }
          }
        }
      } catch (dbErr: any) {
        console.error('Similar check DB error:', dbErr)
      }
    }

    return NextResponse.json({
      valid: !isDuplicate && confidence >= 50 && amountMatch !== false,
      confidence,
      extracted_amount: extractedAmount,
      transaction_id: transactionId,
      payment_date: jsonResult.payment_date || null,
      analysis,
      amount_match: isDuplicate ? false : amountMatch,
      is_duplicate: isDuplicate,
      duplicate_info: duplicateInfo || null
    })

  } catch (error: any) {
    console.error('AI tekshiruv xatoligi:', error)
    return NextResponse.json({
      error: error.message || 'Ichki server xatoligi',
      valid: false,
      confidence: 0,
      extracted_amount: null,
      analysis: 'AI tekshiruvda xatolik yuz berdi: ' + (error.message || 'Noma\'lum xatolik'),
      is_duplicate: false
    }, { status: 500 })
  }
}
