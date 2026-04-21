'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Mail, Phone, GraduationCap, Home,
  ShieldCheck, LogOut, Camera, Edit2, Lock,
  X, Eye, EyeOff, Check, AlertCircle, Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  faculty?: string
  role?: string
  room_number?: string
  course?: string | number
  group?: string | number
  avatar_url?: string
}

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
}

const modalAnim = {
  hidden: { opacity: 0, scale: 0.95, y: 24 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.18 } },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
type StepState = 'done' | 'active' | 'todo'

function Timeline({ course }: { course: number }) {
  const steps = [1, 2, 3, 4].map(n => ({
    n, year: String(2021 + n),
    state: (course > n ? 'done' : course === n ? 'active' : 'todo') as StepState,
  }))
  const cls: Record<StepState, string> = {
    done: 'bg-blue-700 text-blue-200',
    active: 'bg-violet-600 text-white ring-4 ring-violet-500/25',
    todo: 'bg-slate-800 text-slate-600',
  }
  return (
    <div className="flex items-start w-full">
      {steps.map((s, i) => (
        <div key={s.n} className="flex-1 flex flex-col items-center relative">
          {i < 3 && <div className="absolute top-4 left-1/2 w-full h-px bg-white/[0.05]" />}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black z-10 mb-1.5 ${cls[s.state]}`}>
            {s.n}
          </div>
          <p className={`text-[10px] font-bold ${s.state === 'active' ? 'text-violet-400' : 'text-slate-600'}`}>
            {s.n}-kurs
          </p>
          <p className="text-[9px] text-slate-700">{s.year}</p>
        </div>
      ))}
    </div>
  )
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, bg, color }: {
  icon: React.ReactNode; label: string; value: string; bg: string; color: string
}) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
        style={{ background: bg, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.18em] mb-0.5">{label}</p>
        <p className="text-sm font-bold text-slate-100 truncate">{value}</p>
      </div>
    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        variants={modalAnim} initial="hidden" animate="show" exit="exit"
        className="w-full max-w-md bg-[#0f1829] border border-white/10 rounded-[28px] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06]">
      <h2 className="text-base font-black uppercase tracking-wider text-white">{title}</h2>
      <button onClick={onClose}
        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
        <X size={16} className="text-slate-400" />
      </button>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ profile, onClose, onSave }: {
  profile: Profile
  onClose: () => void
  onSave: (data: Partial<Profile>) => Promise<void>
}) {
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    faculty: profile.faculty || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!form.full_name.trim()) { toast.error("Ism bo'sh bo'lishi mumkin emas!"); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Ma'lumot tahrirlash" onClose={onClose} />
      <div className="px-6 py-5 space-y-4">
        {[
          { key: 'full_name', label: "To'liq ism", placeholder: 'Ism Familiya', type: 'text' },
          { key: 'phone', label: 'Telefon raqam', placeholder: '+998 90 123 45 67', type: 'tel' },
          { key: 'faculty', label: 'Fakultet', placeholder: 'Dasturiy injiniring', type: 'text' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5">
              {f.label}
            </label>
            <input
              type={f.type}
              value={form[f.key as keyof typeof form]}
              placeholder={f.placeholder}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full bg-[#0b1120] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>
        ))}
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/[0.08] text-slate-400 text-sm font-bold hover:bg-white/10 transition-all active:scale-95">
          Bekor qilish
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Avatar Modal ─────────────────────────────────────────────────────────────
function AvatarModal({ currentAvatar, fullName, onClose, onSave }: {
  currentAvatar?: string
  fullName: string
  onClose: () => void
  onSave: (file: File) => Promise<void>
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Faqat rasm fayllar!'); return }
    if (f.size > 5 * 1024 * 1024) { toast.error('5MB dan katta bo\'lmasin!'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleUpload = async () => {
    if (!file) return
    setSaving(true)
    await onSave(file)
    setSaving(false)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Rasm yuklash" onClose={onClose} />
      <div className="px-6 py-5 space-y-5">
        {/* Preview ring */}
        <div className="flex justify-center">
          <div className="w-28 h-28 rounded-full p-[2px]"
            style={{ background: 'linear-gradient(135deg, #2563eb, #6366f1)' }}>
            <div className="w-full h-full rounded-full bg-[#020617] flex items-center justify-center overflow-hidden">
              {(preview || currentAvatar) ? (
                <img src={preview || currentAvatar} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-indigo-400/40">{getInitials(fullName)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-white/[0.08] hover:border-blue-500/40 hover:bg-white/[0.02]'
            }`}
        >
          <Camera size={24} className="mx-auto mb-2 text-slate-500" />
          <p className="text-sm font-bold text-slate-400">
            {preview ? 'Boshqa rasm tanlash' : 'Rasm tanlash yoki sudrab tashlang'}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">JPG, PNG — max 5MB</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/[0.08] text-slate-400 text-sm font-bold hover:bg-white/10 transition-all active:scale-95">
          Bekor qilish
        </button>
        <button onClick={handleUpload} disabled={!file || saving}
          className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Yuklanmoqda...' : 'Saqlash'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Password Modal ───────────────────────────────────────────────────────────
function PasswordModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [saving, setSaving] = useState(false)
  const [strength, setStrength] = useState(0)

  const calcStrength = (pw: string) => {
    let s = 0
    if (pw.length >= 8) s++
    if (/[A-Z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    return s
  }

  const strengthLabel = ['', 'Zaif', "O'rtacha", 'Yaxshi', 'Kuchli']
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']

  const handleSubmit = async () => {
    if (!form.current) { toast.error('Joriy parolni kiriting!'); return }
    if (form.next.length < 8) { toast.error('Yangi parol kamida 8 belgi!'); return }
    if (form.next !== form.confirm) { toast.error('Parollar mos kelmaydi!'); return }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: form.next })
      if (error) throw error
      toast.success("Parol muvaffaqiyatli o'zgartirildi!")
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Xatolik yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: 'current', label: 'Joriy parol', placeholder: '••••••••' },
    { key: 'next', label: 'Yangi parol', placeholder: 'Kamida 8 belgi' },
    { key: 'confirm', label: 'Yangi parolni tasdiqlang', placeholder: '••••••••' },
  ]

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Parol o'zgartirish" onClose={onClose} />
      <div className="px-6 py-5 space-y-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5">
              {f.label}
            </label>
            <div className="relative">
              <input
                type={show[f.key as keyof typeof show] ? 'text' : 'password'}
                value={form[f.key as keyof typeof form]}
                placeholder={f.placeholder}
                onChange={e => {
                  setForm(prev => ({ ...prev, [f.key]: e.target.value }))
                  if (f.key === 'next') setStrength(calcStrength(e.target.value))
                }}
                className="w-full bg-[#0b1120] border border-white/[0.08] rounded-2xl px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShow(prev => ({ ...prev, [f.key]: !prev[f.key as keyof typeof show] }))}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {show[f.key as keyof typeof show] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength indicator */}
            {f.key === 'next' && form.next && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                      style={{ background: i <= strength ? strengthColor[strength] : 'rgba(255,255,255,0.06)' }} />
                  ))}
                </div>
                <p className="text-[10px] font-bold" style={{ color: strengthColor[strength] }}>
                  {strengthLabel[strength]}
                </p>
              </div>
            )}

            {/* Mismatch warning */}
            {f.key === 'confirm' && form.confirm && form.next !== form.confirm && (
              <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1">
                <AlertCircle size={12} /> Parollar mos kelmaydi
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/[0.08] text-slate-400 text-sm font-bold hover:bg-white/10 transition-all active:scale-95">
          Bekor qilish
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          {saving ? 'Saqlanmoqda...' : "O'zgartirish"}
        </button>
      </div>
    </Modal>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
type ModalType = 'edit' | 'avatar' | 'password' | null

export default function StudentProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data, error } = await supabase
          .from('profiles').select('*').eq('id', user.id).single()
        if (error) throw error
        setProfile(data)
      } catch (err: unknown) {
        toast.error('Profilni yuklashda xatolik!')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Ma'lumot saqlash
  const handleSaveEdit = async (data: Partial<Profile>) => {
    if (!profile) return
    try {
      const { error } = await supabase
        .from('profiles').update(data).eq('id', profile.id)
      if (error) throw error
      setProfile(prev => prev ? { ...prev, ...data } : prev)
      toast.success("Ma'lumotlar saqlandi!")
    } catch {
      toast.error('Saqlashda xatolik!')
    }
  }

  // Rasm yuklash — "avatars" bucket kerak (loyiha boshlig'i yaratadi)
  const handleSaveAvatar = async (file: File) => {
    if (!profile) return
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/avatar.${ext}`

      const { error: upErr } = await supabase.storage
        .from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage
        .from('avatars').getPublicUrl(path)

      const { error: dbErr } = await supabase
        .from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id)
      if (dbErr) throw dbErr

      setProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : prev)
      toast.success('Rasm yangilandi!')
    } catch {
      toast.error('Rasm yuklash     da xatolik! (Storage bucket kerak)')
    }
  }

  if (loading) return <Skeleton />

  const fullName = profile?.full_name || 'Mastura'
  const faculty = profile?.faculty || 'AMIT'
  const role = profile?.role || 'Talaba'
  const email = profile?.email || 'mastura@gmail.com'
  const phone = profile?.phone || '+998 50 079 26 07'
  const roomNumber = profile?.room_number || '66'
  const course = Number(profile?.course ?? 1)
  const group = profile?.group ? String(profile.group) : '25-01'

  return (
    <>
      <div className="space-y-4">

        {/* ── Header ── */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show"
          className="flex items-center justify-between pt-2 pb-4 border-b border-white/[0.05]">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">
            Shaxsiy<br />Profil
          </h1>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-[11px] font-black uppercase tracking-wide hover:bg-rose-500 hover:text-white transition-all active:scale-95">
            <LogOut size={14} /> Chiqish
          </button>
        </motion.div>

        {/* ── Hero card ── */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show"
          className="relative overflow-hidden bg-[#0b1120] border border-white/[0.07] rounded-[24px] p-5">
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none opacity-15"
            style={{ background: 'radial-gradient(circle, #2563eb, transparent 70%)' }} />

          <div className="flex items-center gap-5 relative z-10">
            {/* Avatar — bosish bilan modal ochiladi */}
            <div className="relative shrink-0">
              <button onClick={() => setModal('avatar')}
                className="block w-24 h-24 rounded-full p-[2px] cursor-pointer hover:opacity-90 transition-opacity group"
                style={{ background: 'linear-gradient(135deg, #2563eb, #6366f1)' }}>
                <div className="w-full h-full rounded-full bg-[#020617] flex items-center justify-center overflow-hidden relative">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-indigo-400/50 select-none">
                      {getInitials(fullName)}
                    </span>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    <Camera size={20} className="text-white" />
                  </div>
                </div>
              </button>
              <button onClick={() => setModal('avatar')} aria-label="Rasm yuklash"
                className="absolute bottom-0.5 right-0.5 w-7 h-7 bg-blue-600 hover:bg-blue-500 rounded-full border-2 border-[#0b1120] flex items-center justify-center transition-all hover:scale-110 shadow-lg">
                <Camera size={13} className="text-white" />
              </button>
            </div>

            <div className="min-w-0 space-y-2">
              <h2 className="text-2xl font-black text-white leading-tight truncate">{fullName}</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                <ShieldCheck size={11} /> Faol Talaba
              </span>
              <p className="text-blue-400 font-bold text-[10px] uppercase tracking-[0.2em] truncate">
                {faculty} · {role}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Stat cards ── */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show"
          className="grid grid-cols-3 gap-2.5">
          {[
            { val: course, label: 'Kurs', color: '#60a5fa' },
            { val: group, label: 'Guruh', color: '#34d399' },
            { val: roomNumber, label: 'Xona', color: '#fcd34d' },
          ].map(s => (
            <div key={s.label}
              className="bg-[#0b1120] border border-white/[0.06] rounded-2xl p-3.5 text-center">
              <p className="font-black leading-tight mb-1 truncate"
                style={{ color: s.color, fontSize: String(s.val).length > 5 ? '13px' : '22px' }}>
                {s.val}
              </p>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.18em]">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Info sections ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <motion.section custom={3} variants={fadeUp} initial="hidden" animate="show"
            className="group bg-[#0b1120] border border-white/[0.07] rounded-[20px] p-4 hover:border-blue-500/25 transition-colors space-y-4">
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-1.5">
              <span className="block w-0.5 h-3 bg-blue-500 rounded-full" /> Aloqa
            </h3>
            <InfoRow icon={<Mail size={17} />} label="Email" value={email}
              bg="rgba(59,130,246,0.1)" color="#60a5fa" />
            <InfoRow icon={<Phone size={17} />} label="Telefon" value={phone}
              bg="rgba(99,102,241,0.1)" color="#a5b4fc" />
          </motion.section>

          <motion.section custom={4} variants={fadeUp} initial="hidden" animate="show"
            className="group bg-[#0b1120] border border-white/[0.07] rounded-[20px] p-4 hover:border-emerald-500/25 transition-colors space-y-4">
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-1.5">
              <span className="block w-0.5 h-3 bg-emerald-500 rounded-full" /> Turar joy
            </h3>
            <InfoRow icon={<Home size={17} />} label="Xona" value={roomNumber}
              bg="rgba(16,185,129,0.1)" color="#34d399" />
            <InfoRow icon={<GraduationCap size={17} />} label="Kurs / Guruh"
              value={`${course}-kurs, ${group}-guruh`}
              bg="rgba(245,158,11,0.1)" color="#fcd34d" />
          </motion.section>
        </div>

        {/* ── Timeline ── */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show"
          className="bg-[#0b1120] border border-white/[0.07] rounded-[20px] p-4">
          <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-1.5 mb-5">
            <span className="block w-0.5 h-3 bg-violet-500 rounded-full" /> Ta'lim davri
          </h3>
          <Timeline course={course} />
        </motion.div>

        {/* ── Actions ── */}
        <motion.div
          custom={6}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-col sm:flex-row gap-4 w-full"
        >
          <button
            onClick={() => setModal('edit')}
            className="flex-1 flex items-center justify-center gap-3 py-5 rounded-[24px] bg-blue-900 text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-500 hover:-translate-y-1 active:scale-95 shadow-2xl shadow-blue-600/30 transition-all"
          >
            <Edit2 size={18} /> Ma'lumotlarni Tahrirlash
          </button>

          <button
            onClick={() => setModal('password')}
            className="flex-1 flex items-center justify-center gap-3 py-5 rounded-[24px] bg-slate-800 border border-white/10 text-slate-300 font-black uppercase tracking-widest text-xs hover:bg-slate-700 active:scale-95 transition-all"
          >
            <Lock size={18} /> Parolni O'zgartirish
          </button>
        </motion.div>

      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal === 'edit' && profile && (
          <EditModal
            profile={profile}
            onClose={() => setModal(null)}
            onSave={handleSaveEdit}
          />
        )}
        {modal === 'avatar' && (
          <AvatarModal
            currentAvatar={profile?.avatar_url}
            fullName={fullName}
            onClose={() => setModal(null)}
            onSave={handleSaveAvatar}
          />
        )}
        {modal === 'password' && (
          <PasswordModal onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </>
  )
}
