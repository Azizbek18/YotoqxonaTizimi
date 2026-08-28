import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { generateInviteCode, hashInviteCode } from '@/lib/staff-invite'
import type { CreatedStaffInvite, StaffInviteRole, StaffInviteRow } from '../types'
import { createStaffInviteRepository, type StaffInviteRepository } from './repository'

// A dekan (this panel) may only issue tarbiyachi codes. The single 'dekan'
// code — one shared registration link for every faculty's dean — is minted
// by the system owner (scripts/mint-dekan-invite.mjs), never here.
const ROLES: StaffInviteRole[] = ['tarbiyachi']
const MAX_EXPIRY_DAYS = 60
const DEFAULT_EXPIRY_DAYS = 14

function toRow(raw: Record<string, unknown>): StaffInviteRow {
  const expiresAt = String(raw.expires_at)
  const revokedAt = raw.revoked_at ? String(raw.revoked_at) : null
  const maxUses = raw.max_uses === null || raw.max_uses === undefined ? null : Number(raw.max_uses)
  const useCount = Number(raw.use_count ?? 0)
  return {
    id: String(raw.id),
    faculty: raw.faculty ? String(raw.faculty) : null,
    role: raw.role as StaffInviteRole,
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

      const label = typeof input.label === 'string' ? input.label.trim().slice(0, 80) || null : null

      const expiryDays = Number(input.expiryDays)
      const days = Number.isInteger(expiryDays) && expiryDays >= 1 && expiryDays <= MAX_EXPIRY_DAYS
        ? expiryDays
        : DEFAULT_EXPIRY_DAYS
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

      let maxUses: number | null = null
      if (input.maxUses !== null && input.maxUses !== undefined && input.maxUses !== '') {
        const parsed = Number(input.maxUses)
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) throw new ApiError(400, "Foydalanish limiti noto'g'ri")
        maxUses = parsed
      }

      const code = generateInviteCode()
      const created = await repository.insert({
        code_hash: hashInviteCode(code),
        faculty,
        role,
        label,
        created_by: creatorId,
        expires_at: expiresAt,
        max_uses: maxUses,
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
  }
}
