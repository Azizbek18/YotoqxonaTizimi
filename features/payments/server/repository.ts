import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { PaymentRecord, PaymentStatus } from '../types'

const PAYMENT_COLUMNS = 'id, student_id, student_name, month, year, amount, status, receipt_url, admin_message, created_at, ai_confidence, ai_extracted_amount, ai_analysis'

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

    async listAll(studentId?: string) {
      let query = supabase
        .from('tolovlar')
        .select(PAYMENT_COLUMNS)
        .order('created_at', { ascending: false })
      if (studentId) query = query.eq('student_id', studentId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map((row) => toPaymentRecord(row as Record<string, unknown>))
    },

    async countWaiting() {
      const { count, error } = await supabase
        .from('tolovlar')
        .select('id', { count: 'exact', head: true })
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

    getPublicReceiptUrl(path: string) {
      return supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl
    },

    async removeReceipt(path: string) {
      await supabase.storage.from('receipts').remove([path])
    },

    async insertBatch(rows: Array<Record<string, unknown>>) {
      return supabase.from('tolovlar').insert(rows).select('id, month, year, status')
    },

    async review(ids: string[], status: Extract<PaymentStatus, 'approved' | 'rejected'>, adminMessage: string) {
      const { data, error } = await supabase
        .from('tolovlar')
        .update({ status, admin_message: adminMessage })
        .in('id', ids)
        .select('id')
      if (error) throw error
      return data ?? []
    },
  }
}

export type PaymentRepository = ReturnType<typeof createPaymentRepository>
