'use client'

import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Application route error:', error)
  }, [error])

  return (
    <main className="min-h-[60vh] grid place-items-center p-6" role="alert">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-black">Sahifani yuklab bo‘lmadi</h1>
        <p className="text-sm text-slate-500">Internet aloqasini tekshirib, qayta urinib ko‘ring.</p>
        <button onClick={reset} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500">
          Qayta urinish
        </button>
      </div>
    </main>
  )
}
