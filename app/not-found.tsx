import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-indigo-400 font-black">404</p>
        <h1 className="text-3xl font-black">Sahifa topilmadi</h1>
        <p className="text-sm text-slate-400">Manzil noto‘g‘ri yoki sahifa ko‘chirilgan.</p>
        <Link href="/" className="inline-block rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold hover:bg-indigo-500">
          Bosh sahifaga qaytish
        </Link>
      </div>
    </main>
  )
}
