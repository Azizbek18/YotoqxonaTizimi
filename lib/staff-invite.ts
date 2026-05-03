import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { StaffRole } from '@/lib/staff-access'

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function generateRawInviteToken() {
  return randomBytes(24).toString('hex')
}

export async function createInvite(params: {
  role: StaffRole
  allowedStaffId: string
  expiresInMinutes: number
  createdBy: string
}) {
  const token = generateRawInviteToken()
  const hash = tokenHash(token)
  const expiresAt = new Date(Date.now() + params.expiresInMinutes * 60_000).toISOString()
  const supabase = getServiceSupabase()

  const { error } = await supabase.from('staff_invites').insert({
    token_hash: hash,
    role: params.role,
    allowed_staff_id: params.allowedStaffId,
    expires_at: expiresAt,
    created_by: params.createdBy,
  })
  if (error) throw new Error(error.message)
  return token
}

export async function validateInvite(params: {
  token: string
  role: StaffRole
  staffId: string
  consume?: boolean
}) {
  const supabase = getServiceSupabase()
  const hash = tokenHash(params.token)

  const { data, error } = await supabase
    .from('staff_invites')
    .select('id, role, allowed_staff_id, expires_at, used_at')
    .eq('token_hash', hash)
    .maybeSingle()

  if (error || !data) return false
  if (data.role !== params.role) return false
  if (data.allowed_staff_id !== params.staffId) return false
  if (data.used_at) return false
  if (new Date(data.expires_at).getTime() < Date.now()) return false

  if (params.consume) {
    const { error: consumeError } = await supabase
      .from('staff_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', data.id)
      .is('used_at', null)
    if (consumeError) return false
  }

  return true
}
