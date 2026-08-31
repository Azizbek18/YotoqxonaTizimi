'use client'

import React from 'react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { Loader } from '@/components/ui/Loader'

export default function PageSkeleton() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const shimmer = isLight
    ? 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200'
    : 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800'

  const baseBg = isLight ? 'bg-slate-100' : 'bg-slate-800/50'

  return (
    <div className="space-y-10 pb-12">
      {/* 1. BRAND LOADER */}
      <div className="flex flex-col items-center justify-center gap-5 py-12 text-center">
        <Loader size={132} />
        <div className="space-y-1.5">
          <h3 className={`text-sm font-black uppercase tracking-[0.25em] ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Yotoqxona yuklanmoqda…
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Xonalar va ma&apos;lumotlar tayyorlanmoqda
          </p>
        </div>
      </div>

      {/* 2. DYNAMIC SKELETON PREVIEW LAYOUT */}
      <div className="space-y-6 animate-pulse">
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`p-5 rounded-3xl border ${
              isLight ? 'bg-white/80 border-slate-200/80' : 'bg-[#0f172a]/30 border-white/5'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`h-2.5 w-20 rounded-full ${baseBg}`} />
                <div className={`h-9 w-9 rounded-xl ${baseBg}`} />
              </div>
              <div className={`h-8 w-24 rounded-xl ${shimmer} mb-2`}
                style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.15}s` }} />
              <div className={`h-3 w-36 rounded-full ${baseBg}`} />
            </div>
          ))}
        </div>

        {/* Content list skeleton */}
        <div className={`p-5 rounded-[28px] border space-y-4 ${
          isLight ? 'bg-white/80 border-slate-200/80' : 'bg-[#0f172a]/30 border-white/5'
        }`}>
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <div className={`h-4 w-32 rounded-lg ${baseBg}`} />
            <div className={`h-4 w-16 rounded-lg ${baseBg}`} />
          </div>
          {[0, 1].map((idx) => (
            <div key={idx} className="flex items-center gap-4 py-2">
              <div className={`h-10 w-10 rounded-xl ${baseBg} shrink-0`} />
              <div className="flex-1 space-y-2 min-w-0">
                <div className={`h-3.5 w-[60%] rounded-md ${shimmer}`}
                  style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', animationDelay: `${idx * 0.1}s` }} />
                <div className={`h-2.5 w-[30%] rounded-md ${baseBg}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
