'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Edit3,
  X,
  FileText,
  AlertTriangle,
  Globe,
  School,
  CheckCircle,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { motion, AnimatePresence } from 'framer-motion'

type ElonType = 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish'

interface Elon {
  id: string
  title: string
  text: string
  type: ElonType
  audience: 'all' | 'faculty'
  faculty: string | null
  is_published: boolean
  created_at: string
  published_at: string | null
}

const TYPE_OPTIONS: ElonType[] = ['Yangilik', 'Muhim', 'Tadbir', 'Ogohlantirish']
const FACULTY_OPTIONS = ['Matematika', 'Fizika', 'Iqtisodiyot', 'Dasturiy Injiniring', 'Amaliy Matematika']

const typeClass: Record<ElonType, string> = {
  Yangilik: 'border-blue-400/30 bg-blue-500/10 text-blue-400',
  Muhim: 'border-red-400/30 bg-red-500/10 text-red-400',
  Tadbir: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-400',
  Ogohlantirish: 'border-amber-400/30 bg-amber-500/10 text-amber-400',
}

const typeIcons: Record<ElonType, React.ReactNode> = {
  Yangilik: <Layers size={14} />,
  Muhim: <AlertTriangle size={14} />,
  Tadbir: <CheckCircle size={14} />,
  Ogohlantirish: <AlertTriangle size={14} />,
}

