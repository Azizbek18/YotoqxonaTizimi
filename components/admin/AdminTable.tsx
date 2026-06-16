'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

export interface TableColumn<T> {
    key: string
    label: string
    sortable?: boolean
    width?: string
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

    return (
        <div className={`backdrop-blur-xl border rounded-2xl overflow-hidden ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b1120]/50 border-white/10'
        }`}>
            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className={`border-b ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`px-6 py-4 text-left text-sm font-bold ${
                                        isLight ? 'text-slate-700' : 'text-slate-300'
                                    } ${col.width || ''} ${
                                        col.sortable ? 'cursor-pointer hover:text-purple-600 transition-colors' : ''
                                    }`}
                                    onClick={() => col.sortable && onSort?.(col.key)}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.label}
                                        {col.sortable && sortBy === col.key && (
                                            <span>
                                                {sortOrder === 'asc' ? (
                                                    <ChevronUp size={16} />
                                                ) : (
                                                    <ChevronDown size={16} />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={columns.length} className={`px-6 py-4 text-center ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                    <span className="animate-pulse">Yuklanmoqda...</span>
                                </td>
                            </tr>
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className={`px-6 py-4 text-center ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Ma&apos;lumot topilmadi
                                </td>
                            </tr>
                        ) : (
                            sortedData.map((row, idx) => (
                                <motion.tr
                                    key={idx}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={`border-b transition-colors ${
                                        isLight ? 'border-slate-100 hover:bg-slate-50/50' : 'border-white/5 hover:bg-white/5'
                                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                                    onClick={() => onRowClick?.(row)}
                                >
                                    {columns.map((col) => {
                                        const value = (row as Record<string, unknown>)[col.key]

                                        return (
                                            <td key={col.key} className={`px-6 py-4 text-sm ${
                                                isLight ? 'text-slate-800' : 'text-slate-300'
                                            } ${col.width || ''}`}>
                                                {col.render ? col.render(value, row) : value as React.ReactNode}
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
            {pagination && (
                <div className={`px-6 py-4 border-t flex items-center justify-between ${
                    isLight ? 'border-slate-200' : 'border-white/10'
                }`}>
                    <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Sahifa {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => pagination.onPageChange(pagination.current - 1)}
                            disabled={pagination.current === 1}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                isLight
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                            }`}
                        >
                            Oldingi
                        </button>
                        <button
                            onClick={() => pagination.onPageChange(pagination.current + 1)}
                            disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                isLight
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                            }`}
                        >
                            Keyingi
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
