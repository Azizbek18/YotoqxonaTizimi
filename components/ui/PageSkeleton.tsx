'use client'

import React from 'react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { Moon, Sparkles } from 'lucide-react'

export default function PageSkeleton() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const shimmer = isLight
    ? 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200'
    : 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800'

  const baseBg = isLight ? 'bg-slate-100' : 'bg-slate-800/50'

  return (
    <div className="space-y-10 pb-12">
      {/* 1. PREMIUM DORMITORY THEMED ANIMATED LOADER */}
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Animated Sky Background */}
          <div className="absolute inset-0 rounded-full bg-linear-to-tr from-indigo-500/10 to-cyan-500/10 blur-xl animate-pulse" />

          {/* Sleeping Moon and Stars */}
          <div className="absolute top-2 right-4 text-amber-400 animate-bounce">
            <Moon size={20} className="fill-amber-400/20" />
          </div>
          <div className="absolute top-4 left-6 text-cyan-400 animate-ping duration-1000">
            <Sparkles size={10} />
          </div>

          {/* Stylized Dormitory Building (SVG) */}
          <svg
            width="80"
            height="100"
            viewBox="0 0 80 100"
            className={`relative z-10 filter drop-shadow-[0_0_15px_rgba(6,182,212,0.3)] ${
              isLight ? 'text-slate-800' : 'text-slate-200'
            }`}
          >
            {/* Building Frame */}
            <rect x="15" y="10" width="50" height="90" rx="6" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="2.5" />
            {/* Roof / Triangle Top */}
            <path d="M 10 12 L 40 2 L 70 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Main Entrance Door */}
            <rect x="34" y="80" width="12" height="20" rx="2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />

            {/* Dormitory Windows (Grid of 6 Rooms) */}
            {/* Row 1 */}
            <rect x="23" y="24" width="10" height="12" rx="1.5" className="window-light window-1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="47" y="24" width="10" height="12" rx="1.5" className="window-light window-2" stroke="currentColor" strokeWidth="1.5" />
            {/* Row 2 */}
            <rect x="23" y="42" width="10" height="12" rx="1.5" className="window-light window-3" stroke="currentColor" strokeWidth="1.5" />
            <rect x="47" y="42" width="10" height="12" rx="1.5" className="window-light window-4" stroke="currentColor" strokeWidth="1.5" />
            {/* Row 3 */}
            <rect x="23" y="60" width="10" height="12" rx="1.5" className="window-light window-5" stroke="currentColor" strokeWidth="1.5" />
            <rect x="47" y="60" width="10" height="12" rx="1.5" className="window-light window-6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="space-y-1.5">
          <h3 className={`text-sm font-black uppercase tracking-[0.25em] ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Yotoqxona Yuklanmoqda...
          </h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider animate-pulse">
            Xonalar va ma'lumotlar tayyorlanmoqda
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

      {/* Styles for Dormitory Window lights and shimmer */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        .window-light {
          fill: transparent;
          transition: fill 0.4s ease-in-out;
        }

        /* Dormitory lights turning on in sequence */
        .window-1 { animation: windowGlow1 4s infinite; }
        .window-2 { animation: windowGlow2 4s infinite; }
        .window-3 { animation: windowGlow3 4s infinite; }
        .window-4 { animation: windowGlow4 4s infinite; }
        .window-5 { animation: windowGlow5 4s infinite; }
        .window-6 { animation: windowGlow6 4s infinite; }

        @keyframes windowGlow1 {
          0%, 100% { fill: transparent; }
          10%, 40% { fill: #facc15; } /* Yellow */
        }
        @keyframes windowGlow2 {
          0%, 10%, 100% { fill: transparent; }
          20%, 50% { fill: #22d3ee; } /* Cyan */
        }
        @keyframes windowGlow3 {
          0%, 20%, 100% { fill: transparent; }
          30%, 60% { fill: #facc15; }
        }
        @keyframes windowGlow4 {
          0%, 30%, 100% { fill: transparent; }
          40%, 70% { fill: #22d3ee; }
        }
        @keyframes windowGlow5 {
          0%, 40%, 100% { fill: transparent; }
          50%, 80% { fill: #facc15; }
        }
        @keyframes windowGlow6 {
          0%, 50%, 100% { fill: transparent; }
          60%, 90% { fill: #22d3ee; }
        }
      `}</style>
    </div>
  )
}
