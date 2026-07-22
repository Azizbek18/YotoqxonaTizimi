import type { UserRow } from '@/types/database.generated'

export type StudentProfile = Pick<
  UserRow,
  | 'id' | 'full_name' | 'middle_name' | 'email' | 'phone_number'
  | 'faculty' | 'direction' | 'role' | 'status' | 'room_number'
  | 'course' | 'group' | 'gender' | 'nationality' | 'region'
  | 'district' | 'mahalla' | 'study_type' | 'entry_date'
  | 'passport_series' | 'passport_date' | 'birth_date'
  | 'father_full_name' | 'father_workplace' | 'father_phone'
  | 'mother_full_name' | 'mother_workplace' | 'mother_phone'
  | 'avatar_url' | 'warning_count' | 'assigned_floor'
  | 'is_floor_captain' | 'created_at'
>

export type RoommateProfile = Pick<
  UserRow,
  'id' | 'full_name' | 'email' | 'phone_number' | 'faculty' | 'role' | 'room_number' | 'course' | 'group' | 'avatar_url'
>

export type FloorCaptain = Pick<UserRow, 'full_name' | 'phone_number' | 'email'>

export type StudentProfilePayload = {
  success: true
  profile: StudentProfile
  roommates: RoommateProfile[]
  roommatesCount: number
  floorCaptain: FloorCaptain | null
}

export type StudentProfileUpdate = {
  full_name?: string
  phone?: string
  group?: string
}
