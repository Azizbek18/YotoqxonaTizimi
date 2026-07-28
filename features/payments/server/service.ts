import 'server-only'
import { createHash, randomUUID } from 'crypto'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'
import { ApiError } from '@/server/http/api-error'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { verifyFileClaim } from '@/lib/receipt-claim'
import type { SubmitPaymentResult } from '../types'
import {
  PAYMENT_MONTHS,
  PaymentValidationError,
  validatePaymentReview,
} from '../domain/validation'
import { createPaymentRepository, type PaymentRepository } from './repository'

type StudentForPayment = { id: string; full_name: string | null }

function parseMonths(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? '[]')) as unknown
    if (!Array.isArray(parsed)) throw new Error('not-an-array')
    const clean = Array.from(new Set(parsed.map(String))).filter((month) => PAYMENT_MONTHS.has(month))
    if (clean.length === 0 || clean.length !== parsed.length) throw new Error('invalid-month')
    return clean
  } catch {
    throw new ApiError(400, 'To‘lov oylari noto‘g‘ri')
  }
}

export function createPaymentService(repository: PaymentRepository = createPaymentRepository()) {
  return {
    listForStudent(studentId: string) {
      return repository.listForStudent(studentId)
    },

    listAll(studentId?: string) {
      return repository.listAll(studentId)
    },

    async getSummary() {
      return { waitingCount: await repository.countWaiting() }
    },

    async review(input: { ids: unknown; status: unknown; message: unknown }) {
      let review
      try {
        review = validatePaymentReview(input)
      } catch (error) {
        if (error instanceof PaymentValidationError) throw new ApiError(400, error.message, error.code)
        throw error
      }
      const rows = await repository.review(review.ids, review.status, review.message)
      if (rows.length !== review.ids.length) throw new ApiError(409, 'Ba’zi to‘lovlar yangilanmadi')
      return { ok: true as const }
    },

    async submit(student: StudentForPayment, form: FormData): Promise<SubmitPaymentResult> {
      const file = form.get('file')
      const amount = Number(form.get('amount'))
      const year = Number(form.get('year'))
      const months = parseMonths(form.get('months'))
      if (!(file instanceof File)) throw new ApiError(400, 'Chek fayli topilmadi')
      if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new ApiError(400, 'To‘lov yili noto‘g‘ri')
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000) {
        throw new ApiError(400, 'To‘lov summasi noto‘g‘ri')
      }
      const { monthlyFee } = await createAppSettingsService().get()
      if (amount !== monthlyFee * months.length) {
        throw new ApiError(400, `To‘lov summasi tanlangan oylar uchun kutilgan summaga (${(monthlyFee * months.length).toLocaleString('uz-UZ')} so'm) mos kelmayapti`)
      }

      const rule = PERMIT_FILE_RULES[file.type]
      if (!rule || file.size < 16 || file.size > 8 * 1024 * 1024) {
        throw new ApiError(400, 'Faqat PDF, JPG, PNG yoki WEBP (8 MB gacha) qabul qilinadi')
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      if (!hasAllowedSignature(buffer, rule.signatures) || (file.type === 'image/webp' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP')) {
        throw new ApiError(400, 'Fayl tarkibi e’lon qilingan formatga mos emas')
      }

      const receiptHash = createHash('sha256').update(buffer).digest('hex')
      // The AI precheck (/api/ai/tekshiruv) and this submission are two
      // independent requests — without this, a caller could skip straight
      // here with a self-declared "already validated" flag. The claim is
      // an HMAC signature over this exact file's hash AND the userId/amount
      // the precheck actually validated, only issued by the precheck when
      // it passed — so it can't be forged, reused for a different file, or
      // replayed to submit a different amount (e.g. more months) than what
      // the AI actually verified.
      const claim = form.get('validatedHash')
      if (!verifyFileClaim('payment', claim, receiptHash, { userId: student.id, amount })) {
        throw new ApiError(400, 'Chek avval AI orqali tekshirilishi shart')
      }
      const batchId = randomUUID()
      const { error: claimError } = await repository.claimReceipt(receiptHash, batchId, student.id)
      if (claimError?.code === '23505') throw new ApiError(409, 'Bu chek avval yuklangan')
      if (claimError) throw claimError

      const path = `${student.id}/${batchId}.${rule.extension}`
      const { error: uploadError } = await repository.uploadReceipt(path, buffer, file.type)
      if (uploadError) {
        await repository.releaseReceipt(receiptHash, batchId)
        throw uploadError
      }

      try {
        await repository.setReceiptPath(receiptHash, batchId, path)
        // The bucket is private; only the storage path is stored, and
        // signed URLs are minted on demand (see /api/payments/receipt-url).
        const receiptUrl = path
        // Largest-remainder split so the per-month amounts always sum back
        // to exactly `amount` (a plain Math.round(amount/n) per month can
        // silently lose/gain currency units when amount isn't evenly
        // divisible by months.length).
        const baseAmount = Math.floor(amount / months.length)
        const remainder = amount - baseAmount * months.length
        const rows = months.map((month, index) => ({
          student_id: student.id,
          student_name: student.full_name || 'Talaba',
          month,
          year,
          amount: baseAmount + (index < remainder ? 1 : 0),
          status: 'waiting',
          receipt_url: receiptUrl,
          receipt_hash: receiptHash,
          admin_message: 'Tekshirilmoqda...',
        }))
        const { data, error } = await repository.insertBatch(rows)
        if (error) throw error
        return {
          ok: true,
          records: (data ?? []).map((record) => ({
            ...record,
            status: record.status as SubmitPaymentResult['records'][number]['status'],
          })),
        }
      } catch (error) {
        await repository.removeReceipt(path)
        await repository.releaseReceipt(receiptHash, batchId)
        const code = (error as { code?: string } | null)?.code
        if (code === '23505') {
          throw new ApiError(409, 'Ushbu oy(lar) uchun to\'lov allaqachon yuborilgan yoki tasdiqlangan')
        }
        throw error
      }
    },
  }
}
