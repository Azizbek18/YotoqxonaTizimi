import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getServiceSupabase } from '@/lib/server-supabase'
import { callGemini } from '@/lib/gemini'
import { getRequestUser } from '@/lib/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

// Normalizes a transaction_id for comparison so trivial formatting
// differences (case, spaces, dashes) can't be used to dodge the
// duplicate check — must mirror the `transaction_id_normalized`
// generated column added in MIGRATION_receipt_duplicate_hardening.sql.
function normalizeTransactionId(id: string): string {
  return id.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// Catches placeholder/example IDs (including the literal example used
// in the prompt below) and trivially-guessable sequences that carry no
// real evidence of an actual transaction.
function isSuspiciousTransactionId(normalizedId: string): boolean {
  if (normalizedId.length < 6) return true

  const knownPlaceholders = ['TX12345678', 'TX99281726', 'NA', 'TEST', 'TXXXXXXXXX']
  if (knownPlaceholders.includes(normalizedId)) return true

  const digitsOnly = normalizedId.replace(/[^0-9]/g, '')
  if (digitsOnly.length >= 6) {
    if (/^(\d)\1+$/.test(digitsOnly)) return true // all same digit

    let ascending = true
    let descending = true
    for (let i = 1; i < digitsOnly.length; i++) {
      const prev = Number(digitsOnly[i - 1])
      const cur = Number(digitsOnly[i])
      if (cur !== (prev + 1) % 10) ascending = false
      if (cur !== (prev + 9) % 10) descending = false
    }
    if (ascending || descending) return true
  }

  return false
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    const throttle = checkRateLimit(`ai-tekshiruv:${user.id}:${getClientIp(req)}`, 12, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p chek tekshirildi. Keyinroq urinib ko‘ring.' }, { status: 429 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const declaredAmount = Number(formData.get('amount') || 0)

    if (!file) {
      return NextResponse.json({ error: 'Fayl yuklanmadi' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Faqat rasm yoki PDF chek qabul qilinadi' }, { status: 400 })
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Chek hajmi 8MB dan kichik bo‘lishi kerak' }, { status: 400 })
    }

    // Read file once — used for both the byte-level duplicate check and the AI call.
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex')
    const base64Data = fileBuffer.toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // ========== EXACT FILE DUPLICATE CHECK ==========
    // Independent of the AI's OCR/authenticity judgement: if the exact same
    // image bytes were already submitted (by this student or reused from
    // someone else's receipt), it's a guaranteed duplicate regardless of what
    // the AI extracts this time.
    const supabaseForHash = getServiceSupabase()
    const { data: hashMatches } = await supabaseForHash
      .from('tolovlar')
      .select('id, student_name, month, year, created_at')
      .eq('receipt_hash', fileHash)
      .limit(1)

    if (hashMatches && hashMatches.length > 0) {
      const dup = hashMatches[0]
      const dupDate = new Date(dup.created_at).toLocaleDateString('uz-UZ')
      const duplicateInfo = `⚠️ TAKRORIY CHEK ANIQLANDI!\n\nUshbu aynan bir xil chek fayli tizimda allaqachon mavjud!\n\nAvval "${dup.student_name}" tomonidan ${dup.month} ${dup.year} oyi to'lovi uchun ${dupDate} sanasida yuklangan.\n\nBu chekni qayta yuklash mumkin emas!`
      return NextResponse.json({
        valid: false,
        confidence: 5,
        extracted_amount: null,
        transaction_id: null,
        analysis: duplicateInfo,
        amount_match: false,
        is_duplicate: true,
        duplicate_info: duplicateInfo,
        file_hash: fileHash
      })
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
        is_duplicate: false,
        file_hash: fileHash
      })
    }

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

    // ========== DUPLICATE / SUSPICIOUS ID CHECK ==========
    // Check if this transaction_id already exists in the database, matching
    // on a normalized form (uppercase, alphanumeric-only) so case/spacing/
    // punctuation differences can't be used to dodge the check.
    let isDuplicate = false
    let isSuspiciousId = false
    let duplicateInfo = ''

    if (transactionId) {
      const normalizedId = normalizeTransactionId(transactionId)

      if (isSuspiciousTransactionId(normalizedId)) {
        isSuspiciousId = true
        confidence = 5
        duplicateInfo = `⚠️ SHUBHALI TRANZAKSIYA RAQAMI!\n\nAniqlangan tranzaksiya raqami (${transactionId}) haqiqiy to'lov tizimlariga xos ko'rinmayapti (juda qisqa, na'muna yoki ketma-ket raqamlarga o'xshaydi).\n\nIltimos, chekning asl, aniq skrinshotini yuklang.`
        analysis = duplicateInfo
        amountMatch = false
      } else {
        try {
          const supabase = getServiceSupabase()
          const { data: existingRecords, error: dupError } = await supabase
            .from('tolovlar')
            .select('id, student_name, month, year, created_at')
            .eq('transaction_id_normalized', normalizedId)
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
        } catch (dbErr: unknown) {
          console.error('Duplicate check DB error:', dbErr)
          // Don't block the validation if DB check fails
        }
      }
    }

    return NextResponse.json({
      valid: !isDuplicate && !isSuspiciousId && confidence >= 50 && amountMatch !== false,
      confidence,
      extracted_amount: extractedAmount,
      transaction_id: transactionId,
      payment_date: jsonResult.payment_date || null,
      analysis,
      amount_match: (isDuplicate || isSuspiciousId) ? false : amountMatch,
      is_duplicate: isDuplicate,
      is_suspicious_id: isSuspiciousId,
      duplicate_info: duplicateInfo || null,
      file_hash: fileHash
    })

  } catch (error: unknown) {
    console.error('AI tekshiruv xatoligi:', error)
    const message = error instanceof Error ? error.message : 'Noma\'lum xatolik'
    return NextResponse.json({
      error: message || 'Ichki server xatoligi',
      valid: false,
      confidence: 0,
      extracted_amount: null,
      analysis: 'AI tekshiruvda xatolik yuz berdi: ' + message,
      is_duplicate: false
    }, { status: 500 })
  }
}
