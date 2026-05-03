'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Users, Search, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

type UserRow = {
  id: string
  full_name: string
  email: string
  role: 'talaba' | 'tarbiyachi' | 'admin'
  created_at: string
}

const ROLE_OPTIONS: UserRow['role'][] = ['talaba', 'tarbiyachi', 'admin']

const ROLE_LABELS: Record<string, string> = {
  talaba: 'Talaba',
  tarbiyachi: 'Tarbiyachi',
  admin: 'Admin',
}

const ROLE_COLORS: Record<string, string> = {
  talaba: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  tarbiyachi: 'bg-green-500/20 text-green-400 border-green-500/30',
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers((data ?? []) as UserRow[])
    } catch (error) {
      console.error('Foydalanuvchilarni yuklashda xato:', error)
      toast.error('Foydalanuvchilarni yuklashda xato!')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const updateRole = async (id: string, role: UserRow['role']) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', id)

      if (error) throw error

      setUsers((prev) =>
        prev.map((user) => (user.id === id ? { ...user, role } : user))
      )
      setEditingId(null)
      toast.success('Rol muvaffaqiyatli o\'zgartirildi!')
    } catch (error) {
      console.error('Rolni o\'zgartirishda xato:', error)
      toast.error('Rolni o\'zgartirishda xato!')
    }
  }

  const deleteUser = async (id: string) => {
    if (!window.confirm('Siz foydalanuvchini o\'chirishni xohlaysizmi?')) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) throw error

      setUsers((prev) => prev.filter((user) => user.id !== id))
      toast.success('Foydalanuvchi muvaffaqiyatli o\'chirildi!')
    } catch (error) {
      console.error('Foydalanuvchini o\'chirishda xato:', error)
      toast.error('Foydalanuvchini o\'chirishda xato!')
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter">
          Foydalanuvchilar
        </h1>
        <p className="text-slate-400 mt-2">Barcha foydalanuvchilarni boshqarish va rol o'zgartirishI</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Ism yoki emailni qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b1120]/50 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder-slate-500 outline-none focus:border-purple-500/50 transition-all"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Foydalanuvchilar yuklanyapti...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Foydalanuvchilar topilmadi</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Ism Familiya
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Ro'yxatdan O'tish Sanasi
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">
                    Amallar
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-white">{user.full_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-400">{user.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      {editingId === user.id ? (
                        <select
                          value={user.role}
                          onChange={(e) =>
                            updateRole(user.id, e.target.value as UserRow['role'])
                          }
                          autoFocus
                          className="bg-[#0b1120] border border-purple-500/50 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500"
                          onBlur={() => setEditingId(null)}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${ROLE_COLORS[user.role]}`}
                        >
                          {ROLE_LABELS[user.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(user.created_at).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(editingId === user.id ? null : user.id)}
                          className="text-blue-400 hover:text-blue-300 transition-colors p-2"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="text-red-400 hover:text-red-300 transition-colors p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
        {[
          { label: 'Jami Talabalar', count: users.filter(u => u.role === 'talaba').length },
          { label: 'Tarbiyachilar', count: users.filter(u => u.role === 'tarbiyachi').length },
          { label: 'Adminlar', count: users.filter(u => u.role === 'admin').length },
        ].map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-lg p-4"
          >
            <p className="text-slate-400 text-sm">{stat.label}</p>
            <p className="text-2xl font-black text-white mt-2">{stat.count}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

