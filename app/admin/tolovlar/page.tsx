'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchAdminPayments, reviewAdminPayments, fetchReceiptSignedUrl } from '@/features/payments/client/api'
import type { PaymentRecord } from '@/features/payments/types'
import {
  CreditCard, Search, Check, X, Clock, AlertCircle,
  Eye, FileText,
  Sparkles, CheckCircle2, Loader,
  AlertTriangle, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Skel } from '@/components/ui/skeletons'
import { adminUI } from '@/lib/admin-ui'

interface GroupedPayment {
  key: string
  records: PaymentRecord[]
  student_id: string
  student_name: string
  months: string[]
  year: number
  totalAmount: number
  status: string
  receipt_url?: string
  created_at: string
  ai_confidence?: number
  ai_extracted_amount?: number
  ai_analysis?: string
  ai_review?: 'manual' | 'skipped'
}

type PaymentTab = 'waiting' | 'approved' | 'rejected' | 'all'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Noma\'lum xato'
}

const UZ_MONTH_ORDER: Record<string, number> = {
  'Yanvar': 1, 'Fevral': 2, 'Mart': 3, 'Aprel': 4, 'May': 5, 'Iyun': 6,
  'Iyul': 7, 'Avgust': 8, 'Sentabr': 9, 'Oktabr': 10, 'Noyabr': 11, 'Dekabr': 12
}

function sortMonths(months: string[]): string[] {
  return [...months].sort((a, b) => (UZ_MONTH_ORDER[a] || 99) - (UZ_MONTH_ORDER[b] || 99))
}

const REJECTION_PRESETS = [
  "Chek xira yoki to'liq ko'rinmagan",
  "Chekdagi summa mos kelmadi",
  "To'lov boshqa shaxs nomiga o'tkazilgan",
  "Oldingi to'lov cheki qayta yuklangan",
  "Tranzaksiya bekor qilingan yoki tasdiqlanmagan",
]

