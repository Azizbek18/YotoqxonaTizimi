import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: "Yotoqxona arizasi holatini tekshirish",
  description: "Yuborilgan yotoqxona arizangiz holatini tekshiring va keyingi bosqichni bilib oling.",
  alternates: { canonical: '/ruxsatnoma-tekshirish' },
  openGraph: { title: "Yotoqxona arizasi holatini tekshirish", description: "Yuborilgan yotoqxona arizangiz holatini tekshiring va keyingi bosqichni bilib oling.", url: '/ruxsatnoma-tekshirish' },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
