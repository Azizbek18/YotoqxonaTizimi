'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, ImagePlus, Send, Sparkles, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { prepareUploadFile } from '@/lib/prepare-upload'
import { ANNOUNCEMENT_TYPES, type StaffStory, type StoryType } from '@/features/stories/types'
import { createCouncilStory, deleteCouncilStory, fetchCouncilStories } from '@/features/stories/client/api'
import { accentChip } from '@/components/leader/leader-theme'

function hoursLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Muddati tugadi'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h} soat ${m} daq qoldi` : `${m} daqiqa qoldi`
}

/**
 * Kengash raisi's own "story" composer — same 24h image-story channel as
 * dekan/tarbiyachi (`features/stories/*`), restyled for the dark leader
 * command console. Reaches only the raisi's own gender across the faculty
 * (`announcement_stories.target_gender`), unlike dekan's whole-faculty reach.
 */
export default function StoryManager({ isLight, canManage }: { isLight: boolean; canManage: boolean }) {
  const [stories, setStories] = useState<StaffStory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [, forceTick] = useState(0)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [type, setType] = useState<StoryType>('Yangilik')
  const [linkUrl, setLinkUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deleteModal = useConfirmModal<StaffStory>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStories(await fetchCouncilStories())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yangiliklarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const resetForm = () => {
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setTitle('')
    setCaption('')
    setType('Yangilik')
    setLinkUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    if (!picked) return
    const prepared = await prepareUploadFile(picked, { allowPdf: false, maxDimension: 1600 })
    if (!prepared.ok) {
      toast.error(prepared.message)
      return
    }
    setFile(prepared.file)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(prepared.file))
  }

  const handleSubmit = async () => {
    if (saving) return
    if (!file) {
      toast.error('Rasm tanlang')
      return
    }
    if (title.trim().length < 2) {
      toast.error("Sarlavha kamida 2 belgidan iborat bo'lishi kerak")
      return
    }
    setSaving(true)
    try {
      const form = new FormData()
      form.append('image', file)
      form.append('title', title.trim())
      form.append('caption', caption.trim())
      form.append('type', type)
      if (linkUrl.trim()) form.append('link_url', linkUrl.trim())
      const created = await createCouncilStory(form)
      setStories((prev) => [created, ...prev])
      resetForm()
      toast.success("Yangilik joylandi — talabalarga Telegram va push orqali yuborilmoqda")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yangilikni joylab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const target = deleteModal.target
    if (!target) return
    try {
      deleteModal.setIsLoading(true)
      await deleteCouncilStory(target.id)
      setStories((prev) => prev.filter((s) => s.id !== target.id))
      deleteModal.close()
      toast.success("Yangilik o'chirildi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yangilikni o'chirib bo'lmadi")
    } finally {
      deleteModal.setIsLoading(false)
    }
  }

  const inputCls = `min-w-0 w-full rounded-xl border text-xs sm:text-sm px-3 min-[360px]:px-4 py-2.5 transition-all focus:outline-hidden ${
    isLight
      ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400'
      : 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500'
  }`
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400'
  const strongCls = isLight ? 'text-slate-900' : 'text-white'

  return (
    <div className={`no-shelf min-w-0 overflow-hidden rounded-2xl border p-3 min-[360px]:p-4 sm:rounded-3xl sm:p-7 backdrop-blur-xl ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-900/60'}`}>
      <div className="mb-4 flex min-w-0 flex-col justify-between gap-3 min-[360px]:mb-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-2.5 min-[360px]:gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xs min-[360px]:h-11 min-[360px]:w-11 min-[360px]:rounded-2xl">
            <Sparkles size={20} strokeWidth={2.3} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 min-[360px]:gap-2">
              <h2 className={`min-w-0 break-words text-sm font-black leading-snug tracking-tight min-[360px]:text-base sm:text-lg ${strongCls}`}>
                Yangiliklar lentasi (Stories)
              </h2>
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold min-[360px]:px-2 min-[360px]:text-[10px] ${accentChip('indigo', isLight)}`}>
                24 soatlik
              </span>
            </div>
            <p className={`mt-1 break-words text-[11px] leading-relaxed min-[360px]:text-xs ${mutedCls}`}>
              Rasm sizning fakultetingiz talabalarining bosh sahifasida 24 soat &laquo;story&raquo; ko&apos;rinishida turadi va Telegram bot orqali yuboriladi.
            </p>
          </div>
        </div>

        {stories.length > 0 && (
          <div className={`flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`text-xs font-bold ${strongCls}`}>Faol: {stories.length} ta</span>
          </div>
        )}
      </div>

      {canManage && (
        <div className={`grid min-w-0 gap-4 rounded-2xl border p-3 min-[360px]:p-4 sm:grid-cols-12 sm:gap-5 sm:p-5 ${isLight ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-900/40 border-slate-800/80'}`}>
          <div className="sm:col-span-4 lg:col-span-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPickFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex aspect-[9/12] sm:aspect-[9/13] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed text-xs font-semibold transition-all no-shelf cursor-pointer group ${
                preview
                  ? 'border-transparent shadow-md'
                  : isLight
                    ? 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/20'
                    : 'border-slate-700 bg-slate-900/60 hover:border-indigo-500 hover:bg-slate-800/60'
              }`}
            >
              {preview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute bottom-2.5 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md text-xs font-bold text-white shadow-sm">
                    Almashtirish
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                      if (preview) URL.revokeObjectURL(preview)
                      setPreview(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/60 hover:bg-rose-600 text-white transition-all no-shelf cursor-pointer"
                    title="Rasmni olib tashlash"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${accentChip('indigo', isLight)}`}>
                    <ImagePlus size={24} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${strongCls}`}>Rasm yuklash</p>
                    <p className={`text-[10px] mt-0.5 ${mutedCls}`}>9:16 story formati tavsiya etiladi</p>
                  </div>
                </div>
              )}
            </button>
          </div>

          <div className="flex min-w-0 flex-col justify-between space-y-3.5 sm:col-span-8 lg:col-span-9">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>Sarlavha</label>
                  <span className={`text-[10px] ${mutedCls}`}>{title.length}/120</span>
                </div>
                <input
                  type="text"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masalan: Bugun soat 18:00 da uchrashuv"
                  className={inputCls}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>Qisqacha ma&apos;lumot</label>
                  <span className={`text-[10px] ${mutedCls}`}>{caption.length}/500</span>
                </div>
                <textarea
                  value={caption}
                  rows={2}
                  maxLength={500}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Qisqacha tavsif (ixtiyoriy) — ushbu matn Telegram botga ham yuboriladi"
                  className={`resize-none ${inputCls}`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                  Story turi
                </label>
                <div className={`grid min-w-0 grid-cols-2 gap-1 rounded-2xl border p-1 sm:grid-cols-4 ${isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                  {ANNOUNCEMENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`min-w-0 rounded-xl px-1 py-2 text-[9px] font-bold uppercase leading-tight tracking-normal transition-all no-shelf cursor-pointer min-[360px]:px-2 min-[360px]:text-[10px] min-[360px]:tracking-wide sm:px-2.5 sm:text-xs sm:tracking-wider ${
                        type === t
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : `${mutedCls} ${isLight ? 'hover:text-slate-900 hover:bg-slate-100' : 'hover:text-white hover:bg-slate-800/60'}`
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                  Batafsil havola (ixtiyoriy)
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://t.me/... yoki havola manzili"
                  className={inputCls}
                />
              </div>
            </div>

            <div className={`flex min-w-0 flex-col items-stretch justify-end gap-2 pt-2 border-t min-[360px]:flex-row min-[360px]:items-center min-[360px]:gap-2.5 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              {(file || title || caption || linkUrl) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className={`no-shelf cursor-pointer inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-all min-[360px]:px-3.5 min-[360px]:text-xs min-[360px]:tracking-wider ${
                    isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <X size={14} /> <span>Tozalash</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="no-shelf cursor-pointer inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-xs transition-all hover:bg-indigo-500 disabled:opacity-50 min-[360px]:px-5 min-[360px]:text-xs min-[360px]:tracking-wider"
              >
                <Send size={14} />
                <span>{saving ? 'Joylanmoqda...' : 'Joylash va yuborish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`mt-8 pt-6 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
        <div className="mb-4 flex min-w-0 flex-col gap-1.5 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className={`break-words text-[10px] font-black uppercase tracking-wide min-[360px]:text-xs min-[360px]:tracking-wider ${strongCls}`}>
              Faol Stories (24 soatlik)
            </h3>
            {stories.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${accentChip('indigo', isLight)}`}>
                {stories.length} ta
              </span>
            )}
          </div>
          <span className={`break-words text-[10px] leading-relaxed min-[360px]:text-[11px] ${mutedCls}`}>24 soatdan so&apos;ng avtomatik arxivlanadi</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`aspect-[9/13] rounded-2xl animate-pulse border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/50 border-white/10'}`} />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className={`rounded-2xl border border-dashed px-3 py-8 text-center min-[360px]:py-10 ${isLight ? 'border-slate-200 bg-slate-50/50' : 'border-white/10 bg-white/[0.02]'}`}>
            <Sparkles size={24} className="mx-auto text-indigo-400/80 mb-2" />
            <p className={`break-words text-[11px] font-semibold leading-relaxed min-[360px]:text-xs ${mutedCls}`}>
              {canManage
                ? 'Hozircha faol story mavjud emas. Yuqoridagi formadan foydalanib yangi story joylang.'
                : 'Hozircha faol story mavjud emas.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {stories.map((story) => (
              <div
                key={story.id}
                className="group relative aspect-[9/13] rounded-2xl overflow-hidden border border-white/10 shadow-sm hover:shadow-md transition-all duration-200 bg-slate-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={story.image_url}
                  alt={story.title}
                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 z-10">
                  <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[9px] font-extrabold uppercase tracking-wider text-white border border-white/10">
                    {story.type}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => deleteModal.open(story)}
                      aria-label="O'chirish"
                      className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/90 hover:bg-rose-600 hover:text-white transition-all no-shelf cursor-pointer border border-white/10"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="absolute bottom-2.5 inset-x-2.5 z-10 text-white space-y-1">
                  <p className="line-clamp-2 text-xs font-extrabold leading-snug drop-shadow-xs">
                    {story.title}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-200">
                    <Clock size={11} />
                    <span>{hoursLeft(story.expires_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Yangilikni o'chirish"
        description={
          deleteModal.target
            ? `"${deleteModal.target.title}" darhol talabalar lentasidan olib tashlanadi.`
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
