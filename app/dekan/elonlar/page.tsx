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

const TYPE_META: Record<AnnouncementType, { icon: React.ComponentType<{ size?: number }>; badge: string; dot: string }> = {
  Muhim: {
    icon: AlertTriangle,
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  Ogohlantirish: {
    icon: AlertTriangle,
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  Tadbir: {
    icon: PartyPopper,
    badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    dot: 'bg-violet-500',
  },
  Yangilik: {
    icon: Newspaper,
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    dot: 'bg-sky-500',
  },
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

  const surface = isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-[#0b1120]/50 border-white/10'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const inputClass = isLight
    ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-indigo-500 focus:bg-white'
    : 'border-white/10 bg-white/5 text-white focus:border-indigo-500/50'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`flex items-center gap-3 text-2xl font-black tracking-tighter sm:text-3xl ${textStrong}`}>
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-2 text-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.12)]">
              <Megaphone size={28} />
            </div>
            E&apos;lonlar
          </h1>
          <p className={`mt-2 text-sm ${textMuted}`}>
            Bu yerda yozilgan e&apos;lon{' '}
            <span className="font-bold text-indigo-500 dark:text-indigo-400">
              {dekanFaculty ? permitFacultyLabel(dekanFaculty) : 'fakultetingiz'}
            </span>{' '}
            talabalarining shaxsiy kabinetiga va bildirishnomalariga tushadi
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className={`inline-flex items-center justify-center rounded-xl border p-3 transition-all disabled:opacity-50 ${
              isLight
                ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
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
            className="flex items-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-violet-600 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white shadow-lg transition-all hover:from-indigo-600 hover:to-violet-700 active:scale-95"
          >
            <Plus size={16} />
            Yangi e&apos;lon
          </button>
        </div>
      </div>

      {/* Stats + filters */}
      <div className={`rounded-3xl border p-5 ${surface}`}>
        <div className="mb-4 flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-tr from-indigo-500 to-violet-600 text-white shadow-lg">
              <Megaphone size={19} />
            </div>
            <div>
              <p className={`text-2xl font-black leading-none ${textStrong}`}>{loading ? '...' : announcements.length}</p>
              <p className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Jami e&apos;lonlar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-tr from-emerald-500 to-teal-600 text-white shadow-lg">
              <Users size={19} />
            </div>
            <div>
              <p className={`text-2xl font-black leading-none ${textStrong}`}>{loading ? '...' : publishedCount}</p>
              <p className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
                Talabalarga ko&apos;rinmoqda
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${textMuted}`} />
            <input
              type="text"
              placeholder="Sarlavha yoki matn bo'yicha qidirish..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`w-full rounded-2xl border py-3 pl-11 pr-10 text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 ${inputClass}`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Qidiruvni tozalash"
                className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10 ${textMuted}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="sm:w-56">
            <CustomSelect
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as '' | AnnouncementType)}
              className={`rounded-2xl border px-4 py-3 text-sm ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}
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
        <div className={`flex h-40 items-center justify-center rounded-3xl border ${surface}`}>
          <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-indigo-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-3xl border p-12 text-center ${surface}`}>
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'
            }`}
          >
            <Megaphone size={24} />
          </div>
          <p className={`text-sm font-bold ${textMuted}`}>
            {announcements.length === 0 ? "Hali e'lon yozilmagan" : "Qidiruvga mos e'lon topilmadi"}
          </p>
          {announcements.length === 0 && (
            <button
              onClick={openCreate}
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:bg-indigo-700 active:scale-95"
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
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className={`flex flex-col rounded-3xl border p-5 ${surface} ${
                    item.is_published ? '' : 'opacity-70'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`shrink-0 rounded-xl border p-2.5 ${meta.badge}`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <h3 className={`break-words text-sm font-black leading-tight ${textStrong}`}>{item.title}</h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${meta.badge}`}>
                            {item.type}
                          </span>
                          <span
                            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                              item.is_published
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'border-slate-400/20 bg-slate-400/10 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${item.is_published ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {item.is_published ? "Talabalarda ko'rinadi" : 'Qoralama'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className={`mb-4 flex-1 whitespace-pre-wrap break-words text-xs leading-relaxed ${textMuted}`}>
                    {item.text.length > 320 ? `${item.text.slice(0, 320)}…` : item.text}
                  </p>

                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 border-t pt-3 ${
                      isLight ? 'border-slate-100' : 'border-white/5'
                    }`}
                  >
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold ${textMuted}`}>
                      <CalendarDays size={12} />
                      {item.is_published ? formatDate(item.published_at ?? item.created_at) : formatDate(item.created_at)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => void togglePublished(item)}
                        title={item.is_published ? 'Talabalardan yashirish' : "Talabalarga ko'rsatish"}
                        className={`rounded-lg border p-2 transition-colors ${
                          isLight
                            ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {item.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        title="Tahrirlash"
                        className={`rounded-lg border p-2 transition-colors ${
                          isLight
                            ? 'border-slate-200 bg-white text-amber-600 hover:bg-amber-50'
                            : 'border-white/10 bg-white/5 text-amber-400 hover:bg-amber-500/10'
                        }`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteModal.open(item)}
                        title="O'chirish"
                        className={`rounded-lg border p-2 transition-colors ${
                          isLight
                            ? 'border-slate-200 bg-white text-rose-600 hover:bg-rose-50'
                            : 'border-white/10 bg-white/5 text-rose-400 hover:bg-rose-500/10'
                        }`}
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
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Sarlavha</label>
            <input
              type="text"
              value={form.title}
              maxLength={160}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Masalan: Yotoqxonada suv o'chiriladi"
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${inputClass}`}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>E&apos;lon turi</label>
            <div className={`grid grid-cols-2 gap-2 rounded-2xl border p-1 sm:grid-cols-4 ${
              isLight ? 'border-slate-200 bg-slate-100' : 'border-white/5 bg-white/5'
            }`}>
              {ANNOUNCEMENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type }))}
                  className={`rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                    form.type === type
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : isLight
                        ? 'text-slate-500 hover:text-slate-800'
                        : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Xabar matni</label>
            <textarea
              value={form.text}
              rows={7}
              maxLength={20_000}
              onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
              placeholder="Talabalarga yetkazmoqchi bo'lgan xabaringizni yozing..."
              className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all ${inputClass}`}
            />
            <p className={`text-right text-[10px] font-bold ${textMuted}`}>{form.text.length}/20000</p>
          </div>

          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, is_published: !prev.is_published }))}
            className={`flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors ${
              form.is_published
                ? 'border-emerald-500/25 bg-emerald-500/5'
                : isLight
                  ? 'border-slate-200 bg-slate-50'
                  : 'border-white/10 bg-white/5'
            }`}
          >
            <div>
              <p className={`text-xs font-bold ${textStrong}`}>
                {form.is_published ? 'Darhol talabalarga yuborilsin' : 'Qoralama sifatida saqlansin'}
              </p>
              <p className={`mt-0.5 text-[11px] ${textMuted}`}>
                {form.is_published
                  ? "E'lon fakultet talabalarining e'lonlar ro'yxatida va bildirishnomalarida ko'rinadi"
                  : "Hozircha faqat sizga ko'rinadi, keyin bosib chop etishingiz mumkin"}
              </p>
            </div>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                form.is_published ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-white/15'
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
