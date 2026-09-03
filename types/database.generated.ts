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
  dorm_id: string | null
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
  gender: string | null
  faculty: string | null
  dorm_id: string | null
  assigned_floor: number | null
  assigned_gender: string | null
  created_by: string | null
  signature_image: string | null
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

export type ArizaSignatureRow = {
  id: string
  ariza_id: string
  student_id: string
  content_hash: string
  content_snapshot: Record<string, unknown>
  typed_name: string
  signed_at: string
  client_ip: string | null
  user_agent: string | null
  verify_code: string
  signature: string
  signature_image: string | null
  created_at: string
}

export type StudentTelegramLinkRow = {
  student_id: string
  token_hash: string
  token_expires_at: string
  chat_id: number | null
  linked_at: string | null
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
  faculty: string
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
  /** 'passed' (default) | 'manual' (AI was down at submission — check by hand). */
  ai_review: string
  created_at: string
  updated_at: string
}

export type PermitRequestRow = {
  id: string
  passport_series: string
  jshshir: string | null
  full_name: string
  email: string
  phone: string
  gender: string
  faculty: string
  dorm_id: string | null
  direction: string
  course: number
  permit_url: string
  status: string | null
  room_number: string | null
  reject_reason: string | null
  created_at: string
  updated_at: string
  /** 'yollanma' (government referral, default) | 'imtiyozli' (foreign/privileged student — Ariza+Tilxat+passport photo). */
  application_type: string
  relative_phone: string | null
  origin_country: string | null
  origin_region: string | null
  study_type: string | null
  /** 'passed' (default) | 'manual' (AI was down at submission — verify the document by hand) | 'skipped' (imtiyozli). */
  ai_review: string
}

export type PermitTelegramLinkRow = {
  permit_request_id: string
  token_hash: string
  token_expires_at: string
  chat_id: number | null
  linked_at: string | null
  last_notified_status: string | null
  created_at: string
  updated_at: string
}

export type PermitDocumentRow = {
  permit_request_id: string
  student_signature: string
  student_signed_at: string
  student_ip: string | null
  student_user_agent: string | null
  dekan_staff_id: string | null
  dekan_name: string | null
  dekan_signature: string | null
  ariza_no: string | null
  assigned_floor: number | null
  assigned_room: string | null
  pdf_path: string | null
  delivered_at: string | null
  delivery_channel: string | null
  delivery_error: string | null
  created_at: string
  updated_at: string
}

