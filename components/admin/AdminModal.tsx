'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

interface AdminModalProps {
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
}

export default function AdminModal({
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
}: AdminModalProps) {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const mountId = window.setTimeout(() => setMounted(true), 0)
        return () => window.clearTimeout(mountId)
    }, [])

    if (!mounted) return null

    const modalSurface = isLight ? 'bg-white border-slate-200 shadow-2xl' : 'bg-[#0b1120] border-white/10 shadow-2xl shadow-slate-950'
    const titleText = isLight ? 'text-slate-900' : 'text-white'
    const descText = isLight ? 'text-slate-500' : 'text-slate-400'
    const borderCls = isLight ? 'border-slate-200' : 'border-white/10'

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/55 backdrop-blur-xs z-40"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className={`relative w-full ${maxWidthClass} max-h-[90vh] flex flex-col border rounded-3xl z-50 overflow-hidden transition-all duration-300 ${modalSurface}`}
                    >
                        {/* Header */}
                        <div className={`flex items-center justify-between p-4 sm:p-6 border-b shrink-0 ${borderCls}`}>
                            <div>
                                <h2 className={`text-lg sm:text-xl font-black tracking-tight ${titleText}`}>{title}</h2>
                                {description && <p className={`text-xs sm:text-sm mt-1 leading-normal ${descText}`}>{description}</p>}
                            </div>
                            <button
                                onClick={onClose}
                                className={`p-1.5 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-800' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6 overflow-y-auto flex-1 no-scrollbar text-xs sm:text-sm">{children}</div>

                        {/* Actions */}
                        {onConfirm && (
                            <div className={`flex gap-3 p-4 sm:p-6 border-t shrink-0 ${borderCls}`}>
                                <button
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 ${
                                        isLight 
                                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
                                            : 'bg-white/5 hover:bg-white/10 text-slate-300'
                                    }`}
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 text-white shadow-lg ${
                                        confirmVariant === 'danger'
                                            ? 'bg-red-600 hover:bg-red-750 shadow-red-600/10'
                                            : 'bg-purple-600 hover:bg-purple-750 shadow-purple-600/10'
                                    }`}
                                >
                                    {isLoading ? 'Jarayonda...' : confirmText}
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
