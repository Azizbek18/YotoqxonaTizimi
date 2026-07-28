import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { StaffAccountRow, ManagedStaffRole } from '../types'
import { createStaffAccountRepository, type StaffAccountRepository } from './repository'

export function createStaffAccountService(repository: StaffAccountRepository = createStaffAccountRepository()) {
  return {
    async list(creatorId: string): Promise<StaffAccountRow[]> {
      return (await repository.listCreatedBy(creatorId)) as StaffAccountRow[]
    },

    async create(creatorId: string, creatorFaculty: string, value: unknown) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
      const input = value as Record<string, unknown>

      const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : ''
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
      const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
      const role = input.role as ManagedStaffRole
      const password = typeof input.password === 'string' ? input.password : ''
      const confirmPassword = typeof input.confirmPassword === 'string' ? input.confirmPassword : ''
      const assignedFloor = Number(input.assignedFloor)
      const assignedGender = input.assignedGender as 'male' | 'female' | undefined

      // Only ever called from /api/zamdekan/staff, gated to the 'zamdekan'
      // role — a faculty-scoped role that must never be able to mint an
      // 'admin' account (that would let it escalate to full system access
      // with no ADMIN_PORTAL_KEY or other admin-panel gate involved at all).
      if (role !== 'tarbiyachi') throw new ApiError(400, "Noto'g'ri rol")
      if (fullName.length < 3) throw new ApiError(400, "F.I.Sh. kamida 3 belgidan iborat bo'lishi kerak")
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, "Email noto'g'ri")
      if (password !== confirmPassword) throw new ApiError(400, 'Parollar bir xil emas')
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        throw new ApiError(400, "Parol kamida 8 belgi, harf va raqamdan iborat bo'lishi kerak")
      }
      // A tarbiyachi with no assigned floor/gender is treated as "sees every
      // floor" (server/auth/tarbiyachi.ts isWithinTarbiyachiFloor) — without
      // this, a faculty-scoped zamdekan could mint a tarbiyachi account with
      // broader reach (every floor, every gender) than the zamdekan itself.
      if (!Number.isInteger(assignedFloor) || assignedFloor < 1 || assignedFloor > 50) {
        throw new ApiError(400, 'Tarbiyachi uchun qavat tanlanishi shart')
      }
      if (assignedGender !== 'male' && assignedGender !== 'female') {
        throw new ApiError(400, 'Tarbiyachi uchun jins tanlanishi shart')
      }
      // Floors aren't faculty-segregated (a floor can house every faculty's
      // students), so this can't fully confine the resulting tarbiyachi's
      // reach to the zamdekan's own faculty — but requiring at least one of
      // the zamdekan's own students to actually live on the target floor
      // stops them from picking a floor with no connection to their
      // faculty at all, purely to reach a specific unrelated resident.
      const floorRelevant = await repository.floorHasFacultyStudents(assignedFloor, creatorFaculty)
      if (!floorRelevant) {
        throw new ApiError(400, "Bu qavatda sizning fakultetingiz talabalari yashamaydi")
      }

      const existing = await repository.findByEmail(email)
      if (existing) throw new ApiError(409, "Bu email allaqachon ro'yxatdan o'tgan")

      const { data: authData, error: authError } = await repository.createAuthUser(email, password, role)
      if (authError || !authData.user) {
        throw new ApiError(400, authError?.message ?? "Xodim akkauntini yaratib bo'lmadi")
      }

      const { error: insertError } = await repository.insertStaffRow({
        id: authData.user.id,
        email,
        full_name: fullName,
        phone_number: phone || null,
        role,
        status: 'active',
        assigned_floor: assignedFloor,
        assigned_gender: assignedGender,
        created_by: creatorId,
      })

      if (insertError) {
        await repository.deleteAuthUser(authData.user.id)
        throw new ApiError(400, insertError.message)
      }

      return { success: true as const }
    },
  }
}
