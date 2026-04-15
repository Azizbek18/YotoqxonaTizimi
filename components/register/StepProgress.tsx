'use client'

import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface Props {
  current: number
  total: number
}

export default function StepProgress({ current, total }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const activeStepRef = useRef<HTMLDivElement>(null)
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
      className="relative flex items-center justify-between gap-1 mb-2 px-2 pt-1 pb-4 overflow-x-auto no-scrollbar"
    >
      
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        const isDone = n < current
        const isActive = n === current

        return (
          <React.Fragment key={n}>
            <div 
              ref={isActive ? activeStepRef : null} 
              className="relative z-10 flex flex-col items-center flex-shrink-0"
            >
              {/* QADAM DOIRASI */}
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.15 : 1,
                  backgroundColor: isDone ? '#10b981' : isActive ? '#3b82f6' : '#1e293b',
                  borderColor: isDone ? '#34d399' : isActive ? '#60a5fa' : 'rgba(255,255,255,0.1)',
                }}
                className={`
                  w-8 h-8 rounded-xl border-2 flex items-center justify-center 
                  transition-all duration-500 relative backdrop-blur-xl
                  ${isActive ? 'shadow-[0_0_20px_rgba(59,130,246,0.5)]' : ''}
                  ${isDone ? 'shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}
                `}
              >
                {/* ACTIVE BO'LGANDA ATROFIDAGI PORLASH (GLOW) */}
                {isActive && (
                  <motion.div
                    layoutId="glow"
                    className="absolute inset-0 rounded-xl bg-blue-500/20 blur-md"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}
                  />
                )}

                <span className={`
                  text-[12px] font-black transition-colors duration-500 relative z-20
                  ${isActive || isDone ? 'text-white' : 'text-slate-500'}
                `}>
                  {isDone ? <Check size={16} strokeWidth={4} /> : n}
                </span>

                {/* TAGIDAGI KICHIK KO'RSATKICH */}
                {isActive && (
                  <motion.div 
                    layoutId="indicator"
                    className="absolute -bottom-3 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_8px_#60a5fa]"
                  />
                )}
              </motion.div>
            </div>

            {/* QADAMLAR ORASIDAGI CHIZIQ */}
            {n < total && (
              <div className="flex-1 min-w-[8px] relative h-[3px] mx-1 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: isDone ? "100%" : "0%" }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}