import type { Metadata } from 'next'
import Link from 'next/link'

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

export default function DormitoryGuide() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl space-y-8 leading-7">
        <nav aria-label="Sahifa yo‘li"><Link className="text-indigo-700 underline" href="/">Bosh sahifa</Link> / Yotoqxona</nav>
        <header className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Talabalar yotoqxonasiga joylashish</h1>
          <p>Meningyotoqxonam.uz yotoqxona arizalarini yuborish va ularning holatini kuzatishga yordam beradi.
            Quyidagi yo‘riqnoma ushbu platformadan foydalanish bosqichlarini tushuntiradi.
            Joy ajratish qarori va talab qilinadigan hujjatlar tegishli ta’lim muassasasiga bog‘liq.</p>
        </header>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">1. Ariza turini tanlang</h2>
          <p><Link href="/ariza-yuborish" className="text-indigo-700 underline">Yotoqxonaga ariza yuborish</Link> sahifasini oching.
            O‘zingizga mos toifani tanlab, shaklda ko‘rsatilgan ma’lumotlarni kiriting.
            my.gov.uz orqali olingan yo‘llanmangiz bo‘lsa, yo‘llanma yuborish bo‘limidan foydalaning.</p>
          <p>Ma’lumot va hujjatlarni yuborishdan oldin tekshiring. Ayniqsa email manzilini to‘g‘ri kiriting:
            u hisobga kirish va parolni tiklashda kerak bo‘lishi mumkin.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">2. Ariza holatini tekshiring</h2>
          <p><Link href="/ruxsatnoma-tekshirish" className="text-indigo-700 underline">Ariza holatini tekshirish</Link> sahifasida
            so‘ralgan ma’lumotlarni kiriting. Ariza ko‘rib chiqilayotgan bo‘lsa, natijani kuting.
            Tuzatish talab etilsa, ko‘rsatilgan sababni o‘qib, tegishli ma’lumotlarni to‘g‘rilang.</p>
          <p>Ariza yuborishning o‘zi yotoqxonadan joy ajratilganini anglatmaydi. Tasdiqlash va xona biriktirish holatini alohida tekshiring.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">3. Shaxsiy kabinetdan foydalaning</h2>
          <p>Tasdiqlangan arizangiz bo‘yicha tizim ko‘rsatmalariga amal qiling.
            Hisobingiz tayyor bo‘lsa, <Link href="/login" className="text-indigo-700 underline">shaxsiy kabinetga kiring</Link>.
            Kabinetda sizga ochilgan bo‘limlar orqali arizalar, e’lonlar va to‘lov ma’lumotlarini kuzatishingiz mumkin.</p>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Ko‘p so‘raladigan savollar</h2>
          <h3 className="text-lg font-semibold">Yotoqxona narxi va bo‘sh joylarni qayerdan bilaman?</h3>
          <p>Narx va joy mavjudligi yotoqxona hamda ta’lim muassasasiga bog‘liq. Aniq ma’lumotni tegishli yotoqxona mas’ulidan oling.</p>
          <h3 className="text-lg font-semibold">Parolni tiklash xati kelmasa nima qilaman?</h3>
          <p>Hisob ochishda ishlatgan emailni kiriting, spam papkasini ham tekshiring.
            Muammo davom etsa, mas’ulga urinish vaqti va ekranda chiqqan xabarni ayting.
            Parol yoki tiklash havolasini boshqalarga bermang.</p>
        </section>
        <Link href="/ariza-yuborish" className="inline-block rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white">Yotoqxona arizasini yuborish</Link>
      </article>
    </main>
  )
}
