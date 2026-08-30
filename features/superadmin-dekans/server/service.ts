import 'server-only'
import { PERMIT_FACULTIES, normalizeFaculty, permitFacultyLabel } from '@/lib/faculties'
import type { SuperadminDekan, SuperadminDekansPayload } from '../types'
import {
  createSuperadminDekanRepository,
  type SuperadminDekanRepository,
} from './repository'

type RawDekan = {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  faculty: string | null
  status: string | null
  created_at: string
}

function mapDekan(row: RawDekan): SuperadminDekan {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    faculty: normalizeFaculty(row.faculty) ?? row.faculty,
    status: row.status,
    createdAt: row.created_at,
  }
}

function sameFaculty(value: string | null | undefined, faculty: string) {
  return normalizeFaculty(value) === faculty
}

export function createSuperadminDekanService(
  repository: SuperadminDekanRepository = createSuperadminDekanRepository(),
) {
  return {
    async getOverview(): Promise<SuperadminDekansPayload> {
      const { dekans, educators, students, permits, facultyDorms, dorms } = await repository.loadAll()
      const mappedDekans = (dekans as RawDekan[]).map(mapDekan)
      const dormById = new Map(dorms.map((dorm) => [dorm.id, dorm]))

      const extraFacultyCodes = mappedDekans
        .map((dekan) => normalizeFaculty(dekan.faculty))
        .filter((faculty): faculty is NonNullable<typeof faculty> => Boolean(faculty))
      const facultyCodes = Array.from(new Set([
        ...PERMIT_FACULTIES.map((faculty) => faculty.value),
        ...extraFacultyCodes,
      ]))

      const faculties = facultyCodes.map((faculty) => {
        const facultyDekans = mappedDekans
          .filter((dekan) => sameFaculty(dekan.faculty, faculty))
          .sort((a, b) => {
            const activeDelta = Number(b.status === 'active') - Number(a.status === 'active')
            return activeDelta || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })
        const facultyStudents = students.filter((student) => sameFaculty(student.faculty, faculty))
        const link = facultyDorms.find((item) => sameFaculty(item.faculty, faculty))
        const dorm = link ? dormById.get(link.dorm_id) : null

        return {
          faculty,
          facultyLabel: permitFacultyLabel(faculty),
          dekan: facultyDekans[0] ?? null,
          stats: {
            students: facultyStudents.length,
            activeStudents: facultyStudents.filter((student) => student.status === 'active').length,
            placedStudents: facultyStudents.filter((student) => Boolean(student.room_number)).length,
            activeEducators: educators.filter(
              (educator) => sameFaculty(educator.faculty, faculty) && educator.status === 'active',
            ).length,
            pendingPermits: permits.filter(
              (permit) => sameFaculty(permit.faculty, faculty) && permit.status === 'pending',
            ).length,
          },
          dorm: dorm
            ? { id: dorm.id, number: dorm.number, name: dorm.name }
            : null,
        }
      })

      const activeDekans = mappedDekans.filter((dekan) => dekan.status === 'active').length
      const coveredFaculties = faculties.filter((faculty) => faculty.dekan?.status === 'active').length

      return {
        summary: {
          totalFaculties: faculties.length,
          coveredFaculties,
          activeDekans,
          inactiveDekans: mappedDekans.length - activeDekans,
          vacantFaculties: faculties.length - coveredFaculties,
          totalStudents: students.length,
          pendingPermits: permits.filter((permit) => permit.status === 'pending').length,
        },
        faculties,
        unassignedDekans: mappedDekans.filter((dekan) => !normalizeFaculty(dekan.faculty)),
      }
    },
  }
}
