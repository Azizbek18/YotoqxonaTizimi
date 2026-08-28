import InviteRegisterForm from '@/components/auth/InviteRegisterForm'
import { normalizeInviteCode } from '@/lib/staff-invite'

type Props = {
  searchParams: Promise<{ code?: string }>
}

// No link-key gate: the invite code itself is the credential, validated
// server-side by claim_staff_invite. A ?code= param just prefills the field.
export default async function XodimRegisterPage({ searchParams }: Props) {
  const { code } = await searchParams
  return <InviteRegisterForm initialCode={code ? normalizeInviteCode(code) : ''} />
}
