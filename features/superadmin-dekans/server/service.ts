import 'server-only'
import { PERMIT_FACULTIES, normalizeFaculty, permitFacultyLabel } from '@/lib/faculties'
import { summariseBeds } from '@/lib/room-capacity'
import { ApiError } from '@/server/http/api-error'
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
      const { dekans, educators, students, permits, facultyDorms, dorms, rooms } = await repository.loadAll()
      const mappedDekans = (dekans as RawDekan[]).map(mapDekan)
      const dormById = new Map(dorms.map((dorm) => [dorm.id, dorm]))

      // Per-room occupancy for the bed maths — students + approved-permit
      // reservations, keyed by room number (unique per dorm).
      const occByRoom = new Map<string, number>()
      const bumpRoom = (roomNumber: string | null | undefined) => {
        if (!roomNumber) return
        occByRoom.set(roomNumber, (occByRoom.get(roomNumber) ?? 0) + 1)
      }
      students.forEach((s) => bumpRoom(s.room_number))
      permits.forEach((p) => { if (p.status === 'approved') bumpRoom(p.room_number) })

      const roomsByFaculty = new Map<string, typeof rooms>()
      for (const room of rooms) {
        const code = normalizeFaculty(room.faculty)
        if (!code) continue
        const list = roomsByFaculty.get(code) ?? []
        list.push(room)
        roomsByFaculty.set(code, list)
      }

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

        const defaultCapacity = dorm?.default_room_capacity ?? 4
        const { availableBeds, freeBeds } = summariseBeds(
          roomsByFaculty.get(faculty) ?? [],
          defaultCapacity,
          occByRoom,
        )

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
            availableBeds,
            freeBeds,
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
          facultiesWithBuilding: faculties.filter((f) => f.dorm).length,
          availableBeds: faculties.reduce((total, f) => total + f.stats.availableBeds, 0),
          freeBeds: faculties.reduce((total, f) => total + f.stats.freeBeds, 0),
        },
        faculties,
        unassignedDekans: mappedDekans.filter((dekan) => !normalizeFaculty(dekan.faculty)),
      }
    },

    // ---- dean lifecycle ----

    /**
     * Activate or deactivate a dean account. Activating is refused when the
     * dean has no faculty, or when that faculty already has another active
     * dean (the DB index `staff_one_active_dekan_per_faculty` enforces it
     * too — we check first for a friendly message).
     */
    async setDekanStatus(idValue: unknown, statusValue: unknown): Promise<{ ok: true }> {
      const id = typeof idValue === 'string' ? idValue.trim() : ''
      if (!id) throw new ApiError(400, 'Dekan tanlanmagan')
      const status = statusValue === 'active' ? 'active' : statusValue === 'inactive' ? 'inactive' : null
      if (!status) throw new ApiError(400, "Holat noto'g'ri")

      const dekan = await repository.getDekan(id)
      if (!dekan) throw new ApiError(404, 'Dekan topilmadi')
      if (dekan.status === status) return { ok: true }

      if (status === 'active') {
        const faculty = normalizeFaculty(dekan.faculty)
        if (!faculty) throw new ApiError(400, 'Avval dekanni fakultetga biriktiring')
        const clash = await repository.activeDekanFor(faculty, id)
        if (clash) {
          throw new ApiError(409, `${permitFacultyLabel(faculty)} fakultetida allaqachon faol dekan bor (${clash.full_name})`)
        }
      }

      const updated = await repository.updateDekan(id, { status })
      if (!updated) throw new ApiError(404, 'Dekan topilmadi')
      return { ok: true }
    },

    /**
     * Move a dean to a different faculty. An active dean cannot land on a
     * faculty that already has one — deactivate or reassign the incumbent
     * first.
     */
    async reassignDekan(idValue: unknown, facultyValue: unknown): Promise<{ ok: true }> {
      const id = typeof idValue === 'string' ? idValue.trim() : ''
      if (!id) throw new ApiError(400, 'Dekan tanlanmagan')
      const faculty = normalizeFaculty(typeof facultyValue === 'string' ? facultyValue : null)
      if (!faculty) throw new ApiError(400, "Fakultet noto'g'ri")

      const dekan = await repository.getDekan(id)
      if (!dekan) throw new ApiError(404, 'Dekan topilmadi')
      if (normalizeFaculty(dekan.faculty) === faculty) return { ok: true }

      if (dekan.status === 'active') {
        const clash = await repository.activeDekanFor(faculty, id)
        if (clash) {
          throw new ApiError(409, `${permitFacultyLabel(faculty)} fakultetida allaqachon faol dekan bor (${clash.full_name})`)
        }
      }

      const updated = await repository.updateDekan(id, { faculty })
      if (!updated) throw new ApiError(404, 'Dekan topilmadi')
      return { ok: true }
    },
  }
}
