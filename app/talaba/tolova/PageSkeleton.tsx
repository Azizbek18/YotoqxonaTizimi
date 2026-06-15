'use client'

import React from 'react'
import { useThemeStore } from '@/lib/stores/theme-store'

export default function PageSkeleton() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    return (
        <div className={`w-full min-h-[60vh] flex flex-col gap-6 animate-pulse p-2 sm:p-4 ${isLight ? 'opacity-60' : 'opacity-40'}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col gap-2">
                    <div className={`w-10 h-10 rounded-2xl ${isLight ? 'bg-slate-300' : 'bg-slate-800'}`}></div>
                    <div className="space-y-2 mt-2">
                        <div className={`w-40 h-6 rounded-full ${isLight ? 'bg-slate-300' : 'bg-slate-800'}`}></div>
                        <div className={`w-28 h-3 rounded-full ${isLight ? 'bg-slate-300' : 'bg-slate-800'}`}></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-28 rounded-3xl ${isLight ? 'bg-slate-300' : 'bg-slate-800'}`}></div>
                ))}
            </div>

            <div className={`h-64 rounded-3xl w-full mt-4 ${isLight ? 'bg-slate-300' : 'bg-slate-800'}`}></div>
        </div>
    )
}