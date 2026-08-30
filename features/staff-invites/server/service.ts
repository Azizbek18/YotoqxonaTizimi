import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { generateInviteCode, hashInviteCode } from '@/lib/staff-invite'
import { normalizeFaculty, permitFacultyLabel } from '@/lib/faculties'
import type { CreatedStaffInvite, StaffInviteRole, StaffInviteRow } from '../types'
import { createStaffInviteRepository, type StaffInviteRepository } from './repository'

// A dekan (this panel) may only issue tarbiyachi codes. `dekan` codes are
// minted by the superadmin — createDeanInvite() below, or the fallback CLI
// (scripts/mint-dekan-invite.mjs) — never through the dekan-facing route.
const ROLES: StaffInviteRole[] = ['tarbiyachi']
const MAX_EXPIRY_DAYS = 60
const DEFAULT_EXPIRY_DAYS = 14
const DEAN_EXPIRY_DAYS = 30

function toRow(raw: Record<string, unknown>): StaffInviteRow {
  const expiresAt = String(raw.expires_at)
  const revokedAt = raw.revoked_at ? String(raw.revoked_at) : null
  const maxUses = raw.max_uses === null || raw.max_uses === undefined ? null : Number(raw.max_uses)
  const useCount = Number(raw.use_count ?? 0)
  return {
    id: String(raw.id),
    faculty: raw.faculty ? String(raw.faculty) : null,
    role: raw.role as StaffInviteRole,
    email: raw.email ? String(raw.email) : null,
    label: raw.label ? String(raw.label) : null,
    createdAt: String(raw.created_at),
    expiresAt,
    revokedAt,
    maxUses,
    useCount,
    active: !revokedAt && new Date(expiresAt) > new Date() && (maxUses === null || useCount < maxUses),
  }
}

export function createStaffInviteService(repository: StaffInviteRepository = createStaffInviteRepository()) {
  return {
    async list(faculty: string): Promise<StaffInviteRow[]> {
      return (await repository.listByFaculty(faculty)).map((raw) => toRow(raw as Record<string, unknown>))
    },

    async create(creatorId: string, faculty: string, value: unknown): Promise<CreatedStaffInvite> {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
      const input = value as Record<string, unknown>

      const role = input.role as StaffInviteRole
      if (!ROLES.includes(role)) throw new ApiError(400, "Rol noto'g'ri")

      // The dekan types exactly one email; the code is bound to it and is
      // single-use. The tarbiyachi fills in everything else at registration.
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new ApiError(400, "Email noto'g'ri")

      if (await repository.staffEmailExists(email)) {
        throw new ApiError(409, "Bu email allaqachon xodim sifatida ro'yxatdan o'tgan")
      }
      if (await repository.pendingInviteForEmail(faculty, email)) {
        throw new ApiError(409, "Bu email uchun faol taklif kodi allaqachon bor — avval uni bekor qiling")
      }

      const label = typeof input.label === 'string' ? input.label.trim().slice(0, 80) || null : null

      const expiryDays = Number(input.expiryDays)
      const days = Number.isInteger(expiryDays) && expiryDays >= 1 && expiryDays <= MAX_EXPIRY_DAYS
        ? expiryDays
        : DEFAULT_EXPIRY_DAYS
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

      const code = generateInviteCode()
      const created = await repository.insert({
        code_hash: hashInviteCode(code),
        faculty,
        role,
        email,
        label,
        created_by: creatorId,
        expires_at: expiresAt,
        max_uses: 1,
      })

      return { ...toRow(created as Record<string, unknown>), code }
    },

    async revoke(faculty: string, idValue: unknown): Promise<{ ok: true }> {
      const id = typeof idValue === 'string' ? idValue.trim() : ''
      if (!id) throw new ApiError(400, "Taklif tanlanmagan")
      const revoked = await repository.revoke(id, faculty)
      if (!revoked) throw new ApiError(404, "Taklif topilmadi yoki allaqachon bekor qilingan")
      return { ok: true }
    },

    // ---- superadmin: dean invites (cross-faculty) ----

    async listDeanInvites(): Promise<StaffInviteRow[]> {
      return (await repository.listByRole('dekan')).map((raw) => toRow(raw as Record<string, unknown>))
    },

    /**
     * Mint a faculty-bound, email-bound, single-use registration code for a
     * faculty's dean. Refuses a faculty that already has an active dean (the
     * DB index enforces it too) and an email that's already staff / already
     * holds a pending code.
     */
    async createDeanInvite(creatorId: string, value: unknown): Promise<CreatedStaffInvite> {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, "So'rov noto'g'ri")
      const input = value as Record<string, unknown>

      const faculty = normalizeFaculty(typeof input.faculty === 'string' ? input.faculty : null)
      if (!faculty) throw new ApiError(400, "Fakultet noto'g'ri")
      if (await repository.activeDekanExists(faculty)) {
        throw new ApiError(409, `${permitFacultyLabel(faculty)} fakultetida allaqachon faol dekan bor`)
      }

      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new ApiError(400, "Email noto'g'ri")
      if (await repository.staffEmailExists(email)) {
        throw new ApiError(409, "Bu email allaqachon xodim sifatida ro'yxatdan o'tgan")
      }
      if (await repository.pendingInviteForEmailAnywhere(email)) {
        throw new ApiError(409, "Bu email uchun faol taklif kodi allaqachon bor — avval uni bekor qiling")
      }

      const label = typeof input.label === 'string' ? input.label.trim().slice(0, 80) || null : null
      const expiryDays = Number(input.expiryDays)
      const days = Number.isInteger(expiryDays) && expiryDays >= 1 && expiryDays <= MAX_EXPIRY_DAYS
        ? expiryDays
        : DEAN_EXPIRY_DAYS
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

      const code = generateInviteCode()
      const created = await repository.insert({
        code_hash: hashInviteCode(code),
        faculty,
        role: 'dekan',
        email,
        label,
        created_by: creatorId,
        expires_at: expiresAt,
        max_uses: 1,
      })
      return { ...toRow(created as Record<string, unknown>), code }
    },

    async revokeDeanInvite(idValue: unknown): Promise<{ ok: true }> {
      const id = typeof idValue === 'string' ? idValue.trim() : ''
      if (!id) throw new ApiError(400, "Taklif tanlanmagan")
      const revoked = await repository.revokeAnyDean(id)
      if (!revoked) throw new ApiError(404, "Taklif topilmadi yoki allaqachon bekor qilingan")
      return { ok: true }
    },
  }
}
