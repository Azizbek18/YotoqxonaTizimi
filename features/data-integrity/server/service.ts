import 'server-only'
import { PERMIT_FACULTIES, normalizeFaculty, permitFacultyLabel } from '@/lib/faculties'
import type { IntegrityCheck, IntegrityReport, IntegritySample } from '../types'
import { createDataIntegrityRepository, type DataIntegrityRepository } from './repository'

const STALE_PERMIT_DAYS = 14
const FACULTY_SET = new Set(PERMIT_FACULTIES.map((f) => f.value))

function facultyRoomKey(faculty: string | null | undefined, roomNumber: string | null | undefined) {
  const code = normalizeFaculty(faculty) ?? String(faculty ?? '').trim().toLowerCase()
  return code && roomNumber ? `${code}:${roomNumber}` : ''
}

function sample(rows: Array<{ id?: string; full_name?: string | null; faculty?: string | null }>, limit = 8): IntegritySample[] {
  return rows.slice(0, limit).map((r, i) => ({
    id: String(r.id ?? i),
    label: r.full_name?.trim() || String(r.id ?? '—'),
    hint: r.faculty ? permitFacultyLabel(r.faculty) || r.faculty : undefined,
  }))
}

export function createDataIntegrityService(
  repository: DataIntegrityRepository = createDataIntegrityRepository(),
) {
  return {
    async getReport(): Promise<IntegrityReport> {
      const cutoff = new Date(Date.now() - STALE_PERMIT_DAYS * 86_400_000).toISOString()

      const [
        roomNoFloor,
        stalePermits,
        frozenRooms,
        layoutRooms,
        housed,
        allStudents,
        pendingFaculties,
        deanFaculties,
      ] = await Promise.all([
        repository.roomWithoutFloor(),
        repository.staleApprovedPermits(cutoff),
        repository.frozenRooms(),
        repository.layoutRoomNumbers(),
        repository.housedStudents(),
        repository.allStudentFaculties(),
        repository.pendingPermitFaculties(),
        repository.activeDeanFaculties(),
      ])

      // Frozen rooms that still have a resident.
      const frozenByRoom = new Set(frozenRooms.map((r) => facultyRoomKey(r.faculty, r.room_number)).filter(Boolean))
      const residentsInFrozen = housed.filter((s) => frozenByRoom.has(facultyRoomKey(s.faculty, s.room_number)))

      // Housed students whose room isn't on any floor plan.
      const layoutSet = new Set(layoutRooms.map((r) => facultyRoomKey(r.faculty, r.room_number)).filter(Boolean))
      const roomsOffPlan = housed.filter((s) => s.room_number && !layoutSet.has(facultyRoomKey(s.faculty, s.room_number)))

      // Students on a faculty code the app doesn't recognise.
      const unknownFaculty = allStudents.filter((s) => {
        const code = normalizeFaculty(s.faculty)
        return !code || !FACULTY_SET.has(code)
      })

      // Faculties with a pending permit but no active dean.
      const norm = (f: string): string => normalizeFaculty(f) ?? ''
      const deanSet = new Set(deanFaculties.map(norm).filter(Boolean))
      const strandedFaculties = Array.from(new Set(pendingFaculties.map(norm).filter(Boolean)))
        .filter((f) => !deanSet.has(f))

      const checks: IntegrityCheck[] = [
        {
          key: 'stranded-faculties',
          title: 'Dekansiz, arizali fakultet',
          description: 'Kutilayotgan yo‘llanma bor, lekin faol dekan yo‘q — arizalar javobsiz qoladi.',
          severity: 'danger',
          count: strandedFaculties.length,
          sample: strandedFaculties.slice(0, 8).map((f) => ({ id: f, label: permitFacultyLabel(f) || f })),
          href: '/dekan/dekanlar',
        },
        {
          key: 'frozen-with-residents',
          title: 'Rezidentli muzlatilgan xona',
          description: 'Xona muzlatilgan, ammo ichida talaba bor — muzlatishni oching yoki talabani ko‘chiring.',
          severity: 'danger',
          count: residentsInFrozen.length,
          sample: sample(residentsInFrozen),
          href: '/dekan/xonalar',
        },
        {
          key: 'room-without-floor',
          title: 'Qavatsiz joylashtirilgan talaba',
          description: 'Xona biriktirilgan, lekin qavat aniqlanmagan — qavat bo‘yicha ro‘yxatlarga tushmaydi.',
          severity: 'warning',
          count: roomNoFloor.count,
          sample: sample(roomNoFloor.rows),
          href: '/dekan/xonalar',
        },
        {
          key: 'rooms-off-plan',
          title: 'Tarxda yo‘q band xona',
          description: 'Talaba yashayotgan xona hech bir qavat tarxida yo‘q — tarxni to‘ldiring.',
          severity: 'warning',
          count: roomsOffPlan.length,
          sample: sample(roomsOffPlan),
          href: '/dekan/3d-xonalar',
        },
        {
          key: 'stale-approved-permits',
          title: `${STALE_PERMIT_DAYS} kundan eski tasdiqlangan yo‘llanma`,
          description: 'Tasdiqlangan, ammo talaba hali ro‘yxatdan o‘tmagan — bog‘laning yoki tasdiqni bekor qiling.',
          severity: 'info',
          count: stalePermits.count,
          sample: sample(stalePermits.rows),
          href: '/dekan/arizalar',
        },
        {
          key: 'unknown-faculty',
          title: 'Notanish fakultetli talaba',
          description: 'Talaba fakultet kodi ilova ro‘yxatida yo‘q — to‘g‘ri fakultetga o‘tkazing.',
          severity: 'warning',
          count: unknownFaculty.length,
          sample: sample(unknownFaculty),
          href: '/dekan/talabalar-global',
        },
      ]

      return { generatedAt: new Date().toISOString(), checks }
    },
  }
}
