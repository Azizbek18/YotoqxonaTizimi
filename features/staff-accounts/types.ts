export type ManagedStaffRole = 'admin' | 'tarbiyachi'

export type StaffAccountRow = {
  id: string
  full_name: string
  email: string
  role: ManagedStaffRole
  status: string | null
  phone_number: string | null
  assigned_floor: number | null
  assigned_gender: string | null
  created_at: string
}

export type CreateStaffAccountInput = {
  fullName: string
  email: string
  phone: string
  role: ManagedStaffRole
  password: string
  confirmPassword: string
}
