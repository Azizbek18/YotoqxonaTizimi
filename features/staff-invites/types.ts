export type StaffInviteRole = 'tarbiyachi' | 'dekan'

export type StaffInviteRow = {
  id: string
  faculty: string
  role: StaffInviteRole
  label: string | null
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  maxUses: number | null
  useCount: number
  /** Derived: not revoked, not expired, uses left. */
  active: boolean
}

/** The one and only time the plaintext code is returned to the caller. */
export type CreatedStaffInvite = StaffInviteRow & { code: string }
