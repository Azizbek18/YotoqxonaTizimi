import StaffRegisterForm from '@/components/auth/StaffRegisterForm'
import { notFound } from 'next/navigation'
import { validateStaffLink } from '@/lib/staff-access'

type Props = {
  searchParams: Promise<{ k?: string }>
}

export default async function AdminRegisterPage({ searchParams }: Props) {
  const { k } = await searchParams
  if (!validateStaffLink('admin', k)) {
    notFound()
  }

  return <StaffRegisterForm role="admin" linkKey={k!} />
}
