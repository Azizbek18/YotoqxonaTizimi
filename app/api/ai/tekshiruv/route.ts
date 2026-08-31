import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getServiceSupabase } from '@/lib/server-supabase'
import { aiVisionJson } from '@/lib/ai'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'
import { signFileClaim } from '@/lib/receipt-claim'
import {
  isSuspiciousPaymentTransactionId,
  normalizePaymentTransactionId,
  parsePaymentAmount,
  PaymentValidationError,
} from '@/features/payments/domain/validation'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { MAX_UPLOAD_SIZE_BYTES, readMultipartForm } from '@/lib/upload-limits'

export async function POST(req: NextRequest) {
  try {
    const { student } = await requireActiveStudent(req)

    const throttle = await checkRateLimit(`ai-tekshiruv:${student.id}:${getClientIp(req)}`, 12, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p chek tekshirildi. Keyinroq urinib ko‘ring.' }, { status: 429 })
    }

    const formData = await readMultipartForm(req)
    const file = formData.get('file') as File | null
    const declaredAmount = parsePaymentAmount(formData.get('amount'))

    if (!file) {
      return NextResponse.json({ error: 'Fayl yuklanmadi' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Faqat rasm yoki PDF chek qabul qilinadi' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: 'Chek hajmi 4 MB dan oshmasligi kerak' }, { status: 413 })
    }

    // Read file once — used for both the byte-level duplicate check and the AI call.
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    const fileRule = PERMIT_FILE_RULES[file.type]
    if (!fileRule || !hasAllowedSignature(fileBuffer, fileRule.signatures) || (file.type === 'image/webp' && fileBuffer.subarray(8, 12).toString('ascii') !== 'WEBP')) {
      return NextResponse.json({ error: 'Chek rasmining formati qo‘llab-quvvatlanmaydi. iPhone rasmi (HEIC) bo‘lsa JPG ga o‘giring yoki skrinshot yuklang — PDF, JPG, PNG qabul qilinadi.' }, { status: 400 })
    }
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex')
    const base64Data = fileBuffer.toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // ========== EXACT FILE DUPLICATE CHECK ==========
    // Independent of the AI's OCR/authenticity judgement: if the exact same
    // image bytes were already submitted (by this student or reused from
    // someone else's receipt), it's a guaranteed duplicate regardless of what
    // the AI extracts this time.
    const supabaseForHash = getServiceSupabase()
    const { data: hashMatches, error: hashError } = await supabaseForHash
      .from('tolovlar')
      .select('id, created_at')
      .eq('receipt_hash', fileHash)
      .limit(1)

    if (hashError) throw hashError
    if (hashMatches && hashMatches.length > 0) {
      const dup = hashMatches[0]
      const dupDate = new Date(dup.created_at).toLocaleDateString('uz-UZ')
      // Deliberately does not name whose receipt this was — the caller may
      // not be authorized to see that student's identity (see AI dup-check
      // PII leak fix).
      const duplicateInfo = `⚠️ TAKRORIY CHEK ANIQLANDI!\n\nUshbu aynan bir xil chek fayli tizimda allaqachon ${dupDate} sanasida yuklangan.\n\nBu chekni qayta yuklash mumkin emas!`
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
        valid: false,
        confidence: 0,
        extracted_amount: null,
        transaction_id: null,
        analysis: 'AI tekshiruv xizmati vaqtincha mavjud emas.',
        amount_match: false,
        is_duplicate: false,
        file_hash: fileHash,
      }, { status: 503 })
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

    let extractedAmount: number | null = null
    let confidence = 100
    let transactionId: string | null = null
    let analysis = ''
    let amountMatch = true
    let paymentDate: string | null = null

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

      extractedAmount = typeof jsonResult.extracted_amount === 'number' ? jsonResult.extracted_amount : null
      confidence = typeof jsonResult.confidence === 'number' ? jsonResult.confidence : 50
      transactionId = jsonResult.transaction_id ? String(jsonResult.transaction_id) : null
      analysis = jsonResult.analysis || ''
      paymentDate = jsonResult.payment_date || null

      // Determine amount match. Never trust jsonResult.amount_match at face
      // value — it can be undefined/null/a "false" string (all truthy in a
      // loose check), which would let a claim through despite no real
      // amount evidence. The tolerance check against a real, finite
      // extracted number is the actual source of truth; the AI's own flag
      // can only veto it (force a reject), never approve on its own.
      if (typeof extractedAmount !== 'number' || !Number.isFinite(extractedAmount)) {
        amountMatch = false
      } else {
        // Capped absolute slack, not a flat percentage — 5% of a 3,000,000
        // so'm yearly contract payment is 150,000 so'm of unchecked room,
        // which is real money for a financial control. This still tolerates
        // the kind of minor digit misread OCR can produce on small amounts.
        const tolerance = Math.min(declaredAmount * 0.05, 5000)
        amountMatch = Math.abs(extractedAmount - declaredAmount) <= tolerance
        if (jsonResult.amount_match === false) amountMatch = false
      }
    } catch (geminiError: unknown) {
      console.error('Gemini API call failed:', geminiError)
      return NextResponse.json({
        valid: false,
        confidence: 0,
        extracted_amount: null,
        transaction_id: null,
        analysis: 'AI tekshiruvi yakunlanmadi. Keyinroq qayta urinib ko‘ring.',
        amount_match: false,
        is_duplicate: false,
        file_hash: fileHash,
      }, { status: 502 })
    }

    // ========== DUPLICATE / SUSPICIOUS ID CHECK ==========
    // Check if this transaction_id already exists in the database, matching
    // on a normalized form (uppercase, alphanumeric-only) so case/spacing/
    // punctuation differences can't be used to dodge the check.
    let isDuplicate = false
    let isSuspiciousId = false
    let duplicateInfo = ''

    // A receipt with no readable transaction id at all must never pass —
    // without one there's nothing for the duplicate check below to compare
    // against, so a real receipt with its transaction id cropped/blurred
    // out (or a screenshot with it edited away) would otherwise skip
    // fraud detection entirely while still coming back "valid".
    if (!transactionId) {
      isSuspiciousId = true
      confidence = 5
      duplicateInfo = `⚠️ TRANZAKSIYA RAQAMI ANIQLANMADI!\n\nChekdan tranzaksiya raqamini o'qib bo'lmadi, shuning uchun takroriy chek tekshiruvini o'tkazib bo'lmaydi.\n\nIltimos, chekning to'liq va aniq skrinshotini yuklang — tranzaksiya raqami ko'rinib turishi shart.`
      analysis = duplicateInfo
      amountMatch = false
    } else {
      const normalizedId = normalizePaymentTransactionId(transactionId)

      if (isSuspiciousPaymentTransactionId(normalizedId)) {
        isSuspiciousId = true
        confidence = 5
        duplicateInfo = `⚠️ SHUBHALI TRANZAKSIYA RAQAMI!\n\nAniqlangan tranzaksiya raqami (${transactionId}) haqiqiy to'lov tizimlariga xos ko'rinmayapti (juda qisqa, na'muna yoki ketma-ket raqamlarga o'xshaydi).\n\nIltimos, chekning asl, aniq skrinshotini yuklang.`
        analysis = duplicateInfo
        amountMatch = false
      } else {
        try {
          const supabase = getServiceSupabase()
          const { data: existingRecords, error: dupError } = await supabase
            .from('payment_receipt_transactions')
            .select('receipt_hash, updated_at')
            .eq('transaction_id_normalized', normalizedId)
            .neq('receipt_hash', fileHash)
            .limit(1)

          if (dupError) throw dupError
          if (existingRecords && existingRecords.length > 0) {
            const dup = existingRecords[0]
            isDuplicate = true
            confidence = 5 // Very low confidence for duplicates
            const dupDate = new Date(dup.updated_at).toLocaleDateString('uz-UZ')
            // Deliberately does not name whose transaction this was — the
            // caller may not be authorized to see that student's identity.
            duplicateInfo = `⚠️ TAKRORIY CHEK ANIQLANDI!\n\nUshbu chekdagi tranzaksiya raqami (${transactionId}) tizimda allaqachon ${dupDate} sanasida yuklangan boshqa to'lovda qayd etilgan!\n\nBu chekni qayta yuklash mumkin emas!`
            analysis = duplicateInfo
            amountMatch = false // Force invalid
          }
        } catch (dbErr: unknown) {
          console.error('Duplicate check DB error:', dbErr)
          throw dbErr
        }
      }
    }

    const valid = !isDuplicate && !isSuspiciousId && confidence >= 50 && amountMatch === true

    return NextResponse.json({
      valid,
      confidence,
      extracted_amount: extractedAmount,
      transaction_id: transactionId,
      payment_date: paymentDate,
      analysis,
      amount_match: (isDuplicate || isSuspiciousId) ? false : amountMatch,
      is_duplicate: isDuplicate,
      is_suspicious_id: isSuspiciousId,
      duplicate_info: duplicateInfo || null,
      file_hash: fileHash,
      // Only issued when the check actually passed — this is what proves to
      // the real submission endpoint that this exact file was validated,
      // instead of trusting a client-supplied hash at face value. Binding
      // The normalized transaction id is signed as well, so the submission
      // endpoint can reserve it atomically instead of relying on a later,
      // client-triggered background analysis.
      claim: valid
        ? signFileClaim('payment', fileHash, {
            userId: student.id,
            amount: declaredAmount,
            transactionId: normalizePaymentTransactionId(transactionId),
          })
        : null,
    })

  } catch (error: unknown) {
    console.error('AI tekshiruv xatoligi:', error)
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message, valid: false }, { status: 400 })
    }
    const apiError = getApiError(error, 'AI tekshiruvda server xatoligi yuz berdi')
    return NextResponse.json({
      ...apiError.body,
      valid: false,
      confidence: 0,
      extracted_amount: null,
      analysis: 'AI tekshiruvni yakunlab bo‘lmadi.',
      is_duplicate: false
    }, { status: apiError.status })
  }
}
