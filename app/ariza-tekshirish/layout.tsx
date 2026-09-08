import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: "Arizani tekshirish",
  description: "Yotoqxona tizimida yuborilgan arizani tekshirish sahifasi.",
  alternates: { canonical: '/ariza-tekshirish' },
  openGraph: { title: "Arizani tekshirish", description: "Yotoqxona tizimida yuborilgan arizani tekshirish sahifasi.", url: '/ariza-tekshirish' },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
