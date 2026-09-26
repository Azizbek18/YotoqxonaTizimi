'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ShieldCheck, ShieldAlert, Search, House, Loader2 } from 'lucide-react'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

type VerifyResult =
  | { valid: false }
  | {
      valid: boolean
      hashOk: boolean
      signatureOk: boolean
      signedBy: string
      signedAt: string
      title: string | null
      type: string | null
      code: string
    }

function Content() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const params = useSearchParams()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [touched, setTouched] = useState(false)

  const check = useCallback(async (raw: string) => {
    const c = raw.trim()
    if (!c) return
    setLoading(true)
    setTouched(true)
    try {
      const res = await fetch(`/api/ariza-signature/verify?code=${encodeURIComponent(c)}`, { cache: 'no-store' })
      const data = await res.json()
      setResult(res.ok ? data : { valid: false })
    } catch {
      setResult({ valid: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const q = params.get('code')
    if (q) { setCode(q); void check(q) }
  }, [params, check])

  const page = isLight ? 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900' : 'bg-[#020617] text-white'
  const card = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/10'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className={`min-h-screen ${page}`}>
      <div className="mx-auto flex max-w-lg flex-col px-5 py-8">
        <div className="flex items-center justify-between">
          <Link href="/" className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-black uppercase tracking-wider ${isLight ? 'border-slate-300 text-slate-600' : 'border-white/10 text-slate-400'}`}>
            <House size={14} /> Bosh sahifa
          </Link>
          <ThemeToggle />
        </div>

        <div className="mt-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-xl font-black tracking-tight">Ariza imzosini tekshirish</h1>
          <p className={`mx-auto mt-1.5 max-w-sm text-sm ${muted}`}>
            Tilxatdagi tekshiruv kodini kiriting — arizani kim va qachon imzolagani hamda mazmuni
            o‘zgartirilmaganini ko‘rasiz.
          </p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void check(code) }}
          className="mt-6 flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="YT-XXXX-XXXX"
            autoCapitalize="characters"
            className={`w-full rounded-xl border px-4 py-3 font-mono text-sm uppercase tracking-widest outline-none focus:border-emerald-500 ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-white/5 border-white/15 text-white'
            }`}
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Tekshirish
          </button>
        </form>

        {touched && !loading && result && (
          <div className={`mt-6 rounded-2xl border p-5 ${card}`}>
            {result.valid ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-500">Haqiqiy imzo</p>
                    <p className={`text-xs ${muted}`}>Mazmun o‘zgartirilmagan</p>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <Row label="Imzoladi" value={result.signedBy} muted={muted} />
                  <Row
                    label="Sana / vaqt"
                    value={new Date(result.signedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
                    muted={muted}
                  />
                  {result.title && <Row label="Hujjat" value={`${result.title} (${result.type === 'tushuntirish' ? 'tushuntirish' : 'ariza'})`} muted={muted} />}
                  <Row label="Kod" value={result.code} muted={muted} mono />
                </dl>
              </>
            ) : 'signedBy' in result ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-rose-500">Imzo mos kelmadi</p>
                  <p className={`text-xs ${muted}`}>
                    {!result.hashOk ? 'Hujjat mazmuni imzolangandan keyin o‘zgartirilgan.' : 'Imzo autentifikatsiyadan o‘tmadi.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'}`}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <p className="text-sm font-black">Bunday kod topilmadi</p>
                  <p className={`text-xs ${muted}`}>Kodni tilxatdan aynan ko‘chiring (YT-XXXX-XXXX).</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, muted, mono }: { label: string; value: string; muted: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={`shrink-0 text-xs font-bold uppercase tracking-wider ${muted}`}>{label}</dt>
      <dd className={`text-right font-semibold ${mono ? 'font-mono tracking-widest' : ''}`}>{value}</dd>
    </div>
  )
}

export default function ArizaTekshirishPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020617]" />}>
      <Content />
    </Suspense>
  )
}
