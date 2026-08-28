import 'server-only'
import { ApiError } from '@/server/http/api-error'
import type { StaffAccountRow, ManagedStaffRole } from '../types'
import { createStaffAccountRepository, type StaffAccountRepository } from './repository'
import { getPasswordPolicyError } from '@/lib/password-policy'

// Creating a tarbiyachi account is admin-only (see app/api/admin/staff-accounts).
// A tarbiyachi supervises their faculty's WHOLE dormitory — every floor,
// both genders — so the account only needs a faculty, which the creating
// admin/dekan is already bound to. Dekan can only ever create this one
// role for their own faculty.
export function createStaffAccountService(repository: StaffAccountRepository = createStaffAccountRepository()) {
  return {
    async list(faculty: string): Promise<StaffAccountRow[]> {
      return (await repository.listAll(faculty)) as StaffAccountRow[]
    },

    async create(creatorId: string, faculty: string, value: unknown) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
      const input = value as Record<string, unknown>

      const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : ''
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
      const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
      const role = input.role as ManagedStaffRole
      const password = typeof input.password === 'string' ? input.password : ''
      const confirmPassword = typeof input.confirmPassword === 'string' ? input.confirmPassword : ''

      if (role !== 'tarbiyachi') throw new ApiError(400, "Noto'g'ri rol")
      if (fullName.length < 3) throw new ApiError(400, "F.I.Sh. kamida 3 belgidan iborat bo'lishi kerak")
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, "Email noto'g'ri")
      if (password !== confirmPassword) throw new ApiError(400, 'Parollar bir xil emas')
      const passwordError = getPasswordPolicyError(password)
      if (passwordError) throw new ApiError(400, passwordError)

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
        faculty,
        assigned_floor: null,
        assigned_gender: null,
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
