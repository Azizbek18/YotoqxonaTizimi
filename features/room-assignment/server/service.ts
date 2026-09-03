import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { sendRoomAssignedEmail } from '@/lib/email'
import { deliverPermitDocumentsSafely } from '@/lib/permit-documents'
import { sendPushForPermit, sendPushForUser, sendPushWithoutBreaking } from '@/lib/push-notifications'
import type { FacultyStudentRow } from '../types'
import { createRoomAssignmentRepository, type RoomAssignmentRepository } from './repository'

function sameFaculty(value: string | null | undefined, faculty: string) {
  return (value ?? '').trim().toLocaleLowerCase() === faculty.trim().toLocaleLowerCase()
}

// Both assignRoomAtomic and assignPermitRoomAtomic raise the same error
// codes for the same reasons (P0002 room missing, P0004 frozen, P0001
// generic capacity/gender) — one mapping for both callers.
function throwForRoomError(error: unknown): never {
  const code = (error as { code?: string } | null)?.code
  if (code === 'P0002') {
    throw new ApiError(404, 'Bunday xona xonalar sxemasida topilmadi')
  }
  if (code === 'P0004') {
    throw new ApiError(409, "Bu xona ta'mirlash tufayli muzlatilgan — talaba joylashtirib bo'lmaydi")
  }
  if (code === 'P0005') {
    // The permit stopped being 'approved' between our check and the RPC —
    // almost always a concurrent "tasdiqni bekor qilish".
    throw new ApiError(409, "Ariza holati o'zgardi — sahifani yangilang")
  }
  if (code === 'P0007') {
    // Shared dorm: the room sits on a floor another faculty has confirmed.
    throw new ApiError(403, "Bu xona boshqa fakultetning qavatida — joylashtirib bo'lmaydi")
  }
  throw error as Error
}

// Pre-assigns (or clears) a room on an approved-but-unregistered permit.
// No email here: the approval email already told this person to register,
// and they have no account yet to receive a personalized "your room is X"
// notice at — app/api/student/register/route.ts picks up the room the
// moment they actually do register.
type Signer = { id: string; fullName: string } | null

