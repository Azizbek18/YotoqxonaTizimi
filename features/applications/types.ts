import type { ApplicationRow } from '@/types/database.generated'

export type StudentApplication = ApplicationRow

export type CreateStudentApplication = {
  title: string
  type: 'ariza' | 'tushuntirish' | 'chat' | 'taklif'
  reason: string
  text: string
  level?: 'info' | 'warning' | 'critical'
  status?: 'draft' | 'submitted' | 'pending'
  aiGenerated?: boolean
}

export type ApplicationListKind = 'documents' | 'warnings' | 'chat' | 'notifications'
