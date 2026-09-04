export type AttendanceState = 'present' | 'absent' | 'excused' | 'unmarked'
export type AttendanceReason = 'unexcused' | 'excused'
export type AttendanceActorRole = 'sardor' | 'tarbiyachi' | 'dekan' | 'talaba'

export type AttendanceActor = {
  userId: string
  role: AttendanceActorRole
  dormId: string
  /** Faculties whose residents this actor covers (shared-dorm: all of them). */
  faculties: string[]
  /** Sardor: their assigned floor. Others: null (whole building). */
  floor: number | null
  /** Sardor: their gender. Tarbiyachi: assigned_gender if set. Else null. */
  gender: 'male' | 'female' | null
  canWrite: boolean
}

export type RosterResident = {
  id: string
  fullName: string
  avatarUrl: string | null
  roomNumber: string
  state: AttendanceState
  source: string | null
  softFlag: boolean
  selfDistanceM: number | null
}

export type RosterRoom = {
  roomNumber: string
  residents: RosterResident[]
}

export type AttendanceSummary = {
  present: number
  absent: number
  excused: number
  unmarked: number
  total: number
}

export type AttendanceSessionInfo = {
  id: string
  kind: 'nightly' | 'adhoc'
  floor: number | null
  gender: 'male' | 'female' | null
  status: 'open' | 'closed' | 'auto_closed'
  closesAt: string
  openedAt: string
}

export type RosterView = {
  session: AttendanceSessionInfo
  rooms: RosterRoom[]
  summary: AttendanceSummary
  canWrite: boolean
}

export type CheckinResult =
  | { status: 'present'; distanceM: number }
  | { status: 'outside'; distanceM: number }
  | { status: 'retry' }
  | { status: 'unavailable' }
  | { status: 'no_session' }
  | { status: 'already'; state: AttendanceState }

export type FlaggedRecord = {
  recordId: string
  studentId: string
  fullName: string
  roomNumber: string
  sessionDate: string
  note: string | null
}

export type StudentAttendanceHistory = {
  date: string
  state: AttendanceState
  kind: 'nightly' | 'adhoc'
}
