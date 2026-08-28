import 'server-only'
import type { StaffAccountRow } from '../types'
import { createStaffAccountRepository, type StaffAccountRepository } from './repository'

// Read-only view of a faculty's tarbiyachi accounts for the dekan panel.
// New accounts are onboarded exclusively through email-bound invite codes
// (features/staff-invites + /api/staff/register) — the dekan enters an
// email, the tarbiyachi fills in the rest. There is no direct create here.
export function createStaffAccountService(repository: StaffAccountRepository = createStaffAccountRepository()) {
  return {
    async list(faculty: string): Promise<StaffAccountRow[]> {
      return (await repository.listAll(faculty)) as StaffAccountRow[]
    },
  }
}
