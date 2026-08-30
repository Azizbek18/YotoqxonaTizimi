export type SuperadminStudentRow = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  faculty: string | null
  facultyLabel: string
  /** true when `faculty` is not one of the app's known faculty codes. */
  unknownFaculty: boolean
  direction: string | null
  course: number | null
  status: string | null
  roomNumber: string | null
  assignedFloor: number | null
  blacklisted: boolean
  createdAt: string
}

export type SuperadminStudentsPage = {
  students: SuperadminStudentRow[]
  total: number
  /** Per-faculty counts across the whole (unfiltered by faculty) student set. */
  facultyCounts: Array<{ faculty: string; facultyLabel: string; count: number }>
}

export type SuperadminStudentsQuery = {
  limit: number
  offset: number
  search?: string
  faculty?: string
  status?: string
  blacklisted?: boolean
  placement?: 'placed' | 'roomless'
  unknownFacultyOnly?: boolean
}

export type StudentActionResult = { ok: true; message: string }
