'use client'

import React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { adminUI } from '@/lib/admin-ui'

interface StatCardProps {
    title: string
    value: number | string
    icon: LucideIcon
    isLoading?: boolean
}

export default function StatCard({ title, value, icon: Icon, isLoading = false }: StatCardProps) {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'
    const ui = adminUI(isLight)

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 ${ui.card} ${ui.hoverLift}`}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${ui.muted}`}>
                        {title}
                    </p>
                    <p className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${ui.strong}`}>
                        {isLoading ? (
                            <span className="inline-block w-12 h-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
                        ) : (
                            value
                        )}
                    </p>
                </div>

                <div className={`shrink-0 flex h-14 w-14 items-center justify-center rounded-2xl ${ui.accentTile}`}>
                    <Icon size={24} strokeWidth={2.4} />
                </div>
            </div>
        </motion.div>
    )
}
