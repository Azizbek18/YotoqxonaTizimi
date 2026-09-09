import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: "Yotoqxonaga ariza yuborish",
  description: "Talabalar yotoqxonasiga joylashish uchun ariza turini tanlang va hujjat yuborish bosqichiga o‘ting.",
  alternates: { canonical: '/ariza-yuborish' },
  openGraph: { title: "Yotoqxonaga ariza yuborish", description: "Talabalar yotoqxonasiga joylashish uchun ariza turini tanlang va hujjat yuborish bosqichiga o‘ting.", url: '/ariza-yuborish' },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