export default function AdminElonlarPage() {
  const [elonlar, setElonlar] = useState<Elon[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Search and Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | ElonType>('all')
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'dorm' | 'faculty'>('all')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingElon, setEditingElon] = useState<Elon | null>(null)

  // Form State
  const [form, setForm] = useState({
    title: '',
    text: '',
    type: 'Yangilik' as ElonType,
    audience: 'all' as 'all' | 'faculty',
    faculty: '',
    is_published: true,
  })

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // Load data
  const loadElonlar = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/elonlar')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? "E'lonlarni yuklashda xatolik")
      }

      setElonlar(result.elonlar ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "E'lonlarni yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadElonlar()
  }, [])

  // Auto-populate form when editing
  useEffect(() => {
    if (editingElon) {
      setForm({
        title: editingElon.title,
        text: editingElon.text,
        type: editingElon.type,
        audience: editingElon.audience,
        faculty: editingElon.faculty || '',
        is_published: editingElon.is_published,
      })
    } else {
      setForm({
        title: '',
        text: '',
        type: 'Yangilik',
        audience: 'all',
        faculty: '',
        is_published: true,
      })
    }
  }, [editingElon, isModalOpen])

  // Filtered announcements
  const filteredElonlar = useMemo(() => {
    let list = elonlar

    // Search query
    const query = search.trim().toLowerCase()
    if (query) {
      list = list.filter((elon) =>
        elon.title.toLowerCase().includes(query) ||
        elon.text.toLowerCase().includes(query) ||
        elon.type.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter === 'published') {
      list = list.filter((e) => e.is_published)
    } else if (statusFilter === 'draft') {
      list = list.filter((e) => !e.is_published)
    }

    // Type filter
    if (typeFilter !== 'all') {
      list = list.filter((e) => e.type === typeFilter)
    }

    // Audience filter
    if (audienceFilter !== 'all') {
      if (audienceFilter === 'dorm') {
        list = list.filter((e) => e.audience === 'all')
      } else {
        list = list.filter((e) => e.audience === 'faculty')
      }
    }

    return list
  }, [elonlar, search, statusFilter, typeFilter, audienceFilter])

  // Stats calculation
  const stats = useMemo(() => {
    const total = elonlar.length
    const published = elonlar.filter((e) => e.is_published).length
    const drafts = total - published
    const urgent = elonlar.filter((e) => e.type === 'Muhim' || e.type === 'Ogohlantirish').length

    return { total, published, drafts, urgent }
  }, [elonlar])

  // Form submission (Create & Edit)
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setSubmitting(true)
      const payload = {
        title: form.title,
        text: form.text,
        type: form.type,
        audience: form.audience,
        faculty: form.audience === 'faculty' ? form.faculty : null,
        is_published: form.is_published,
      }

      if (editingElon) {
        // PATCH
        const response = await fetch('/api/admin/elonlar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingElon.id,
            ...payload,
          }),
        })
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error ?? "E'lonni yangilashda xatolik")
        }

        setElonlar((current) => current.map((item) => (item.id === editingElon.id ? result.elon : item)))
        toast.success("E'lon muvaffaqiyatli yangilandi")
      } else {
        // POST
        const response = await fetch('/api/admin/elonlar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error ?? "E'lon yaratishda xatolik")
        }

        setElonlar((current) => [result.elon, ...current])
        toast.success(form.is_published ? "E'lon talabalarga yuborildi" : "E'lon qoralama sifatida saqlandi")
      }

      setIsModalOpen(false)
      setEditingElon(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi")
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle publish state
  const togglePublished = async (elon: Elon) => {
    try {
      const response = await fetch('/api/admin/elonlar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: elon.id, is_published: !elon.is_published }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Holatni yangilashda xatolik')
      }

      setElonlar((current) => current.map((item) => (item.id === elon.id ? result.elon : item)))
      toast.success(result.elon.is_published ? "E'lon nashr qilindi" : "E'lon nashrdan olindi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Holatni yangilashda xatolik')
    }
  }

  // Delete announcement
  const deleteElon = async (id: string) => {
    if (!confirm("E'lonni o'chirasizmi? Ushbu amal qaytarilmaydi!")) return

    try {
      const response = await fetch(`/api/admin/elonlar?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? "E'lonni o'chirishda xatolik")
      }

      setElonlar((current) => current.filter((elon) => elon.id !== id))
      toast.success("E'lon o'chirildi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "E'lonni o'chirishda xatolik")
    }
  }

  // Theme styles
  const surfaceBg = isLight ? 'bg-white/80 border-slate-200/80 shadow-sm' : 'bg-[#0f172a]/40 border-white/5 shadow-2xl backdrop-blur-xl'
  const cardBg = isLight ? 'bg-white border-slate-200/60 shadow-xs hover:border-purple-300' : 'bg-[#1e293b]/40 border-white/5 hover:border-purple-500/20 hover:bg-[#1e293b]/60'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const textBody = isLight ? 'text-slate-600' : 'text-slate-300'
  const inputBg = isLight ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-purple-500/50' : 'bg-slate-950/40 border-white/10 text-white placeholder-slate-500 focus:bg-slate-950/60 focus:border-purple-500/50'
  const modalBg = isLight ? 'bg-white border-slate-200 shadow-2xl' : 'bg-[#0f172a] border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)]'
  const borderCol = isLight ? 'border-slate-200' : 'border-white/10'

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-1">
      {/* Header section with Stats */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className={`flex items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl ${textStrong}`}>
            <div className="rounded-2xl bg-purple-500/10 p-2.5 text-purple-400 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
              <Megaphone size={28} />
            </div>
            E&apos;lonlar boshqaruvi
          </h1>
          <p className={`mt-2 text-sm ${textMuted}`}>Tizimdagi barcha yangiliklar, tadbirlar va muhim bildirishnomalarni boshqarish</p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            onClick={loadElonlar}
            disabled={loading}
            className={`inline-flex items-center justify-center p-3 rounded-xl border transition-all ${
              isLight ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600' : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
            } disabled:opacity-50`}
            title="Yangilash"
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
            >
              <RefreshCw size={18} />
            </motion.div>
          </button>

          <button
            onClick={() => {
              setEditingElon(null)
              setIsModalOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 px-4 py-3 text-sm font-bold text-white transition-all shadow-lg shadow-purple-500/20 active:scale-95 cursor-pointer"
          >
            <Plus size={18} />
            Yangi e&apos;lon
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Jami e'lonlar",
            value: stats.total,
            icon: <Megaphone className="text-purple-400" size={20} />,
            color: 'from-purple-500/10 to-indigo-500/10 border-purple-500/20 text-purple-400',
          },
          {
            title: 'Chop etilganlar',
            value: stats.published,
            icon: <CheckCircle className="text-emerald-400" size={20} />,
            color: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-400',
          },
          {
            title: 'Qoralamalar',
            value: stats.drafts,
            icon: <FileText className="text-slate-400" size={20} />,
            color: 'from-slate-500/10 to-zinc-500/10 border-slate-500/20 text-slate-400',
          },
          {
            title: 'Muhimlar',
            value: stats.urgent,
            icon: <AlertTriangle className="text-amber-400" size={20} />,
            color: 'from-amber-500/10 to-rose-500/10 border-amber-500/20 text-amber-400',
          },
        ].map((item, index) => (
          <div
            key={index}
            className={`rounded-2xl border p-5 bg-gradient-to-br ${item.color} backdrop-blur-md flex items-center justify-between shadow-xs`}
          >
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>{item.title}</p>
              <h3 className={`mt-2 text-2xl font-black ${textStrong}`}>{item.value}</h3>
            </div>
            <div className={`p-3 rounded-xl bg-white/5 border border-white/10`}>
              {item.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar & Filters */}
      <div className={`rounded-2xl border p-4 backdrop-blur-xl ${surfaceBg}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          
          {/* Search bar */}
          <div className={`flex items-center gap-3 rounded-xl border px-3 py-1 flex-1 max-w-md ${inputBg}`}>
            <Search size={18} className={textMuted} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Sarlavha yoki matn bo'yicha izlash..."
              className="w-full bg-transparent py-2 text-sm outline-none text-inherit"
            />
            {search && (
              <button onClick={() => setSearch('')} className={`p-1 hover:text-white transition ${textMuted}`}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtering controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Pills */}
            <div className={`flex rounded-xl p-1 border ${borderCol} bg-slate-950/20`}>
              {([
                { id: 'all', label: 'Barchasi' },
                { id: 'published', label: 'Faol' },
                { id: 'draft', label: 'Qoralama' }
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    statusFilter === tab.id
                      ? 'bg-purple-600 text-white shadow-xs'
                      : `text-slate-400 hover:${textStrong}`
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Type dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | ElonType)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold outline-none transition cursor-pointer ${inputBg}`}
            >
              <option value="all">Barcha Turlar</option>
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type} className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>{type}</option>
              ))}
            </select>

            {/* Audience filter */}
            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value as 'all' | 'dorm' | 'faculty')}
              className={`rounded-xl border px-3 py-2 text-xs font-bold outline-none transition cursor-pointer ${inputBg}`}
            >
              <option value="all">Barcha Auditoriya</option>
              <option value="dorm">Yotoqxona (Barchaga)</option>
              <option value="faculty">Fakultet bo&apos;yicha</option>
            </select>
          </div>

        </div>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 border border-dashed rounded-3xl border-purple-500/10">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            className="text-purple-500 mb-4"
          >
            <RefreshCw size={36} />
          </motion.div>
          <span className={`text-sm ${textMuted}`}>Ma&apos;lumotlar yuklanmoqda...</span>
        </div>
      ) : filteredElonlar.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 border border-dashed rounded-3xl border-slate-500/20 text-center">
          <Megaphone className="text-slate-500/30 mb-4" size={48} />
          <h3 className={`text-lg font-bold ${textStrong}`}>Hech qanday e&apos;lon topilmadi</h3>
          <p className={`text-xs mt-1 max-w-sm ${textMuted}`}>Qidiruv shartlarini o&apos;zgartirib ko&apos;ring yoki yangi e&apos;lon yarating.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredElonlar.map((elon) => (
            <motion.article
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              key={elon.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all group ${cardBg}`}
            >
              <div>
                {/* Meta details */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category tag */}
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${typeClass[elon.type]}`}>
                      {typeIcons[elon.type]}
                      {elon.type}
                    </span>

                    {/* Target tag */}
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      elon.audience === 'faculty'
                        ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                        : 'border-sky-500/30 bg-sky-500/10 text-sky-400'
                    }`}>
                      {elon.audience === 'faculty' ? <School size={10} /> : <Globe size={10} />}
                      {elon.audience === 'faculty' ? elon.faculty : 'Barchaga'}
                    </span>
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${elon.is_published ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${elon.is_published ? 'text-emerald-400' : textMuted}`}>
                      {elon.is_published ? 'Faol' : 'Qoralama'}
                    </span>
                  </div>
                </div>

                {/* Title and body */}
                <h3 className={`text-lg font-bold group-hover:text-purple-400 transition-colors line-clamp-2 ${textStrong}`}>
                  {elon.title}
                </h3>
                <p className={`mt-3 text-sm leading-relaxed whitespace-pre-line line-clamp-5 ${textBody}`}>
                  {elon.text}
                </p>
              </div>

              {/* Card Footer */}
              <div className={`mt-6 pt-4 border-t ${borderCol} flex items-center justify-between gap-4`}>
                <div className="min-w-0">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Yaratilgan sana</p>
                  <p className={`text-xs font-semibold ${textStrong}`}>
                    {new Date(elon.created_at).toLocaleString('uz-UZ', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-1.5">
                  {/* Publish/Hide button */}
                  <button
                    onClick={() => togglePublished(elon)}
                    className={`rounded-lg p-2 border transition-colors ${
                      elon.is_published
                        ? isLight
                          ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700'
                          : 'border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
                        : isLight
                          ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          : 'border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                    }`}
                    title={elon.is_published ? "Nashrdan olish (Qoralamaga o'tkazish)" : "Chop etish (Faollashtirish)"}
                  >
                    {elon.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>

                  {/* Edit button */}
                  <button
                    onClick={() => {
                      setEditingElon(elon)
                      setIsModalOpen(true)
                    }}
                    className={`rounded-lg p-2 border transition-colors ${
                      isLight
                        ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white hover:border-white/20'
                    }`}
                    title="Tahrirlash"
                  >
                    <Edit3 size={15} />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => deleteElon(elon.id)}
                    className={`rounded-lg p-2 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors active:scale-95`}
                    title="O'chirish"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {/* Creation / Editing Modal Dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false)
                setEditingElon(null)
              }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className={`relative z-10 w-full max-w-2xl rounded-3xl border p-6 overflow-hidden ${modalBg}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4 mb-5 border-white/5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20">
                    {editingElon ? <Edit3 size={20} /> : <Plus size={20} />}
                  </div>
                  <div>
                    <h3 className={`text-lg font-black ${textStrong}`}>
                      {editingElon ? "E'lonni tahrirlash" : "Yangi e'lon yaratish"}
                    </h3>
                    <p className={`text-xs ${textMuted}`}>
                      {editingElon ? "Mavjud e'lon ma'lumotlarini o'zgartirish" : "Yotoqxona talabalari uchun yangi bildirishnoma loyihasi"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingElon(null)
                  }}
                  className={`rounded-lg p-1.5 transition ${
                    isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Sarlavha</label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Sarlavha (Kamida 3 ta belgi)"
                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${inputBg}`}
                    required
                  />
                </div>

                {/* Grid inputs (Type and Audience) */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>E&apos;lon turi</label>
                    <select
                      value={form.type}
                      onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as ElonType }))}
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition cursor-pointer ${inputBg}`}
                    >
                      {TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type} className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Maqsadli auditoriya</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, audience: 'all', faculty: '' }))}
                        className={`rounded-xl border py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                          form.audience === 'all'
                            ? 'border-purple-600 bg-purple-600 text-white shadow-md'
                            : isLight
                              ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                              : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        Barchaga
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, audience: 'faculty', faculty: current.faculty || FACULTY_OPTIONS[0] }))}
                        className={`rounded-xl border py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                          form.audience === 'faculty'
                            ? 'border-purple-600 bg-purple-600 text-white shadow-md'
                            : isLight
                              ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                              : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        Fakultet
                      </button>
                    </div>
                  </div>
                </div>

                {/* Faculty selection (conditionally rendered) */}
                {form.audience === 'faculty' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Fakultetni tanlang</label>
                    <select
                      value={form.faculty || ''}
                      onChange={(event) => setForm((current) => ({ ...current, faculty: event.target.value }))}
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition cursor-pointer ${inputBg}`}
                    >
                      {FACULTY_OPTIONS.map((faculty) => (
                        <option key={faculty} value={faculty} className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>{faculty}</option>
                      ))}
                    </select>
                  </motion.div>
                )}

                {/* Text Content */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>Xabar matni</label>
                  <textarea
                    value={form.text}
                    onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
                    placeholder="Talabalarga yuboriladigan xabar matni (Kamida 5 ta belgi)"
                    rows={5}
                    className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition ${inputBg}`}
                    required
                  />
                </div>

                {/* Publish Switch */}
                <label className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                }`}>
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${textStrong}`}>Darhol nashr etilsinmi?</span>
                    <p className={`text-[10px] ${textMuted} mt-0.5`}>Agar faollashtirilsa, talabalarning dashboardida zudlik bilan ko&apos;rinadi.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))}
                    className="h-5 w-5 rounded-lg accent-purple-600 cursor-pointer"
                  />
                </label>

                {/* Submit / Cancel Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false)
                      setEditingElon(null)
                    }}
                    className={`rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-wider transition ${
                      isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    Bekor qilish
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-purple-500/20 active:scale-95 cursor-pointer"
                  >
                    <Send size={14} />
                    {submitting ? 'Saqlanmoqda...' : editingElon ? 'Saqlash' : 'Nashr qilish'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
