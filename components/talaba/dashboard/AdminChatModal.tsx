'use client';

import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePollingEffect, useChatAutoScroll } from '@/lib/hooks/useChatPolling';
import { createStudentApplication, fetchStudentApplications } from '@/features/applications/client/api';
import { useMounted } from './useMounted';
import { toAdminChatMessage } from './helpers';
import type { AdminChatMessage, Profile } from './types';

type Props = {
  open: boolean;
  onClose: () => void;
  isLight: boolean;
  profile: Profile | null;
};

/**
 * Telegram-style split chat between the student and the admin. Self-contained:
 * owns its message list / input / polling. Backed by the `arizalar` table
 * with type='chat' (a student message carries title='talaba').
 */
export default function AdminChatModal({ open, onClose, isLight, profile }: Props) {
  const mounted = useMounted();
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const isActive = open && Boolean(profile);

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { applications } = await fetchStudentApplications('chat');
      setMessages((applications || []).map(toAdminChatMessage));
    } catch (error) {
      console.error('Chat yuklashda xatolik:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePollingEffect(loadMessages, isActive, profile?.id);

  const { containerRef, endRef } = useChatAutoScroll(messages.length, isActive);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !input.trim() || sending) return;

    const messageText = input.trim();
    setInput('');
    setSending(true);

    try {
      const { application } = await createStudentApplication({
        type: 'chat',
        title: 'talaba',
        reason: messageText,
        status: 'submitted',
        text: messageText,
        level: 'info',
      });
      setMessages((prev) => [...prev, toAdminChatMessage(application)]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Xabar yuborishda xatolik');
      setInput(messageText);
    } finally {
      setSending(false);
    }
  };

  if (!mounted || typeof document === 'undefined' || !open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative flex flex-col w-full max-w-lg h-[500px] overflow-hidden rounded-3xl border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0f172a] border-white/10 text-white'
          }`}
        >
          {/* Modal Header */}
          <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-[#1e293b]/50'
          }`}>
            <div>
              <h3 className="text-sm font-bold leading-none">Admin bilan yozishuv</h3>
              <p className="text-[10px] text-slate-400 mt-1">Shaxsiy xabarlar va javoblar</p>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg border transition-all ${
                isLight
                  ? 'border-slate-200 hover:bg-slate-100 text-slate-500'
                  : 'border-white/10 hover:bg-white/5 text-slate-400'
              }`}
            >
              <X size={16} />
            </button>
          </div>

          {/* Chat bubbles container */}
          <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar flex flex-col min-h-0">
            {loading ? (
              <p className="text-center text-xs text-slate-500 my-auto">Yuklanmoqda...</p>
            ) : messages.length === 0 ? (
              <p className="text-center text-xs text-slate-500 my-auto">Xabarlar mavjud emas. Adminga xabar yuborishingiz mumkin.</p>
            ) : (
              messages.map((msg) => {
                const isStudentSender = msg.title === 'talaba';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[80%] rounded-2xl p-3 text-xs ${
                      isStudentSender
                        ? 'self-end bg-purple-600 text-white rounded-br-none'
                        : isLight
                          ? 'self-start bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                          : 'self-start bg-slate-800 text-slate-100 rounded-bl-none border border-white/5'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words font-medium">{msg.reason}</p>
                    <span className={`text-[8px] self-end mt-1 font-bold ${
                      isStudentSender ? 'text-purple-200' : 'text-slate-400'
                    }`}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Composer form */}
          <form onSubmit={handleSend} className={`p-4 border-t flex gap-2 shrink-0 ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-[#1e293b]/30'
          }`}>
            <input
              type="text"
              placeholder="Xabar yozing..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-xs outline-none transition-all ${
                isLight
                  ? 'bg-white border border-slate-200 text-slate-900 focus:border-purple-500'
                  : 'bg-slate-900 border border-white/10 text-white focus:border-purple-500/50'
              }`}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {sending ? '...' : 'Yuborish'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
