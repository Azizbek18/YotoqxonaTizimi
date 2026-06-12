export type ArizaLevel = 'info' | 'warning' | 'critical'

export interface Ariza {
  id: string | number
  student_name: string
  text: string
  level: ArizaLevel
  created_at?: string
}

export interface Student {
  id: string
  full_name?: string
  faculty?: string
  room_number?: string
  status?: string
  email?: string
  role?: string
  created_at?: string
  gender?: string
}
