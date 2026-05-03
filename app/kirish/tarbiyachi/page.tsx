import { notFound, redirect } from 'next/navigation'
import { validateStaffLink } from '@/lib/staff-access'

type Props = {
  searchParams: Promise<{ k?: string }>
}

export default async function TarbiyachiKirishPage({ searchParams }: Props) {
  const { k } = await searchParams
  if (!validateStaffLink('tarbiyachi', k)) {
    notFound()
  }
  redirect(`/login?portal=tarbiyachi&k=${encodeURIComponent(k!)}`)
}
