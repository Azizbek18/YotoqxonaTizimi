import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: "Yotoqxona uchun maxsus toifadagi ariza",
  description: "Yotoqxonaga joylashish bo‘yicha ushbu tizimdagi maxsus ariza shaklini to‘ldiring.",
  alternates: { canonical: '/imtiyozli-ariza' },
  openGraph: { title: "Yotoqxona uchun maxsus toifadagi ariza", description: "Yotoqxonaga joylashish bo‘yicha ushbu tizimdagi maxsus ariza shaklini to‘ldiring.", url: '/imtiyozli-ariza' },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
