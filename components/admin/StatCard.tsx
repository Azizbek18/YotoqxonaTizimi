'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
    title: string
    value: number | string
    icon: LucideIcon
    color: string
    trend?: number
    trendLabel?: string
    isLoading?: boolean
}

export default function StatCard({
    title,
    value,
    icon: Icon,
    color,
    trend,
    trendLabel,
    isLoading = false,
}: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all group"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <p className="text-slate-400 text-sm font-medium mb-2">{title}</p>
                    <p className="text-3xl sm:text-4xl font-black text-white">
                        {isLoading ? (
                            <span className="animate-pulse">...</span>
                        ) : (
                            value
                        )}
                    </p>
                </div>
                <div
                    className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform`}
                >
                    <Icon size={24} />
                </div>
            </div>

            {trend !== undefined && trendLabel && (
                <div className={`flex items-center text-xs gap-1 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span>{trend >= 0 ? '↑' : '↓'}</span>
                    <span>{Math.abs(trend)}% {trendLabel}</span>
                </div>
            )}
        </motion.div>
    )
}
