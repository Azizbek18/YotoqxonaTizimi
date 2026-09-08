import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: "Yotoqxona yo‘llanmasini yuborish",
  description: "Yotoqxonaga joylashish uchun yo‘llanmani yuklang va arizangizni ko‘rib chiqishga yuboring.",
  alternates: { canonical: '/ruxsatnoma-yuborish' },
  openGraph: { title: "Yotoqxona yo‘llanmasini yuborish", description: "Yotoqxonaga joylashish uchun yo‘llanmani yuklang va arizangizni ko‘rib chiqishga yuboring.", url: '/ruxsatnoma-yuborish' },
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
