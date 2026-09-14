'use client'

import { useCallback, useEffect, useState } from 'react'
import { Home, Check, X, Phone, Mail, IdCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiRequest } from '@/lib/api-client'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import { directionLabel } from '@/lib/directions'
import { genderLabel } from '@/lib/gender'

type KvTalaba = {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  gender: string | null
  direction: string | null
  course: number | null
  group: string | null
  hemis_student_id: string | null
  status: string
  created_at: string
}

type Tab = 'pending' | 'active'

// Dekan's approval queue for KV-talaba (off-campus student)
// self-registrations — this session's interim verification step until
// HEMIS/OneID auto-verification lands. Deliberately its own page, not a
// folder tab on /dekan/talabalar: that page's 'roomless' folder means "lost
// their room," a different concept from "never had one."
export default function KvTalabalarPage() {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const ui = dekanUI(isLight)

  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<KvTalaba[]>([])
  const [active, setActive] = useState<KvTalaba[]>([])
  const [loading, setLoading] = useState(true)
  const rejectModal = useConfirmModal<KvTalaba>()
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<{ ok: true; pending: KvTalaba[]; active: KvTalaba[] }>('/api/dekan/kv-talabalar')
      setPending(data.pending)
      setActive(data.active)
    } catch {
      toast.error("Ro'yxatni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const approve = async (student: KvTalaba) => {
    setBusyId(student.id)
    try {
      await apiRequest('/api/dekan/kv-talabalar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: student.id, action: 'approve' }),
      })
      toast.success(`${student.full_name} tasdiqlandi`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Amalni bajarib bo'lmadi")
    } finally {
      setBusyId(null)
    }
  }

  const reject = async () => {
    const student = rejectModal.target
    if (!student) return
    rejectModal.setIsLoading(true)
    try {
      await apiRequest('/api/dekan/kv-talabalar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: student.id, action: 'reject' }),
      })
      toast.success(`${student.full_name} rad etildi`)
      rejectModal.close()
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Amalni bajarib bo'lmadi")
    } finally {
      rejectModal.setIsLoading(false)
    }
  }

  const list = tab === 'pending' ? pending : active

  return (
    <div className={`min-h-screen ${ui.shell} px-4 py-8 sm:px-8`}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${ui.accentTile}`}>
            <Home size={20} />
          </div>
          <div>
            <h1 className={`text-lg font-black ${ui.strong}`}>KV-talabalar</h1>
            <p className={`text-xs ${ui.muted}`}>Ijarada/kvartirada turadigan talabalar — hujjatsiz ro&apos;yxatdan o&apos;tish</p>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setTab('pending')}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
              tab === 'pending' ? ui.accentSolid : `${ui.card} border ${ui.border} ${ui.body}`
            }`}
          >
            Kutilmoqda {pending.length > 0 ? `(${pending.length})` : ''}
          </button>
          <button
            onClick={() => setTab('active')}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
              tab === 'active' ? ui.accentSolid : `${ui.card} border ${ui.border} ${ui.body}`
            }`}
          >
            Faol ({active.length})
          </button>
        </div>

        {loading ? (
          <div className={`rounded-3xl border ${ui.border} ${ui.card} p-10 text-center text-xs ${ui.muted}`}>Yuklanmoqda...</div>
        ) : list.length === 0 ? (
          <div className={`rounded-3xl border ${ui.border} ${ui.card} p-10 text-center text-xs ${ui.muted}`}>
            {tab === 'pending' ? 'Kutilayotgan ariza yo‘q' : 'Hali faol KV-talaba yo‘q'}
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((student) => (
              <div key={student.id} className={`rounded-2xl border ${ui.border} ${ui.card} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className={`text-sm font-bold ${ui.strong}`}>{student.full_name}</h3>
                    <p className={`mt-0.5 text-xs ${ui.muted}`}>
                      {directionLabel(student.direction) || '—'} · {student.course}-kurs{student.group ? ` · ${student.group}` : ''} · {genderLabel(student.gender)}
                    </p>
                    <div className={`mt-2 flex flex-wrap gap-3 text-[11px] ${ui.faint}`}>
                      <span className="flex items-center gap-1"><Mail size={12} /> {student.email}</span>
                      {student.phone_number && <span className="flex items-center gap-1"><Phone size={12} /> {student.phone_number}</span>}
                      {student.hemis_student_id && <span className="flex items-center gap-1"><IdCard size={12} /> HEMIS: {student.hemis_student_id}</span>}
                    </div>
                  </div>
                  {tab === 'pending' && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => approve(student)}
                        disabled={busyId === student.id}
                        className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        <Check size={13} /> Tasdiqlash
                      </button>
                      <button
                        onClick={() => rejectModal.open(student)}
                        disabled={busyId === student.id}
                        className="flex items-center gap-1 rounded-xl bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-500 hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        <X size={13} /> Rad etish
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={rejectModal.isOpen}
        title="Arizani rad etish"
        description={`${rejectModal.target?.full_name ?? ''} arizasi rad etiladi va hisobi butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.`}
        onClose={rejectModal.close}
        onConfirm={reject}
        confirmText="Rad etish"
        confirmVariant="danger"
        isLoading={rejectModal.isLoading}
      />
    </div>
  )
}
