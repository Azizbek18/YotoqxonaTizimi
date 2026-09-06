'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock, ImagePlus, Send, Sparkles, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'
import { dekanUI, statusChip, type DekanStatusTone } from '@/lib/dekan-ui'
import { permitFacultyLabel } from '@/lib/faculties'
import { prepareUploadFile } from '@/lib/prepare-upload'
import { ANNOUNCEMENT_TYPES, type StaffStory, type StoryType } from '@/features/stories/types'
import { createStaffStory, deleteStaffStory, fetchStaffStories } from '@/features/stories/client/api'

const TYPE_TONE: Record<StoryType, DekanStatusTone> = {
  Muhim: 'danger',
  Ogohlantirish: 'warning',
  Tadbir: 'info',
  Yangilik: 'neutral',
}

function hoursLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Muddati tugadi'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h} soat ${m} daq qoldi` : `${m} daqiqa qoldi`
}

export default function StoryManager({ isLight }: { isLight: boolean }) {
  const ui = dekanUI(isLight)
  const { id: myStaffId, faculty } = useDekanScope()
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

  const inputCls = `w-full rounded-lg border text-sm px-4 py-3 transition-colors ${ui.input} ${ui.ring}`
  const facultyLabel = useMemo(
    () => (faculty ? permitFacultyLabel(faculty) || faculty.toUpperCase() : 'fakultetingiz'),
    [faculty],
  )

  return (
    <div className={`rounded-2xl border p-5 ${ui.card}`}>
      <div className="mb-4 flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
          <Sparkles size={18} strokeWidth={2.2} />
        </div>
        <div>
          <h2 className={`text-base font-bold tracking-tight ${ui.strong}`}>Yangiliklar lentasi</h2>
          <p className={`mt-0.5 text-xs ${ui.muted}`}>
            Rasm <span className={ui.accentText}>{facultyLabel}</span> talabalarining bosh sahifasida 24 soat
            «story» ko&apos;rinishida turadi va Telegram bot + ilova push orqali yuboriladi.
          </p>
        </div>
      </div>

      {/* Create form */}
      <div className={`grid gap-3 rounded-xl border p-4 sm:grid-cols-[160px_1fr] ${ui.inset}`}>
        <div>
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
            className={`relative flex aspect-[9/12] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed text-xs font-semibold transition-colors ${ui.border} ${ui.muted} ${isLight ? 'bg-white hover:bg-slate-50' : 'bg-slate-900/40 hover:bg-slate-800/40'}`}
          >
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute bottom-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white">
                  Almashtirish
                </span>
              </>
            ) : (
              <span className="flex flex-col items-center gap-1.5">
                <ImagePlus size={22} />
                Rasm tanlash
              </span>
            )}
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sarlavha (masalan: Bugun soat 18:00 da uchrashuv)"
            className={inputCls}
          />
          <textarea
            value={caption}
            rows={3}
            maxLength={500}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Qisqacha ma'lumot (ixtiyoriy) — shu matn Telegramga ham boradi"
            className={`resize-none ${inputCls}`}
          />
          <div className={`grid grid-cols-2 gap-1 rounded-lg border p-1 sm:grid-cols-4 ${ui.inset}`}>
            {ANNOUNCEMENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-md px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  type === t ? 'bg-indigo-600 text-white' : `${ui.muted} ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-200'}`
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Batafsil havola (ixtiyoriy, https://...)"
            className={inputCls}
          />
          <div className="flex items-center justify-end gap-2">
            {(file || title || caption) && (
              <button
                type="button"
                onClick={resetForm}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider ${ui.btnGhost}`}
              >
                <X size={14} /> Tozalash
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider ${ui.accentSolid}`}
            >
              <Send size={14} />
              {saving ? 'Joylanmoqda...' : 'Joylash va yuborish'}
            </button>
          </div>
        </div>
      </div>

      {/* Active stories */}
      <div className="mt-5">
        <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
          Faol yangiliklar {stories.length > 0 && `(${stories.length})`}
        </p>
        {loading ? (
          <p className={`py-6 text-center text-xs ${ui.faint}`}>Yuklanmoqda...</p>
        ) : stories.length === 0 ? (
          <p className={`rounded-xl border border-dashed py-8 text-center text-xs ${ui.border} ${ui.faint}`}>
            Hozircha faol yangilik yo&apos;q.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stories.map((story) => {
              const chip = statusChip(TYPE_TONE[story.type] ?? 'neutral', isLight)
              return (
                <div key={story.id} className={`overflow-hidden rounded-xl border ${ui.border}`}>
                  <div className="relative aspect-[9/12]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={story.image_url} alt={story.title} className="absolute inset-0 h-full w-full object-cover" />
                    {canDelete(story) && (
                      <button
                        type="button"
                        onClick={() => deleteModal.open(story)}
                        aria-label="O'chirish"
                        className="absolute right-1.5 top-1.5 rounded-lg bg-black/55 p-1.5 text-white transition-colors hover:bg-rose-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      {story.type}
                    </span>
                  </div>
                  <div className="space-y-1 p-2">
                    <p className={`line-clamp-1 text-xs font-semibold ${ui.strong}`}>{story.title}</p>
                    <p className={`flex items-center gap-1 text-[10px] ${chip.text}`}>
                      <Clock size={10} /> {hoursLeft(story.expires_at)}
                    </p>
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
