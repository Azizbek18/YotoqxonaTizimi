'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Minus } from 'lucide-react'

interface CustomCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  indeterminate?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: React.ReactNode
  className?: string
  id?: string
  'aria-label'?: string
}

export default function CustomCheckbox({
  checked,
  onChange,
  indeterminate = false,
  disabled = false,
  size = 'md',
  label,
  className = '',
  id,
  'aria-label': ariaLabel,
}: CustomCheckboxProps) {
  const sizeClasses = {
    sm: 'w-[18px] h-[18px] rounded-[6px]',
    md: 'w-[22px] h-[22px] rounded-[7px]',
    lg: 'w-[26px] h-[26px] rounded-[8px]',
  }[size]

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 17,
  }[size]

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!disabled) {
      onChange(!checked)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      onChange(!checked)
    }
  }

  const isActive = checked || indeterminate

  return (
    <div
      onClick={handleClick}
      className={`inline-flex items-center gap-2 select-none cursor-pointer group ${
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
    >
      <div
        role="checkbox"
        id={id}
        tabIndex={disabled ? -1 : 0}
        aria-checked={indeterminate ? 'mixed' : checked}
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className={`relative flex items-center justify-center shrink-0 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-1 no-shelf active:scale-95 ${sizeClasses} ${
          isActive
            ? 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white border border-indigo-400/30 shadow-sm shadow-indigo-600/30 ring-1 ring-white/20'
            : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/90 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 shadow-2xs'
        }`}
      >
        <AnimatePresence initial={false}>
          {checked && (
            <motion.div
              key="check"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="flex items-center justify-center"
            >
              <Check size={iconSizes} strokeWidth={3.4} className="text-white drop-shadow-xs" />
            </motion.div>
          )}
          {indeterminate && !checked && (
            <motion.div
              key="indeterminate"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="flex items-center justify-center"
            >
              <Minus size={iconSizes} strokeWidth={3.6} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {label && (
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
          {label}
        </span>
      )}
    </div>
  )
}
