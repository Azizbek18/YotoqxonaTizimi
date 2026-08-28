export type StaffInviteRole = 'tarbiyachi' | 'dekan'

export type StaffInviteRow = {
  id: string
  /** null on the one shared dekan code — the dean picks their faculty at registration. */
  faculty: string | null
  role: StaffInviteRole
  /**
   * The email the code is bound to. A tarbiyachi code always has one (the
   * dekan types it; only that address can register with the code). null on
   * the shared dekan code, where the dean enters their own email.
   */
  email: string | null
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
