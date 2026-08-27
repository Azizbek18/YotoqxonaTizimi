'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { getAuthHeaders } from '@/lib/auth-session'
import ArizaTilxatDocument, { type ArizaTilxatData } from '@/components/documents/ArizaTilxatDocument'

// Read-only view for dekan: the exact Ariza+Tilxat the applicant filled in
// and reviewed themselves — reached from the "Tilxat va Arizani ko'rish"
// link on an 'imtiyozli' application's detail panel (app/dekan/arizalar).
function HujjatContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [data, setData] = useState<ArizaTilxatData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('Ariza identifikatori topilmadi.')
      setLoading(false)
      return
    }
    let active = true
    async function load() {
      try {
        const headers = await getAuthHeaders()
        const response = await fetch(`/api/staff/imtiyozli-document?id=${encodeURIComponent(id!)}`, { headers })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Hujjatni yuklab bo‘lmadi')
        if (active) setData(result.data)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Hujjatni yuklab bo‘lmadi')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [id])

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-3 sm:p-6 print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #hujjat-print-area, #hujjat-print-area * { visibility: visible; }
          #hujjat-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .print-page { box-shadow: none !important; border: none !important; page-break-after: always; }
        }
      `}} />

      <div className="max-w-2xl mx-auto print:max-w-none">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Link href="/dekan/arizalar" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={14} /> <span>Arizalar</span>
          </Link>
          {data && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <Download size={14} /> <span>Yuklab olish (PDF)</span>
            </button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700" />
          </div>
        )}

        {error && !loading && (
          <div className="p-6 rounded-xl border text-sm font-medium flex items-start gap-3 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {data && !loading && (
          <div id="hujjat-print-area">
            <ArizaTilxatDocument data={data} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function DekanHujjatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-600" />
      </div>
    }>
      <HujjatContent />
    </Suspense>
  )
}
