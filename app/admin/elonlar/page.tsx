'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Megaphone, Plus, RefreshCw, Search, Send, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'

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
  Yangilik: 'border-blue-400 bg-blue-500/10 text-blue-300',
  Muhim: 'border-red-400 bg-red-500/10 text-red-300',
  Tadbir: 'border-emerald-400 bg-emerald-500/10 text-emerald-300',
  Ogohlantirish: 'border-amber-400 bg-amber-500/10 text-amber-300',
}

export default function AdminElonlarPage() {
  const [elonlar, setElonlar] = useState<Elon[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
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

  const filteredElonlar = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return elonlar

    return elonlar.filter((elon) =>
      elon.title.toLowerCase().includes(query) ||
      elon.text.toLowerCase().includes(query) ||
      elon.type.toLowerCase().includes(query)
    )
  }, [elonlar, search])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setSubmitting(true)
      const response = await fetch('/api/admin/elonlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          faculty: form.audience === 'faculty' ? form.faculty : null,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? "E'lon yuborishda xatolik")
      }

      setElonlar((current) => [result.elon, ...current])
      setForm({ title: '', text: '', type: 'Yangilik', audience: 'all', faculty: '', is_published: true })
      toast.success(form.is_published ? "E'lon talabalarga yuborildi" : "E'lon qoralama sifatida saqlandi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "E'lon yuborishda xatolik")
    } finally {
      setSubmitting(false)
    }
  }

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

  const deleteElon = async (id: string) => {
    if (!confirm("E'lonni o'chirasizmi?")) return

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

  const surface = isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-white/[0.04] text-white'
  const input = isLight
    ? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
    : 'border-white/10 bg-slate-950/40 text-white placeholder:text-slate-500'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.24em] ${muted}`}>Admin xabarlari</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">E&apos;lonlar</h1>
        </div>
        <button
          type="button"
          onClick={loadElonlar}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${surface}`}
        >
          <RefreshCw size={16} />
          Yangilash
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className={`rounded-2xl border p-5 shadow-sm ${surface}`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-3 text-white">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black">Yangi e&apos;lon</h2>
              <p className={`text-sm ${muted}`}>Nashr qilinganda talaba sahifasida ko&apos;rinadi.</p>
            </div>
          </div>

          <div className="space-y-4">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Sarlavha"
              className={`w-full rounded-xl border px-4 py-3 outline-none transition focus:border-blue-500 ${input}`}
            />

            <textarea
              value={form.text}
              onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
              placeholder="Talabalarga yuboriladigan xabar matni"
              rows={7}
              className={`w-full resize-none rounded-xl border px-4 py-3 outline-none transition focus:border-blue-500 ${input}`}
            />

            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as ElonType }))}
              className={`w-full rounded-xl border px-4 py-3 outline-none transition focus:border-blue-500 ${input}`}
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, audience: 'all', faculty: '' }))}
                className={`rounded-xl border px-4 py-3 text-sm font-black transition ${form.audience === 'all' ? 'border-blue-500 bg-blue-600 text-white' : input}`}
              >
                Yotoqxona
              </button>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, audience: 'faculty', faculty: current.faculty || FACULTY_OPTIONS[0] }))}
                className={`rounded-xl border px-4 py-3 text-sm font-black transition ${form.audience === 'faculty' ? 'border-emerald-500 bg-emerald-600 text-white' : input}`}
              >
                Fakultet
              </button>
            </div>

            {form.audience === 'faculty' && (
              <select
                value={form.faculty}
                onChange={(event) => setForm((current) => ({ ...current, faculty: event.target.value }))}
                className={`w-full rounded-xl border px-4 py-3 outline-none transition focus:border-emerald-500 ${input}`}
              >
                {FACULTY_OPTIONS.map((faculty) => (
                  <option key={faculty} value={faculty}>{faculty}</option>
                ))}
              </select>
            )}

            <label className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
              <span className="text-sm font-bold">Darhol talabalarga ko&apos;rsatish</span>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))}
                className="h-5 w-5 accent-blue-600"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={18} />
              {submitting ? 'Yuborilmoqda...' : 'E&apos;lon yuborish'}
            </button>
          </div>
        </form>

        <section className={`rounded-2xl border p-5 shadow-sm ${surface}`}>
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black">Mavjud e&apos;lonlar</h2>
              <p className={`text-sm ${muted}`}>{elonlar.filter((elon) => elon.is_published).length} ta nashr qilingan</p>
            </div>
            <div className={`flex items-center gap-2 rounded-xl border px-3 ${input}`}>
              <Search size={16} className={muted} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Qidirish"
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className={`rounded-xl border p-8 text-center ${muted}`}>Yuklanmoqda...</div>
          ) : filteredElonlar.length === 0 ? (
            <div className={`rounded-xl border p-8 text-center ${muted}`}>
              <Megaphone className="mx-auto mb-3" size={28} />
              E&apos;lon topilmadi
            </div>
          ) : (
            <div className="space-y-3">
              {filteredElonlar.map((elon) => (
                <article key={elon.id} className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/10 bg-slate-950/25'}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${typeClass[elon.type]}`}>{elon.type}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${elon.is_published ? 'border-emerald-400/40 text-emerald-400' : 'border-slate-400/40 text-slate-400'}`}>
                          {elon.is_published ? 'Nashr qilingan' : 'Qoralama'}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${elon.audience === 'faculty' ? 'border-emerald-400/40 text-emerald-400' : 'border-sky-400/40 text-sky-400'}`}>
                          {elon.audience === 'faculty' ? elon.faculty : 'Yotoqxona'}
                        </span>
                      </div>
                      <h3 className="text-lg font-black">{elon.title}</h3>
                      <p className={`mt-2 line-clamp-2 text-sm leading-6 ${muted}`}>{elon.text}</p>
                      <p className={`mt-3 text-xs font-semibold ${muted}`}>
                        {new Date(elon.created_at).toLocaleString('uz-UZ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => togglePublished(elon)}
                        className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${isLight ? 'border-slate-200 bg-white hover:bg-slate-100' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}
                      >
                        {elon.is_published ? 'Yashirish' : 'Nashr'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteElon(elon.id)}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/15"
                        aria-label="O'chirish"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
