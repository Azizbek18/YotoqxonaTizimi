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
    /** Beds in non-frozen rooms on this faculty's floors (per-room capacity applied). */
    availableBeds: number
    /** Unoccupied beds in those rooms — the real "bo'sh joy". */
    freeBeds: number
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
    /** How many of the 13 faculties have a dorm building assigned. */
    facultiesWithBuilding: number
    /** Cross-building sum of non-frozen beds. */
    availableBeds: number
    /** Cross-building sum of unoccupied non-frozen beds. */
    freeBeds: number
  }
  faculties: FacultyDekanOverview[]
  unassignedDekans: SuperadminDekan[]
}
