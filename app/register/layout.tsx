import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: "Ro‘yxatdan o‘tish",
  description: "Yotoqxona tizimida shaxsiy hisob yarating.",
  alternates: { canonical: '/register' },
  openGraph: { title: "Ro‘yxatdan o‘tish", description: "Yotoqxona tizimida shaxsiy hisob yarating.", url: '/register' },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
