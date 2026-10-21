'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe2, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { supabase } from '@/lib/supabase'
import { getSafeUser } from '@/lib/auth-session'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'

// International office shell: one read-only page, so a slim top bar instead of
// the dekan/tarbiyachi sidebar. Role access is enforced by proxy.ts (page) and
// the /api/xalqaro/* guard (data) — this layout is presentation only.
export default function XalqaroLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isLight = useThemeStore((state) => state.theme === 'light')
  const ui = dekanUI(isLight)
  const [email, setEmail] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let active = true
    void getSafeUser().then((user) => {
      if (active) setEmail(user?.email ?? null)
    })
    return () => { active = false }
  }, [])

  const logout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      toast.error('Chiqib ketishda xato!')
      setLoggingOut(false)
    }
  }

  return (
    <div className={`min-h-screen ${ui.shell}`}>
      <header className={`sticky top-0 z-30 border-b backdrop-blur ${isLight ? 'border-slate-200 bg-white/85' : 'border-slate-800 bg-slate-950/80'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
              <Globe2 size={18} />
            </div>
            <div className="min-w-0">
              <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${ui.accentText}`}>Xalqaro bo‘lim</p>
              <p className={`truncate text-sm font-bold ${ui.strong}`}>Viza va propiska nazorati</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {email && <span className={`hidden max-w-[220px] truncate text-xs sm:inline ${ui.muted}`}>{email}</span>}
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 ${ui.btnGhost}`}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
