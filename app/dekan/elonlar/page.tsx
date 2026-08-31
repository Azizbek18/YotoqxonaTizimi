'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  CalendarDays,
  Edit2,
  Eye,
  EyeOff,
  Megaphone,
  Newspaper,
  PartyPopper,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import {
  createDekanAnnouncement,
  deleteDekanAnnouncement,
  fetchDekanAnnouncements,
  updateDekanAnnouncement,
} from '@/features/announcements/client/api'
import { ANNOUNCEMENT_TYPES, type AnnouncementType, type AuthoredAnnouncement } from '@/features/announcements/types'
import { permitFacultyLabel } from '@/lib/faculties'
import { dekanUI, statusChip, type DekanStatusTone } from '@/lib/dekan-ui'
import { SkelList } from '@/components/dekan/Skeletons'

// Type is genuine categorisation, so it keeps a colour — but only from the
// panel's three status tones plus neutral, never a fifth hue.
const TYPE_META: Record<AnnouncementType, { icon: React.ComponentType<{ size?: number }>; tone: DekanStatusTone }> = {
  Muhim: { icon: AlertTriangle, tone: 'danger' },
  Ogohlantirish: { icon: AlertTriangle, tone: 'warning' },
  Tadbir: { icon: PartyPopper, tone: 'info' },
  Yangilik: { icon: Newspaper, tone: 'neutral' },
}

type FormState = {
  id: string | null
  title: string
  text: string
  type: AnnouncementType
  is_published: boolean
}

const EMPTY_FORM: FormState = {
  id: null,
  title: '',
  text: '',
  type: 'Yangilik',
  is_published: true,
}