export type PushSubscriptionRow = {
  id: number
  endpoint: string
  p256dh: string
  auth: string
  user_id: string | null
  permit_request_id: string | null
  expiration_time: number | null
  user_agent: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export type AttendanceSessionRow = {
  id: string
  dorm_id: string
  scheduled_for: string
  kind: 'nightly' | 'adhoc'
  gender: 'male' | 'female' | null
  floor_number: number | null
  opened_by: string | null
  opened_at: string
  closes_at: string
  closed_by: string | null
  closed_at: string | null
  status: 'open' | 'closed' | 'auto_closed'
  created_at: string
}

export type AttendanceRecordRow = {
  id: string
  session_id: string
  student_id: string
  room_number: string
  floor_number: number | null
  gender: string | null
  state: 'present' | 'absent' | 'excused' | 'unmarked'
  source: 'self_location' | 'captain' | 'tarbiyachi' | 'auto' | 'leave' | null
  self_lat: number | null
  self_lng: number | null
  self_accuracy_m: number | null
  self_distance_m: number | null
  soft_flag: boolean
  note: string | null
  marked_by: string | null
  marked_at: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      users: Table<UserRow>
      staff: Table<StaffRow>
      arizalar: Table<ApplicationRow>
      ariza_signatures: Table<ArizaSignatureRow>
      elonlar: Table<AnnouncementRow>
      tolovlar: Table<PaymentRow>
      permit_requests: Table<PermitRequestRow>
      permit_telegram_links: Table<PermitTelegramLinkRow>
      permit_documents: Table<PermitDocumentRow>
      student_telegram_links: Table<StudentTelegramLinkRow>
      push_subscriptions: Table<PushSubscriptionRow>
      attendance_sessions: Table<AttendanceSessionRow>
      attendance_records: Table<AttendanceRecordRow>
      cleaning_schedule: Table<{
        faculty: string
        room_number: string
        schedule: Json
        updated_at: string | null
      }>
      staff_invites: Table<{
        id: string
        code_hash: string
        faculty: string | null
        role: string
        email: string | null
        label: string | null
        created_by: string | null
        created_at: string
        expires_at: string
        revoked_at: string | null
        max_uses: number | null
        use_count: number
      }>
      payment_receipt_uploads: Table<{
        receipt_hash: string
        batch_id: string
        student_id: string
        object_path: string | null
        created_at: string
      }>
      payment_receipt_transactions: Table<{
        receipt_hash: string
        transaction_id: string | null
        transaction_id_normalized: string
        updated_at: string
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
      floor_room_layout: Table<{
        id: string
        faculty: string
        dorm_id: string
        floor_number: number
        room_number: string
        side: string
        position: number
        size: string
        frozen: boolean
        frozen_reason: string | null
        // NULL = inherit dorms.default_room_capacity (migration 202609180000).
        capacity: number | null
        // Declared gender the dekan reserved the room for, before anyone is
        // placed (migration 202609240000). NULL = undeclared (any gender).
        gender: 'male' | 'female' | null
        created_at: string
      }>
      // Since P2 (202609150000) app_settings holds only the two fee amounts,
      // per faculty. Everything else moved to `dorms`.
      app_settings: Table<{
        faculty: string
        monthly_fee: number
        yearly_contract_fee: number
        dekan_telegram_chat_id: string | null
        updated_at: string
      }>
      // Shared dorm tenancy (P0, migration 202609130000). Not read by
      // application code yet — everything still routes through `faculty`.
      dorms: Table<{
        id: string
        number: string
        name: string
        address: string
        default_room_capacity: number
        floor_count: number
        tarbiyachi_name: string
        tarbiyachi_phone: string
        komendant_name: string
        komendant_phone: string
        doctor_name: string
        doctor_phone: string
        talaba_kengashi_raisi_ogil_name: string
        talaba_kengashi_raisi_ogil_phone: string
        talaba_kengashi_raisi_qiz_name: string
        talaba_kengashi_raisi_qiz_phone: string
        security_phone: string
        max_upload_size_mb: number
        warning_threshold: number
        ttj_name: string
        latitude: number | null
        longitude: number | null
        checkin_radius_m: number
        attendance_enabled: boolean
        attendance_open_time: string
        attendance_close_time: string
        created_at: string
        updated_at: string
      }>
      faculty_dorm: Table<{
        faculty: string
        dorm_id: string
        created_at: string
      }>
      dorm_floor: Table<{
        dorm_id: string
        floor_number: number
        faculty: string | null
        confirmed_by: string | null
        confirmed_at: string
        pending_faculty: string | null
        pending_by: string | null
        pending_at: string | null
        created_at: string
        updated_at: string
      }>
    }
    Views: Record<string, never>
    Functions: {
      is_active_staff_role: {
        Args: { required_roles: string[] }
        Returns: boolean
      }
      assign_student_room_atomic: {
        Args: { p_student_id: string; p_room_number: string; p_max_capacity?: number }
        Returns: void
      }
      assign_permit_room_atomic: {
        Args: { p_permit_id: string; p_room_number: string; p_max_capacity?: number }
        Returns: void
      }
      approve_permit_room_atomic: {
        Args: { p_permit_id: string; p_room_number: string; p_max_capacity?: number }
        Returns: PermitRequestRow[]
      }
      replace_floor_room_layout: {
        Args: { p_faculty: string; p_floor_number: number; p_rows: Json }
        Returns: void
      }
      apply_building_layout: {
        Args: { p_faculty: string; p_numbering: string; p_floors: Json }
        Returns: { created: number; removed: number; renumbered: number }
      }
      claim_receipt_transaction: {
        Args: { p_receipt_hash: string; p_transaction_id: string | null; p_transaction_id_normalized: string }
        Returns: { stored_transaction_id_normalized: string; is_conflict: boolean }[]
      }
      promote_floor_captain: {
        Args: { p_user_id: string; p_assigned_floor: number; p_gender: string; p_is_captain: boolean }
        Returns: void
      }
      create_student_warning_atomic: {
        Args: { p_student_id: string; p_title: string; p_text: string; p_level: string }
        Returns: { warning_id: string; new_warning_count: number }[]
      }
      list_user_sessions: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          created_at: string
          refreshed_at: string | null
          user_agent: string | null
          ip: string | null
          not_after: string | null
        }[]
      }
      revoke_user_session: {
        Args: { p_user_id: string; p_session_id: string }
        Returns: boolean
      }
      revoke_other_user_sessions: {
        Args: { p_user_id: string; p_keep_session_id: string | null }
        Returns: number
      }
      finalize_payment_analysis: {
        Args: {
          p_payment_id: string
          p_receipt_hash: string
          p_transaction_id: string | null
          p_transaction_id_normalized: string
          p_ai_confidence: number
          p_ai_extracted_amount: number
          p_ai_analysis: string
        }
        Returns: {
          applied: boolean
          is_conflict: boolean
          final_confidence: number
          final_analysis: string
          final_transaction_id: string | null
        }[]
      }
      upsert_floor_duty_schedule: {
        Args: {
          p_creator_id: string
          p_floor: number
          p_gender: string
          p_text: string
        }
        Returns: string
      }
      // Shared dorm tenancy — floor handshake (P1a, migration 202609140000).
      dorm_claim_floors: {
        Args: { p_dorm_id: string; p_faculty: string; p_floors: number[]; p_staff_id: string }
        Returns: Json
      }
      dorm_resolve_floor: {
        Args: { p_dorm_id: string; p_floor: number; p_staff_id: string; p_accept: boolean }
        Returns: Json
      }
      dorm_withdraw_floors: {
        Args: { p_dorm_id: string; p_faculty: string; p_floors: number[] }
        Returns: Json
      }
      submit_payment_batch_atomic: {
        Args: {
          p_student_id: string
          p_student_name: string
          p_months: string[]
          p_amounts: number[]
          p_year: number
          p_receipt_url: string
          p_receipt_hash: string
          p_batch_id: string
          p_transaction_id: string
          p_transaction_id_normalized: string
        }
        Returns: {
          id: string
          month: string
          year: number
          status: string
        }[]
      }
      activate_pending_student: {
        Args: {
          p_user_id: string
          p_email: string
        }
        Returns: boolean
      }
      claim_staff_invite: {
        Args: { p_code_hash: string }
        Returns: { faculty: string | null; role: string; email: string | null }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
