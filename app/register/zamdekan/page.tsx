import StaffRegisterForm from '@/components/auth/StaffRegisterForm'
import { notFound } from 'next/navigation'
import { validateStaffLink } from '@/lib/staff-access'

type Props = {
  searchParams: Promise<{ k?: string }>
}

export default async function ZamdekanRegisterPage({ searchParams }: Props) {
  const { k } = await searchParams
  if (!validateStaffLink('zamdekan', k)) {
    notFound()
  }

  return <StaffRegisterForm role="zamdekan" linkKey={k!} />
}
