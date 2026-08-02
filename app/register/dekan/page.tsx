import StaffRegisterForm from '@/components/auth/StaffRegisterForm'
import { notFound } from 'next/navigation'
import { validateStaffLink } from '@/lib/staff-access'

type Props = {
  searchParams: Promise<{ k?: string }>
}

export default async function DekanRegisterPage({ searchParams }: Props) {
  const { k } = await searchParams
  if (!validateStaffLink('dekan', k)) {
    notFound()
  }

  return <StaffRegisterForm role="dekan" linkKey={k!} />
}