function getInitials(name: string): string {
  if (!name) return 'TL'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatPaymentPeriod(months: string[], year: number): string {
  if (!months || months.length === 0) return `${year}`
  const sorted = sortMonths(months)
  if (sorted.length === 1) return `${sorted[0]} ${year}`
  return `${sorted[0]} – ${sorted[sorted.length - 1]}, ${year} (${sorted.length} oy)`
}

export default function AdminTolovlarPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [records, setRecords] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<PaymentTab>('waiting')

  // Review modal states
  const [selectedGroup, setSelectedGroup] = useState<GroupedPayment | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [receiptSignedUrl, setReceiptSignedUrl] = useState<string | null>(null)
  // Separate from `receiptSignedUrl === null`, which also means "still
  // loading" — without it a receipt that fails to load span the spinner
  // forever and the reviewer had no idea anything had gone wrong.
  const [receiptError, setReceiptError] = useState(false)

  // The `receipts` bucket is private — resolve a fresh signed URL whenever
  // the selected batch's receipt is shown, instead of using the stored
  // storage path directly as an <img src>.
  useEffect(() => {
    const paymentId = selectedGroup?.records[0]?.id
    if (!paymentId) {
      setReceiptSignedUrl(null)
      setReceiptError(false)
      return
    }
    let cancelled = false
    setReceiptSignedUrl(null)
    setReceiptError(false)
    fetchReceiptSignedUrl(paymentId)
      .then((url) => { if (!cancelled) setReceiptSignedUrl(url) })
      .catch(() => { if (!cancelled) setReceiptError(true) })
    return () => { cancelled = true }
  }, [selectedGroup?.records])

  const handleRunAI = async (group: GroupedPayment) => {
    try {
      setAnalyzing(true)
      // Run AI on the first record of the group (they all share same receipt)
      const paymentId = group.records[0].id
      const res = await fetch('/api/ai/tahlil', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paymentId })
      })
      const data = await res.json()
      if (data.success) {
        toast.success("AI Tahlili muvaffaqiyatli yakunlandi! 🤖")
        if (selectedGroup && selectedGroup.key === group.key) {
          setSelectedGroup({
            ...selectedGroup,
            ai_confidence: data.ai_confidence,
            ai_extracted_amount: data.ai_extracted_amount,
            ai_analysis: data.ai_analysis
          })
        }
        await loadPayments()
      } else {
        throw new Error(data.error || "Noma'lum xato")
      }
    } catch (err: unknown) {
      console.error("AI run error:", err)
      toast.error("AI tahlilida xatolik: " + getErrorMessage(err))
    } finally {
      setAnalyzing(false)
    }
  }


  // Fetch payments from Supabase
  const loadPayments = async () => {
    try {
      setLoading(true)
      setRecords(await fetchAdminPayments())
    } catch (err: unknown) {
      console.error('Error fetching payments:', err)
      toast.error('To\'lovlarni yuklashda xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  const handleApprove = async (group: GroupedPayment) => {
    try {
      setSubmitting(true)
      // Approve ALL records in the group
      const ids = group.records.map(r => r.id)
      await reviewAdminPayments({
        ids,
        status: 'approved',
        message: 'To\'lov muvaffaqiyatli tasdiqlandi. Rahmat! ✅',
      })

      toast.success(`${group.student_name} — ${group.months.join(', ')} to'lovi tasdiqlandi!`)
      setSelectedGroup(null)
      await loadPayments()
    } catch (err: unknown) {
      console.error('Error approving payment:', err)
      toast.error('To\'lovni tasdiqlashda xatolik yuz berdi')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async (group: GroupedPayment) => {
    if (!rejectReason.trim()) {
      toast.error('Rad etish sababini kiriting')
      return
    }

    try {
      setSubmitting(true)
      // Reject ALL records in the group
      const ids = group.records.map(r => r.id)
      await reviewAdminPayments({
        ids,
        status: 'rejected',
        message: `Rad etildi: ${rejectReason}`,
      })

      toast.success(`${group.student_name} — ${group.months.join(', ')} to'lovi rad etildi`)
      setSelectedGroup(null)
      setRejectMode(false)
      setRejectReason('')
      await loadPayments()
    } catch (err: unknown) {
      console.error('Error rejecting payment:', err)
      toast.error('To\'lovni rad etishda xatolik yuz berdi')
    } finally {
      setSubmitting(false)
    }
  }

  // Group records by receipt_url + student_id (same batch upload)
  const groupRecords = (recs: PaymentRecord[]): GroupedPayment[] => {
    const groupMap = new Map<string, PaymentRecord[]>()
    recs.forEach(r => {
      // Group by same receipt + same student
      const key = `${r.student_id}_${r.receipt_url || r.id}_${r.created_at?.slice(0, 16)}`
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(r)
    })

    return Array.from(groupMap.entries()).map(([key, groupRecs]) => {
      const first = groupRecs[0]
      return {
        key,
        records: groupRecs,
        student_id: first.student_id,
        student_name: first.student_name,
        months: sortMonths(groupRecs.map(r => r.month)),
        year: first.year,
        totalAmount: groupRecs.reduce((sum, r) => sum + r.amount, 0),
        status: first.status,
        receipt_url: first.receipt_url,
        created_at: first.created_at,
        ai_confidence: first.ai_confidence,
        ai_extracted_amount: first.ai_extracted_amount,
        ai_analysis: first.ai_analysis,
        ai_review: first.ai_review,
      }
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  // Filter records based on tab and search
  const filteredRecords = records.filter(r => {
    const matchesSearch = r.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.month.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (activeTab === 'all') return matchesSearch
    if (activeTab === 'waiting') return r.status === 'waiting' && matchesSearch
    if (activeTab === 'approved') return (r.status === 'approved' || r.status === 'paid') && matchesSearch
    if (activeTab === 'rejected') return r.status === 'rejected' && matchesSearch
    return false
  })

  const groupedPayments = groupRecords(filteredRecords)

  // Counters (count unique groups)
  const allGroups = groupRecords(records)
  const countWaiting = allGroups.filter(g => g.status === 'waiting').length
  const countApproved = allGroups.filter(g => g.status === 'approved' || g.status === 'paid').length
  const countRejected = allGroups.filter(g => g.status === 'rejected').length

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'approved':
        return isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100/50' : 'bg-emerald-950/20 text-emerald-400 border-emerald-800/60 shadow-emerald-950/10'
      case 'waiting':
        return isLight ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-100/50' : 'bg-amber-950/20 text-amber-400 border-amber-800/60 shadow-amber-950/10'
      case 'rejected':
        return isLight ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-rose-100/50' : 'bg-rose-950/20 text-rose-400 border-rose-800/60 shadow-rose-950/10'
      default:
        return isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-slate-900/40 text-slate-500 border-white/5'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
      case 'approved':
        return 'Tasdiqlangan'
      case 'waiting':
        return 'Kutilayotgan'
      case 'rejected':
        return 'Rad etilgan'
      default:
        return 'To\'lanmagan'
    }
  }

  const ui = adminUI(isLight)
  const surfaceBg = ui.card
  const textMuted = ui.muted
  const textStrong = ui.strong
  const inputBg = ui.input

  return (
    <div className="space-y-8 pb-12">

      {/* Hero — matches the rest of the tarbiyachi/dekan panel */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">
            <CreditCard size={22} strokeWidth={2.3} />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Kvitansiyalar nazorati</h1>
            <p className="mt-0.5 text-xs sm:text-sm text-indigo-100">
              To&apos;lov cheklarini tekshiring, tasdiqlang yoki rad eting
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-3">
          {([
            { label: 'Kutilmoqda', count: countWaiting, icon: Clock, key: 'waiting' },
            { label: 'Tasdiqlangan', count: countApproved, icon: Check, key: 'approved' },
            { label: 'Rad etilgan', count: countRejected, icon: X, key: 'rejected' },
          ] satisfies Array<{ label: string; count: number; icon: typeof Clock; key: PaymentTab }>).map((card) => {
            const Icon = card.icon
            const isCardActive = activeTab === card.key
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => setActiveTab(card.key)}
                className={`text-left rounded-2xl p-3.5 backdrop-blur-sm transition-all cursor-pointer no-shelf ${
                  isCardActive
                    ? 'bg-white/25 ring-2 ring-white/60 shadow-lg'
                    : 'bg-white/10 hover:bg-white/15'
                }`}
              >
                <p className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-indigo-100" style={{ color: '#e0e7ff' }}>
                  <Icon size={12} /> {card.label}
                </p>
                <p className="mt-1 text-2xl sm:text-3xl font-black text-white" style={{ color: '#ffffff' }}>
                  {card.count}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 rounded-2xl sm:rounded-[28px] border backdrop-blur-xl ${surfaceBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Talaba ismi yoki oy bo'yicha qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs font-semibold focus:outline-hidden focus:border-indigo-500 transition-all ${inputBg}`}
          />
        </div>

        {/* Segmented Control Filter */}
        <div className={`flex p-1 rounded-2xl border shrink-0 max-w-full overflow-x-auto no-scrollbar flex-nowrap ${
          isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-800/80 border-slate-700/80'
        }`}>
          {(['waiting', 'approved', 'rejected', 'all'] as const).map((tab) => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap no-shelf ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-xs dark:bg-slate-900 dark:text-white'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'waiting' && `Kutilmoqda (${countWaiting})`}
                {tab === 'approved' && `Tasdiqlangan (${countApproved})`}
                {tab === 'rejected' && `Rad etilgan (${countRejected})`}
                {tab === 'all' && `Barchasi (${allGroups.length})`}
              </button>
            )
          })}
        </div>
      </div>

      {/* Records Container */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200/70 bg-white/55 p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                <Skel className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skel className="h-3.5 w-2/3" />
                  <Skel className="h-2.5 w-2/5" />
                </div>
              </div>
              <Skel className="h-24 w-full rounded-xl" />
              <Skel className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : groupedPayments.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl border ${surfaceBg}`}>
          <p className={`text-sm ${textMuted}`}>Ushbu toifada hech qanday kvitansiya mavjud emas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          {groupedPayments.map((group) => (
            <div
              key={group.key}
              className={`group rounded-2xl border p-5 backdrop-blur-xl transition-all duration-200 hover:shadow-md flex flex-col justify-between h-full ${
                isLight
                  ? 'bg-white border-slate-200/90 hover:border-indigo-300'
                  : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/50'
              }`}
            >
              {/* Zone 1: Student info & Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-200/80 dark:border-slate-700 shrink-0">
                    {getInitials(group.student_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-sm font-extrabold truncate ${textStrong}`} title={group.student_name}>
                      {group.student_name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {group.months.length > 1 ? `${group.months.length} oylik to'lov` : "1 oylik to'lov"}
                      </span>
                    </div>
                  </div>
                </div>

                <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold border tracking-wide whitespace-nowrap ${getStatusColor(group.status)}`}>
                  {getStatusLabel(group.status)}
                </span>
              </div>

              {/* Zone 2: Structured Details Box (Uniform height & rows) */}
              <div className="my-4 rounded-xl p-3.5 border bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 space-y-2.5 text-xs flex-1 flex flex-col justify-center">
                {/* Row 1: Davr */}
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] shrink-0">To‘lov davri:</span>
                  <span className={`font-bold truncate text-[11px] text-right ${textStrong}`} title={group.months.join(', ') + ' ' + group.year}>
                    {formatPaymentPeriod(group.months, group.year)}
                  </span>
                </div>

                {/* Row 2: Summa */}
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] shrink-0">Summa:</span>
                  <div className="text-right">
                    <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      {group.totalAmount.toLocaleString()} UZS
                    </span>
                    {group.months.length > 1 && (
                      <span className="block text-[10px] text-slate-400 font-medium">
                        ({group.records[0].amount.toLocaleString()} UZS/oy)
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: Sana & AI Status */}
                <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-200/40 dark:border-slate-800/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock size={11} className="text-slate-400 shrink-0" />
                    {new Date(group.created_at).toLocaleDateString('uz-UZ')}
                  </span>

                  {group.ai_review === 'manual' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      <AlertCircle size={10} className="shrink-0" /> Qo‘lda tekshiruv
                    </span>
                  ) : group.ai_confidence !== undefined ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                      group.ai_confidence >= 80
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : group.ai_confidence >= 50
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      <Sparkles size={10} className="shrink-0" /> AI: {group.ai_confidence}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Kutilmoqda</span>
                  )}
                </div>
              </div>

              {/* Zone 3: Footer Action (Aligned to baseline across all cards) */}
              <div className="mt-auto pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 no-shelf cursor-pointer ${
                    group.status === 'waiting'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                      : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <Eye size={14} />
                  <span>{group.status === 'waiting' ? 'Tekshirish' : "Ko'rish"}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review & Approve Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className={`w-full max-w-5xl rounded-3xl border backdrop-blur-xl relative flex flex-col max-h-[92vh] shadow-2xl overflow-hidden ${
            isLight ? 'bg-white border-slate-200/90 shadow-slate-900/15' : 'bg-slate-950 border-slate-800/90 shadow-black'
          }`}>
            {/* Modal Header */}
            <div className={`px-5 sm:px-6 py-4 border-b flex items-center justify-between gap-4 shrink-0 ${
              isLight ? 'border-slate-100 bg-slate-50/60' : 'border-slate-800/70 bg-slate-900/40'
            }`}>
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isLight ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-400'
                }`}>
                  <CreditCard size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className={`text-base sm:text-lg font-black tracking-tight ${textStrong}`}>
                      Kvitansiyani Tekshirish
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wide whitespace-nowrap ${getStatusColor(selectedGroup.status)}`}>
                      {getStatusLabel(selectedGroup.status)}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 truncate ${textMuted}`}>
                    {selectedGroup.student_name} • {formatPaymentPeriod(selectedGroup.months, selectedGroup.year)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedGroup(null)
                  setRejectMode(false)
                  setRejectReason('')
                }}
                className={`p-2 rounded-xl border transition-all no-shelf cursor-pointer ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title="Yopish"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: 2-Column Responsive Layout */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6">

              {/* LEFT COLUMN: Receipt Preview Canvas */}
              <div className="lg:col-span-6 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black uppercase tracking-wider ${textMuted} flex items-center gap-1.5`}>
                    <FileText size={14} className="text-indigo-500" />
                    To&apos;lov cheki hujjati
                  </span>
                  {receiptSignedUrl && (
                    <button
                      type="button"
                      onClick={() => viewReceipt(receiptSignedUrl)}
                      className={`inline-flex items-center gap-1 text-[11px] font-bold transition-all no-shelf cursor-pointer ${
                        isLight ? 'text-indigo-600 hover:text-indigo-700' : 'text-indigo-400 hover:text-indigo-300'
                      }`}
                    >
                      <ExternalLink size={12} />
                      <span>Yangi oynada ochish</span>
                    </button>
                  )}
                </div>

                {/* Receipt Canvas */}
                <div className={`flex-1 min-h-[320px] sm:min-h-[440px] max-h-[580px] rounded-2xl border p-4 flex flex-col items-center justify-center relative overflow-auto ${
                  isLight ? 'bg-slate-100/70 border-slate-200/90' : 'bg-slate-900/60 border-slate-800/80'
                }`}>
                  {selectedGroup.receipt_url ? (
                    selectedGroup.receipt_url.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                        <FileText size={48} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                        <div>
                          <p className={`font-bold text-sm ${textStrong}`}>PDF Formatidagi Hujjat</p>
                          <p className={`text-xs mt-1 ${textMuted}`}>Ushbu kvitansiya PDF shaklida yuklangan.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => viewReceipt(receiptSignedUrl ?? undefined)}
                          disabled={!receiptSignedUrl}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 disabled:opacity-50 no-shelf cursor-pointer ${
                            isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <Eye size={14} />
                          <span>PDFni ochish</span>
                        </button>
                      </div>
                    ) : receiptSignedUrl ? (
                      <div className="relative max-h-full flex items-center justify-center">
                        <Image
                          src={receiptSignedUrl}
                          alt="Chek tasviri"
                          width={960}
                          height={1280}
                          unoptimized
                          className="max-h-[380px] sm:max-h-[480px] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => viewReceipt(receiptSignedUrl)}
                          className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-md text-xs font-bold transition-all flex items-center gap-1.5 no-shelf cursor-pointer ${
                            isLight ? 'bg-white/90 border-slate-200 text-slate-700 hover:bg-white' : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-900'
                          }`}
                          title="Kattalashtirib ochish"
                        >
                          <Eye size={14} />
                          <span>Kattalashtirish</span>
                        </button>
                      </div>
                    ) : receiptError ? (
                      <div className="flex flex-col items-center gap-2.5 p-6 text-center">
                        <AlertTriangle size={32} className="text-amber-500" />
                        <p className={`text-xs font-bold ${textStrong}`}>Chekni ochib bo&apos;lmadi</p>
                        <p className={`text-[11px] max-w-xs ${textMuted}`}>
                          Fayl o&apos;chirilgan yoki vaqtincha mavjud emas. Tasdiqlashdan oldin talabadan chekni qayta yuborishini so&apos;rang.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Loader size={24} className="animate-spin text-slate-400" />
                        <span className={`text-xs ${textMuted}`}>Chek yuklanmoqda...</span>
                      </div>
                    )
                  ) : (
                    <div className="p-8 text-center text-rose-500 font-bold border rounded-2xl">
                      Yuklangan chek fayli topilmadi!
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Details & AI Audit & Actions */}
              <div className="lg:col-span-6 flex flex-col space-y-4">
                {/* Student Mini Card */}
                <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                  isLight ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-900/40 border-slate-800/80'
                }`}>
                  <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-black text-sm flex items-center justify-center border border-slate-200/80 dark:border-slate-700 shrink-0">
                    {getInitials(selectedGroup.student_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-sm font-extrabold truncate ${textStrong}`}>
                      {selectedGroup.student_name}
                    </h4>
                    <p className={`text-xs mt-0.5 ${textMuted}`}>
                      Yotoqxona talabasi
                    </p>
                  </div>
                </div>

                {/* Financial Summary Card */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-900/40 border-slate-800/80'
                }`}>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className={`text-xs ${textMuted}`}>Jami to&apos;lov:</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                      {selectedGroup.totalAmount.toLocaleString()} UZS
                    </span>
                  </div>

                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-xs shrink-0 mt-0.5 ${textMuted}`}>To&apos;lov davri:</span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {selectedGroup.months.map((m) => (
                        <span key={m} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isLight ? 'bg-white text-indigo-700 border-indigo-100 shadow-xs' : 'bg-indigo-950/30 text-indigo-300 border-indigo-800/40'
                        }`}>
                          {m}
                        </span>
                      ))}
                      <span className={`text-[10px] font-bold self-center ${textMuted}`}>{selectedGroup.year}</span>
                    </div>
                  </div>

                  {selectedGroup.months.length > 1 && (
                    <div className="flex justify-between items-center gap-2">
                      <span className={`text-xs ${textMuted}`}>Oylik stavka:</span>
                      <span className={`text-xs font-semibold ${textStrong}`}>
                        {selectedGroup.records[0].amount.toLocaleString()} UZS × {selectedGroup.months.length} oy
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                    <span className={`text-xs ${textMuted}`}>Yuklangan sana:</span>
                    <span className={`text-xs font-bold ${textStrong} flex items-center gap-1`}>
                      <Clock size={12} className="text-slate-400" />
                      {new Date(selectedGroup.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* AI Audit Tahlili */}
                <div className={`p-4 sm:p-5 rounded-2xl border relative overflow-hidden space-y-3.5 ${
                  isLight ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-900/40 border-slate-800/80'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className={isLight ? 'text-indigo-600' : 'text-indigo-400'} />
                      <h4 className={`text-xs font-black uppercase tracking-wider ${textStrong}`}>
                        AI Audit Tahlili
                      </h4>
                    </div>
                    {selectedGroup.ai_confidence !== undefined && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${
                        selectedGroup.ai_confidence >= 80
                          ? isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                          : selectedGroup.ai_confidence >= 50
                            ? isLight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                            : isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-950/30 border-rose-800/60 text-rose-300 animate-pulse'
                      }`}>
                        Haqiqiylik: {selectedGroup.ai_confidence}%
                      </span>
                    )}
                  </div>

                  {selectedGroup.ai_review === 'manual' && (
                    <div className={`flex items-start gap-2 rounded-xl border p-2.5 text-[11px] ${
                      isLight ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                    }`}>
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">AI chekni avtomatik o&apos;qiy olmadi</p>
                        <p className="text-[10px] mt-0.5 leading-tight">Summa va sanani chek tasviridan ko&apos;rib solishtiring.</p>
                      </div>
                    </div>
                  )}

                  {selectedGroup.ai_confidence === undefined ? (
                    <div className="text-center py-3 space-y-2.5">
                      <p className={`text-xs ${textMuted}`}>Ushbu chek hali AI auditidan o&apos;tkazilmagan.</p>
                      <button
                        type="button"
                        onClick={() => handleRunAI(selectedGroup)}
                        disabled={analyzing}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 mx-auto bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs no-shelf cursor-pointer"
                      >
                        {analyzing ? (
                          <>
                            <Loader size={14} className="animate-spin" />
                            <span>Tahlil qilinmoqda...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>AI Tahlilini Boshlash</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Amount Match Check */}
                      {selectedGroup.ai_extracted_amount !== selectedGroup.totalAmount ? (
                        <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                          isLight ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                        }`}>
                          <AlertCircle className="shrink-0 mt-0.5 text-rose-600" size={15} />
                          <div className="text-xs">
                            <p className="font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">Summa mos kelmadi!</p>
                            <p className="mt-0.5">
                              Kiritilgan: <span className="font-bold">{selectedGroup.totalAmount.toLocaleString()} UZS</span> <br />
                              Chekda aniqlangan: <span className="font-bold">{selectedGroup.ai_extracted_amount?.toLocaleString() || 'Aniqlanmadi'} UZS</span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                          isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        }`}>
                          <CheckCircle2 className="shrink-0 text-emerald-600" size={15} />
                          <span className="text-xs font-bold">
                            Chekdagi summa to&apos;liq mos keladi: {selectedGroup.totalAmount.toLocaleString()} UZS
                          </span>
                        </div>
                      )}

                      {/* AI Feedback */}
                      {selectedGroup.ai_analysis && (
                        <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                          isLight ? 'bg-white border-slate-200/80' : 'bg-slate-950/60 border-slate-800'
                        }`}>
                          <p className={`font-bold mb-0.5 ${textStrong}`}>AI izohi:</p>
                          <p className={textMuted}>{selectedGroup.ai_analysis}</p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRunAI(selectedGroup)}
                        disabled={analyzing}
                        className={`text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 opacity-70 hover:opacity-100 no-shelf cursor-pointer ${
                          isLight ? 'text-indigo-600' : 'text-indigo-400'
                        }`}
                      >
                        {analyzing ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        <span>Qayta tahlil qilish</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Rejection Area (If rejectMode) */}
                {rejectMode && (
                  <div className={`p-4 rounded-2xl border space-y-3 animate-in fade-in duration-150 ${
                    isLight ? 'bg-rose-50/40 border-rose-200' : 'bg-rose-950/20 border-rose-900/30'
                  }`}>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                      Rad etish sababini tanlang yoki yozing:
                    </label>

                    {/* Quick Preset Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {REJECTION_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setRejectReason(preset)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all no-shelf cursor-pointer ${
                            rejectReason === preset
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : isLight
                                ? 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'
                                : 'bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-900/40'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Sababni batafsil yozing..."
                      className={`w-full p-3 rounded-xl border text-xs font-semibold transition-all focus:outline-hidden focus:border-rose-500 ${
                        isLight ? 'bg-white border-rose-300 text-slate-900' : 'bg-slate-900/80 border-rose-900 text-white'
                      }`}
                    />
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions */}
            <div className={`px-5 sm:px-6 py-4 border-t flex items-center gap-3 shrink-0 ${
              isLight ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800/70 bg-slate-900/40'
            }`}>
              {rejectMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectMode(false)
                      setRejectReason('')
                    }}
                    className={`flex-1 py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all no-shelf cursor-pointer ${
                      isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(selectedGroup)}
                    disabled={submitting || !rejectReason.trim()}
                    className={`flex-1 py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-white no-shelf cursor-pointer flex items-center justify-center gap-1.5 ${
                      !rejectReason.trim()
                        ? 'bg-rose-400 cursor-not-allowed opacity-60'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-xs'
                    }`}
                  >
                    {submitting ? <Loader size={14} className="animate-spin" /> : <X size={14} />}
                    <span>{selectedGroup.months.length > 1 ? `${selectedGroup.months.length} oyni rad etish` : 'Rad etishni tasdiqlash'}</span>
                  </button>
                </>
              ) : (
                <>
                  {selectedGroup.status === 'waiting' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejectMode(true)}
                        className={`flex-1 py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/20 no-shelf cursor-pointer flex items-center justify-center gap-1.5`}
                      >
                        <X size={14} />
                        <span>Rad etish</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(selectedGroup)}
                        disabled={submitting}
                        className="flex-1 py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-white flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 shadow-xs no-shelf cursor-pointer"
                      >
                        {submitting ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                        <span>{selectedGroup.months.length > 1 ? `${selectedGroup.months.length} oyni tasdiqlash` : 'Kvitansiyani tasdiqlash'}</span>
                      </button>
                    </>
                  )}
                  {selectedGroup.status !== 'waiting' && (
                    <button
                      type="button"
                      onClick={() => setSelectedGroup(null)}
                      className={`w-full py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all no-shelf cursor-pointer ${
                        isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      Yopish
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function viewReceipt(url?: string) {
  if (url) {
    window.open(url, '_blank')
  }
}
