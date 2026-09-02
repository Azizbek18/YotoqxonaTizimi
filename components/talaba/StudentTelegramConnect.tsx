'use client'

import { useCallback, useEffect, useState } from 'react'
import { Send, ShieldCheck, RefreshCw } from 'lucide-react'
import { getAuthHeaders } from '@/lib/auth-session'

type Status = { linked: boolean; url: string | null }

// Self-contained card: shows the student's Telegram binding state and a
// one-tap /start deep link. Drop it on the profile / dashboard. Renders
// nothing while loading or if Telegram isn't configured for this env.
export default function StudentTelegramConnect({ isLight }: { isLight: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [checking, setChecking] = useState(true)

  const load = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/student/telegram-link', { headers: await getAuthHeaders(), cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setStatus(data)
    } catch { /* silent */ } finally { setChecking(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Re-check when the tab regains focus (they linked in Telegram and came back).
  useEffect(() => {
    const onFocus = () => { if (status && !status.linked) load() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [status, load])

  if (checking || !status) return null
  if (!status.linked && !status.url) return null // Telegram not configured

  return (
    <div className={`rounded-2xl border p-4 ${
      isLight ? 'border-sky-200 bg-sky-50' : 'border-sky-400/20 bg-sky-500/10'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white">
          {status.linked ? <ShieldCheck size={20} /> : <Send size={19} />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-xs font-black uppercase tracking-wide ${isLight ? 'text-sky-900' : 'text-sky-200'}`}>
            {status.linked ? 'Telegram ulangan' : 'Arizalar nusxasini Telegramda oling'}
          </p>
          <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {status.linked
              ? 'Yuborgan har bir imzolangan arizangiz nusxasi shu botga keladi.'
              : 'Tugmani bosing va botda bir marta START ni bosing. Keyin imzolangan arizalaringiz PDF nusxasi shu yerga tushadi.'}
          </p>
        </div>
        {status.linked && (
          <button onClick={load} className={`shrink-0 rounded-lg p-1.5 ${isLight ? 'text-sky-700 hover:bg-sky-100' : 'text-sky-300 hover:bg-white/5'}`} title="Yangilash">
            <RefreshCw size={14} />
          </button>
        )}
      </div>
      {status.url && (
        <a
          href={status.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#168bc2] active:scale-[0.98]"
        >
          <Send size={15} /> Telegram botga ulash
        </a>
      )}
    </div>
  )
}
