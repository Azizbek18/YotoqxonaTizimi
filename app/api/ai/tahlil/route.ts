import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getServiceSupabase } from '@/lib/server-supabase'
import { aiVisionJson } from '@/lib/ai'
import { groqConfigured } from '@/lib/groq'
import { getRequestUser } from '@/lib/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { extractReceiptPath } from '@/lib/safe-storage-url'
import { normalizePaymentTransactionId } from '@/features/payments/domain/validation'
import { MAX_UPLOAD_SIZE_BYTES } from '@/lib/upload-limits'

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
      .select('id, student_id, student_name, month, year, amount, receipt_url, status, transaction_id')
      .eq('id', paymentId)
      .single()

    if (fetchError || !record) {
      return NextResponse.json({ error: 'To\'lov yozuvi topilmadi' }, { status: 404 })
    }

    if (!(await canAnalyzePayment(user.id, record.student_id))) {
      return NextResponse.json({ error: 'Ushbu to‘lovni tahlil qilishga ruxsat yo‘q' }, { status: 403 })
    }

    // Once a payment has been decided (approved/rejected/paid), its audit
    // fields (ai_confidence, ai_analysis, ...) must stay a record of what
    // was actually reviewed — allowing the owner to re-trigger analysis
    // afterwards would let them silently rewrite that history.
    if (record.status !== 'waiting') {
      return NextResponse.json({ error: 'Bu to\'lov allaqachon ko\'rib chiqilgan, qayta tahlil qilib bo\'lmaydi' }, { status: 409 })
    }

    const receiptPath = extractReceiptPath(record.receipt_url, record.student_id)
    if (!receiptPath) {
      return NextResponse.json({ error: 'Ushbu to\'lovda yuklangan chek/kvitansiya mavjud emas' }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey && !groqConfigured()) {
      return NextResponse.json({ error: 'AI tekshiruv xizmati vaqtincha mavjud emas' }, { status: 503 })
    }

    let aiConfidence = 95
    let aiExtractedAmount = record.amount
    let aiTransactionId: string | null = null
    let aiAnalysis = ''
    let receiptHash = ''

    try {
        // 2. Download the receipt file directly from private storage
        // (service-role client, so this works regardless of bucket ACLs).
        const { data: fileData, error: downloadError } = await supabase.storage.from('receipts').download(receiptPath)
        if (downloadError || !fileData) {
          return NextResponse.json({ error: 'Chek faylini yuklab bo‘lmadi' }, { status: 500 })
        }
        if (fileData.size > MAX_UPLOAD_SIZE_BYTES) {
          return NextResponse.json({ error: 'Chek fayli juda katta' }, { status: 400 })
        }
        const mimeType = fileData.type || 'application/octet-stream'
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
          return NextResponse.json({ error: 'Chek fayli formati qo‘llab-quvvatlanmaydi' }, { status: 400 })
        }
        const buffer = Buffer.from(await fileData.arrayBuffer())
        const base64Data = buffer.toString('base64')
        // Computed from the actual downloaded bytes rather than trusting
        // record.receipt_hash — that column can be NULL on legacy rows,
        // which would otherwise silently skip the atomic duplicate check
        // below entirely. Hashing the file we already have here works
        // unconditionally and is exactly what should identify "the same
        // physical receipt" anyway.
        receiptHash = createHash('sha256').update(buffer).digest('hex')

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
        const apiData = await aiVisionJson({
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
        // Submission already reserved a verified transaction id atomically.
        // Preserve it when a later background analysis cannot read the id,
        // rather than erasing the canonical value from this payment row.
        aiTransactionId = jsonResult.transaction_id
          ? String(jsonResult.transaction_id)
          : record.transaction_id
        aiAnalysis = jsonResult.analysis || 'Tahlil muvaffaqiyatli yakunlandi.'

    } catch (geminiError: unknown) {
      console.error('Gemini processing failed:', geminiError)
      return NextResponse.json({ error: 'AI tahlili yakunlanmadi; to‘lov qo‘lda tekshiriladi' }, { status: 502 })
    }

    // 5.5 Check for duplicate transaction IDs in the database. Compares the
    // normalized form (same regexp as the generated transaction_id_normalized
    // column) so formatting differences like "TX-778812340" vs
    // "tx778812340" can't be used to dodge this soft, informational check.
    const normalizedTransactionId = normalizePaymentTransactionId(aiTransactionId)
    if (normalizedTransactionId) {
      const { data: duplicateRecords, error: dupError } = await supabase
        .from('tolovlar')
        .select('id')
        .eq('transaction_id_normalized', normalizedTransactionId)
        .neq('id', paymentId) // Exclude current payment
        .neq('receipt_url', record.receipt_url) // Exclude same batch uploads
        .limit(1)

      // Deliberately does not name whose payment this was — the caller may
      // not be authorized to see that student's identity (an attacker could
      // forward someone else's real receipt as "their own" upload just to
      // probe whose transaction ID it is).
      if (!dupError && duplicateRecords && duplicateRecords.length > 0) {
        aiConfidence = 10 // Flag confidence extremely low for duplicates
        aiAnalysis = `⚠️ DIQQAT: TAKRORAN YUKLANGAN CHEK (DUPLICATE DETECTION)! \n\nUshbu chekdagi tranzaksiya raqami (${aiTransactionId}) tizimdagi boshqa to'lovda allaqachon ro'yxatdan o'tgan! Soxtalik va firibgarlik ehtimoli juda yuqori.`
      }
    }

    // 6. Claiming the transaction id and writing the payment's audit fields
    // happen inside one DB function (advisory-locked per receipt_hash),
    // not as separate statements here — status='waiting' is re-checked
    // and row-locked FIRST, before anything is claimed, so a payment that
    // gets decided in the gap between the top-of-request check and now
    // (the Gemini call can take several seconds) can't end up with a
    // claimed-but-never-recorded transaction id permanently occupying it,
    // nor can its audit fields get overwritten after the fact.
    const { data: finalizeResult, error: finalizeError } = await supabase
      .rpc('finalize_payment_analysis', {
        p_payment_id: paymentId,
        p_receipt_hash: receiptHash,
        p_transaction_id: aiTransactionId,
        p_transaction_id_normalized: normalizedTransactionId,
        p_ai_confidence: aiConfidence,
        p_ai_extracted_amount: aiExtractedAmount,
        p_ai_analysis: aiAnalysis,
      })
      .single()

    if (finalizeError) {
      throw finalizeError
    }
    if (!finalizeResult.applied) {
      return NextResponse.json({ error: 'Bu to\'lov tahlil davomida allaqachon ko\'rib chiqilgan' }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      ai_confidence: finalizeResult.final_confidence,
      ai_extracted_amount: aiExtractedAmount,
      ai_analysis: finalizeResult.final_analysis
    })

  } catch (error: unknown) {
    console.error('AI analysis API error:', error)
    return NextResponse.json({ error: 'AI tahlilida server xatoligi yuz berdi' }, { status: 500 })
  }
}
