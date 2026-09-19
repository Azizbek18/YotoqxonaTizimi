'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

export interface TableColumn<T> {
  key: string
  label: string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T) => React.ReactNode
}

interface AdminTableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  isLoading?: boolean
  onRowClick?: (row: T) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
  emptyMessage?: string
  pagination?: {
    current: number
    total: number
    pageSize: number
    onPageChange: (page: number) => void
  }
}

export default function AdminTable<T extends object>({
  columns,
  data,
  isLoading = false,
  onRowClick,
  sortBy,
  sortOrder = 'asc',
  onSort,
  emptyMessage,
  pagination,
}: AdminTableProps<T>) {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const sortedData = useMemo(() => {
    if (!sortBy || !onSort) return data

    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortBy]
      const bVal = (b as Record<string, unknown>)[sortBy]
      const normalizedA = typeof aVal === 'number' ? aVal : String(aVal ?? '')
      const normalizedB = typeof bVal === 'number' ? bVal : String(bVal ?? '')

      if (normalizedA < normalizedB) return sortOrder === 'asc' ? -1 : 1
      if (normalizedA > normalizedB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortBy, sortOrder, onSort])

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all shadow-sm ${
      isLight ? 'bg-white border-slate-200/90 shadow-slate-200/50' : 'bg-slate-900/80 border-slate-800 shadow-black/40'
    }`}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className={`border-b select-none ${
              isLight ? 'border-slate-200/90 bg-slate-50/80' : 'border-slate-800/80 bg-slate-950/50'
            }`}>
              {columns.map((col) => {
                const isSorted = sortBy === col.key
                return (
                  <th
                    key={col.key}
                    className={`px-5 py-3.5 text-[11px] font-extrabold uppercase tracking-wider transition-colors ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    } ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.width || ''} ${
                      col.sortable ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''
                    }`}
                    onClick={() => col.sortable && onSort?.(col.key)}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${
                      col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'
                    }`}>
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className={`transition-opacity ${isSorted ? 'opacity-100 text-indigo-500' : 'opacity-30'}`}>
                          {isSorted && sortOrder === 'desc' ? (
                            <ChevronDown size={14} strokeWidth={2.5} />
                          ) : (
                            <ChevronUp size={14} strokeWidth={2.5} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 size={24} className="animate-spin text-indigo-500" />
                    <p className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Arizalar yuklanmoqda...
                    </p>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800/60 text-slate-500'
                    }`}>
                      <Inbox size={24} strokeWidth={1.8} />
                    </div>
                    <p className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                      {emptyMessage ?? 'Arizalar topilmadi'}
                    </p>
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Tanlangan filtr yoki qidiruv so‘rovi bo‘yicha hozircha hech qanday ma‘lumot mavjud emas.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.2), duration: 0.15 }}
                  className={`group transition-colors ${
                    isLight
                      ? 'hover:bg-indigo-50/40 bg-white'
                      : 'hover:bg-slate-800/40 bg-transparent'
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => {
                    const value = (row as Record<string, unknown>)[col.key]

                    return (
                      <td
                        key={col.key}
                        className={`px-5 py-3.5 text-sm ${col.width || ''} ${
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.render ? col.render(value, row) : (value as React.ReactNode)}
                      </td>
                    )
                  })}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className={`px-5 py-3.5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 select-none ${
          isLight ? 'border-slate-200/90 bg-slate-50/50' : 'border-slate-800/80 bg-slate-950/30'
        }`}>
          <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Jami <span className="font-bold text-slate-700 dark:text-slate-200">{pagination.total}</span> ta arizadan{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {Math.min((pagination.current - 1) * pagination.pageSize + 1, pagination.total)}–{Math.min(pagination.current * pagination.pageSize, pagination.total)}
            </span> ko‘rsatilmoqda
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => pagination.onPageChange(pagination.current - 1)}
              disabled={pagination.current === 1}
              className={`p-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none active:scale-95 ${
                isLight
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 shadow-xs'
              }`}
              title="Oldingi sahifa"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page indicator chips */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - pagination.current) <= 1)
                .map((p, i, arr) => {
                  const prev = arr[i - 1]
                  const showEllipsis = prev && p - prev > 1
                  const isActive = p === pagination.current

                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && (
                        <span className="px-1 text-xs text-slate-400">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => pagination.onPageChange(p)}
                        className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                            : isLight
                              ? 'text-slate-600 hover:bg-slate-100'
                              : 'text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  )
                })}
            </div>

            <button
              type="button"
              onClick={() => pagination.onPageChange(pagination.current + 1)}
              disabled={pagination.current >= totalPages}
              className={`p-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none active:scale-95 ${
                isLight
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 shadow-xs'
              }`}
              title="Keyingi sahifa"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
