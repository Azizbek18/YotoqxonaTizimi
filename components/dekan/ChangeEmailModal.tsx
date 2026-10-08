'use client'

import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * "Change this person's email" dialog, shared by the registered-student card
 * and the unregistered list. The caller owns the request; this only collects
 * and validates the new address and stays open (showing the error) on failure.
 */
export default function ChangeEmailModal({
  isOpen,
  name,
  currentEmail,
  registered,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  name: string
  currentEmail: string | null
  registered: boolean
  onClose: () => void
  onSubmit: (email: string) => Promise<void>
}) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setValue('')
      setError('')
      setBusy(false)
    }
  }, [isOpen])

  const submit = async () => {
    if (busy) return
    const email = value.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(email)) {
      setError("Email manzili noto'g'ri")
      return
    }
    if (email === (currentEmail ?? '').trim().toLowerCase()) {
      setError('Bu email allaqachon shu talabada')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Emailni o'zgartirib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmModal
      isOpen={isOpen}
      title="Emailni o'zgartirish"
      description={name}
      onClose={onClose}
      onConfirm={submit}
      confirmText="O'zgartirish"
      isLoading={busy}
      maxWidthClass="max-w-md"
      icon={<Mail size={20} className="text-indigo-600 dark:text-indigo-400" />}
    >
      <div className="space-y-3">
        <div className={`rounded-lg border px-3 py-2 text-xs ${ui.inset} ${ui.body}`}>
          <span className={ui.faint}>Hozirgi email: </span>
          <span className="break-all font-bold">{currentEmail || '—'}</span>
        </div>
        <div>
          <label htmlFor="change-email-input" className={`mb-2 block text-xs font-bold uppercase tracking-wider ${ui.muted}`}>
            Yangi email
          </label>
          <input
            id="change-email-input"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(event) => { setValue(event.target.value); setError('') }}
            onKeyDown={(event) => { if (event.key === 'Enter') void submit() }}
            placeholder="yangi@gmail.com"
            maxLength={254}
            className={`w-full rounded-lg border px-4 py-3 text-sm transition-colors ${ui.input} ${ui.ring}`}
          />
          {error && <p role="alert" className="mt-1.5 text-xs font-bold text-rose-500">{error}</p>}
        </div>
        <p className={`text-[11px] leading-relaxed ${ui.faint}`}>
          {registered
            ? "Talaba endi shu email va eski parol bilan kiradi; eski emailga kirish ishlamaydi. Uning arizalaridagi email ham almashadi."
            : "Talaba ro'yxatdan o'tishda shu emailni kiritadi va tasdiqlash kodi ham shu manzilga boradi."}
        </p>
      </div>
    </ConfirmModal>
  )
}
