'use client'

import { Send, ShieldCheck } from 'lucide-react'

type Props = {
  url: string | null
  linked?: boolean
  isLight: boolean
}

export default function TelegramPermitConnect({ url, linked = false, isLight }: Props) {
  if (!url && !linked) return null

  return (
    <div className={`rounded-2xl border p-4 text-left ${
      isLight ? 'border-sky-200 bg-sky-50' : 'border-sky-400/20 bg-sky-500/10'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
          {linked ? <ShieldCheck size={20} /> : <Send size={19} />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-xs font-black uppercase tracking-wide ${isLight ? 'text-sky-900' : 'text-sky-200'}`}>
            {linked ? 'Telegram ulangan' : 'Javobni Telegramda oling'}
          </p>
          <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {linked
              ? 'Dekan javobi tayyor bo‘lishi bilan bot avtomatik yozadi. Qayta START bosish shart emas.'
              : 'Tugmani bosing va Telegram botda bir marta START ni bosing. Keyin tasdiq yoki rad javobi shu yerga avtomatik keladi.'}
          </p>
        </div>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#168bc2] active:scale-[0.98]"
        >
          <Send size={15} />
          Telegram botga ulash
        </a>
      ) : null}
    </div>
  )
}