export default function DekanAnnouncementsPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)
  const { faculty: dekanFaculty } = useDekanScope()

  const [announcements, setAnnouncements] = useState<AuthoredAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | AnnouncementType>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const deleteModal = useConfirmModal<AuthoredAnnouncement>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAnnouncements(await fetchDekanAnnouncements())
    } catch (error) {
      console.error("E'lonlarni yuklashda xato:", error)
      toast.error(error instanceof Error ? error.message : "E'lonlarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return announcements.filter((item) => {
      const matchesQuery =
        !query || item.title.toLowerCase().includes(query) || item.text.toLowerCase().includes(query)
      const matchesType = !typeFilter || item.type === typeFilter
      return matchesQuery && matchesType
    })
  }, [announcements, searchTerm, typeFilter])

  const publishedCount = announcements.filter((item) => item.is_published).length

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('uz-UZ')
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (item: AuthoredAnnouncement) => {
    setForm({
      id: item.id,
      title: item.title,
      text: item.text,
      type: item.type,
      is_published: item.is_published,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (saving) return
    const title = form.title.trim()
    const text = form.text.trim()
    if (title.length < 3) {
      toast.error("Sarlavha kamida 3 belgidan iborat bo'lishi kerak")
      return
    }
    if (text.length < 5) {
      toast.error("Xabar matni kamida 5 belgidan iborat bo'lishi kerak")
      return
    }

    setSaving(true)
    try {
      if (form.id) {
        const updated = await updateDekanAnnouncement({
          id: form.id,
          title,
          text,
          type: form.type,
          is_published: form.is_published,
        })
        setAnnouncements((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        toast.success("E'lon yangilandi")
      } else {
        const created = await createDekanAnnouncement({
          title,
          text,
          type: form.type,
          is_published: form.is_published,
        })
        setAnnouncements((prev) => [created, ...prev])
        toast.success(
          form.is_published ? "E'lon fakultet talabalariga yuborildi" : "E'lon qoralama sifatida saqlandi"
        )
      }
      setModalOpen(false)
      setForm(EMPTY_FORM)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "E'lonni saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (item: AuthoredAnnouncement) => {
    try {
      const updated = await updateDekanAnnouncement({ id: item.id, is_published: !item.is_published })
      setAnnouncements((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      toast.success(updated.is_published ? "E'lon talabalarga ko'rinmoqda" : "E'lon yashirildi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Holatni o'zgartirib bo'lmadi")
    }
  }

  const handleDelete = async () => {
    const target = deleteModal.target
    if (!target) return
    try {
      deleteModal.setIsLoading(true)
      await deleteDekanAnnouncement(target.id)
      setAnnouncements((prev) => prev.filter((item) => item.id !== target.id))
      deleteModal.close()
      toast.success("E'lon o'chirildi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "E'lonni o'chirib bo'lmadi")
    } finally {
      deleteModal.setIsLoading(false)
    }
  }

  const inputCls = `rounded-lg border text-sm px-4 py-3 transition-colors ${ui.input} ${ui.ring}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${ui.strong}`}>E&apos;lonlar</h1>
          <p className={`mt-1 text-xs sm:text-sm ${ui.muted}`}>
            Bu yerda yozilgan e&apos;lon{' '}
            <span className={`font-semibold ${ui.accentText}`}>
              {dekanFaculty ? permitFacultyLabel(dekanFaculty) : 'fakultetingiz'}
            </span>{' '}
            talabalarining shaxsiy kabinetiga tushadi
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className={`inline-flex items-center justify-center rounded-lg border p-3 transition-colors disabled:opacity-50 ${ui.btnGhost}`}
            title="Yangilash"
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
            >
              <RotateCcw size={18} />
            </motion.div>
          </button>
          <button
            onClick={openCreate}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${ui.accentSolid}`}
          >
            <Plus size={16} />
            Yangi e&apos;lon
          </button>
        </div>
      </div>

      {/* Stats + filters */}
      <div className={`rounded-2xl border p-5 ${ui.card}`}>
        <div className="mb-4 flex flex-wrap items-center gap-6">
          {[
            { icon: Megaphone, value: announcements.length, label: 'Jami e’lonlar' },
            { icon: Users, value: publishedCount, label: "Talabalarga ko'rinmoqda" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
                <Icon size={18} strokeWidth={2.2} />
              </div>
              <div>
                <p className={`text-2xl font-bold leading-none tracking-tight ${ui.strong}`}>{loading ? '...' : value}</p>
                <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${ui.faint}`} />
            <input
              type="text"
              placeholder="Sarlavha yoki matn bo'yicha qidirish..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`w-full rounded-lg border py-3 pl-11 pr-10 text-sm transition-colors ${ui.input} ${ui.ring}`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Qidiruvni tozalash"
                className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors ${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="sm:w-56">
            <CustomSelect
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as '' | AnnouncementType)}
              className={`rounded-lg border px-4 py-3 text-sm ${ui.input}`}
              options={[
                { value: '', label: 'Barcha turlar' },
                ...ANNOUNCEMENT_TYPES.map((type) => ({ value: type, label: type })),
              ]}
            />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <SkelList count={5} />
      ) : filtered.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${ui.card}`}>
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-slate-500'}`}>
            <Megaphone size={24} />
          </div>
          <p className={`text-sm font-medium ${ui.muted}`}>
            {announcements.length === 0 ? "Hali e'lon yozilmagan" : "Qidiruvga mos e'lon topilmadi"}
          </p>
          {announcements.length === 0 && (
            <button
              onClick={openCreate}
              className={`mt-4 rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${ui.accentSolid}`}
            >
              Birinchi e&apos;lonni yozish
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {filtered.map((item) => {
              const meta = TYPE_META[item.type] ?? TYPE_META.Yangilik
              const Icon = meta.icon
              const chip = statusChip(meta.tone, isLight)
              const pub = statusChip(item.is_published ? 'success' : 'neutral', isLight)
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`flex flex-col rounded-2xl border p-5 ${ui.card} ${item.is_published ? '' : 'opacity-70'}`}
                >
                  <div className="mb-3 flex items-start gap-3">
                    <div className={`shrink-0 rounded-lg p-2.5 ${chip.chip}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <h3 className={`break-words text-sm font-semibold leading-tight ${ui.strong}`}>{item.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${chip.chip}`}>
                          {item.type}
                        </span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${pub.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${pub.dot}`} />
                          {item.is_published ? "Talabalarda ko'rinadi" : 'Qoralama'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className={`mb-4 flex-1 whitespace-pre-wrap break-words text-xs leading-relaxed ${ui.muted}`}>
                    {item.text.length > 320 ? `${item.text.slice(0, 320)}…` : item.text}
                  </p>

                  <div className={`flex flex-wrap items-center justify-between gap-2 border-t pt-3 ${ui.border}`}>
                    <span className={`flex items-center gap-1.5 text-[10px] font-medium ${ui.muted}`}>
                      <CalendarDays size={12} />
                      {item.is_published ? formatDate(item.published_at ?? item.created_at) : formatDate(item.created_at)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => void togglePublished(item)}
                        title={item.is_published ? 'Talabalardan yashirish' : "Talabalarga ko'rsatish"}
                        className={`rounded-lg border p-2 transition-colors ${ui.btnGhost}`}
                      >
                        {item.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        title="Tahrirlash"
                        className={`rounded-lg border p-2 transition-colors ${ui.btnGhost}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteModal.open(item)}
                        title="O'chirish"
                        className={`rounded-lg border p-2 transition-colors ${ui.dangerSoft}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create / edit modal */}
      <ConfirmModal
        isOpen={modalOpen}
        title={form.id ? "E'lonni tahrirlash" : "Yangi e'lon"}
        description={
          dekanFaculty
            ? `${permitFacultyLabel(dekanFaculty)} fakulteti talabalariga yuboriladi`
            : undefined
        }
        onClose={() => setModalOpen(false)}
        onConfirm={handleSave}
        confirmText={form.id ? 'Saqlash' : form.is_published ? 'Yuborish' : 'Qoralama saqlash'}
        isLoading={saving}
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Sarlavha</label>
            <input
              type="text"
              value={form.title}
              maxLength={160}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Masalan: Yotoqxonada suv o'chiriladi"
              className={`w-full ${inputCls}`}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>E&apos;lon turi</label>
            <div className={`grid grid-cols-2 gap-1 rounded-lg border p-1 sm:grid-cols-4 ${ui.inset}`}>
              {ANNOUNCEMENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type }))}
                  className={`rounded-md px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    form.type === type
                      ? 'bg-indigo-600 text-white'
                      : `${ui.muted} ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-200'}`
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Xabar matni</label>
            <textarea
              value={form.text}
              rows={7}
              maxLength={20_000}
              onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
              placeholder="Talabalarga yetkazmoqchi bo'lgan xabaringizni yozing..."
              className={`w-full resize-none ${inputCls}`}
            />
            <p className={`text-right text-[10px] font-medium ${ui.muted}`}>{form.text.length}/20000</p>
          </div>

          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, is_published: !prev.is_published }))}
            className={`flex w-full items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors ${
              form.is_published ? (isLight ? 'border-indigo-300 bg-indigo-50/60' : 'border-indigo-500/40 bg-indigo-500/10') : ui.inset
            }`}
          >
            <div>
              <p className={`text-xs font-semibold ${ui.strong}`}>
                {form.is_published ? 'Darhol talabalarga yuborilsin' : 'Qoralama sifatida saqlansin'}
              </p>
              <p className={`mt-0.5 text-[11px] ${ui.muted}`}>
                {form.is_published
                  ? "E'lon fakultet talabalarining e'lonlar ro'yxatida va bildirishnomalarida ko'rinadi"
                  : "Hozircha faqat sizga ko'rinadi, keyin bosib chop etishingiz mumkin"}
              </p>
            </div>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                form.is_published ? 'bg-indigo-600' : isLight ? 'bg-slate-300' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  form.is_published ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>
        </div>
      </ConfirmModal>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="E'lonni o'chirish"
        description={
          deleteModal.target
            ? `"${deleteModal.target.title}" e'loni butunlay o'chiriladi va talabalarda ko'rinmay qoladi.`
            : undefined
        }
        onClose={deleteModal.close}
        onConfirm={handleDelete}
        confirmText="O'chirish"
        confirmVariant="danger"
        isLoading={deleteModal.isLoading}
      />
    </div>
  )
}