async function assignPermitRoom(
  repository: RoomAssignmentRepository,
  faculty: string,
  permitId: string,
  roomNumber: string,
  signer: Signer,
) {
  const permit = await repository.findPermit(permitId)
  if (!permit) throw new ApiError(404, "Yo'llanma topilmadi")
  if (permit.status !== 'approved') throw new ApiError(409, "Faqat tasdiqlangan yo'llanmalarga xona biriktirish mumkin")
  if (!sameFaculty(permit.faculty, faculty)) throw new ApiError(403, 'Boshqa fakultet yo\'llanmasini boshqarib bo\'lmaydi')

  if (!roomNumber) {
    await repository.clearPermitRoom(permitId)
    return { success: true as const }
  }

  if (roomNumber === permit.room_number) {
    return { success: true as const }
  }

  // Room capacity is the permit faculty's own dorm setting.
  const { defaultRoomCapacity } = await createAppSettingsService().get(faculty)
  try {
    const assigned = await repository.assignPermitRoomAtomic(permitId, roomNumber, defaultRoomCapacity)
    if (!assigned) {
      throw new ApiError(409, "Bu xonada bo'sh joy yo'q yoki xonada boshqa jinsdagi talaba(lar) bor")
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throwForRoomError(error)
  }
  await sendPushWithoutBreaking(() => sendPushForPermit(permitId, {
    title: 'Xonangiz biriktirildi 🏠',
    body: `Siz uchun ${roomNumber}-xona band qilindi. Ro‘yxatdan o‘tishni davom ettiring.`,
    url: '/ruxsatnoma-tekshirish',
    tag: `room-permit-${permitId}`,
  }))
  // Approved + a room now assigned -> generate and send the signed Ariza +
  // Tilxat. Best-effort: a delivery hiccup must not fail the assignment.
  const documentDelivery = await deliverPermitDocumentsSafely(
    permitId,
    signer ? { id: signer.id, fullName: signer.fullName } : undefined,
  )
  return { success: true as const, documentDelivery }
}

export function createRoomAssignmentService(repository: RoomAssignmentRepository = createRoomAssignmentRepository()) {
  return {
    // The roomless queue is two things stitched together: real accounts
    // waiting for a room, and approved yo'llanmalar nobody has
    // self-registered from yet. A dekan can place either into a room —
    // see assignRoom's 'permit' branch — so both belong in one list.
    async listStudents(facultyValue: string | null): Promise<FacultyStudentRow[]> {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')

      const [students, permits] = await Promise.all([
        repository.listFacultyStudents(faculty),
        repository.listApprovedUnregisteredPermits(faculty),
      ])

      const rows: FacultyStudentRow[] = [
        ...students.map((row) => ({ ...row, full_name: row.full_name || 'Noma\'lum', source: 'user' as const })),
        ...permits.map((row) => ({ ...row, source: 'permit' as const })),
      ]
      rows.sort((a, b) => a.full_name.localeCompare(b.full_name, 'uz'))
      return rows
    },

    async assignRoom(facultyValue: string | null, value: unknown, signer: Signer = null) {
      const faculty = facultyValue?.trim()
      if (!faculty) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
      const input = value as Record<string, unknown>

      const studentId = typeof input.studentId === 'string' ? input.studentId.trim() : ''
      if (!studentId) throw new ApiError(400, "Talaba tanlanmagan")
      const roomNumber = typeof input.roomNumber === 'string' ? input.roomNumber.trim().slice(0, 20) : ''
      const source = input.source === 'permit' ? 'permit' as const : 'user' as const

      if (source === 'permit') return assignPermitRoom(repository, faculty, studentId, roomNumber, signer)

      const student = await repository.findStudent(studentId)
      if (!student) throw new ApiError(404, 'Talaba topilmadi')
      if (student.role !== 'talaba') throw new ApiError(403, "Faqat talaba akkountlarini joylashtirish mumkin")
      if (!sameFaculty(student.faculty, faculty)) throw new ApiError(403, 'Boshqa fakultet talabasini joylashtirib bo\'lmaydi')

      if (!roomNumber) {
        await repository.clearStudentRoom(studentId)
        return { success: true as const }
      }

      if (roomNumber === student.room_number) {
        return { success: true as const }
      }

      const { defaultRoomCapacity } = await createAppSettingsService().get(faculty)
      // Room existence is checked inside the RPC itself (same advisory
      // lock/transaction as the capacity check) — a separate SELECT here
      // first would leave a window where the room could be deleted from
      // floor_room_layout between the check and the actual assignment.
      try {
        const assigned = await repository.assignRoomAtomic(studentId, roomNumber, defaultRoomCapacity)
        if (!assigned) {
          throw new ApiError(409, "Bu xonada bo'sh joy yo'q yoki xonada boshqa jinsdagi talaba(lar) bor")
        }
      } catch (error) {
        if (error instanceof ApiError) throw error
        throwForRoomError(error)
      }
      // Faqat haqiqatan biriktirilgandan keyin — yuqoridagi erta return'lar
      // (xona tozalash yoki ayni o'sha xona) xat yuborishga sabab bo'lmaydi.
      await sendRoomAssignedEmail(student.email ?? '', student.full_name ?? 'Talaba', roomNumber)
      await sendPushWithoutBreaking(() => sendPushForUser(studentId, {
        title: 'Xonangiz biriktirildi 🏠',
        body: `Siz ${roomNumber}-xonaga joylashtirildingiz. Batafsil ma’lumot dashboardda.`,
        url: '/talaba/dashboard',
        tag: `room-user-${studentId}`,
      }))
      // This student may have come in through an approved yo'llanma — if so,
      // now that they have a room, send their signed Ariza + Tilxat.
      let documentDelivery
      const permitId = await repository.findApprovedPermitIdForStudent(student)
      if (permitId) {
        documentDelivery = await deliverPermitDocumentsSafely(
          permitId,
          signer ? { id: signer.id, fullName: signer.fullName } : undefined,
        )
      }
      return { success: true as const, documentDelivery }
    },
  }
}
