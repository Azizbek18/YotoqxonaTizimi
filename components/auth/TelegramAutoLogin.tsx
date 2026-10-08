'use client'

import { useEffect, useState } from 'react'

/**
 * Telegram passes the signed launch data in the URL fragment of a Mini App.
 * Deliberately NOT cached anywhere: a student who logs out (client-side
 * navigation to /login, no fragment) must stay logged out.
 */
function readInitData(): string | null {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tgWebAppData')
}

// One request per page load, shared by every effect run: each login mints a
// one-time token that replaces the previous one, so two concurrent calls
// (React Strict Mode runs effects twice in dev) would invalidate each other.
let inFlight: Promise<boolean> | null = null

function signInWithTelegram(initData: string) {
  inFlight ??= fetch('/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  })
    .then((response) => response.ok)
    .catch(() => false)
  return inFlight
}

/**
 * Inside the Telegram Mini App, signs the linked student in automatically.
 * Renders nothing outside Telegram, and falls back to the normal form (by
 * unmounting its overlay) when the student isn't linked or the call fails.
 */
export default function TelegramAutoLogin() {
  const [trying, setTrying] = useState(false)

  useEffect(() => {
    const initData = readInitData()
    if (!initData) return
    let cancelled = false
    setTrying(true)
    signInWithTelegram(initData).then((ok) => {
      if (cancelled) return
      // Full load, so the new session cookies are sent to the dashboard.
      if (ok) window.location.replace('/talaba/dashboard')
      else setTrying(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!trying) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 text-white" style={{ backgroundColor: '#020617' }} role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      <p className="text-sm font-semibold">Telegram orqali kirilmoqda…</p>
    </div>
  )
}
