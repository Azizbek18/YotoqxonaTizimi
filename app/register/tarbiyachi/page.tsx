import StaffRegisterForm from '@/components/auth/StaffRegisterForm'
import { notFound } from 'next/navigation'
import { validateStaffLink } from '@/lib/staff-access'

type Props = {
  searchParams: Promise<{ k?: string }>
}

export default async function TarbiyachiRegisterPage({ searchParams }: Props) {
  const { k } = await searchParams
  if (!validateStaffLink('tarbiyachi', k)) {
    notFound()
  }

  return <StaffRegisterForm role="tarbiyachi" linkKey={k!} />
}
