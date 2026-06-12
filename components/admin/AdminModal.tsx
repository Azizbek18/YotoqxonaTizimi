'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

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
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full ${maxWidthClass} bg-[#0b1120] border border-white/10 rounded-2xl shadow-2xl z-50`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div>
                                <h2 className="text-xl font-bold text-white">{title}</h2>
                                {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">{children}</div>

                        {/* Actions */}
                        {onConfirm && (
                            <div className="flex gap-3 p-6 border-t border-white/10">
                                <button
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-all disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${confirmVariant === 'danger'
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-purple-500 hover:bg-purple-600 text-white'
                                        }`}
                                >
                                    {isLoading ? 'Jarayonda...' : confirmText}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
