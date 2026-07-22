'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uz">
      <body className="min-h-screen bg-slate-950 text-white grid place-items-center p-6">
        <main className="max-w-md text-center space-y-4" role="alert">
          <h1 className="text-2xl font-black">Kutilmagan xatolik yuz berdi</h1>
          <p className="text-sm text-slate-400">Sahifani qayta yuklang. Muammo davom etsa administratorga murojaat qiling.</p>
          <button onClick={reset} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold hover:bg-indigo-500">
            Qayta urinish
          </button>
        </main>
      </body>
    </html>
  )
}
