import 'server-only'
import { safeEqual } from '@/lib/security'

export type StaffRole = 'admin' | 'tarbiyachi'

function envByRole(role: StaffRole) {
  if (role === 'admin') {
    return {
      linkKey: process.env.ADMIN_PORTAL_KEY,
      accessCode: process.env.ADMIN_REGISTER_CODE,
      allowedIds: process.env.ADMIN_ALLOWED_IDS,
    }
  }

  return {
    linkKey: process.env.TARBIYACHI_PORTAL_KEY,
    accessCode: process.env.TARBIYACHI_REGISTER_CODE,
    allowedIds: process.env.TARBIYACHI_ALLOWED_IDS,
  }
}

export function validateStaffLink(role: StaffRole, key: string | null | undefined) {
  const { linkKey } = envByRole(role)
  return safeEqual(linkKey, key ?? undefined)
}

export function validateStaffId(role: StaffRole, staffId: string | null | undefined) {
  const { allowedIds } = envByRole(role)
  if (!allowedIds || !staffId) return false
  const normalized = staffId.trim()
  const list = allowedIds.split(',').map((item) => item.trim()).filter(Boolean)
  return list.includes(normalized)
}

export function validateRegisterCode(role: StaffRole, code: string | null | undefined) {
  const { accessCode } = envByRole(role)
  return safeEqual(accessCode, code ?? undefined)
}
