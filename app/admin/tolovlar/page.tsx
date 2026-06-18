'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  CreditCard, Search, Check, X, Clock, AlertCircle,
  Eye, Download, FileText, Calendar, DollarSign, User,
  HelpCircle, Sparkles, ArrowRight, CheckCircle2, ChevronRight, Loader,
  Layers
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface PaymentRecord {
  id: string
  student_id: string
  student_name: string
  month: string
  year: number
  amount: number
  status: 'paid' | 'pending' | 'rejected' | 'waiting' | 'approved'
  receipt_url?: string
  admin_message?: string
  created_at: string
  ai_confidence?: number
  ai_extracted_amount?: number
  ai_analysis?: string
}

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
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Noma\'lum xato'
}

export default function AdminTolovlarPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [records, setRecords] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'waiting' | 'approved' | 'rejected' | 'all'>('waiting')

  // Review modal states
  const [selectedGroup, setSelectedGroup] = useState<GroupedPayment | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

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
      const { data, error } = await supabase
        .from('tolovlar')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecords(data || [])
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
      const { error } = await supabase
        .from('tolovlar')
        .update({
          status: 'approved',
          admin_message: 'To\'lov muvaffaqiyatli tasdiqlandi. Rahmat! ✅'
        })
        .in('id', ids)

      if (error) throw error

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
      const { error } = await supabase
        .from('tolovlar')
        .update({
          status: 'rejected',
          admin_message: `Rad etildi: ${rejectReason}`
        })
        .in('id', ids)

      if (error) throw error

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
        months: groupRecs.map(r => r.month),
        year: first.year,
        totalAmount: groupRecs.reduce((sum, r) => sum + r.amount, 0),
        status: first.status,
        receipt_url: first.receipt_url,
        created_at: first.created_at,
        ai_confidence: first.ai_confidence,
        ai_extracted_amount: first.ai_extracted_amount,
        ai_analysis: first.ai_analysis
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

  const surfaceBg = isLight ? 'bg-white/80 border-slate-200/80 shadow-lg shadow-slate-100/40' : 'bg-[#0f172a]/30 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.3)]'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const inputBg = isLight ? 'bg-slate-50 border-slate-200 focus:bg-white text-slate-900' : 'bg-slate-900/40 border-white/5 focus:bg-slate-950/40 text-white'

  return (
    <div className="space-y-8 pb-12">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={20} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>To&apos;lov Audit</span>
          </div>
          <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${textStrong}`}>
            Kvitansiyalar <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">Nazorati</span>
          </h1>
          <p className={`mt-2 text-sm ${textMuted}`}>
            Talabalar tomonidan yuborilgan to&apos;lov kvitansiyalarini tekshirish, tasdiqlash va rad etish boshqaruvi.
          </p>
        </div>
      </div>

      {/* Stats Cards Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Waiting Card */}
        <div className={`relative p-5 rounded-3xl border backdrop-blur-xl ${surfaceBg} border-amber-500/20 shadow-[0_10px_30px_rgba(245,158,11,0.04)]`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-[9px] font-black uppercase tracking-wider ${textMuted}`}>Kutilmoqda</span>
            <div className={`p-2 rounded-xl ${isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/10 text-amber-400'}`}>
              <Clock size={16} />
            </div>
          </div>
          <p className={`text-3xl font-black tracking-tight ${textStrong}`}>{countWaiting} ta</p>
          <p className="text-[10px] text-slate-500 mt-2">Tasdiqlash kutilayotgan cheklar</p>
        </div>

        {/* Approved Card */}
        <div className={`relative p-5 rounded-3xl border backdrop-blur-xl ${surfaceBg} border-emerald-500/20 shadow-[0_10px_30px_rgba(16,185,129,0.04)]`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-[9px] font-black uppercase tracking-wider ${textMuted}`}>Tasdiqlangan</span>
            <div className={`p-2 rounded-xl ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <Check size={16} />
            </div>
          </div>
          <p className={`text-3xl font-black tracking-tight ${textStrong}`}>{countApproved} ta</p>
          <p className="text-[10px] text-slate-500 mt-2">Qabul qilingan oylar</p>
        </div>

        {/* Rejected Card */}
        <div className={`relative p-5 rounded-3xl border backdrop-blur-xl ${surfaceBg} border-rose-500/20 shadow-[0_10px_30px_rgba(244,63,94,0.04)]`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-[9px] font-black uppercase tracking-wider ${textMuted}`}>Rad etilgan</span>
            <div className={`p-2 rounded-xl ${isLight ? 'bg-rose-50 text-rose-600' : 'bg-rose-500/10 text-rose-400'}`}>
              <X size={16} />
            </div>
          </div>
          <p className={`text-3xl font-black tracking-tight ${textStrong}`}>{countRejected} ta</p>
          <p className="text-[10px] text-slate-500 mt-2">Xatolik sababli qaytarilganlar</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 rounded-[28px] border backdrop-blur-xl ${surfaceBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
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
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs font-semibold focus:outline-hidden focus:border-blue-500/80 transition-all ${inputBg}`}
          />
        </div>

        {/* Tabs */}
        <div className={`flex p-0.5 rounded-xl border shrink-0 max-w-full overflow-x-auto no-scrollbar flex-nowrap ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/60 border-white/5'}`}>
          {(['waiting', 'approved', 'rejected', 'all'] as const).map((tab) => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all shrink-0 whitespace-nowrap ${
                  isActive
                    ? isLight ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'bg-white/[0.08] text-cyan-400 border border-cyan-400/20'
                    : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'waiting' && `Kutilmoqda (${countWaiting})`}
                {tab === 'approved' && `Tasdiqlangan (${countApproved})`}
                {tab === 'rejected' && `Rad etilgan (${countRejected})`}
                {tab === 'all' && `Barchasi (${records.length})`}
              </button>
            )
          })}
        </div>
      </div>

      {/* Records Container */}
      {loading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${isLight ? 'border-blue-600' : 'border-cyan-400'}`}></div>
          </div>
        </div>
      ) : groupedPayments.length === 0 ? (
        <div className={`p-12 text-center rounded-[32px] border ${surfaceBg}`}>
          <p className={`text-sm ${textMuted}`}>Ushbu toifada hech qanday kvitansiya mavjud emas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groupedPayments.map((group) => (
            <div
              key={group.key}
              className={`group rounded-[32px] border p-5 backdrop-blur-xl relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${
                isLight ? 'bg-white border-slate-200/80 hover:border-blue-300' : 'bg-[#0f172a]/30 border-white/5 hover:border-cyan-400/30'
              }`}
            >
              {/* Multi-month badge */}
              {group.months.length > 1 && (
                <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${
                  isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400'
                }`}>
                  <Layers size={10} />
                  {group.months.length} oylik
                </div>
              )}

              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.03] text-slate-400'}`}>
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-sm font-black truncate max-w-[160px] ${textStrong}`}>
                      {group.student_name}
                    </h4>
                    <p className={`text-[10px] mt-0.5 ${textMuted}`}>Talaba</p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border whitespace-nowrap ${
                  group.months.length > 1 ? 'mt-5' : ''
                } ${getStatusColor(group.status)}`}>
                  {getStatusLabel(group.status)}
                </span>
              </div>

              <div className={`p-4 rounded-2xl border mb-5 space-y-2.5 text-xs ${
                isLight ? 'bg-slate-50/50 border-slate-100' : 'bg-slate-900/10 border-white/5'
              }`}>
                <div className="flex justify-between items-center">
                  <span className={textMuted}>{group.months.length > 1 ? 'Oylar:' : 'Oy:'}</span>
                  <span className={`font-bold ${textStrong}`}>
                    {group.months.length > 1 
                      ? <span className="flex flex-wrap justify-end gap-1">
                          {group.months.map((m, i) => (
                            <span key={m} className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                              isLight ? 'bg-blue-50 text-blue-700' : 'bg-cyan-500/10 text-cyan-400'
                            }`}>
                              {m}{i < group.months.length - 1 ? '' : ''}
                            </span>
                          ))}
                          <span className={`text-[10px] ${textMuted}`}>{group.year}</span>
                        </span>
                      : `${group.months[0]} ${group.year}`
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={textMuted}>Jami summa:</span>
                  <span className={`font-black ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
                    {group.totalAmount.toLocaleString()} UZS
                  </span>
                </div>
                {group.months.length > 1 && (
                  <div className="flex justify-between items-center">
                    <span className={textMuted}>Har bir oy:</span>
                    <span className={`font-semibold ${textStrong}`}>
                      {group.records[0].amount.toLocaleString()} UZS
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className={textMuted}>Sana:</span>
                  <span className={textStrong}>{new Date(group.created_at).toLocaleDateString('uz-UZ')}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedGroup(group)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${
                    group.status === 'waiting'
                      ? isLight
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10'
                        : 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-500/10'
                      : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <Eye size={14} />
                  <span>{group.status === 'waiting' ? 'Tekshirish' : 'Ko\'rish'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review & Approve Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className={`w-full max-w-2xl rounded-[32px] border p-6 backdrop-blur-xl relative flex flex-col justify-between max-h-[90vh] ${
            isLight ? 'bg-white border-slate-200 shadow-2xl' : 'bg-slate-950 border-white/5 shadow-2xl shadow-slate-950'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/40 mb-4 shrink-0">
              <div>
                <h3 className={`text-lg font-black tracking-tight ${textStrong}`}>
                  🔍 Kvitansiyani Tekshirish
                </h3>
                <p className={`text-xs mt-1 truncate max-w-[300px] ${textMuted}`}>
                  {selectedGroup.student_name} • {selectedGroup.months.join(', ')} {selectedGroup.year}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedGroup(null)
                  setRejectMode(false)
                  setRejectReason('')
                }}
                className={`p-2 rounded-xl transition-all border ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs sm:text-sm">
              {/* Info Grid */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isLight ? 'bg-slate-50/50 border-slate-100' : 'bg-slate-900/10 border-white/5'
              }`}>
                <div className="flex justify-between items-center">
                  <span className={textMuted}>Talaba ismi:</span>
                  <span className={`font-bold ${textStrong}`}>{selectedGroup.student_name}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className={`${textMuted} shrink-0`}>{selectedGroup.months.length > 1 ? 'Oylar:' : 'Oy:'}</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {selectedGroup.months.map((m) => (
                      <span key={m} className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        isLight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      }`}>
                        {m}
                      </span>
                    ))}
                    <span className={`text-[10px] font-semibold self-center ${textMuted}`}>{selectedGroup.year}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className={textMuted}>Jami summa:</span>
                  <span className={`font-black ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
                    {selectedGroup.totalAmount.toLocaleString()} UZS
                  </span>
                </div>
                {selectedGroup.months.length > 1 && (
                  <div className="flex justify-between items-center">
                    <span className={textMuted}>Har bir oy:</span>
                    <span className={`font-semibold ${textStrong}`}>
                      {selectedGroup.records[0].amount.toLocaleString()} UZS × {selectedGroup.months.length} oy
                    </span>
                  </div>
                )}
              </div>

              {/* Receipt File Container */}
              <div className="space-y-2">
                <p className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Kvitansiya fayli (Chek)</p>
                
                {selectedGroup.receipt_url ? (
                  <div className={`p-2 rounded-2xl border flex flex-col justify-center items-center relative overflow-hidden min-h-[180px] sm:min-h-[300px] ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/50 border-white/5'
                  }`}>
                    {selectedGroup.receipt_url.toLowerCase().endsWith('.pdf') ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                        <FileText size={48} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                        <div>
                          <p className={`font-bold text-sm ${textStrong}`}>PDF Formatidagi Hujjat</p>
                          <p className={`text-xs mt-1 ${textMuted}`}>Ushbu kvitansiya PDF hujjat shaklida yuklangan.</p>
                        </div>
                        <button
                          onClick={() => viewReceipt(selectedGroup.receipt_url)}
                          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                            isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <Eye size={14} />
                          <span>PDFni ochish</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <img
                          src={selectedGroup.receipt_url}
                          alt="Chek tasviri"
                          className="max-h-[180px] sm:max-h-[350px] object-contain rounded-xl shadow-md border"
                        />
                        <button
                          onClick={() => viewReceipt(selectedGroup.receipt_url)}
                          className={`absolute bottom-3 right-3 p-2 rounded-xl border backdrop-blur-md transition-all ${
                            isLight ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white' : 'bg-slate-900/80 border-white/5 text-slate-200 hover:bg-slate-900'
                          }`}
                          title="Rasm faylini ochish"
                        >
                          <Eye size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-rose-500 font-bold border rounded-2xl">
                    Yuklangan fayl topilmadi!
                  </div>
                )}
              </div>

              {/* AI Audit Tahlili */}
              <div className={`p-5 rounded-2xl border backdrop-blur-xl relative overflow-hidden space-y-4 ${
                isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-900/30 border-white/5'
              }`}>
                {/* Decorative glow */}
                <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-cyan-500/10 blur-xl pointer-events-none" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
                    <h4 className={`text-xs font-black uppercase tracking-wider ${textStrong}`}>🤖 AI Audit Tahlili</h4>
                  </div>
                  {selectedGroup.ai_confidence !== undefined && (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border tracking-wider uppercase ${
                      selectedGroup.ai_confidence >= 80
                        ? isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                        : selectedGroup.ai_confidence >= 50
                          ? isLight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                          : isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-500/10 border-rose-500/20 text-rose-300 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse'
                    }`}>
                      Haqiqiylik: {selectedGroup.ai_confidence}%
                    </span>
                  )}
                </div>

                {selectedGroup.ai_confidence === undefined ? (
                  <div className="text-center py-4 space-y-3">
                    <p className={`text-xs ${textMuted}`}>Ushbu chek hali AI auditidan o&apos;tkazilmagan.</p>
                    <button
                      onClick={() => handleRunAI(selectedGroup)}
                      disabled={analyzing}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 mx-auto ${
                        isLight 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                          : 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-500/10'
                      }`}
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
                  <div className="space-y-3.5">
                    {/* Amount Comparison Check */}
                    {selectedGroup.ai_extracted_amount !== selectedGroup.totalAmount ? (
                      <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 shadow-sm ${
                        isLight ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                      }`}>
                        <AlertCircle className="shrink-0 mt-0.5 animate-bounce" size={16} />
                        <div>
                          <p className="font-black text-xs uppercase tracking-wide">⚠️ Summa mos kelmadi!</p>
                          <p className="text-xs mt-1">
                            Talaba kiritgan jami: <span className="font-bold underline">{selectedGroup.totalAmount.toLocaleString()} UZS</span>. <br />
                            AI aniqlagan summa: <span className="font-bold underline">{selectedGroup.ai_extracted_amount?.toLocaleString() || 'Aniqlanmadi'} UZS</span>.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 ${
                        isLight ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-emerald-950/15 border-emerald-900/30 text-emerald-300'
                      }`}>
                        <CheckCircle2 className="shrink-0" size={16} />
                        <span className="text-xs font-semibold">
                          Summa mos keladi: {selectedGroup.totalAmount.toLocaleString()} UZS
                        </span>
                      </div>
                    )}

                    {/* AI Feedback message */}
                    <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                      isLight ? 'bg-white border-slate-100' : 'bg-white/[0.02] border-white/5'
                    }`}>
                      <p className={`font-bold mb-1 ${textStrong}`}>AI Audit izohi:</p>
                      <p className={textMuted}>{selectedGroup.ai_analysis}</p>
                    </div>

                    {/* Re-run button */}
                    <button
                      onClick={() => handleRunAI(selectedGroup)}
                      disabled={analyzing}
                      className={`text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 opacity-60 hover:opacity-100 ${
                        isLight ? 'text-blue-600' : 'text-cyan-400'
                      }`}
                    >
                      {analyzing ? <Loader size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      <span>Tahlilni qayta ishga tushirish</span>
                    </button>
                  </div>
                )}
              </div>


              {/* Rejection Feed Area */}
              {rejectMode && (
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-rose-50/40 border-rose-200' : 'bg-rose-950/[0.04] border-rose-900/30'
                }`}>
                  <label className={`block text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                    Rad etish sababi:
                  </label>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Masalan: Chek to'liq tushmagan, summa noto'g'ri ko'rsatilgan..."
                    className={`w-full p-3 rounded-xl border text-xs font-bold transition-all focus:outline-hidden focus:border-rose-500/80 ${
                      isLight ? 'bg-white border-rose-300 text-slate-900' : 'bg-slate-900/60 border-rose-900/30 text-white'
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-200/40 mt-4 shrink-0">
              {rejectMode ? (
                <>
                  <button
                    onClick={() => {
                      setRejectMode(false)
                      setRejectReason('')
                    }}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    Bekor qilish
                  </button>
                  <button
                    onClick={() => handleReject(selectedGroup)}
                    disabled={submitting || !rejectReason.trim()}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-white shadow-md ${
                      !rejectReason.trim()
                        ? 'bg-rose-500/50 cursor-not-allowed'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'
                    }`}
                  >
                    {submitting ? <Loader size={14} className="animate-spin inline mr-1" /> : <X size={14} className="inline mr-1" />}
                    <span>{selectedGroup.months.length > 1 ? `${selectedGroup.months.length} oyni rad etish` : 'Rad etishni tasdiqlash'}</span>
                  </button>
                </>
              ) : (
                <>
                  {selectedGroup.status === 'waiting' && (
                    <>
                      <button
                        onClick={() => setRejectMode(true)}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-rose-500/20 text-rose-500 hover:bg-rose-500/5 ${
                          isLight ? 'bg-rose-50/25' : 'bg-rose-500/[0.02]'
                        }`}
                      >
                        <X size={14} className="inline mr-1" />
                        <span>Rad etish</span>
                      </button>
                      <button
                        onClick={() => handleApprove(selectedGroup)}
                        disabled={submitting}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-white shadow-lg flex items-center justify-center gap-1.5 ${
                          isLight ? 'bg-green-600 hover:bg-green-700 shadow-green-600/15' : 'bg-green-600 hover:bg-green-700 shadow-green-600/15'
                        }`}
                      >
                        {submitting ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                        <span>{selectedGroup.months.length > 1 ? `${selectedGroup.months.length} oyni tasdiqlash` : 'Kvitansiyani qabul qilish'}</span>
                      </button>
                    </>
                  )}
                  {selectedGroup.status !== 'waiting' && (
                    <button
                      onClick={() => setSelectedGroup(null)}
                      className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-slate-300'
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
