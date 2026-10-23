'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchAdminPayments, reviewAdminPayments, fetchReceiptSignedUrl } from '@/features/payments/client/api'
import type { PaymentRecord } from '@/features/payments/types'
import {
  CreditCard, Search, Check, X, Clock, AlertCircle,
  Eye, FileText,
  Sparkles, CheckCircle2, Loader2,
  AlertTriangle, ExternalLink, CheckCheck,
  LayoutGrid, Table as TableIcon, ChevronLeft, ChevronRight,
  RotateCcw, Inbox, ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomCheckbox from '@/components/ui/CustomCheckbox'
import { dekanUI } from '@/lib/dekan-ui'

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

type PaymentTab = 'waiting' | 'ai_matched' | 'approved' | 'rejected' | 'all'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Noma'lum xato"
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

/** Same rule for the "AI mos" tab and the bulk "AI moslarni tasdiqlash" button. */
function isAiMatched(g: GroupedPayment) {
  return g.ai_extracted_amount === g.totalAmount && (g.ai_confidence ?? 0) >= 70
}

/** Server accepts at most 100 ids per review call; smaller chunks keep each notification burst modest. */
const REVIEW_CHUNK_SIZE = 50

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
  const ui = dekanUI(isLight)
  const textMuted = ui.muted
  const textStrong = ui.strong
  const inputBg = `${ui.input} ${ui.ring}`

  const [records, setRecords] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<PaymentTab>('waiting')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 12

  // Multi-selection for batch operations
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [batchActionLoading, setBatchActionLoading] = useState(false)
  const [batchRejectReason, setBatchRejectReason] = useState('')
  const [batchConfirmModal, setBatchConfirmModal] = useState<{
    isOpen: boolean
    action: 'approved' | 'rejected'
    groups: GroupedPayment[]
    title: string
    description: string
  }>({
    isOpen: false,
    action: 'approved',
    groups: [],
    title: '',
    description: '',
  })

  // Review modal states
  const [selectedGroup, setSelectedGroup] = useState<GroupedPayment | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [approvingKey, setApprovingKey] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [receiptSignedUrl, setReceiptSignedUrl] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState(false)

  // Fetch payments from backend
  const loadPayments = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchAdminPayments()
      setRecords(data)
    } catch (err: unknown) {
      console.error('Error fetching payments:', err)
      toast.error("To'lovlarni yuklashda xatolik yuz berdi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  // Group records by receipt_url + student_id
  const allGroups = useMemo((): GroupedPayment[] => {
    const groupMap = new Map<string, PaymentRecord[]>()
    records.forEach(r => {
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
  }, [records])

  // Waiting groups queue for sequential modal review
  const waitingGroups = useMemo(
    () => allGroups.filter((g) => g.status === 'waiting'),
    [allGroups]
  )

  // AI-matched groups: waiting payments whose receipt amount the AI read as exactly the total, with confidence.
  const aiMatchedGroups = useMemo(() => waitingGroups.filter(isAiMatched), [waitingGroups])

  // Filter groups based on search & active tab
  const filteredGroups = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return allGroups.filter((group) => {
      const matchesSearch =
        !query ||
        group.student_name.toLowerCase().includes(query) ||
        group.months.some((m) => m.toLowerCase().includes(query)) ||
        group.totalAmount.toString().includes(query)

      if (!matchesSearch) return false

      if (activeTab === 'all') return true
      if (activeTab === 'waiting') return group.status === 'waiting'
      if (activeTab === 'ai_matched') return group.status === 'waiting' && isAiMatched(group)
      if (activeTab === 'approved') return group.status === 'approved' || group.status === 'paid'
      if (activeTab === 'rejected') return group.status === 'rejected'
      return true
    })
  }, [allGroups, searchQuery, activeTab])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize))
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredGroups.slice(start, start + pageSize)
  }, [filteredGroups, currentPage, pageSize])

  // Modal queue index
  const currentQueueIndex = useMemo(() => {
    if (!selectedGroup) return -1
    return waitingGroups.findIndex((g) => g.key === selectedGroup.key)
  }, [waitingGroups, selectedGroup])

  // Resolve signed URL for receipt preview
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
  }, [selectedGroup?.key, selectedGroup?.records])

  // Real-time statistics
  const countWaiting = waitingGroups.length
  const countApproved = allGroups.filter(g => g.status === 'approved' || g.status === 'paid').length
  const countRejected = allGroups.filter(g => g.status === 'rejected').length
  const sumWaiting = waitingGroups.reduce((acc, g) => acc + g.totalAmount, 0)
  const sumApproved = allGroups.filter(g => g.status === 'approved' || g.status === 'paid').reduce((acc, g) => acc + g.totalAmount, 0)

  // Chunked batch review helper
  const executeBatchReview = async (
    groups: GroupedPayment[],
    status: 'approved' | 'rejected',
    message: string
  ) => {
    const allIds = groups.flatMap((g) => g.records.map((r) => r.id))
    if (allIds.length === 0) return

    try {
      for (let i = 0; i < allIds.length; i += REVIEW_CHUNK_SIZE) {
        await reviewAdminPayments({ ids: allIds.slice(i, i + REVIEW_CHUNK_SIZE), status, message })
      }
    } catch (error) {
      // Earlier chunks may already be saved: show the real state, then report the error.
      await loadPayments()
      throw error
    }

    // Optimistically update local records state
    const idSet = new Set(allIds)
    setRecords((prev) =>
      prev.map((r) => (idSet.has(r.id) ? { ...r, status } : r))
    )
    setSelectedKeys((prev) => prev.filter((k) => !groups.some((g) => g.key === k)))
  }

  // 1-Click fast approval for a single receipt group
  const handleApprove = async (group: GroupedPayment): Promise<boolean> => {
    try {
      setApprovingKey(group.key)
      setSubmitting(true)
      await executeBatchReview(
        [group],
        'approved',
        "To'lov muvaffaqiyatli tasdiqlandi. Rahmat! ✅"
      )
      toast.success(`✓ ${group.student_name} — to'lovi tasdiqlandi!`)
      return true
    } catch (err: unknown) {
      console.error('Error approving payment:', err)
      toast.error("To'lovni tasdiqlashda xatolik yuz berdi: " + getErrorMessage(err))
      return false
    } finally {
      setApprovingKey(null)
      setSubmitting(false)
    }
  }

  // Reject single receipt
  const handleReject = async (group: GroupedPayment, reason: string): Promise<boolean> => {
    if (!reason.trim()) {
      toast.error('Rad etish sababini kiriting')
      return false
    }
    try {
      setSubmitting(true)
      await executeBatchReview(
        [group],
        'rejected',
        `Rad etildi: ${reason}`
      )
      toast.success(`✕ ${group.student_name} — to'lovi rad etildi`)
      setRejectMode(false)
      setRejectReason('')
      return true
    } catch (err: unknown) {
      console.error('Error rejecting payment:', err)
      toast.error("To'lovni rad etishda xatolik: " + getErrorMessage(err))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  // In-Modal Decision: Approve and smoothly advance to next waiting receipt
  const handleModalApprove = async () => {
    if (!selectedGroup) return
    const currentKey = selectedGroup.key
    if (!(await handleApprove(selectedGroup))) return

    const remaining = waitingGroups.filter((g) => g.key !== currentKey)
    if (remaining.length > 0) {
      const nextIndex = Math.min(currentQueueIndex, remaining.length - 1)
      setSelectedGroup(remaining[nextIndex])
      setRejectMode(false)
      setRejectReason('')
    } else {
      setSelectedGroup(null)
      toast.success("Barcha kutilayotgan to'lovlar ko'rib chiqildi! 🎉")
    }
  }

  // In-Modal Decision: Reject and advance
  const handleModalReject = async () => {
    if (!selectedGroup) return
    const currentKey = selectedGroup.key
    if (!(await handleReject(selectedGroup, rejectReason))) return

    const remaining = waitingGroups.filter((g) => g.key !== currentKey)
    if (remaining.length > 0) {
      const nextIndex = Math.min(currentQueueIndex, remaining.length - 1)
      setSelectedGroup(remaining[nextIndex])
      setRejectMode(false)
      setRejectReason('')
    } else {
      setSelectedGroup(null)
    }
  }

  // Modal navigation
  const handleModalNext = () => {
    if (currentQueueIndex >= 0 && currentQueueIndex < waitingGroups.length - 1) {
      setSelectedGroup(waitingGroups[currentQueueIndex + 1])
      setRejectMode(false)
      setRejectReason('')
    }
  }

  const handleModalPrev = () => {
    if (currentQueueIndex > 0) {
      setSelectedGroup(waitingGroups[currentQueueIndex - 1])
      setRejectMode(false)
      setRejectReason('')
    }
  }

  // Multi-selection handlers
  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const waitingCurrent = useMemo(
    () => paginatedGroups.filter((g) => g.status === 'waiting').map((g) => g.key),
    [paginatedGroups]
  )
  const allCurrentSelected = waitingCurrent.length > 0 && waitingCurrent.every((k) => selectedKeys.includes(k))
  const someCurrentSelected = waitingCurrent.some((k) => selectedKeys.includes(k))
  const selectedCurrentCount = waitingCurrent.filter((k) => selectedKeys.includes(k)).length

  const toggleSelectAllCurrent = () => {
    if (allCurrentSelected) {
      setSelectedKeys((prev) => prev.filter((k) => !waitingCurrent.includes(k)))
    } else {
      setSelectedKeys((prev) => Array.from(new Set([...prev, ...waitingCurrent])))
    }
  }

  // Batch actions triggering confirmation modal
  const handleOpenBatchAiMatched = () => {
    if (aiMatchedGroups.length === 0) {
      toast.error("AI tasdiqlagan kvitansiyalar mavjud emas")
      return
    }
    const aiSum = aiMatchedGroups.reduce((acc, g) => acc + g.totalAmount, 0)
    setBatchConfirmModal({
      isOpen: true,
      action: 'approved',
      groups: aiMatchedGroups,
      title: "AI tasdiqlagan kvitansiyalarni ommaviy tasdiqlash",
      description: `AI auditidan 100% muvaffaqiyatli o'tgan ${aiMatchedGroups.length} ta kvitansiyani tasdiqlamoqchimisiz? (Jami: ${aiSum.toLocaleString()} UZS)`,
    })
  }

  const handleOpenBatchSelected = (action: 'approved' | 'rejected') => {
    const selected = allGroups.filter((g) => selectedKeys.includes(g.key))
    if (selected.length === 0) return
    const totalSelectedSum = selected.reduce((acc, g) => acc + g.totalAmount, 0)
    const actionWord = action === 'approved' ? 'tasdiqlash' : 'rad etish'

    setBatchConfirmModal({
      isOpen: true,
      action,
      groups: selected,
      title: `Tanlangan kvitansiyalarni ${actionWord}`,
      description: `Tanlangan ${selected.length} ta kvitansiyani ${actionWord}ni xohlaysizmi? (Jami: ${totalSelectedSum.toLocaleString()} UZS)`,
    })
  }

  const confirmBatchExecution = async () => {
    const { groups, action } = batchConfirmModal
    if (groups.length === 0) return
    if (action === 'rejected' && !batchRejectReason.trim()) {
      toast.error('Rad etish sababini tanlang yoki yozing')
      return
    }

    setBatchActionLoading(true)
    try {
      const message =
        action === 'approved'
          ? "To'lov muvaffaqiyatli tasdiqlandi. Rahmat! ✅"
          : `Rad etildi: ${batchRejectReason.trim()}`

      await executeBatchReview(groups, action, message)
      toast.success(
        action === 'approved'
          ? `✓ ${groups.length} ta kvitansiya muvaffaqiyatli tasdiqlandi!`
          : `✕ ${groups.length} ta kvitansiya rad etildi`
      )
      setBatchConfirmModal({ isOpen: false, action: 'approved', groups: [], title: '', description: '' })
      setBatchRejectReason('')
    } catch (err: unknown) {
      console.error('Batch error:', err)
      toast.error("Ommaviy amalda xatolik: " + getErrorMessage(err))
    } finally {
      setBatchActionLoading(false)
    }
  }

  // Run AI analysis on demand
  const handleRunAI = async (group: GroupedPayment) => {
    try {
      setAnalyzing(true)
      const paymentId = group.records[0].id
      const res = await fetch('/api/ai/tahlil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })
      const data = await res.json() as {
        success?: boolean
        error?: string
        ai_confidence?: number
        ai_extracted_amount?: number
        ai_analysis?: string
      }
      if (data.success) {
        toast.success("AI Tahlili muvaffaqiyatli yakunlandi! 🤖")
        if (selectedGroup && selectedGroup.key === group.key) {
          setSelectedGroup({
            ...selectedGroup,
            ai_confidence: data.ai_confidence,
            ai_extracted_amount: data.ai_extracted_amount,
            ai_analysis: data.ai_analysis,
          })
        }
        await loadPayments()
      } else {
        throw new Error(data.error || "Noma'lum xato")
      }
    } catch (err: unknown) {
      console.error('AI run error:', err)
      toast.error('AI tahlilida xatolik: ' + getErrorMessage(err))
    } finally {
      setAnalyzing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'approved':
        return isLight
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100/50'
          : 'bg-emerald-950/20 text-emerald-400 border-emerald-800/60 shadow-emerald-950/10'
      case 'waiting':
        return isLight
          ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-100/50'
          : 'bg-amber-950/20 text-amber-400 border-amber-800/60 shadow-amber-950/10'
      case 'rejected':
        return isLight
          ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-rose-100/50'
          : 'bg-rose-950/20 text-rose-400 border-rose-800/60 shadow-rose-950/10'
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
        return 'Kutilmoqda'
      case 'rejected':
        return 'Rad etilgan'
      default:
        return "To'lanmagan"
    }
  }

  const selectedCount = selectedKeys.length
  const selectedSum = useMemo(() => {
    return allGroups
      .filter((g) => selectedKeys.includes(g.key))
      .reduce((sum, g) => sum + g.totalAmount, 0)
  }, [allGroups, selectedKeys])

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Banner with Modern Styling & KPIs */}
      <div className="no-shelf relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-4 sm:p-5 shadow-lg shadow-indigo-950/15 border border-white/20 text-white">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.07]" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/25 shadow-inner shrink-0">
              <CreditCard size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Jami: {allGroups.length} ta
                </span>
                {countWaiting > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/25 text-amber-200 border border-amber-400/35">
                    <Clock size={11} className="text-amber-300" />
                    {countWaiting} ta kutilmoqda
                  </span>
                )}
                {aiMatchedGroups.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-300/25 text-indigo-100 border border-indigo-300/35">
                    <Sparkles size={11} className="text-indigo-200" />
                    {aiMatchedGroups.length} ta AI mos
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white" style={{ color: '#ffffff' }}>
                Kvitansiyalar nazorati
              </h1>
              <p className="mt-0.5 text-xs text-indigo-100" style={{ color: '#e0e7ff' }}>
                To&apos;lov cheklarini ko‘rib chiqish, 1-bosishda tasdiqlash va ommaviy boshqarish paneli
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={loadPayments}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white text-xs font-bold transition-all disabled:opacity-50 no-shelf cursor-pointer active:scale-95 shadow-xs"
              title="Ma'lumotlarni yangilash"
            >
              <motion.div
                animate={loading ? { rotate: 360 } : {}}
                transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
              >
                <RotateCcw size={14} />
              </motion.div>
              <span style={{ color: '#ffffff' }}>{loading ? '...' : 'Yangilash'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            key: 'waiting',
            title: 'Kutilmoqda',
            count: countWaiting,
            sum: sumWaiting,
            icon: Clock,
            gradient: 'from-amber-500 to-orange-500',
            activeClass: isLight
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/40'
              : 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10',
            dotColor: 'bg-amber-500',
          },
          {
            key: 'ai_matched',
            title: 'AI 100% Mos',
            count: aiMatchedGroups.length,
            sum: aiMatchedGroups.reduce((acc, g) => acc + g.totalAmount, 0),
            icon: Sparkles,
            gradient: 'from-blue-600 to-indigo-600',
            activeClass: isLight
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40'
              : 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-500/10',
            dotColor: 'bg-indigo-500',
          },
          {
            key: 'approved',
            title: 'Tasdiqlangan',
            count: countApproved,
            sum: sumApproved,
            icon: CheckCircle2,
            gradient: 'from-emerald-500 to-teal-600',
            activeClass: isLight
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40'
              : 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/10',
            dotColor: 'bg-emerald-500',
          },
          {
            key: 'rejected',
            title: 'Rad etilgan',
            count: countRejected,
            sum: allGroups.filter(g => g.status === 'rejected').reduce((acc, g) => acc + g.totalAmount, 0),
            icon: X,
            gradient: 'from-rose-500 to-red-600',
            activeClass: isLight
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40'
              : 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/10',
            dotColor: 'bg-rose-500',
          },
        ].map((card, idx) => {
          const Icon = card.icon
          const isCurrentActive = activeTab === card.key
          return (
            <motion.button
              key={card.key}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => {
                setActiveTab(isCurrentActive && card.key !== 'all' ? 'all' : (card.key as PaymentTab))
                setCurrentPage(1)
              }}
              className={`no-shelf p-4 rounded-2xl border text-left transition-all relative overflow-hidden group active:scale-[0.98] ${
                isCurrentActive ? card.activeClass : ui.card
              } ${ui.hoverLift}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                    {card.title}
                  </p>
                  <p className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${textStrong}`}>
                    {loading ? '—' : card.count}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} text-white flex items-center justify-center shrink-0 shadow-md shadow-black/10 group-hover:scale-105 transition-transform`}>
                  <Icon size={18} strokeWidth={2.4} />
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className={textMuted}>Summa:</span>
                <span className={`font-bold ${textStrong}`}>
                  {loading ? '—' : `${card.sum.toLocaleString()} UZS`}
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Fast Batch Action Toolbar when items are selected OR waiting items exist */}
      <AnimatePresence>
        {(selectedCount > 0 || (countWaiting > 0 && activeTab !== 'approved' && activeTab !== 'rejected')) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-3 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              selectedCount > 0
                ? isLight
                  ? 'bg-indigo-50/70 border-indigo-200'
                  : 'bg-indigo-950/30 border-indigo-500/30'
                : isLight
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-amber-950/20 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                selectedCount > 0 ? 'bg-indigo-600 text-white shadow-xs' : 'bg-amber-500 text-white shadow-xs'
              }`}>
                {selectedCount > 0 ? <CheckCheck size={16} /> : <Sparkles size={16} />}
              </div>
              <div>
                <p className={`text-xs font-extrabold ${textStrong}`}>
                  {selectedCount > 0
                    ? `${selectedCount} ta kvitansiya tanlandi (${selectedSum.toLocaleString()} UZS)`
                    : `Kutilayotgan to‘lovlar: ${countWaiting} ta (${sumWaiting.toLocaleString()} UZS)`}
                </p>
                <p className={`text-[11px] ${textMuted}`}>
                  {selectedCount > 0
                    ? "Tanlangan cheklar ustida bir vaqtda qaror qabul qiling"
                    : "Cheklarni ketma-ket ko‘rib chiqing yoki barchasini birdaniga tasdiqlang"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedCount > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenBatchSelected('approved')}
                    className="no-shelf inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-extrabold shadow-sm hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all"
                  >
                    <Check size={14} strokeWidth={2.8} />
                    <span>Tanlanganlarni tasdiqlash ({selectedCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenBatchSelected('rejected')}
                    className="no-shelf inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 active:scale-95 transition-all"
                  >
                    <X size={14} strokeWidth={2.6} />
                    <span>Rad etish</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedKeys([])}
                    className={`no-shelf text-xs font-bold px-2.5 py-2 rounded-xl transition-colors ${
                      isLight ? 'text-slate-600 hover:bg-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Tozalash
                  </button>
                </>
              ) : (
                <>
                  {aiMatchedGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={handleOpenBatchAiMatched}
                      className="no-shelf inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-300 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300 text-xs font-bold transition-all active:scale-95 shadow-xs"
                      title="AI to‘liq mos deb topgan kvitansiyalarni tasdiqlash"
                    >
                      <Sparkles size={13} className="text-indigo-500" />
                      <span>AI moslarni tasdiqlash ({aiMatchedGroups.length})</span>
                    </button>
                  )}
                  {waitingGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedGroup(waitingGroups[0])}
                      className={`no-shelf inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                        isLight
                          ? 'border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50'
                          : 'border-indigo-500/40 bg-slate-800 text-indigo-300 hover:bg-slate-700'
                      }`}
                    >
                      <Eye size={14} />
                      <span>Ketma-ket tekshirish (1/{countWaiting})</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className={`p-3.5 sm:p-4 rounded-2xl border space-y-3.5 ${ui.card}`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" size={17} />
            <input
              type="text"
              placeholder="Talaba ismi, oy yoki summa bo‘yicha qidirish..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className={`w-full rounded-xl border py-2.5 pl-10 pr-9 text-sm outline-none transition-all shadow-xs ${inputBg}`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
                className="no-shelf absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* View mode toggle (Cards vs Table) */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className={`no-shelf inline-flex items-center p-1 rounded-xl border gap-1 transition-colors ${
              isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`no-shelf inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'cards'
                    ? isLight
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/70'
                      : 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Kartalar ko'rinishi"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Kartalar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`no-shelf inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? isLight
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/70'
                      : 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Jadval ko'rinishi"
              >
                <TableIcon size={14} />
                <span className="hidden sm:inline">Jadval</span>
              </button>
            </div>

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
                className={`no-shelf inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all shrink-0 active:scale-95 ${
                  isLight
                    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                }`}
              >
                <X size={13} />
                <span>Tozalash</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Segmented Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${textMuted}`}>
            Filtr:
          </span>
          <div className={`no-shelf inline-flex items-center p-1 rounded-xl border gap-1 transition-colors flex-wrap ${
            isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
          }`}>
            {[
              { id: 'all', label: 'Barchasi', count: allGroups.length },
              { id: 'waiting', label: 'Kutilmoqda', count: countWaiting, highlight: countWaiting > 0 },
              { id: 'ai_matched', label: 'AI 100% Mos', count: aiMatchedGroups.length, icon: Sparkles },
              { id: 'approved', label: 'Tasdiqlangan', count: countApproved },
              { id: 'rejected', label: 'Rad etilgan', count: countRejected },
            ].map((tab) => {
              const isActive = activeTab === tab.id
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as PaymentTab)
                    setCurrentPage(1)
                  }}
                  className={`no-shelf relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 ${
                    isActive
                      ? isLight
                        ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/70 font-black'
                        : 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30 border border-indigo-500/30 font-black'
                      : isLight
                        ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
                  }`}
                >
                  {TabIcon && <TabIcon size={12} className={isActive ? 'text-white' : 'text-indigo-500'} />}
                  <span>{tab.label}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                      isActive
                        ? isLight
                          ? 'bg-indigo-50 text-indigo-700 font-black'
                          : 'bg-white/20 text-white font-black'
                        : isLight
                          ? 'bg-slate-200/80 text-slate-600'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.highlight && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1 animate-pulse" />
                    )}
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content: Cards View OR Table View */}
      {viewMode === 'cards' ? (
        <div className="space-y-4">
          {/* Master selection bar with custom checkbox */}
          {waitingCurrent.length > 0 && (
            <div className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
              someCurrentSelected
                ? isLight
                  ? 'bg-indigo-50/70 border-indigo-200/90 shadow-xs'
                  : 'bg-indigo-950/40 border-indigo-500/30 shadow-xs'
                : isLight
                  ? 'bg-slate-50/80 border-slate-200/80'
                  : 'bg-slate-900/50 border-slate-800'
            }`}>
              <div
                onClick={toggleSelectAllCurrent}
                className="flex items-center gap-2.5 cursor-pointer select-none group"
              >
                <CustomCheckbox
                  checked={allCurrentSelected}
                  indeterminate={someCurrentSelected && !allCurrentSelected}
                  onChange={toggleSelectAllCurrent}
                  size="md"
                  aria-label="Sahifadagi barcha kutilayotgan to'lovlarni tanlash"
                />
                <span className={`text-xs font-extrabold transition-colors ${
                  allCurrentSelected
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : textStrong
                }`}>
                  {allCurrentSelected
                    ? `Sahifadagi barcha ${waitingCurrent.length} ta kutilayotgan tanlandi`
                    : someCurrentSelected
                      ? `Sahifada ${selectedCurrentCount} / ${waitingCurrent.length} ta kutilayotgan tanlandi`
                      : `Sahifadagi barcha kutilayotganlarni tanlash (${waitingCurrent.length} ta)`}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {selectedCurrentCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedKeys((prev) => prev.filter((k) => !waitingCurrent.includes(k)))}
                    className="no-shelf text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2.5 py-1 rounded-lg hover:bg-white/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Tanlovni bekor qilish
                  </button>
                )}
                <span className={`text-[11px] font-medium hidden sm:inline ${textMuted}`}>
                  Jami: {filteredGroups.length} ta kvitansiya
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className={`p-12 rounded-2xl border text-center ${ui.card}`}>
              <Loader2 size={28} className="animate-spin mx-auto text-indigo-500 mb-2" />
              <p className={`text-sm font-bold ${textStrong}`}>Kvitansiyalar yuklanmoqda...</p>
            </div>
          ) : paginatedGroups.length === 0 ? (
            <div className={`p-12 text-center rounded-2xl border ${ui.card}`}>
              <Inbox size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
              <p className={`text-sm font-bold ${textStrong}`}>Ushbu toifada kvitansiyalar topilmadi.</p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  <RotateCcw size={12} />
                  Filtrni tozalash
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
              {paginatedGroups.map((group) => {
                const isWaiting = group.status === 'waiting'
                const isSelected = selectedKeys.includes(group.key)
                const isApproving = approvingKey === group.key

                return (
                  <motion.div
                    key={group.key}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? isLight
                          ? 'border-indigo-400 ring-2 ring-indigo-500/30 bg-gradient-to-br from-indigo-50/40 via-white to-white shadow-md shadow-indigo-500/10'
                          : 'border-indigo-500 ring-2 ring-indigo-500/35 bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 shadow-md shadow-black'
                        : ui.card
                    } ${ui.hoverLift}`}
                  >
                    {/* Top Row: Avatar + Name + Checkbox & Status */}
                    <div>
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {isWaiting && (
                            <CustomCheckbox
                              checked={isSelected}
                              onChange={() => toggleSelect(group.key)}
                              size="md"
                              aria-label={`${group.student_name} to'lovini tanlash`}
                              className="shrink-0"
                            />
                          )}
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border shadow-xs transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/25 ring-2 ring-indigo-400/30'
                                : isLight
                                  ? 'bg-slate-100 text-slate-700 border-slate-200/80'
                                  : 'bg-slate-800 text-slate-200 border-slate-700'
                            }`}
                          >
                            {getInitials(group.student_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4
                              onClick={() => setSelectedGroup(group)}
                              className={`text-sm font-extrabold truncate cursor-pointer transition-colors ${
                                isLight ? 'text-slate-900 hover:text-indigo-600' : 'text-slate-100 hover:text-indigo-400'
                              }`}
                              title={group.student_name}
                            >
                              {group.student_name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {group.months.length > 1 ? `${group.months.length} oylik to'lov` : "1 oylik to'lov"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border tracking-wide whitespace-nowrap shadow-2xs ${getStatusColor(group.status)}`}>
                          {isWaiting && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block mr-1 animate-pulse" />}
                          {getStatusLabel(group.status)}
                        </span>
                      </div>

                      {/* Structured Details Box */}
                      <div className={`my-3.5 rounded-xl p-3 border space-y-2 text-xs ${
                        isLight ? 'bg-slate-50/70 border-slate-200/60' : 'bg-slate-800/40 border-slate-700/60'
                      }`}>
                        {/* Period */}
                        <div className="flex justify-between items-center gap-2">
                          <span className={textMuted}>To‘lov davri:</span>
                          <span className={`font-bold truncate text-[11px] text-right ${textStrong}`}>
                            {formatPaymentPeriod(group.months, group.year)}
                          </span>
                        </div>

                        {/* Amount */}
                        <div className="flex justify-between items-baseline gap-2">
                          <span className={textMuted}>Summa:</span>
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

                        {/* Upload Date & AI Status */}
                        <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px]">
                          <span className={`flex items-center gap-1 ${textMuted}`}>
                            <Clock size={11} className="text-slate-400 shrink-0" />
                            {new Date(group.created_at).toLocaleDateString('uz-UZ')}
                          </span>

                          {group.ai_review === 'manual' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              <AlertCircle size={10} className="shrink-0" /> Qo‘lda tekshiruv
                            </span>
                          ) : group.ai_confidence !== undefined ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                              group.ai_extracted_amount === group.totalAmount
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}>
                              <Sparkles size={10} className="shrink-0" />
                              {group.ai_extracted_amount === group.totalAmount ? 'AI: 100% Mos' : `AI: ${group.ai_confidence}%`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Tekshirilmagan</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Toolbar */}
                    <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedGroup(group)}
                        className={`no-shelf inline-flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-2xs ${
                          isLight
                            ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
                            : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-indigo-300'
                        }`}
                      >
                        <Eye size={13} className="text-indigo-500" />
                        <span>Chekni ko‘rish</span>
                      </button>

                      {isWaiting ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => (isAiMatched(group) ? void handleApprove(group) : setSelectedGroup(group))}
                            disabled={isApproving}
                            className="no-shelf inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                            title={isAiMatched(group) ? "AI summani tasdiqlagan — darhol tasdiqlash" : "Avval chekni ochib ko‘rib, keyin tasdiqlash"}
                          >
                            {isApproving ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Check size={14} strokeWidth={3} />
                            )}
                            <span>{isAiMatched(group) ? "Tasdiqlash" : "Ko‘rib tasdiqlash"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGroup(group)
                              setRejectMode(true)
                            }}
                            className="no-shelf inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 active:scale-95 disabled:opacity-50 text-xs font-bold transition-all dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                            title="Rad etish"
                          >
                            <X size={14} strokeWidth={2.6} />
                            <span>Rad</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic px-1">
                          Ko‘rib chiqilgan
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Cards Pagination */}
          {totalPages > 1 && (
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${ui.card}`}>
              <p className={`text-xs ${textMuted}`}>
                Jami {filteredGroups.length} tadan {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredGroups.length)} ko‘rsatilmoqda
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={`no-shelf inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 ${
                    isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <ChevronLeft size={13} />
                  <span>Oldingi</span>
                </button>
                <span className={`text-xs font-black px-2 ${textStrong}`}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={`no-shelf inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 ${
                    isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <span>Keyingi</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className={`rounded-2xl border overflow-hidden transition-all shadow-sm ${
          isLight ? 'bg-white border-slate-200/90' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={`border-b select-none ${
                  isLight ? 'border-slate-200/90 bg-slate-50/80' : 'border-slate-800/80 bg-slate-950/50'
                }`}>
                  <th className="px-4 py-3.5 w-12 text-center">
                    <CustomCheckbox
                      checked={allCurrentSelected}
                      indeterminate={someCurrentSelected && !allCurrentSelected}
                      onChange={toggleSelectAllCurrent}
                      size="sm"
                      aria-label="Sahifadagi barcha kutilayotganlarni tanlash"
                    />
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Talaba</th>
                  <th className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">To‘lov davri</th>
                  <th className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Summa</th>
                  <th className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">AI Audit</th>
                  <th className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Sana</th>
                  <th className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Holat</th>
                  <th className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 text-right">Tezkor amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {paginatedGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      Ushbu toifada kvitansiyalar mavjud emas
                    </td>
                  </tr>
                ) : (
                  paginatedGroups.map((group) => {
                    const isWaiting = group.status === 'waiting'
                    const isSelected = selectedKeys.includes(group.key)
                    const isApproving = approvingKey === group.key

                    return (
                      <tr
                        key={group.key}
                        className={`transition-colors ${
                          isSelected
                            ? isLight ? 'bg-indigo-50/40' : 'bg-indigo-950/20'
                            : isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          {isWaiting ? (
                            <CustomCheckbox
                              checked={isSelected}
                              onChange={() => toggleSelect(group.key)}
                              size="sm"
                              aria-label={`${group.student_name} to'lovini tanlash`}
                            />
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 font-bold">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-[11px] flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                              {getInitials(group.student_name)}
                            </div>
                            <span
                              onClick={() => setSelectedGroup(group)}
                              className={`truncate max-w-[200px] cursor-pointer hover:text-indigo-600 ${textStrong}`}
                              title={group.student_name}
                            >
                              {group.student_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                          {formatPaymentPeriod(group.months, group.year)}
                        </td>
                        <td className="px-4 py-3 font-black text-indigo-600 dark:text-indigo-400">
                          {group.totalAmount.toLocaleString()} UZS
                        </td>
                        <td className="px-4 py-3">
                          {group.ai_extracted_amount === group.totalAmount ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <Sparkles size={11} /> 100% Mos
                            </span>
                          ) : group.ai_confidence !== undefined ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              {group.ai_confidence}%
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(group.created_at).toLocaleDateString('uz-UZ')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(group.status)}`}>
                            {getStatusLabel(group.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedGroup(group)}
                              className="px-2.5 py-1 rounded-lg border text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Chekni ko'rish"
                            >
                              <Eye size={12} className="inline mr-1" />
                              Chek
                            </button>

                            {isWaiting && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => (isAiMatched(group) ? void handleApprove(group) : setSelectedGroup(group))}
                                  disabled={isApproving}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-xs flex items-center gap-1"
                                  title={isAiMatched(group) ? "AI summani tasdiqlagan — darhol tasdiqlash" : "Avval chekni ochib ko‘rib, keyin tasdiqlash"}
                                >
                                  {isApproving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} strokeWidth={2.8} />}
                                  <span>{isAiMatched(group) ? "Tasdiqlash" : "Ko‘rib tasdiqlash"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedGroup(group)
                                    setRejectMode(true)
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition-all dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300"
                                  title="Rad etish"
                                >
                                  Rad
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          {totalPages > 1 && (
            <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isLight ? 'bg-slate-50/60 border-slate-200/90' : 'bg-slate-900/60 border-slate-800'
            }`}>
              <p className={`text-xs ${textMuted}`}>
                Jami {filteredGroups.length} tadan {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredGroups.length)} ko‘rsatilmoqda
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold disabled:opacity-40"
                >
                  Oldingi
                </button>
                <span className={`text-xs font-black px-2 ${textStrong}`}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold disabled:opacity-40"
                >
                  Keyingi
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Sticky Batch Actions Toolbar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="sticky bottom-4 z-30 mx-auto max-w-3xl"
          >
            <div className={`p-3 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isLight
                ? 'bg-white/95 border-indigo-200/90 shadow-indigo-950/20 text-slate-800'
                : 'bg-slate-900/95 border-indigo-500/30 shadow-black/60 text-white'
            }`}>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-indigo-600/30">
                  {selectedCount}
                </div>
                <div>
                  <p className="text-xs font-black">
                    {selectedCount} ta kvitansiya tanlandi ({selectedSum.toLocaleString()} UZS)
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedKeys([])}
                    className="text-[11px] font-bold text-indigo-500 hover:underline"
                  >
                    Tanlovni bekor qilish
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenBatchSelected('rejected')}
                  disabled={batchActionLoading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-950/30 active:scale-95 no-shelf cursor-pointer"
                >
                  <X size={14} />
                  <span>Rad etish ({selectedCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenBatchSelected('approved')}
                  disabled={batchActionLoading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/25 active:scale-95 no-shelf cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck size={16} strokeWidth={2.8} />
                  <span>Tasdiqlash ({selectedCount})</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review & Sequential Queue Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className={`w-full max-w-5xl rounded-3xl border backdrop-blur-xl relative flex flex-col max-h-[92vh] shadow-2xl overflow-hidden ${
            isLight ? 'bg-white border-slate-200/90 shadow-slate-900/20' : 'bg-slate-950 border-slate-800/90 shadow-black'
          }`}>
            {/* Modal Header with Sequential Queue Navigator */}
            <div className={`px-5 sm:px-6 py-4 border-b flex items-center justify-between gap-4 shrink-0 ${
              isLight ? 'border-slate-100 bg-slate-50/80' : 'border-slate-800/70 bg-slate-900/50'
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

              {/* Queue Navigation Arrows & Close */}
              <div className="flex items-center gap-2">
                {currentQueueIndex >= 0 && waitingGroups.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 mr-1">
                    <button
                      type="button"
                      disabled={currentQueueIndex <= 0}
                      onClick={handleModalPrev}
                      className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all cursor-pointer"
                      title="Oldingi kvitansiya"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-black px-2 text-indigo-600 dark:text-indigo-400">
                      {currentQueueIndex + 1} / {waitingGroups.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentQueueIndex >= waitingGroups.length - 1}
                      onClick={handleModalNext}
                      className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all cursor-pointer"
                      title="Keyingi kvitansiya"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

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
                      onClick={() => window.open(receiptSignedUrl, '_blank')}
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
                          onClick={() => receiptSignedUrl && window.open(receiptSignedUrl, '_blank')}
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
                          onClick={() => window.open(receiptSignedUrl, '_blank')}
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
                          Fayl o&apos;chirilgan yoki vaqtincha mavjud emas.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={24} className="animate-spin text-indigo-500" />
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
                        selectedGroup.ai_extracted_amount === selectedGroup.totalAmount
                          ? isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                          : isLight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                      }`}>
                        Haqiqiylik: {selectedGroup.ai_confidence}%
                      </span>
                    )}
                  </div>

                  {selectedGroup.ai_confidence === undefined ? (
                    <div className="text-center py-3 space-y-2.5">
                      <p className={`text-xs ${textMuted}`}>Ushbu chek hali AI auditidan o&apos;tkazilmagan.</p>
                      <button
                        type="button"
                        onClick={() => handleRunAI(selectedGroup)}
                        disabled={analyzing}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 mx-auto bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs no-shelf cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {analyzing ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
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
                        {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
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

            {/* Modal Actions Footer with Continuous Queue Flow */}
            <div className={`px-5 sm:px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0 ${
              isLight ? 'border-slate-100 bg-slate-50/50' : 'border-slate-800/70 bg-slate-900/40'
            }`}>
              {rejectMode ? (
                <div className="flex items-center gap-3 w-full">
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
                    onClick={handleModalReject}
                    disabled={submitting || !rejectReason.trim()}
                    className={`flex-1 py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-white no-shelf cursor-pointer flex items-center justify-center gap-1.5 ${
                      !rejectReason.trim()
                        ? 'bg-rose-400 cursor-not-allowed opacity-60'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-xs'
                    }`}
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    <span>Rad etishni tasdiqlash</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full gap-3">
                  {selectedGroup.status === 'waiting' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejectMode(true)}
                        className="py-2.5 sm:py-3 px-5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/20 no-shelf cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <X size={14} />
                        <span>Rad etish</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleModalApprove}
                        disabled={submitting}
                        className="flex-1 py-2.5 sm:py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all text-white flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/25 no-shelf cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {submitting ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Check size={16} strokeWidth={2.8} />
                        )}
                        <span>
                          {selectedGroup.months.length > 1
                            ? `${selectedGroup.months.length} oyni tasdiqlash`
                            : "Kvitansiyani tasdiqlash"}
                        </span>
                        {currentQueueIndex >= 0 && currentQueueIndex < waitingGroups.length - 1 && (
                          <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full ml-1 flex items-center gap-1">
                            Keyingisi <ArrowRight size={11} />
                          </span>
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-slate-400 italic">
                        Ushbu to‘lov allaqachon ko‘rib chiqilgan
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedGroup(null)}
                        className={`py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all no-shelf cursor-pointer ${
                          isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        Yopish
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Confirmation Modal */}
      <ConfirmModal
        isOpen={batchConfirmModal.isOpen}
        title={batchConfirmModal.title}
        description={batchConfirmModal.description}
        onClose={() => {
          setBatchConfirmModal({ isOpen: false, action: 'approved', groups: [], title: '', description: '' })
          setBatchRejectReason('')
        }}
        onConfirm={confirmBatchExecution}
        confirmText={batchConfirmModal.action === 'approved' ? 'Ha, tasdiqlash' : 'Ha, rad etish'}
        confirmVariant={batchConfirmModal.action === 'approved' ? 'primary' : 'danger'}
        isLoading={batchActionLoading}
      >
        {batchConfirmModal.action === 'rejected' && (
          <div className="space-y-2.5 text-left">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>Rad etish sababi (talabaga yuboriladi)</p>
            <div className="flex flex-wrap gap-1.5">
              {REJECTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBatchRejectReason(preset)}
                  className={`no-shelf rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    batchRejectReason === preset
                      ? isLight ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                      : isLight ? 'border-slate-200 bg-white text-slate-600 hover:border-rose-200' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-rose-500/30'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              value={batchRejectReason}
              onChange={(e) => setBatchRejectReason(e.target.value)}
              maxLength={400}
              rows={2}
              placeholder="Yoki sababni o‘zingiz yozing"
              className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`}
            />
          </div>
        )}
      </ConfirmModal>
    </div>
  )
}
