'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

export interface CustomSelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: CustomSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  menuClassName?: string
  emptyText?: string
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Tanlang...',
  disabled = false,
  className = '',
  menuClassName = '',
  emptyText = "Variantlar yo'q",
}: CustomSelectProps) {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mountId = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(mountId)
  }, [])

  const selected = options.find((o) => o.value === value)

  useLayoutEffect(() => {
    if (!open) return
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < 260 && r.top > spaceBelow
    setRect({ top: r.top, left: r.left, width: r.width, openUp })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onClickOutside = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const baseTrigger = `w-full flex items-center justify-between gap-2 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
    isLight ? 'text-slate-800' : 'text-white'
  }`

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={`${baseTrigger} ${className}`}
      >
        <span className={`truncate ${!selected ? (isLight ? 'text-slate-400' : 'text-slate-500') : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isLight ? 'text-slate-400' : 'text-slate-500'}`}
        />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && rect && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: rect.openUp ? 6 : -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: rect.openUp ? 6 : -6, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'fixed',
                  left: rect.left,
                  width: rect.width,
                  top: rect.openUp ? undefined : rect.top + 4,
                  bottom: rect.openUp ? window.innerHeight - rect.top + 4 : undefined,
                  zIndex: 10000,
                  transformOrigin: rect.openUp ? 'bottom' : 'top',
                }}
                className={`max-h-60 overflow-y-auto rounded-xl border shadow-2xl no-scrollbar ${
                  isLight ? 'bg-white border-slate-200 shadow-slate-300/40' : 'bg-slate-900 border-white/10 shadow-black/50'
                } ${menuClassName}`}
              >
                {options.length === 0 ? (
                  <div className={`px-3 py-2.5 text-xs font-semibold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{emptyText}</div>
                ) : (
                  options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => {
                        if (opt.disabled) return
                        onChange(opt.value)
                        setOpen(false)
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        opt.value === value
                          ? isLight
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-cyan-500/10 text-cyan-300'
                          : isLight
                            ? 'text-slate-700 hover:bg-slate-50'
                            : 'text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {opt.value === value && <Check size={13} className="shrink-0" />}
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
