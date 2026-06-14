'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useThemeStore } from '@/lib/stores/theme-store'

interface StatCardProps {
    title: string
    value: number | string
    imageSrc: string
    color: string
    glowColor: string
    trend?: number
    trendLabel?: string
    isLoading?: boolean
}

export default function StatCard({
    title,
    value,
    imageSrc,
    color,
    glowColor,
    trend,
    trendLabel,
    isLoading = false,
}: StatCardProps) {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6, transition: { duration: 0.2, ease: 'easeOut' } }}
            transition={{ duration: 0.3 }}
            style={{
                boxShadow: isLight
                    ? `0 10px 30px -10px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02)`
                    : `0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 30px -10px ${glowColor}`,
            }}
            className={`relative overflow-hidden backdrop-blur-xl border rounded-3xl p-6 transition-colors duration-300 group ${
                isLight 
                    ? 'bg-white/70 border-slate-200/80 hover:bg-white/90 hover:border-slate-300' 
                    : 'bg-[#0f172a]/40 border-white/10 hover:bg-[#0f172a]/60 hover:border-white/20'
            }`}
        >
            {/* Background Glow */}
            <div 
                className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                style={{ backgroundColor: glowColor }}
            />
            
            <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="flex-1">
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {title}
                    </p>
                    <p className={`text-3xl sm:text-4xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {isLoading ? (
                            <span className="inline-block w-12 h-8 bg-slate-300 dark:bg-slate-700 animate-pulse rounded" />
                        ) : (
                            value
                        )}
                    </p>
                    
                    {trend !== undefined && trendLabel && (
                        <div className={`flex items-center text-xs gap-1 mt-3 ${trend >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}`}>
                            <span className="text-sm">{trend >= 0 ? '↑' : '↓'}</span>
                            <span>{Math.abs(trend)}% {trendLabel}</span>
                        </div>
                    )}
                </div>

                <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 flex items-center justify-center">
                    {/* Glowing ring behind the 3D icon */}
                    <div 
                        className={`absolute inset-0 rounded-full bg-gradient-to-br ${color} opacity-20 blur-md group-hover:scale-110 transition-transform duration-300`}
                    />
                    
                    {/* 3D Icon Image */}
                    <motion.div
                        className="relative z-10 w-16 h-16 sm:w-20 sm:h-20"
                        animate={{
                            y: [0, -4, 0],
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                        whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                    >
                        <Image
                            src={imageSrc}
                            alt={title}
                            fill
                            sizes="(max-width: 768px) 64px, 80px"
                            className="object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.2)]"
                            priority
                        />
                    </motion.div>
                </div>
            </div>
        </motion.div>
    )
}
