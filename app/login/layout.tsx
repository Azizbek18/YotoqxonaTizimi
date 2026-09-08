import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: "Tizimga kirish",
  description: "Yotoqxona tizimidagi shaxsiy kabinetingizga kiring.",
  alternates: { canonical: '/login' },
  openGraph: { title: "Tizimga kirish", description: "Yotoqxona tizimidagi shaxsiy kabinetingizga kiring.", url: '/login' },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
