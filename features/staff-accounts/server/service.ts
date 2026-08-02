import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import type { StaffAccountRow, ManagedStaffRole } from '../types'
import { createStaffAccountRepository, type StaffAccountRepository } from './repository'
import { getPasswordPolicyError } from '@/lib/password-policy'

// Creating a tarbiyachi account is admin-only (see app/api/admin/staff-accounts).
// It used to also be reachable by dekan, scoped by a "does this floor
// have any of my faculty's students" check — that check turned out to be
// both incomplete (didn't verify gender) and bypassable (a dekan could
// temporarily reassign one of their own students onto the target floor,
// create the account, then move the student back), and dorms aren't
// faculty-segregated by floor in the first place, so there was no way to
// make it airtight without changing what a tarbiyachi's floor scope means
// building-wide. Restricting creation to admin removes the incentive
// entirely without touching that model.
export function createStaffAccountService(repository: StaffAccountRepository = createStaffAccountRepository()) {
  return {
    async list(): Promise<StaffAccountRow[]> {
      return (await repository.listAll()) as StaffAccountRow[]
    },

    async create(creatorId: string, value: unknown) {
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

      if (role !== 'tarbiyachi') throw new ApiError(400, "Noto'g'ri rol")
      if (fullName.length < 3) throw new ApiError(400, "F.I.Sh. kamida 3 belgidan iborat bo'lishi kerak")
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, "Email noto'g'ri")
      if (password !== confirmPassword) throw new ApiError(400, 'Parollar bir xil emas')
      const passwordError = getPasswordPolicyError(password)
      if (passwordError) throw new ApiError(400, passwordError)
      // A tarbiyachi with no assigned floor/gender is treated as "sees every
      // floor" (server/auth/tarbiyachi.ts isWithinTarbiyachiFloor) — an
      // unscoped tarbiyachi account would see every student building-wide.
      // Bounded by the real floor_count setting, not a generic guess — a
      // fixed upper bound (e.g. 50) would let an admin pick a floor number
      // that doesn't actually exist in this dorm, creating an account with
      // no real students to ever supervise.
      const { floorCount } = await createAppSettingsService().get()
      if (!Number.isInteger(assignedFloor) || assignedFloor < 1 || assignedFloor > floorCount) {
        throw new ApiError(400, `Tarbiyachi uchun qavat 1 dan ${floorCount} gacha bo'lishi kerak`)
      }
      if (assignedGender !== 'male' && assignedGender !== 'female') {
        throw new ApiError(400, 'Tarbiyachi uchun jins tanlanishi shart')
      }

      const existing = await repository.findByEmail(email)
      if (existing) throw new ApiError(409, "Bu email allaqachon ro'yxatdan o'tgan")

      const { data: authData, error: authError } = await repository.createAuthUser(email, password, role)
      if (authError || !authData.user) {
        console.error('Staff Auth user creation failed:', authError)
        throw new ApiError(400, "Xodim akkauntini yaratib bo'lmadi")
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
        console.error('Staff profile insert failed:', insertError)
        throw new ApiError(insertError.code === '23505' ? 409 : 500, insertError.code === '23505'
          ? "Bu email bilan xodim akkaunti mavjud"
          : "Xodim profilini yaratib bo'lmadi")
      }

      return { success: true as const }
    },
  }
}
