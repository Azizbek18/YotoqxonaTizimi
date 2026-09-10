import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, BadgeCheck, FileText, Home, LayoutDashboard, Search } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Yotoqxonaga joylashish: talabalar uchun yo‘riqnoma',
  description: 'Meningyotoqxonam.uz orqali yotoqxona arizasini yuborish, holatini tekshirish va shaxsiy kabinetga kirish bosqichlari.',
  alternates: { canonical: '/yotoqxona' },
  openGraph: {
    title: 'Yotoqxonaga joylashish: talabalar uchun yo‘riqnoma',
    description: 'Yotoqxona arizasi va yo‘llanmasi bilan ishlash bo‘yicha amaliy yo‘riqnoma.',
    url: '/yotoqxona',
  },
}

const STEPS = [
  {
    n: 1,
    icon: FileText,
    title: 'Ariza turini tanlang',
    href: '/ariza-yuborish',
    hrefLabel: 'Ariza yuborish sahifasi',
    body: (
      <>
        <p>
          <Link href="/ariza-yuborish" className="font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-500 dark:text-indigo-300 dark:decoration-indigo-500/50">
            Yotoqxonaga ariza yuborish
          </Link>{' '}
          sahifasini oching. O‘zingizga mos toifani tanlab, shaklda ko‘rsatilgan ma’lumotlarni kiriting.
          my.gov.uz orqali olingan yo‘llanmangiz bo‘lsa, yo‘llanma yuborish bo‘limidan foydalaning.
        </p>
        <p>
          Ma’lumot va hujjatlarni yuborishdan oldin tekshiring. Ayniqsa email manzilini to‘g‘ri kiriting:
          u hisobga kirish va parolni tiklashda kerak bo‘ladi.
        </p>
      </>
    ),
  },
  {
    n: 2,
    icon: Search,
    title: 'Ariza holatini tekshiring',
    href: '/ruxsatnoma-tekshirish',
    hrefLabel: 'Ariza holatini tekshirish',
    body: (
      <>
        <p>
          <Link href="/ruxsatnoma-tekshirish" className="font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-500 dark:text-indigo-300 dark:decoration-indigo-500/50">
            Ariza holatini tekshirish
          </Link>{' '}
          sahifasida so‘ralgan ma’lumotlarni kiriting. Ariza ko‘rib chiqilayotgan bo‘lsa, natijani kuting.
          Tuzatish talab etilsa, ko‘rsatilgan sababni o‘qib, tegishli ma’lumotlarni to‘g‘rilang.
        </p>
        <p>
          Ariza yuborishning o‘zi yotoqxonadan joy ajratilganini anglatmaydi. Tasdiqlash va xona
          biriktirish holatini alohida tekshiring.
        </p>
      </>
    ),
  },
  {
    n: 3,
    icon: LayoutDashboard,
    title: 'Shaxsiy kabinetdan foydalaning',
    href: '/login',
    hrefLabel: 'Shaxsiy kabinetga kirish',
    body: (
      <>
        <p>
          Tasdiqlangan arizangiz bo‘yicha tizim ko‘rsatmalariga amal qiling. Hisobingiz tayyor bo‘lsa,{' '}
          <Link href="/login" className="font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-500 dark:text-indigo-300 dark:decoration-indigo-500/50">
            shaxsiy kabinetga kiring
          </Link>
          . Kabinetda sizga ochilgan bo‘limlar orqali arizalar, e’lonlar va to‘lov ma’lumotlarini
          kuzatishingiz mumkin.
        </p>
      </>
    ),
  },
] as const

const FAQ = [
  {
    q: 'Yotoqxona narxi va bo‘sh joylarni qayerdan bilaman?',
    a: 'Narx va joy mavjudligi yotoqxona hamda ta’lim muassasasiga bog‘liq. Aniq ma’lumotni tegishli yotoqxona mas’ulidan oling.',
  },
  {
    q: 'Parolni tiklash xati kelmasa nima qilaman?',
    a: 'Hisob ochishda ishlatgan emailni kiriting, spam papkasini ham tekshiring. Muammo davom etsa, mas’ulga urinish vaqti va ekranda chiqqan xabarni ayting. Parol yoki tiklash havolasini boshqalarga bermang.',
  },
] as const

export default function DormitoryGuide() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Ambient top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-indigo-100/70 to-transparent dark:from-indigo-500/10" />

      <article className="relative mx-auto max-w-3xl px-5 pb-20 pt-10 sm:pt-14">
        {/* Breadcrumb */}
        <nav aria-label="Sahifa yo‘li" className="mb-8 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Link className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" href="/">
            <Home size={13} /> Bosh sahifa
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="px-1 text-slate-700 dark:text-slate-300">Yotoqxona yo‘riqnomasi</span>
        </nav>

        {/* Hero */}
        <header className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600 shadow-sm dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300">
            <BadgeCheck size={13} /> Talabalar uchun qo‘llanma
          </span>
          <h1 className="text-3xl font-black leading-[1.1] tracking-tight sm:text-[2.75rem]">
            Talabalar yotoqxonasiga{' '}
            <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">joylashish</span>
          </h1>
          <p className="max-w-2xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">
            Meningyotoqxonam.uz yotoqxona arizalarini yuborish va ularning holatini kuzatishga yordam beradi.
            Quyida platformadan foydalanishning uchta asosiy bosqichi tushuntirilgan. Joy ajratish qarori
            va talab qilinadigan hujjatlar tegishli ta’lim muassasasiga bog‘liq.
          </p>
        </header>

        {/* Steps */}
        <ol className="mt-12 space-y-4">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <li
                key={step.n}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(79,70,229,0.18)] transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-[0_2px_8px_rgba(15,23,42,0.05),0_24px_48px_-24px_rgba(79,70,229,0.28)] dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none dark:hover:border-indigo-500/40 sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-black text-white shadow-lg shadow-indigo-500/30">
                      {step.n}
                    </span>
                    {step.n < STEPS.length && (
                      <span className="h-8 w-px bg-gradient-to-b from-indigo-300 to-transparent dark:from-indigo-500/40" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
                      <Icon size={17} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
                      {step.title}
                    </h2>
                    <div className="space-y-2.5 text-[14px] leading-7 text-slate-600 dark:text-slate-300">
                      {step.body}
                    </div>
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/12 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                    >
                      {step.hrefLabel}
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight">Ko‘p so‘raladigan savollar</h2>
          <div className="mt-5 space-y-3">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70"
              >
                <h3 className="text-[15px] font-bold">{item.q}</h3>
                <p className="mt-2 text-[14px] leading-7 text-slate-600 dark:text-slate-300">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-14 overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-500 to-purple-600 p-7 text-center shadow-xl shadow-indigo-500/25 dark:border-indigo-400/20 sm:p-9">
          <h2 className="text-xl font-black text-white sm:text-2xl">Arizani hoziroq yuboring</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-indigo-100">
            Toifangizga mos shaklni to‘ldiring — jarayonni istalgan vaqtda holat tekshirish orqali kuzatib borasiz.
          </p>
          <Link
            href="/ariza-yuborish"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black uppercase tracking-wider text-indigo-700 shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
          >
            Yotoqxona arizasini yuborish
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </article>
    </main>
  )
}
