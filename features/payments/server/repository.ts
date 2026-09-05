import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { PaymentRecord, PaymentStatus } from '../types'

const PAYMENT_COLUMNS = 'id, student_id, student_name, month, year, amount, status, receipt_url, admin_message, created_at, ai_confidence, ai_extracted_amount, ai_analysis, ai_review'

function toPaymentRecord(row: Record<string, unknown>): PaymentRecord {
  return {
    id: String(row.id),
    student_id: String(row.student_id),
    student_name: String(row.student_name ?? ''),
    month: String(row.month),
    year: Number(row.year),
    amount: Number(row.amount),
    status: row.status as PaymentStatus,
    created_at: String(row.created_at),
    receipt_url: typeof row.receipt_url === 'string' ? row.receipt_url : undefined,
    admin_message: typeof row.admin_message === 'string' ? row.admin_message : undefined,
    ai_confidence: typeof row.ai_confidence === 'number' ? row.ai_confidence : undefined,
    ai_extracted_amount: typeof row.ai_extracted_amount === 'number' ? row.ai_extracted_amount : undefined,
    ai_analysis: typeof row.ai_analysis === 'string' ? row.ai_analysis : undefined,
    ai_review: row.ai_review === 'manual' || row.ai_review === 'skipped' ? row.ai_review : undefined,
  }
}

export function createPaymentRepository() {
  const supabase = getServiceSupabase()

  return {
    async listForStudent(studentId: string) {
      const { data, error } = await supabase
        .from('tolovlar')
        .select(PAYMENT_COLUMNS)
        .eq('student_id', studentId)
        .order('year', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((row) => toPaymentRecord(row as Record<string, unknown>))
    },

    // Since P4 the review side is the tarbiyachi's — scoped to every
    // faculty sharing their dorm, not one faculty.
    async listAll(faculties: string[], studentId?: string) {
      let query = supabase
        .from('tolovlar')
        .select(PAYMENT_COLUMNS)
        .in('faculty', faculties)
        .order('created_at', { ascending: false })
      if (studentId) query = query.eq('student_id', studentId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map((row) => toPaymentRecord(row as Record<string, unknown>))
    },

    async countWaiting(faculties: string[]) {
      const { count, error } = await supabase
        .from('tolovlar')
        .select('id', { count: 'exact', head: true })
        .in('faculty', faculties)
        .eq('status', 'waiting')
      if (error) throw error
      return count ?? 0
    },

    async claimReceipt(receiptHash: string, batchId: string, studentId: string) {
      return supabase.from('payment_receipt_uploads').insert({
        receipt_hash: receiptHash,
        batch_id: batchId,
        student_id: studentId,
      })
    },

    async releaseReceipt(receiptHash: string, batchId: string) {
      await supabase
        .from('payment_receipt_uploads')
        .delete()
        .eq('receipt_hash', receiptHash)
        .eq('batch_id', batchId)
    },

    async setReceiptPath(receiptHash: string, batchId: string, objectPath: string) {
      const { error } = await supabase
        .from('payment_receipt_uploads')
        .update({ object_path: objectPath })
        .eq('receipt_hash', receiptHash)
        .eq('batch_id', batchId)
      if (error) throw error
    },

    async uploadReceipt(path: string, buffer: Buffer, contentType: string) {
      return supabase.storage.from('receipts').upload(path, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      })
    },

    async removeReceipt(path: string) {
      await supabase.storage.from('receipts').remove([path])
    },

    async submitBatchAtomic(input: {
      studentId: string
      studentName: string
      months: string[]
      amounts: number[]
      years: number[]
      receiptUrl: string
      receiptHash: string
      batchId: string
      transactionId: string
      normalizedTransactionId: string
      aiReview: 'passed' | 'manual'
    }) {
      return supabase.rpc('submit_payment_batch_atomic', {
        p_student_id: input.studentId,
        p_student_name: input.studentName,
        p_months: input.months,
        p_amounts: input.amounts,
        p_years: input.years,
        p_receipt_url: input.receiptUrl,
        p_receipt_hash: input.receiptHash,
        p_batch_id: input.batchId,
        p_transaction_id: input.transactionId,
        p_transaction_id_normalized: input.normalizedTransactionId,
        p_ai_review: input.aiReview,
      })
    },

    async review(faculties: string[], ids: string[], status: Extract<PaymentStatus, 'approved' | 'rejected'>, adminMessage: string) {
      // Only 'waiting' payments can be decided — prevents re-flipping a
      // payment that's already been approved/rejected out from under a
      // previous decision (no audit trail of what it changed from/to).
      // Scoped to the reviewer's dorm faculties: a payment id from outside
      // it simply doesn't match, so the service's "not all rows updated"
      // check rejects the whole batch.
      const { data, error } = await supabase
        .from('tolovlar')
        .update({ status, admin_message: adminMessage })
        .in('id', ids)
        .in('faculty', faculties)
        .eq('status', 'waiting')
        .select('id, student_id, month, year')
      if (error) throw error
      return data ?? []
    },
  }
}

export type PaymentRepository = ReturnType<typeof createPaymentRepository>
