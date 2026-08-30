export type SuperadminDekan = {
  id: string
  fullName: string
  email: string
  phoneNumber: string | null
  faculty: string | null
  status: string | null
  createdAt: string
}

export type FacultyDekanOverview = {
  faculty: string
  facultyLabel: string
  dekan: SuperadminDekan | null
  stats: {
    students: number
    activeStudents: number
    placedStudents: number
    activeEducators: number
    pendingPermits: number
  }
  dorm: {
    id: string
    number: string
    name: string
  } | null
}

export type SuperadminDekansPayload = {
  summary: {
    totalFaculties: number
    coveredFaculties: number
    activeDekans: number
    inactiveDekans: number
    vacantFaculties: number
    totalStudents: number
    pendingPermits: number
  }
  faculties: FacultyDekanOverview[]
  unassignedDekans: SuperadminDekan[]
}
