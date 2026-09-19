'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock, ImagePlus, Send, Sparkles, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'
import { dekanUI } from '@/lib/dekan-ui'
import { permitFacultyLabel } from '@/lib/faculties'
import { prepareUploadFile } from '@/lib/prepare-upload'
import { ANNOUNCEMENT_TYPES, type StaffStory, type StoryType } from '@/features/stories/types'
import { createStaffStory, deleteStaffStory, fetchStaffStories } from '@/features/stories/client/api'

function hoursLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Muddati tugadi'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h} soat ${m} daq qoldi` : `${m} daqiqa qoldi`
}

export default function StoryManager({ isLight }: { isLight: boolean }) {
  const ui = dekanUI(isLight)
  const { id: myStaffId, effectiveFaculty: faculty } = useDekanScope()
  const { canManageAnyAnnouncement } = useStaffPanel()
  const canDelete = (story: StaffStory) =>
    canManageAnyAnnouncement || (!!myStaffId && story.created_by === myStaffId)

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
      setStories(await fetchStaffStories())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yangiliklarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Keep the "… qoldi" countdowns fresh.
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
      const created = await createStaffStory(form)
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
      await deleteStaffStory(target.id)
      setStories((prev) => prev.filter((s) => s.id !== target.id))
      deleteModal.close()
      toast.success("Yangilik o'chirildi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yangilikni o'chirib bo'lmadi")
    } finally {
      deleteModal.setIsLoading(false)
    }
  }

  const inputCls = `w-full rounded-xl border text-xs sm:text-sm px-4 py-2.5 transition-all focus:outline-hidden focus:border-indigo-500 ${ui.input}`
  const facultyLabel = useMemo(
    () => (faculty ? permitFacultyLabel(faculty) || faculty.toUpperCase() : 'fakultetingiz'),
    [faculty],
  )

  return (
    <div className={`rounded-3xl border p-5 sm:p-7 backdrop-blur-xl transition-all duration-200 ${ui.card}`}>
      {/* Section Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xs">
            <Sparkles size={20} strokeWidth={2.3} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-base sm:text-lg font-black tracking-tight ${ui.strong}`}>
                Yangiliklar lentasi (Stories)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                24 soatlik
              </span>
            </div>
            <p className={`mt-0.5 text-xs ${ui.muted}`}>
              Rasm <span className={`font-semibold ${ui.accentText}`}>{facultyLabel}</span> talabalarining bosh sahifasida 24 soat «story» ko&apos;rinishida turadi va Telegram bot orqali yuboriladi.
            </p>
          </div>
        </div>

        {stories.length > 0 && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-200/70 dark:border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`text-xs font-bold ${ui.strong}`}>Faol: {stories.length} ta</span>
          </div>
        )}
      </div>

      {/* Story Creator Box */}
      <div className={`rounded-2xl border p-4 sm:p-5 ${isLight ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-900/40 border-slate-800/80'} grid gap-5 sm:grid-cols-12`}>
        {/* Left Column: Image Picker */}
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
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ImagePlus size={24} />
                </div>
                <div>
                  <p className={`text-xs font-bold ${ui.strong}`}>Rasm yuklash</p>
                  <p className={`text-[10px] mt-0.5 ${ui.muted}`}>9:16 story formati tavsiya etiladi</p>
                </div>
              </div>
            )}
          </button>
        </div>

        {/* Right Column: Form Inputs */}
        <div className="sm:col-span-8 lg:col-span-9 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Sarlavha</label>
                <span className={`text-[10px] ${ui.muted}`}>{title.length}/120</span>
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
                <label className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Qisqacha ma&apos;lumot</label>
                <span className={`text-[10px] ${ui.muted}`}>{caption.length}/500</span>
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
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>
                Story turi
              </label>
              <div className={`grid grid-cols-2 gap-1 rounded-2xl border p-1 sm:grid-cols-4 ${ui.inset}`}>
                {ANNOUNCEMENT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-xl px-2.5 py-2 text-xs font-bold uppercase tracking-wider transition-all no-shelf cursor-pointer ${
                      type === t
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : `${ui.muted} ${isLight ? 'hover:text-slate-900 hover:bg-slate-200/60' : 'hover:text-white hover:bg-slate-800/60'}`
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>
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

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
            {(file || title || caption || linkUrl) && (
              <button
                type="button"
                onClick={resetForm}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-all no-shelf cursor-pointer ${ui.btnGhost}`}
              >
                <X size={14} /> <span>Tozalash</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all shadow-xs no-shelf cursor-pointer disabled:opacity-50"
            >
              <Send size={14} />
              <span>{saving ? 'Joylanmoqda...' : 'Joylash va yuborish'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active stories */}
      <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
              Faol Stories (24 soatlik)
            </h3>
            {stories.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                {stories.length} ta
              </span>
            )}
          </div>
          <span className={`text-[11px] ${ui.muted}`}>
            24 soatdan so&apos;ng avtomatik arxivlanadi
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[9/13] rounded-2xl bg-slate-100 dark:bg-slate-800/50 animate-pulse border border-slate-200/60 dark:border-slate-800/60" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className={`rounded-2xl border border-dashed py-10 text-center ${isLight ? 'border-slate-200 bg-slate-50/50' : 'border-slate-800 bg-slate-900/20'}`}>
            <Sparkles size={24} className="mx-auto text-indigo-400/80 mb-2" />
            <p className={`text-xs font-semibold ${ui.muted}`}>
              Hozircha faol story mavjud emas. Yuqoridagi formadan foydalanib yangi story joylang.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {stories.map((story) => {
              return (
                <div
                  key={story.id}
                  className="group relative aspect-[9/13] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 bg-slate-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={story.image_url}
                    alt={story.title}
                    className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Top gradient scrim */}
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

                  {/* Bottom gradient scrim */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 z-10">
                    <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[9px] font-extrabold uppercase tracking-wider text-white border border-white/10">
                      {story.type}
                    </span>
                    {canDelete(story) && (
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

                  {/* Bottom Content */}
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
              )
            })}
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
