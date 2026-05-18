'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown } from 'lucide-react'

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

export default function AdminTable<T extends Record<string, unknown>>({
    columns,
    data,
    isLoading = false,
    onRowClick,
    sortBy,
    sortOrder = 'asc',
    onSort,
    pagination,
}: AdminTableProps<T>) {
    const sortedData = useMemo(() => {
        if (!sortBy || !onSort) return data

        return [...data].sort((a, b) => {
            const aVal = a[sortBy]
            const bVal = b[sortBy]

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
            return 0
        })
    }, [data, sortBy, sortOrder, onSort])

    return (
        <div className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`px-6 py-4 text-left text-sm font-semibold text-slate-300 ${col.width || ''} ${col.sortable ? 'cursor-pointer hover:text-white transition-colors' : ''
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
                                <td colSpan={columns.length} className="px-6 py-4 text-center text-slate-400">
                                    <span className="animate-pulse">Yuklanimoqda...</span>
                                </td>
                            </tr>
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-4 text-center text-slate-400">
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
                                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${onRowClick ? 'cursor-pointer' : ''
                                        }`}
                                    onClick={() => onRowClick?.(row)}
                                >
                                    {columns.map((col) => (
                                        <td key={col.key} className={`px-6 py-4 text-sm text-slate-300 ${col.width || ''}`}>
                                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                                        </td>
                                    ))}
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && (
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                        Sahifa {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => pagination.onPageChange(pagination.current - 1)}
                            disabled={pagination.current === 1}
                            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-slate-300 transition-all"
                        >
                            Oldingi
                        </button>
                        <button
                            onClick={() => pagination.onPageChange(pagination.current + 1)}
                            disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-slate-300 transition-all"
                        >
                            Keyingi
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
