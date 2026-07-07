'use client'

import React, { useEffect, useState } from 'react'
import { Toast, resolveValue } from 'react-hot-toast'
import { motion, useMotionValue, useTransform, useSpring, useMotionTemplate } from 'framer-motion'
import { Sparkles, ShieldAlert } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Custom3DToastProps {
  toast: Toast
}

const playToastSound = (isSuccess: boolean) => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    if (isSuccess) {
      // Harmonic arpeggio success chime: C5 -> E5 -> G5 -> C6
      const notes = [523.25, 659.25, 783.99, 1046.50]
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + index * 0.08)

        gain.gain.setValueAtTime(0, now + index * 0.08)
        gain.gain.linearRampToValueAtTime(0.12, now + index * 0.08 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.35)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + index * 0.08)
        osc.stop(now + index * 0.08 + 0.4)
      })
    } else {
      // Soft cyber error sound: low pitch slide down with lowpass filter
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      osc1.type = 'sawtooth'
      osc2.type = 'sine'

      osc1.frequency.setValueAtTime(220, now)
      osc1.frequency.exponentialRampToValueAtTime(110, now + 0.3)

      osc2.frequency.setValueAtTime(225, now)
      osc2.frequency.exponentialRampToValueAtTime(112, now + 0.3)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(450, now)

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.4)
      osc2.stop(now + 0.4)
    }

    // Clean up AudioContext to prevent memory leaks and lags
    setTimeout(() => {
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {})
      }
    }, 1000)
  } catch {
    // Autoplay policy blocker
    console.debug('Autoplay audio blocked or not interacted yet.')
  }
}

export default function Custom3DToast({ toast: t }: Custom3DToastProps) {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const isSuccess = t.type === 'success'

  // Particle emission state
  const [particles] = useState(() =>
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      angle: (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      distance: 35 + Math.random() * 55,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 0.1,
    }))
  )

  // 3D Parallax Tilt coordinates
  const mx = useMotionValue(0)
  const my = useMotionValue(0)

  const rotateX = useTransform(my, [-100, 100], [15, -15])
  const rotateY = useTransform(mx, [-150, 150], [-15, 15])

  const springX = useSpring(rotateX, { damping: 22, stiffness: 220 })
  const springY = useSpring(rotateY, { damping: 22, stiffness: 220 })

  // Radial highlight coordinates
  const rx = useTransform(mx, [-150, 150], ['0%', '100%'])
  const ry = useTransform(my, [-100, 100], ['0%', '100%'])

  // Rainbow shine angle
  const shineAngle = useTransform(mx, [-150, 150], [0, 360])

  // Particle DOM unmounting to prevent rendering overhead
  const [showParticles, setShowParticles] = useState(true)

  useEffect(() => {
    playToastSound(isSuccess)
    
    // Unmount particles after animation finishes (1s) to save CPU
    const timer = setTimeout(() => setShowParticles(false), 1000)
    return () => clearTimeout(timer)
  }, [isSuccess])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = e.clientX - rect.left - width / 2
    const mouseY = e.clientY - rect.top - height / 2
    mx.set(mouseX)
    my.set(mouseY)
  }

  const handleMouseLeave = () => {
    mx.set(0)
    my.set(0)
  }

  // Motion template strings
  const gradientTemplate = useMotionTemplate`radial-gradient(circle 130px at ${rx} ${ry}, rgba(255, 255, 255, 0.45), transparent)`
  const shineTemplate = useMotionTemplate`linear-gradient(${shineAngle}deg, rgba(16, 185, 129, 0.15), rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.15), rgba(16, 185, 129, 0.15))`

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.85 }}
      animate={{
        opacity: t.visible ? 1 : 0,
        scale: t.visible ? 1 : 0.82,
        y: t.visible ? 0 : 50,
      }}
      style={{
        perspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      transition={{ type: 'spring', damping: 20, stiffness: 260 }}
      className="relative group cursor-pointer w-[92vw] max-w-[390px] mx-auto select-none transform-gpu will-change-transform will-change-opacity"
    >
      {/* 1. Neon Aura Background Glow */}
      <div
        className={`absolute -inset-1.5 rounded-2xl blur-xl opacity-25 group-hover:opacity-40 transition-opacity duration-500 ${
          isSuccess ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      />

      {/* 2. Keypress/Mount Particle Spark Emitters */}
      {showParticles &&
        particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(p.angle) * p.distance,
              y: Math.sin(p.angle) * p.distance,
              opacity: 0,
              scale: 0,
            }}
            transition={{ duration: 0.85, delay: p.delay, ease: 'easeOut' }}
            className={`absolute pointer-events-none rounded-full blur-[0.4px] transform-gpu will-change-transform ${
              isSuccess
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                : 'bg-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
            }`}
            style={{
              width: p.size,
              height: p.size,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

      {/* 3. Main Glass Card Container - Bound directly to GPU MotionValues */}
      <motion.div
        className={`relative backdrop-blur-xl border pt-4.5 px-4.5 pb-6 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] flex items-center gap-4 transition-all duration-300 transform-gpu will-change-[transform,opacity] ${
          isLight
            ? 'bg-white/90 border-slate-200/90 text-slate-900 shadow-slate-900/10'
            : 'bg-[#090d16]/95 border-white/10 text-white shadow-black/60'
        }`}
        style={{
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          rotateX: springX,
          rotateY: springY,
        }}
      >
        {/* Hologram Wireframe Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] rounded-2xl bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px] pointer-events-none" />

        {/* Dynamic Holographic specular highlight (Mouse tracking) */}
        <motion.div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 group-hover:opacity-45 transition-opacity duration-300 rounded-2xl"
          style={{ background: gradientTemplate }}
        />

        {/* Rotating Rainbow Refraction Overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-15 mix-blend-color-dodge transition-opacity duration-500 rounded-2xl"
          style={{ background: shineTemplate }}
        />

        {/* Left Side Icon Pod with Pulse animation */}
        <div
          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-300 relative overflow-hidden ${
            isSuccess
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/25 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
          }`}
        >
          <div
            className={`absolute inset-0 opacity-10 animate-ping rounded-xl ${
              isSuccess ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          {isSuccess ? (
            <Sparkles size={21} className="relative z-10 animate-pulse" />
          ) : (
            <ShieldAlert size={21} className="relative z-10 animate-bounce" />
          )}
        </div>

        {/* Message and Status Type */}
        <div className="flex-1 min-w-0 relative z-10 text-left">
          <p
            className={`text-[8.5px] font-black uppercase tracking-[0.2em] mb-0.5 ${
              isSuccess ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isSuccess ? 'Muvaffaqiyatli' : 'Tizim xabari'}
          </p>
          <p
            className={`text-[12px] font-bold tracking-tight leading-snug ${
              isLight ? 'text-slate-800' : 'text-slate-100'
            }`}
          >
            {resolveValue(t.message, t)}
          </p>
        </div>

        {/* Laser Timer progress bar */}
        <div className="absolute bottom-2.5 left-4.5 right-4.5 h-[2px] bg-slate-500/10 dark:bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              isSuccess
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                : 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
            }`}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: t.duration ? t.duration / 1000 : 4, ease: 'linear' }}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
