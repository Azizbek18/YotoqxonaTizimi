'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Send, Loader2, BellRing } from 'lucide-react'
import { getAuthHeaders } from '@/lib/auth-session'

const POLL_MS = 4000

// Blocks the student panel until the account is linked to the Telegram bot:
// yo'qlama reminders go out ONLY on Telegram, so an unlinked student would
// silently never hear about a roll-call. Fails open — if Telegram isn't
// configured or the status request errors, nobody is locked out.
export default function TelegramLinkGate({ isLight }: { isLight: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)

  // One fetch issues the deep link (and rotates its token). Everything after
  // that uses the status-only check so the link the student already opened
  // is never invalidated.
  const bootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/student/telegram-link', { headers: await getAuthHeaders(), cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) return
      if (!data.linked && data.url) { setUrl(data.url); setBlocked(true) }
    } catch { /* fail open */ }
  }, [])

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/student/telegram-link?check=1', { headers: await getAuthHeaders(), cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.linked) setBlocked(false)
    } catch { /* keep waiting */ }
  }, [])

  useEffect(() => { void bootstrap() }, [bootstrap])

  useEffect(() => {
    if (!blocked) return
    const timer = setInterval(() => void check(), POLL_MS)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [blocked, check])

  if (!blocked || !url || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-gate-title"
      className={`fixed inset-0 z-[300] flex items-center justify-center p-5 backdrop-blur-md ${isLight ? 'bg-slate-900/50' : 'bg-black/70'}`}
    >
      <div className={`w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-slate-900 text-white'}`}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#229ED9] text-white">
          <Send size={28} />
        </div>
        <h2 id="tg-gate-title" className="text-lg font-extrabold">Telegram botni ulang</h2>
        <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          Yo‘qlama boshlanganda va arizalar bo‘yicha xabarlar faqat Telegram bot orqali keladi.
          Davom etish uchun botni ulash majburiy.
        </p>
        <ol className={`mt-4 space-y-1.5 text-left text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          <li className="flex gap-2"><b>1.</b> Pastdagi tugmani bosing — Telegram ochiladi.</li>
          <li className="flex gap-2"><b>2.</b> Botda <b>START</b> (Boshlash) tugmasini bosing.</li>
          <li className="flex gap-2"><b>3.</b> Shu sahifaga qayting — u o‘zi ochiladi.</li>
        </ol>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#168bc2] active:scale-[0.98]"
        >
          <Send size={15} /> Telegram botga ulash
        </a>
        <p className={`mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          <Loader2 size={12} className="animate-spin" /> START bosilishi kutilmoqda…
        </p>
        <p className={`mt-1 flex items-center justify-center gap-1.5 text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          <BellRing size={11} /> Boshqa hech narsa yuborilmaydi
        </p>
      </div>
    </div>,
    document.body,
  )
}
