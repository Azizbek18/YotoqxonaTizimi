'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { createStudentApplication, type ArizaReceipt } from '@/features/applications/client/api'

type Payload = { text: string; title: string; reason: string; type?: 'ariza' | 'tushuntirish' }

/**
 * Shared "prepare → sign → submit" flow for the quick-request modals
 * (tungi ruxsat, navbat almashish, tozalik auditi). Instead of POSTing the
 * application straight away, the form calls `start(payload)`; the caller
 * renders <SignArizaModal> off this state and the student attests before it
 * actually reaches the dekanat.
 */
export function useArizaSigning(onDone?: () => void) {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<ArizaReceipt | null>(null)

  const close = () => {
    setPayload(null)
    setReceipt(null)
    onDone?.()
  }

  const sign = async (typedName: string) => {
    if (!payload) return
    setBusy(true)
    try {
      const res = await createStudentApplication({
        text: payload.text,
        title: payload.title,
        reason: payload.reason,
        type: payload.type ?? 'ariza',
        level: 'info',
        status: 'pending',
        aiGenerated: false,
        signature: { typedName, attested: true },
      })
      if (res.receipt) setReceipt(res.receipt)
      else { toast.success('Yuborildi'); close() }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Xatolik yuz berdi')
    } finally {
      setBusy(false)
    }
  }

  return { payload, busy, receipt, start: (p: Payload) => setPayload(p), sign, close }
}
