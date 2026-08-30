'use client'

import { MessageCircle } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

/**
 * A small fixed "stuck? contact the developer" affordance for the public
 * flows (permit submission, status check, imtiyozli ariza, login,
 * registration) — the places a student can hit a wall with nobody to ask.
 * Deliberately sky-toned so it reads as a support handle, not part of the
 * form. Sits below modals/toasts (z-40) so it never covers a dialog CTA.
 */
const TELEGRAM_URL = 'https://t.me/Azizbek_04_18'

export default function DeveloperContactLink() {
  const isLight = useThemeStore((state) => state.theme === 'light')

  return (
    <div className="fixed bottom-3 right-3 z-40 flex justify-end sm:bottom-5 sm:right-5 print:hidden">
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Telegram orqali dasturchi bilan bog‘lanish"
        title="Muammo yuzaga keldimi? Dasturchi bilan bog‘laning"
        className={`group inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-medium shadow-lg backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 sm:max-w-full sm:px-4 sm:py-2.5 sm:text-xs ${
          isLight
            ? 'border-sky-200/80 bg-white/90 text-slate-600 shadow-slate-300/40 hover:border-sky-300 hover:bg-sky-50 hover:text-slate-800'
            : 'border-sky-500/20 bg-slate-900/90 text-slate-300 shadow-black/50 hover:border-sky-500/40 hover:bg-slate-800'
        }`}
      >
        <MessageCircle size={14} className="shrink-0 text-sky-500" />
        <span className="hidden truncate sm:inline">
          Muammo yuzaga keldimi?{' '}
          <span className="font-bold text-sky-500 group-hover:text-sky-600">
            Dasturchi bilan bog&apos;laning
          </span>
        </span>
        <span className="font-bold text-sky-500 group-hover:text-sky-600 sm:hidden">
          Muammo bo&apos;ldimi? Yordam
        </span>
      </a>
    </div>
  )
}
