'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Eye,
  EyeOff,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import {
  createSystemAnnouncement,
  deleteSystemAnnouncement,
  fetchSystemAnnouncements,
  updateSystemAnnouncement,
} from '@/features/announcements/client/api'
import { ANNOUNCEMENT_TYPES, type AnnouncementType, type AuthoredAnnouncement } from '@/features/announcements/types'
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'

type FormState = {
  id?: string
  title: string
  text: string
  type: AnnouncementType
  is_published: boolean
}

const EMPTY_FORM: FormState = { title: '', text: '', type: 'Muhim', is_published: true }

const TYPE_TONE: Record<AnnouncementType, Parameters<typeof statusChip>[0]> = {
  Muhim: 'danger',
  Ogohlantirish: 'warning',
  Tadbir: 'info',
  Yangilik: 'neutral',
}

export default function SystemAnnouncementsPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [items, setItems] = useState<AuthoredAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const deleteModal = useConfirmModal<AuthoredAnnouncement>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchSystemAnnouncements())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const publishedCount = useMemo(() => items.filter((i) => i.is_published).length, [items])

  const openCreate = () => { setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit = (item: AuthoredAnnouncement) => {
    setForm({ id: item.id, title: item.title, text: item.text, type: item.type, is_published: item.is_published })
    setModalOpen(true)
  }

  const save = async () => {
    if (form.title.trim().length < 3) return toast.error("Sarlavha kamida 3 belgi")
    if (form.text.trim().length < 5) return toast.error("Matn kamida 5 belgi")
    setSaving(true)
    try {
      if (form.id) {
        const updated = await updateSystemAnnouncement({ id: form.id, title: form.title.trim(), text: form.text.trim(), type: form.type, is_published: form.is_published })
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
        toast.success("E'lon yangilandi")
      } else {
        const created = await createSystemAnnouncement({ title: form.title.trim(), text: form.text.trim(), type: form.type, is_published: form.is_published })
        setItems((prev) => [created, ...prev])
        toast.success(form.is_published ? "E'lon barcha talabalarga yuborildi" : 'Qoralama saqlandi')
      }
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (item: AuthoredAnnouncement) => {
    try {
      const updated = await updateSystemAnnouncement({ id: item.id, is_published: !item.is_published })
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      toast.success(updated.is_published ? 'Talabalarga ko‘rinmoqda' : 'Yashirildi')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "O'zgartirib bo'lmadi")
    }
  }

  const doDelete = async () => {
    const target = deleteModal.target
    if (!target) return
    try {
      deleteModal.setIsLoading(true)
      await deleteSystemAnnouncement(target.id)
      setItems((prev) => prev.filter((i) => i.id !== target.id))
      toast.success("E'lon o'chirildi")
      deleteModal.close()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "O'chirib bo'lmadi")
    } finally {
      deleteModal.setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 ${ui.cardElevated}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] ${ui.accentSoft}`}>
              <Megaphone size={13} /> Superadmin · Tizim e‘lonlari
            </div>
            <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${ui.strong}`}>Tizim e‘lonlari</h1>
            <p className={`mt-2 text-sm leading-6 ${ui.body}`}>
              Bitta e‘lon — barcha fakultet talabalariga. Fakultet dekanlarining e‘lonlari
              o‘z fakulteti bilan cheklanadi; bu yerdagilar hammaga ko‘rinadi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold ${ui.btnGhost}`}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={openCreate} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider ${ui.accentSolid}`}>
              <Plus size={14} /> Yangi e‘lon
            </button>
          </div>
        </div>
        <p className={`mt-4 text-xs ${ui.muted}`}>
          {items.length} ta e‘lon · {publishedCount} tasi faol
        </p>
      </section>

      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className={`h-24 animate-pulse rounded-2xl border ${ui.inset}`} />)}
        </div>
      ) : items.length === 0 ? (
        <div className={`rounded-3xl border p-12 text-center ${ui.card}`}>
          <Megaphone className={`mx-auto ${ui.faint}`} size={30} />
          <p className={`mt-3 text-sm font-bold ${ui.strong}`}>Hali tizim e‘loni yo‘q</p>
          <p className={`mt-1 text-xs ${ui.muted}`}>«Yangi e‘lon» bilan birinchisini yarating.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const chip = statusChip(TYPE_TONE[item.type], isLight)
            return (
              <li key={item.id} className={`rounded-2xl border p-4 ${ui.card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${chip.chip}`}>{item.type}</span>
                      {!item.is_published && (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${statusChip('neutral', isLight).chip}`}>Qoralama</span>
                      )}
                      <span className={`text-[10px] ${ui.faint}`}>{new Date(item.created_at).toLocaleDateString('uz-UZ')}</span>
                    </div>
                    <h3 className={`mt-1.5 text-sm font-bold ${ui.strong}`}>{item.title}</h3>
                    <p className={`mt-1 line-clamp-2 text-xs ${ui.body}`}>{item.text}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" title={item.is_published ? 'Yashirish' : 'Chop etish'} onClick={() => togglePublished(item)} className={`rounded-lg border p-1.5 ${ui.btnGhost}`}>
                      {item.is_published ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button type="button" title="Tahrirlash" onClick={() => openEdit(item)} className={`rounded-lg border p-1.5 ${ui.btnGhost}`}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" title="O‘chirish" onClick={() => deleteModal.open(item)} className="rounded-lg border border-rose-300 p-1.5 text-rose-500 hover:bg-rose-500/10 dark:border-rose-500/30">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className={`relative w-full max-w-lg rounded-3xl border p-5 sm:p-6 shadow-2xl ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b1120] border-white/10'}`}>
            <div className="flex items-start justify-between gap-3">
              <h2 className={`text-lg font-black ${ui.strong}`}>{form.id ? "E‘lonni tahrirlash" : 'Yangi tizim e‘loni'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className={`rounded-lg p-1.5 ${ui.muted}`}><X size={16} /></button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Sarlavha"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}
              />
              <textarea
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                rows={5}
                placeholder="E‘lon matni"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}
              />
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AnnouncementType }))}
                  className={`rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}
                >
                  {ANNOUNCEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className={`flex items-center gap-2 text-xs font-bold ${ui.body}`}>
                  <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))} />
                  Darhol chop etilsin
                </label>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button type="button" disabled={saving} onClick={save} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50 ${ui.accentSolid}`}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null} Saqlash
              </button>
              <button type="button" onClick={() => setModalOpen(false)} className={`rounded-xl border px-4 py-2.5 text-xs font-bold ${ui.btnGhost}`}>Bekor</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="E‘lonni o‘chirish"
        description={`«${deleteModal.target?.title ?? ''}» butunlay o‘chiriladi.`}
        onClose={deleteModal.close}
        onConfirm={doDelete}
        confirmText="Ha, o‘chirish"
        confirmVariant="danger"
        isLoading={deleteModal.isLoading}
      />
    </div>
  )
}
