export type PaymentStatus = 'paid' | 'pending' | 'rejected' | 'waiting' | 'approved'

export type PaymentRecord = {
  id: string
  student_id: string
  student_name: string
  month: string
  year: number
  amount: number
  status: PaymentStatus
  receipt_url?: string
  admin_message?: string
  created_at: string
  ai_confidence?: number
  ai_extracted_amount?: number
  ai_analysis?: string
}

export type PaymentSummary = {
  waitingCount: number
}

export type SubmitPaymentResult = {
  ok: true
  records: Array<Pick<PaymentRecord, 'id' | 'month' | 'year' | 'status'>>
}
