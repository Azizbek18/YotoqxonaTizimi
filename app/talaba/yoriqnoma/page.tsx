'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, Home, FileSignature, Plane, Phone } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

type Item = { icon: typeof Home; title: string; steps: string[] }

// Umumiy yo'riqnoma. Qonun va tartiblar o'zgarib turadi — aniq muddat va
// hujjatlar ro'yxati uchun doim dekanat yoki xalqaro bo'limga murojaat qiling.
const ITEMS: Item[] = [
  {
    icon: Home,
    title: 'Propiska (yashash joyida ro‘yxatga qo‘yish)',
    steps: [
      'Ijaraga olgan uyingiz manzili bo‘yicha vaqtincha ro‘yxatga qo‘yilishingiz kerak.',
      'Uy egasi bilan birga hujjatlarni (pasport/ID, ijara shartnomasi) tayyorlang.',
      'Ro‘yxatdan o‘tgach, «Hujjatlarim» bo‘limiga propiskaning amal qilish muddatini kiriting — eslatmalar shu sanaga qarab keladi.',
      'Ko‘chib o‘tsangiz, «Turgan manzil»ni yangilang va propiskani ham yangi manzilga o‘tkazing.',
    ],
  },
  {
    icon: FileSignature,
    title: 'Ijara shartnomasi',
    steps: [
      'Shartnoma yozma bo‘lishi va muddati (tugash sanasi) aniq ko‘rsatilishi kerak.',
      'Shartnoma raqami, muddati va uy egasi ma’lumotlarini «Hujjatlarim» bo‘limiga kiriting; ixtiyoriy ravishda skan-nusxasini yuklang.',
      'Tugashiga 30, 15, 10, 5 va 3 kun qolganda Telegram, push va email orqali eslatma olasiz.',
      'Shartnomani uzaytirsangiz, yangi muddatni kiritib hujjatni yangilang.',
    ],
  },
  {
    icon: Plane,
    title: 'Xorijiy fuqarolar uchun viza va ro‘yxatga qo‘yish',
    steps: [
      'Viza muddati tugashidan oldin xalqaro bo‘lim orqali uni yangilashni boshlang — jarayon bir necha kun olishi mumkin.',
      'Xorijiy fuqaro O‘zbekistonda turgan manzili bo‘yicha belgilangan muddatda ro‘yxatga qo‘yilishi shart. Aniq muddatni xalqaro bo‘limdan so‘rang.',
      'Muddati o‘tgan viza yoki ro‘yxatga qo‘yilmaslik jarima va chiqarib yuborish xavfini keltiradi.',
      'Har bir yangilanishdan keyin yangi muddatni «Hujjatlarim» bo‘limiga kiriting.',
    ],
  },
  {
    icon: Phone,
    title: 'Kimga murojaat qilish kerak?',
    steps: [
      'Hujjatlar, viza va ro‘yxatga qo‘yish bo‘yicha — fakultet dekanati va universitet xalqaro bo‘limi.',
      'Tizim bilan bog‘liq muammo bo‘lsa — sahifa tepasidagi «Dasturchi va takliflar» tugmasi.',
    ],
  },
]

export default function YoriqnomaPage() {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const [open, setOpen] = useState<number | null>(0)
  const card = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.03]'
  const strong = isLight ? 'text-slate-900' : 'text-white'
  const muted = isLight ? 'text-slate-600' : 'text-slate-300'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/talaba/dashboard"
        data-student-button="plain"
        className={`inline-flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}
      >
        <ArrowLeft size={14} /> Asosiy sahifa
      </Link>

      <div>
        <h1 className={`text-xl font-extrabold tracking-tight ${strong}`}>Yo‘riqnoma</h1>
        <p className={`mt-1 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Kvartirada yashovchi talaba uchun hujjatlar bo‘yicha qisqa qo‘llanma.
        </p>
      </div>

      {ITEMS.map((item, index) => {
        const isOpen = open === index
        const Icon = item.icon
        return (
          <div key={item.title} className={`overflow-hidden rounded-2xl border ${card}`}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : index)}
              aria-expanded={isOpen}
              data-student-button="plain"
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/15 text-blue-300'}`}>
                <Icon size={18} />
              </span>
              <span className={`min-w-0 flex-1 text-sm font-bold ${strong}`}>{item.title}</span>
              <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${muted}`} />
            </button>
            {isOpen && (
              <ol className={`space-y-2 px-4 pb-4 pl-[4.25rem] text-sm leading-relaxed ${muted}`}>
                {item.steps.map((step, i) => (
                  <li key={i} className="list-decimal">{step}</li>
                ))}
              </ol>
            )}
          </div>
        )
      })}

      <p className={`px-1 text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
        Qoidalar va muddatlar o‘zgarishi mumkin — aniq ma’lumot uchun dekanat yoki xalqaro bo‘limga murojaat qiling.
      </p>
    </div>
  )
}
