import 'server-only'
import { safeEqual } from '@/lib/security'

export type StaffRole = 'admin' | 'tarbiyachi' | 'dekan'

const DISABLED_ALLOW_LIST = 'disabled'

function envByRole(role: StaffRole) {
  if (role === 'admin') {
    return {
      linkKey: process.env.ADMIN_PORTAL_KEY,
    }
  }

  if (role === 'tarbiyachi') {
    return {
      linkKey: process.env.TARBIYACHI_PORTAL_KEY,
    }
  }

  return {
    linkKey: process.env.DEKAN_PORTAL_KEY,
    accessCode: process.env.DEKAN_REGISTER_CODE,
    allowedIds: process.env.DEKAN_ALLOWED_IDS,
  }
}

// Admin/tarbiyachi only gate their login link (`/kirish/{role}`) through
// this — they no longer self-register, so only `linkKey` applies to them.
export function validateStaffLink(role: StaffRole, key: string | null | undefined) {
  const { linkKey } = envByRole(role)
  return safeEqual(linkKey, key ?? undefined)
}

export function validateStaffId(staffId: string | null | undefined) {
  const { allowedIds } = envByRole('dekan')
  if (!allowedIds || !staffId) return false
  // New dean accounts should normally use a one-time staff invite. This
  // explicit sentinel safely switches off the legacy env allow-list flow.
  if (allowedIds.trim().toLowerCase() === DISABLED_ALLOW_LIST) return false
  const normalized = staffId.trim()
  const list = allowedIds.split(',').map((item) => item.trim()).filter(Boolean)
  return list.includes(normalized)
}

export function validateRegisterCode(code: string | null | undefined) {
  const { accessCode } = envByRole('dekan')
  return safeEqual(accessCode, code ?? undefined)
}
