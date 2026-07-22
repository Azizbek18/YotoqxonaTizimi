/**
 * Database contract snapshot for the Supabase public schema.
 * Keep this file generated from the deployed schema in CI once the Supabase
 * CLI is connected; application/domain DTOs should not duplicate table rows.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row extends Record<string, unknown>> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type UserRow = {
  id: string
  email: string | null
  full_name: string | null
  middle_name: string | null
  phone: string | null
  phone_number: string | null
  faculty: string | null
  direction: string | null
  role: string | null
  status: string | null
  room_number: string | null
  course: number | null
  group: string | null
  gender: string | null
  nationality: string | null
  region: string | null
  district: string | null
  mahalla: string | null
  study_type: string | null
  entry_date: string | null
  passport_series: string | null
  jshshir: string | null
  passport_date: string | null
  birth_date: string | null
  father_full_name: string | null
  father_workplace: string | null
  father_phone: string | null
  mother_full_name: string | null
  mother_workplace: string | null
  mother_phone: string | null
  avatar_url: string | null
  permit_url: string | null
  is_floor_captain: boolean | null
  assigned_floor: number | null
  warning_count: number | null
  blacklisted: boolean | null
  created_at: string
  updated_at: string
}

export type StaffRow = {
  id: string
  email: string
  full_name: string
  staff_id: string | null
  role: string
  status: string | null
  phone_number: string | null
  faculty: string | null
  assigned_floor: number | null
  assigned_gender: string | null
  created_at: string
  updated_at: string
}

export type ApplicationRow = {
  id: string
  student_id: string | null
  student_name: string | null
  faculty: string | null
  direction: string | null
  course: number | null
  title: string | null
  type: string | null
  reason: string | null
  text: string
  level: string | null
  status: string | null
  ai_generated: boolean | null
  admin_response: string | null
  date: string | null
  response_date: string | null
  created_at: string
  updated_at: string
}

export type AnnouncementRow = {
  id: string
  title: string
  text: string
  type: string
  audience: string
  faculty: string | null
  is_published: boolean
  created_by: string | null
  target_floor: number | null
  target_gender: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export type PaymentRow = {
  id: string
  student_id: string
  student_name: string
  month: string
  year: number
  amount: number
  status: string
  receipt_url: string | null
  receipt_hash: string | null
  transaction_id: string | null
  transaction_id_normalized: string | null
  admin_message: string | null
  ai_confidence: number | null
  ai_extracted_amount: number | null
  ai_analysis: string | null
  created_at: string
  updated_at: string
}

export type PermitRequestRow = {
  id: string
  passport_series: string
  jshshir: string
  full_name: string
  email: string
  phone: string
  gender: string
  faculty: string
  direction: string
  course: number
  permit_url: string
  status: string | null
  room_number: string | null
  reject_reason: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      users: Table<UserRow>
      staff: Table<StaffRow>
      arizalar: Table<ApplicationRow>
      elonlar: Table<AnnouncementRow>
      tolovlar: Table<PaymentRow>
      permit_requests: Table<PermitRequestRow>
      cleaning_schedule: Table<{
        room_number: string
        schedule: Json
        updated_at: string | null
      }>
      admin_invites: Table<{
        id: string
        code: string | null
        token_hash: string
        email: string
        created_by: string | null
        created_at: string
        expires_at: string
        used: boolean
        used_at: string | null
      }>
      staff_invites: Table<{
        id: string
        token_hash: string
        role: string
        allowed_staff_id: string
        expires_at: string
        created_by: string | null
        created_at: string
        used_at: string | null
      }>
      payment_receipt_uploads: Table<{
        receipt_hash: string
        batch_id: string
        student_id: string
        object_path: string | null
        created_at: string
      }>
      security_audit_logs: Table<{
        id: string
        event_type: string
        status: string
        ip_address: string | null
        actor_user_id: string | null
        target_role: string | null
        details: Json
        created_at: string
      }>
    }
    Views: Record<string, never>
    Functions: {
      is_active_staff_role: {
        Args: { required_roles: string[] }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
