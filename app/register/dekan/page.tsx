import InviteRegisterForm from '@/components/auth/InviteRegisterForm'
import { normalizeInviteCode } from '@/lib/staff-invite'

type Props = {
  searchParams: Promise<{ code?: string }>
}

// The dedicated dean-onboarding screen the system owner sends to every
// faculty. The invite code (minted per faculty by scripts/mint-dekan-invite.mjs)
// is the credential — it binds the new account to one faculty as a dekan,
// validated server-side by claim_staff_invite. A ?code= param just prefills.
export default async function DekanRegisterPage({ searchParams }: Props) {
  const { code } = await searchParams
  return <InviteRegisterForm audience="dekan" initialCode={code ? normalizeInviteCode(code) : ''} />
}
