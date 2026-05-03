'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ariza } from '@/lib/types'

export default function TarbiyachiArizalarPage() {
  const [items, setItems] = useState<Ariza[]>([])
  const [level, setLevel] = useState<'all' | Ariza['level']>('all')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('arizalar').select('*').order('created_at', { ascending: false })
      setItems((data ?? []) as Ariza[])
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (level === 'all') return items
    return items.filter((item) => item.level === level)
  }, [items, level])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">Arizalar nazorati</h2>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as 'all' | Ariza['level'])}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
        >
          <option value="all">Barchasi</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-bold">{item.student_name}</p>
              <span className="text-xs uppercase text-slate-400">{item.level}</span>
            </div>
            <p className="text-sm text-slate-300">{item.text}</p>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-400">Hozircha arizalar yo&apos;q.</p>}
      </div>
    </div>
  )
}
