import 'server-only'
import { createHash, randomUUID } from 'crypto'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'
import { ApiError } from '@/server/http/api-error'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { verifyFileClaim } from '@/lib/receipt-claim'
import { MAX_UPLOAD_SIZE_BYTES } from '@/lib/upload-limits'
import type { SubmitPaymentResult } from '../types'
import {
  isSuspiciousPaymentTransactionId,
  normalizePaymentTransactionId,
  parsePaymentAmount,
  PAYMENT_MONTHS,
  PaymentValidationError,
  validatePaymentReview,
} from '../domain/validation'
import { createPaymentRepository, type PaymentRepository } from './repository'

type StudentForPayment = { id: string; full_name: string | null; faculty?: string | null }

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

    listAll(faculty: string, studentId?: string) {
      return repository.listAll(faculty, studentId)
    },

    async getSummary(faculty: string) {
      return { waitingCount: await repository.countWaiting(faculty) }
    },

    async review(faculty: string, input: { ids: unknown; status: unknown; message: unknown }) {
      let review
      try {
        review = validatePaymentReview(input)
      } catch (error) {
        if (error instanceof PaymentValidationError) throw new ApiError(400, error.message, error.code)
        throw error
      }
      const rows = await repository.review(faculty, review.ids, review.status, review.message)
      if (rows.length !== review.ids.length) throw new ApiError(409, 'Ba’zi to‘lovlar yangilanmadi')
      return { ok: true as const }
    },

    async submit(student: StudentForPayment, form: FormData): Promise<SubmitPaymentResult> {
      const file = form.get('file')
      let amount: number
      try {
        amount = parsePaymentAmount(form.get('amount'))
      } catch (error) {
        if (error instanceof PaymentValidationError) throw new ApiError(400, error.message, error.code)
        throw error
      }
      const year = Number(form.get('year'))
      const months = parseMonths(form.get('months'))
      const transactionId = String(form.get('transactionId') ?? '').trim()
      const normalizedTransactionId = normalizePaymentTransactionId(transactionId)
      if (!(file instanceof File)) throw new ApiError(400, 'Chek fayli topilmadi')
      if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new ApiError(400, 'To‘lov yili noto‘g‘ri')
      if (transactionId.length > 256 || isSuspiciousPaymentTransactionId(normalizedTransactionId)) {
        throw new ApiError(400, 'Chek tranzaksiya raqami noto‘g‘ri')
      }
      // The monthly fee is the student's own faculty's dorm setting.
      const { monthlyFee } = await createAppSettingsService().get(student.faculty ?? undefined)
      if (amount !== monthlyFee * months.length) {
        throw new ApiError(400, `To‘lov summasi tanlangan oylar uchun kutilgan summaga (${(monthlyFee * months.length).toLocaleString('uz-UZ')} so'm) mos kelmayapti`)
      }

      const rule = PERMIT_FILE_RULES[file.type]
      if (!rule || file.size < 16 || file.size > MAX_UPLOAD_SIZE_BYTES) {
        throw new ApiError(file.size > MAX_UPLOAD_SIZE_BYTES ? 413 : 400, 'Faqat PDF, JPG, PNG yoki WEBP (4 MB gacha) qabul qilinadi')
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      if (!hasAllowedSignature(buffer, rule.signatures) || (file.type === 'image/webp' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP')) {
        throw new ApiError(400, 'Fayl tarkibi e’lon qilingan formatga mos emas')
      }

      const receiptHash = createHash('sha256').update(buffer).digest('hex')
      // The AI precheck (/api/ai/tekshiruv) and this submission are two
      // independent requests — without this, a caller could skip straight
      // here with a self-declared "already validated" flag. The claim is
      // an HMAC signature over this exact file's hash, user/amount and the
      // normalized transaction id the AI extracted. The transaction id is
      // then reserved in the same database transaction that inserts the
      // payment rows, so a caller cannot skip a later background request.
      const claim = form.get('validatedHash')
      if (!verifyFileClaim('payment', claim, receiptHash, {
        userId: student.id,
        amount,
        transactionId: normalizedTransactionId,
      })) {
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
        const amounts = months.map((_, index) => baseAmount + (index < remainder ? 1 : 0))
        const { data, error } = await repository.submitBatchAtomic({
          studentId: student.id,
          studentName: student.full_name || 'Talaba',
          months,
          amounts,
          year,
          receiptUrl,
          receiptHash,
          batchId,
          transactionId,
          normalizedTransactionId,
        })
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
          throw new ApiError(409, 'Bu chek/tranzaksiya yoki ushbu oy(lar) uchun to‘lov avval yuborilgan')
        }
        throw error
      }
    },
  }
}
