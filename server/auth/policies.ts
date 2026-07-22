export type AppRole = 'talaba' | 'tarbiyachi' | 'zamdekan' | 'admin'

export type RoleRecord = {
  role: string | null
  status: string | null
}

export function isActiveStudent(record: RoleRecord | null | undefined) {
  return record?.role === 'talaba' && record.status === 'active'
}

export function isActiveStaff(
  record: RoleRecord | null | undefined,
  allowedRoles: readonly Exclude<AppRole, 'talaba'>[],
) {
  return record?.status === 'active' && allowedRoles.includes(record.role as Exclude<AppRole, 'talaba'>)
}
