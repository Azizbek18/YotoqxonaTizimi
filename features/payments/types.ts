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
  /** 'manual' = AI was down at submission, check the receipt by hand;
   *  'skipped'/undefined = normal AI-checked path. */
  ai_review?: 'manual' | 'skipped'
}

export type PaymentSummary = {
  waitingCount: number
}

export type SubmitPaymentResult = {
  ok: true
  records: Array<Pick<PaymentRecord, 'id' | 'month' | 'year' | 'status'>>
}
