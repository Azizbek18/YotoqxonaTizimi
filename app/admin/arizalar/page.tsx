'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Search, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface ApplicationUser {
  full_name: string;
  email: string;
}

interface ApplicationRequest {
  id: string;
  talaba_id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  users?: ApplicationUser;
  user: ApplicationUser;
}

export default function AdminArizalar() {
  const [requests, setRequests] = useState<ApplicationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true)
      // Arizalarni talaba ma'lumotlari bilan birga bitta so'rovda olish
      const { data, error } = await supabase
        .from('arizalar')
        .select(`
          id, 
          talaba_id, 
          title, 
          description, 
          status, 
          created_at, 
          updated_at,
          users:talaba_id (full_name, email)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rawData = (data || []) as unknown as (Omit<ApplicationRequest, 'user'> & { users: ApplicationUser })[];
      const formattedRequests: ApplicationRequest[] = rawData.map((request) => ({
        ...request,
        user: request.users || { full_name: 'Nomalum', email: '' },
      }))

      if (filterStatus !== 'all') {
        const filtered = formattedRequests.filter((r) => r.status === filterStatus)
        setRequests(filtered)
      } else {
        setRequests(formattedRequests)
      }
    } catch (error) {
      console.error('Arizalarni yuklashda xato:', error)
      toast.error("Arizalarni yuklashda xato!")
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const filteredRequests = requests.filter((request) =>
    request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter">
          Arizalar
        </h1>
        <p className="text-slate-400 mt-2">Talabalardan kelgan barcha arizalar</p>
      </div>

      {/* Search va Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Arizani qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b1120]/50 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder-slate-500 outline-none focus:border-purple-500/50 transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-[#0b1120]/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-500/50 transition-all"
        >
          <option value="all">Barcha holatlar</option>
          <option value="new">Yangi</option>
          <option value="in_progress">Jarayon</option>
          <option value="resolved">Hal qilindi</option>
          <option value="rejected">Rad etildi</option>
        </select>
      </div>

      {/* Arizalar Jadvali */}
      <div className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Arizalar yuklanyapti...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Arizalar topilmadi</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Sarlavha
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Talaba
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Holat
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Sana
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Amallar
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request, index) => (
                  <motion.tr
                    key={request.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">{request.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{request.description.substring(0, 50)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-white">{request.user?.full_name}</p>
                        <p className="text-xs text-slate-500">{request.user?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[request.status] || statusColors.new}`}>
                        {request.status === 'new' ? 'Yangi' : request.status === 'in_progress' ? 'Jarayon' : request.status === 'resolved' ? 'Hal qilindi' : 'Rad etildi'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(request.created_at).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-purple-400 hover:text-purple-300 transition-colors p-2">
                        <Eye size={18} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
