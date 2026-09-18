'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
  current: number
  total: number
  stepNames?: string[]
}

export default function StepProgress({ current, total, stepNames }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const activeStepRef = useRef<HTMLDivElement>(null)
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  useEffect(() => {
    if (activeStepRef.current && scrollContainerRef.current) {
      activeStepRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  }, [current])

  return (
    <div
      ref={scrollContainerRef}
      className={`relative flex items-center justify-between gap-1 ${stepNames ? 'mb-4 pt-1 pb-2' : 'mb-2 pt-1 pb-4'} px-2 overflow-x-auto no-scrollbar`}
    >

      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        const isDone = n < current
        const isActive = n === current

        return (
          <React.Fragment key={n}>
            <div
              ref={isActive ? activeStepRef : null}
              className="relative z-10 flex flex-col items-center shrink-0 min-w-[52px]"
            >
              {/* QADAM DOIRASI */}
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.15 : 1,
                  backgroundColor: isDone ? (isLight ? '#10b981' : '#059669') : isActive ? (isLight ? '#2563eb' : '#3b82f6') : (isLight ? '#f1f5f9' : '#1e293b'),
                  borderColor: isDone ? (isLight ? '#34d399' : '#10b981') : isActive ? (isLight ? '#60a5fa' : '#3b82f6') : (isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'),
                }}
                className={`
                  w-8 h-8 rounded-xl border-2 flex items-center justify-center 
                  transition-all duration-500 relative backdrop-blur-xl
                  ${isActive ? (isLight ? 'shadow-[0_0_16px_rgba(37,99,235,0.35)]' : 'shadow-[0_0_20px_rgba(59,130,246,0.5)]') : ''}
                  ${isDone ? (isLight ? 'shadow-[0_0_12px_rgba(16,185,129,0.25)]' : 'shadow-[0_0_15px_rgba(16,185,129,0.3)]') : ''}
                `}
              >
                {/* ACTIVE BO'LGANDA ATROFIDAGI PORLASH (GLOW) */}
                {isActive && (
                  <motion.div
                    layoutId="glow"
                    className={`absolute inset-0 rounded-xl blur-md ${isLight ? 'bg-blue-400/20' : 'bg-blue-500/25'}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}
                  />
                )}

                <span className={`
                  text-[12px] font-black transition-colors duration-500 relative z-20
                  ${isActive || isDone ? '#ffffff text-white' : (isLight ? 'text-slate-500' : 'text-slate-400')}
                `}>
                  {isDone ? <Check size={16} strokeWidth={3.5} /> : n}
                </span>

                {/* TAGIDAGI KICHIK KO'RSATKICH */}
                {isActive && (
                  <motion.div
                    layoutId="indicator"
                    className={`absolute -bottom-2 w-1.5 h-1.5 rounded-full ${isLight ? 'bg-blue-600 shadow-[0_0_8px_#2563eb]' : 'bg-blue-400 shadow-[0_0_8px_#60a5fa]'}`}
                  />
                )}
              </motion.div>

              {stepNames && stepNames[i] && (
                <span
                  className={`text-[10px] font-semibold mt-2.5 text-center whitespace-nowrap transition-colors ${
                    isActive
                      ? (isLight ? 'text-blue-700 font-black' : 'text-blue-400 font-bold')
                      : isDone
                      ? (isLight ? 'text-emerald-700 font-medium' : 'text-emerald-400 font-medium')
                      : (isLight ? 'text-slate-400' : 'text-slate-500')
                  }`}
                >
                  {stepNames[i]}
                </span>
              )}
            </div>

            {/* QADAMLAR ORASIDAGI CHIZIQ */}
            {n < total && (
              <div className={`flex-1 min-w-2 relative h-0.75 mx-1 overflow-hidden rounded-full ${isLight ? 'bg-slate-200' : 'bg-white/5'}`}>
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: isDone ? "100%" : "0%" }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className={`absolute top-0 left-0 h-full ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500 shadow-[0_0_10px_rgba(59,130,246,0.28)]' : 'bg-linear-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]'}`}
                />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}