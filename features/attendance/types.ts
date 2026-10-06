export type AttendanceState = 'present' | 'absent' | 'excused' | 'unmarked'
export type AttendanceReason = 'unexcused' | 'excused'
export type AttendanceActorRole = 'sardor' | 'tarbiyachi' | 'dekan' | 'talaba'

export type AttendanceActor = {
  block?: string | null
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

// ---- Dekan yo'qlamasi (kind='dekan') ----------------------------------
// One session = ONE faculty's residents of ONE dorm. Nothing here is shared
// with the nightly/adhoc (sardor + tarbiyachi) types above.

export type DekanSessionStatus = 'scheduled' | 'open' | 'closed' | 'auto_closed'

export type DekanSessionInfo = {
  id: string
  dormId: string
  dormLabel: string
  status: DekanSessionStatus
  startsAt: string
  closesAt: string
  closedAt: string | null
  reminderCount: number
  summary: AttendanceSummary
}

export type DekanDormCard = {
  id: string
  label: string
  residentCount: number
  /** False until the dekan sets the building's GPS point in Sozlamalar. */
  hasGeo: boolean
  active: DekanSessionInfo | null
}

export type DekanOverview = {
  dorms: DekanDormCard[]
  recent: DekanSessionInfo[]
}

export type DekanRosterResident = {
  id: string
  fullName: string
  roomNumber: string
  floor: number | null
  phone: string | null
  /** 'excused' is never produced by the dekan flow. */
  state: 'present' | 'absent' | 'unmarked'
  selfDistanceM: number | null
  markedAt: string | null
}

export type DekanRosterView = {
  session: DekanSessionInfo
  residents: DekanRosterResident[]
}
