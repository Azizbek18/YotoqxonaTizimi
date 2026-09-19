'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Edit2,
  Eye,
  EyeOff,
  FileEdit,
  Megaphone,
  Newspaper,
  PartyPopper,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'
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
import StoryManager from '@/components/dekan/StoryManager'

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

type AnnouncementStatusFilter = 'all' | 'published' | 'draft'

export default function DekanAnnouncementsPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)
  const { id: myStaffId, faculty: dekanFaculty } = useDekanScope()
  // In the tarbiyachi panel a colleague's announcement is read-only —
  // only its author (or a dekan) sees the edit / hide / delete controls.
  const { canManageAnyAnnouncement } = useStaffPanel()
  const canManage = (item: AuthoredAnnouncement) =>
    canManageAnyAnnouncement || (!!myStaffId && item.created_by === myStaffId)

  const [announcements, setAnnouncements] = useState<AuthoredAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | AnnouncementType>('')
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatusFilter>('all')
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

  const publishedCount = announcements.filter((item) => item.is_published).length
  const draftCount = announcements.length - publishedCount

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return announcements.filter((item) => {
      const matchesQuery =
        !query || item.title.toLowerCase().includes(query) || item.text.toLowerCase().includes(query)
      const matchesType = !typeFilter || item.type === typeFilter
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'published'
          ? item.is_published
          : !item.is_published
      return matchesQuery && matchesType && matchesStatus
    })
  }, [announcements, searchTerm, typeFilter, statusFilter])

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

  const inputCls = `rounded-xl border text-sm px-4 py-3 transition-colors ${ui.input} ${ui.ring}`

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner (Compact) */}
      <div className="no-shelf relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-4 sm:p-5 shadow-lg shadow-indigo-950/15 border border-white/20 text-white">
        {/* Decorative ambient lighting & subtle micro-dot texture */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.07]" />

        {/* Top bar inside hero */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/25 shadow-inner shrink-0">
              <Megaphone size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white backdrop-blur-md border border-white/20"
                  style={{ color: '#ffffff' }}
                >
                  <Building2 size={11} className="text-white/80" />
                  {dekanFaculty ? permitFacultyLabel(dekanFaculty) : "Fakultet ma'muriyati"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Talabalar bilan aloqa
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white" style={{ color: '#ffffff' }}>
                Fakultet e&apos;lonlari
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center justify-center h-8.5 w-8.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white transition-all disabled:opacity-50 no-shelf cursor-pointer active:scale-95 shadow-xs"
              title="Yangilash"
            >
              <motion.div
                animate={loading ? { rotate: 360 } : {}}
                transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
              >
                <RotateCcw size={15} />
              </motion.div>
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-indigo-50 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-indigo-700 transition-all shadow-md active:scale-95 no-shelf cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Yangi e&apos;lon</span>
            </button>
          </div>
        </div>

        {/* Click-to-filter Hero KPI stats (Compact Horizontal Row) */}
        <div className="relative mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {([
            {
              label: "Jami e'lonlar",
              count: announcements.length,
              icon: Megaphone,
              key: 'all',
              tag: 'Barchasi',
              badgeColor: 'bg-white/20 text-white',
              tagColor: 'bg-white/15 text-white',
            },
            {
              label: "Talabalarga ko'rinmoqda",
              count: publishedCount,
              icon: Radio,
              key: 'published',
              tag: 'Faol',
              badgeColor: 'bg-emerald-400/25 text-emerald-200',
              tagColor: 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30',
              hasPulse: true,
            },
            {
              label: 'Qoralamalar',
              count: draftCount,
              icon: FileEdit,
              key: 'draft',
              tag: 'Yashirin',
              badgeColor: 'bg-amber-400/25 text-amber-200',
              tagColor: 'bg-amber-400/20 text-amber-200 border border-amber-400/30',
            },
          ] satisfies Array<{
            label: string
            count: number
            icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
            key: AnnouncementStatusFilter
            hasPulse?: boolean
            tag: string
            badgeColor: string
            tagColor: string
          }>).map((card) => {
            const Icon = card.icon
            const isCardActive = statusFilter === card.key
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => setStatusFilter(card.key)}
                className={`relative text-left rounded-xl px-3.5 py-2.5 backdrop-blur-md transition-all duration-150 cursor-pointer no-shelf flex items-center justify-between gap-3 border ${
                  isCardActive
                    ? 'bg-white/25 border-white/50 ring-1.5 ring-white/80 shadow-md'
                    : 'bg-white/10 hover:bg-white/15 border-white/15'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.badgeColor} shrink-0`}>
                    <Icon size={15} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-indigo-100 truncate" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                      {card.label}
                    </p>
                    <p className="text-lg sm:text-xl font-black text-white tabular-nums tracking-tight leading-tight" style={{ color: '#ffffff' }}>
                      {loading ? '...' : card.count}
                    </p>
                  </div>
                </div>

                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${card.tagColor}`}>
                  {card.hasPulse && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                  {isCardActive ? '✓ ' + card.tag : card.tag}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Search & Segmented Filter Bar */}
      <div className={`p-4 rounded-2xl border backdrop-blur-xl ${ui.card} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Sarlavha yoki matn bo'yicha qidirish..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs font-semibold focus:outline-hidden focus:border-indigo-500 transition-all ${ui.input}`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Qidiruvni tozalash"
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 transition-colors ${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'} no-shelf cursor-pointer`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Segmented Type Filters */}
        <div className={`flex p-1 rounded-2xl border shrink-0 max-w-full overflow-x-auto no-scrollbar flex-nowrap ${
          isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-800/80 border-slate-700/80'
        }`}>
          {([
            { value: '', label: 'Barchasi' },
            { value: 'Yangilik', label: 'Yangilik' },
            { value: 'Muhim', label: 'Muhim' },
            { value: 'Tadbir', label: 'Tadbir' },
            { value: 'Ogohlantirish', label: 'Ogohlantirish' },
          ] satisfies Array<{ value: '' | AnnouncementType; label: string }>).map((t) => {
            const isActive = typeFilter === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap no-shelf cursor-pointer ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-xs dark:bg-slate-900 dark:text-white'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <SkelList count={4} />
      ) : filtered.length === 0 ? (
        <div className={`rounded-3xl border p-12 text-center ${ui.card}`}>
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-slate-500'}`}>
            <Megaphone size={26} />
          </div>
          <p className={`text-sm font-bold ${ui.strong}`}>
            {announcements.length === 0 ? "Hozircha hech qanday e'lon mavjud emas" : "Qidiruvga mos e'lon topilmadi"}
          </p>
          <p className={`text-xs mt-1 max-w-sm mx-auto ${ui.muted}`}>
            {announcements.length === 0
              ? "Talabalar uchun yangilik, tadbir yoki muhim ogohlantirish yozing."
              : "Boshqa so'z bilan qidirib ko'ring yoki filtrlarni tozalang."}
          </p>
          {announcements.length === 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-xs no-shelf cursor-pointer"
            >
              <Plus size={15} />
              <span>Birinchi e&apos;lonni yozish</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
                  className={`flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-xl transition-all duration-200 hover:shadow-md ${ui.card} ${item.is_published ? '' : 'opacity-75'}`}
                >
                  <div>
                    {/* Card Header: Type badge & Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${chip.chip}`}>
                        <Icon size={13} />
                        {item.type}
                      </span>

                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${pub.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${pub.dot}`} />
                        {item.is_published ? "Talabalarda ko'rinadi" : 'Qoralama'}
                      </span>
                    </div>

                    {/* Title & Body */}
                    <h3 className={`break-words text-sm sm:text-base font-extrabold leading-snug ${ui.strong}`}>
                      {item.title}
                    </h3>
                    <p className={`mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed line-clamp-3 ${ui.muted}`}>
                      {item.text}
                    </p>
                  </div>

                  {/* Footer: Date & Actions */}
                  <div className={`mt-4 flex items-center justify-between gap-2 border-t pt-3.5 ${ui.border}`}>
                    <span className={`flex items-center gap-1.5 text-[11px] font-medium ${ui.muted}`}>
                      <CalendarDays size={13} className="text-slate-400" />
                      {item.is_published ? formatDate(item.published_at ?? item.created_at) : formatDate(item.created_at)}
                    </span>

                    {canManage(item) ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void togglePublished(item)}
                          title={item.is_published ? 'Talabalardan yashirish' : "Talabalarga ko'rsatish"}
                          className={`p-2 rounded-xl border transition-all no-shelf cursor-pointer ${
                            item.is_published
                              ? isLight ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-amber-950/30 text-amber-300 border-amber-800/50 hover:bg-amber-950/50'
                              : isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-950/30 text-emerald-300 border-emerald-800/50 hover:bg-emerald-950/50'
                          }`}
                        >
                          {item.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title="Tahrirlash"
                          className={`p-2 rounded-xl border transition-all no-shelf cursor-pointer ${
                            isLight ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteModal.open(item)}
                          title="O'chirish"
                          className={`p-2 rounded-xl border transition-all no-shelf cursor-pointer ${
                            isLight ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' : 'bg-rose-950/30 text-rose-400 border-rose-900/40 hover:bg-rose-950/50'
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[10px] font-medium ${ui.faint}`}>Boshqa xodim e&apos;loni</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Yangiliklar lentasi (Instagram-style stories) — pastda, alohida bo'lim */}
      <StoryManager isLight={isLight} />

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
            <div className={`grid grid-cols-2 gap-1 rounded-2xl border p-1 sm:grid-cols-4 ${ui.inset}`}>
              {ANNOUNCEMENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type }))}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition-all no-shelf cursor-pointer ${
                    form.type === type
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : `${ui.muted} ${isLight ? 'hover:text-slate-800 hover:bg-slate-200/70' : 'hover:text-slate-200 hover:bg-slate-800/70'}`
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
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all no-shelf cursor-pointer ${
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
