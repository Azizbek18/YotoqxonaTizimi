import { notFound, redirect } from 'next/navigation'
import { validateStaffLink } from '@/lib/staff-access'

type Props = {
  searchParams: Promise<{ k?: string }>
}

export default async function AdminKirishPage({ searchParams }: Props) {
  const { k } = await searchParams
  if (!validateStaffLink('admin', k)) {
    notFound()
  }
  redirect(`/login?portal=admin&k=${encodeURIComponent(k!)}`)
}
