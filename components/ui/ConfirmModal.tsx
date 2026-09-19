'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, LogOut, HelpCircle, Loader2 } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useScopedFontFamily } from '@/lib/font-scope-context'

interface ConfirmModalProps {
    isOpen: boolean
    title: string
    description?: string
    children?: React.ReactNode
    maxWidthClass?: string
    onClose: () => void
    onConfirm?: () => void
    confirmText?: string
    cancelText?: string
    confirmVariant?: 'primary' | 'danger'
    isLoading?: boolean
    icon?: React.ReactNode
}

function getModalIcon(
    icon: React.ReactNode | undefined,
    title: string,
    variant: 'primary' | 'danger'
) {
    if (icon) return icon
    const lower = title.toLowerCase()
    if (lower.includes('chiqish') || lower.includes('chiqmoq') || lower.includes('logout')) {
        return <LogOut size={20} className="text-rose-600 dark:text-rose-400" />
    }
    if (variant === 'danger') {
        return <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400" />
    }
    return <HelpCircle size={20} className="text-indigo-600 dark:text-indigo-400" />
}

export default function ConfirmModal({
    isOpen,
    title,
    description,
    children,
    maxWidthClass = 'max-w-md',
    onClose,
    onConfirm,
    confirmText = 'Tasdiqlash',
    cancelText = 'Bekor qilish',
    confirmVariant = 'primary',
    isLoading = false,
    icon,
}: ConfirmModalProps) {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'
    const scopedFontFamily = useScopedFontFamily()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const mountId = window.setTimeout(() => setMounted(true), 0)
        return () => window.clearTimeout(mountId)
    }, [])

    if (!mounted) return null

    const modalSurface = isLight
        ? 'bg-white border-slate-200/90 shadow-2xl shadow-slate-900/15'
        : 'bg-slate-900 border-slate-800 shadow-2xl shadow-slate-950'
    const titleText = isLight ? 'text-slate-900' : 'text-white'
    const descText = isLight ? 'text-slate-500' : 'text-slate-400'
    const borderCls = isLight ? 'border-slate-100' : 'border-slate-800/80'

    const isLogoutOrDanger =
        confirmVariant === 'danger' ||
        title.toLowerCase().includes('chiqish') ||
        title.toLowerCase().includes('chiqmoq')

    const iconBadgeClass = isLogoutOrDanger
        ? isLight
            ? 'bg-rose-50 ring-1 ring-rose-200/80 shadow-2xs'
            : 'bg-rose-950/50 ring-1 ring-rose-800/60 shadow-2xs'
        : isLight
            ? 'bg-indigo-50 ring-1 ring-indigo-200/80 shadow-2xs'
            : 'bg-indigo-950/50 ring-1 ring-indigo-800/60 shadow-2xs'

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ fontFamily: scopedFontFamily }}>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className={`relative w-full ${maxWidthClass} max-h-[90vh] flex flex-col border rounded-3xl z-50 overflow-hidden transition-all ${modalSurface}`}
                    >
                        {/* Header */}
                        <div className="flex items-start gap-3.5 p-5 sm:p-6 pb-4 shrink-0">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconBadgeClass}`}>
                                {getModalIcon(icon, title, confirmVariant)}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <h2 className={`text-base sm:text-lg font-black tracking-tight ${titleText}`} style={{ fontFamily: scopedFontFamily }}>
                                    {title}
                                </h2>
                                {description && (
                                    <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${descText}`}>
                                        {description}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className={`no-shelf cursor-pointer -mr-1 -mt-1 p-1.5 rounded-xl transition-colors ${
                                    isLight
                                        ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                                        : 'hover:bg-slate-800 text-slate-500 hover:text-slate-200'
                                }`}
                                title="Yopish"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        {children && (
                            <div className="px-5 sm:px-6 py-2 overflow-y-auto flex-1 no-scrollbar text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                {children}
                            </div>
                        )}

                        {/* Actions */}
                        {onConfirm && (
                            <div className={`flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t shrink-0 ${borderCls} ${
                                isLight ? 'bg-slate-50/60' : 'bg-slate-900/40'
                            }`}>
                                <button
                                    type="button"
                                    data-btn="secondary"
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className={`no-shelf cursor-pointer flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-tight transition-all border disabled:opacity-50 shadow-2xs active:scale-[0.98] ${
                                        isLight
                                            ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                                    }`}
                                >
                                    {cancelText}
                                </button>
                                <button
                                    type="button"
                                    data-btn={confirmVariant === 'danger' ? 'danger' : undefined}
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className={`no-shelf cursor-pointer flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-tight transition-all text-white active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-sm ${
                                        confirmVariant === 'danger'
                                            ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-500/25'
                                            : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/25'
                                    }`}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            <span>Jarayonda...</span>
                                        </>
                                    ) : (
                                        confirmText
                                    )}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
