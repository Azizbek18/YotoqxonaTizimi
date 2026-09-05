'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ChatMarkdownMessage } from './ChatMarkdownMessage';

type ChatMessage = { role: 'user' | 'model'; text: string };

const QUICK_CHIPS = [
  '🚪 Kirish-chiqish vaqti',
  "💳 To'lov narxi",
  '🧹 Navbatchiligim qachon?',
  '📞 Komendant raqami',
];

const WELCOME: ChatMessage = {
  role: 'model',
  text: "Salom! Men yotoqxona AI yordamchisiman. Yotoqxona qoidalari, to'lovlar, komendant telefon raqami yoki tozalik navbatchiligi bo'yicha qanday savolingiz bor? 😊",
};

/**
 * Floating AI assistant: a fixed action button plus a slide-in chat drawer.
 * Fully self-contained — owns its open/message/loading state and talks to
 * /api/ai/chat directly, so the dashboard page doesn't carry any of it.
 */
export default function AiAssistant({ isLight }: { isLight: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME]);
  const [userMessage, setUserMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';
  const textStrong = isLight ? 'text-slate-900' : 'text-white';
  const hairline = isLight ? 'border-slate-200' : 'border-white/10';
  // The chat has barely started — show the suggestion chips large and
  // centered rather than leaving a blank void with one lonely bubble.
  const isFresh = chatMessages.length === 1 && !chatLoading;

  // Lock the page behind the drawer + keep the transcript pinned to the newest
  // message.
  useEffect(() => {
    if (!isChatOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isChatOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || userMessage;
    if (!messageText.trim() || chatLoading) return;

    setChatMessages((prev) => [...prev, { role: 'user', text: messageText }]);
    setUserMessage('');
    setChatLoading(true);

    try {
      const { data: { session: chatSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(chatSession?.access_token ? { Authorization: `Bearer ${chatSession.access_token}` } : {}),
        },
        body: JSON.stringify({
          message: messageText,
          history: chatMessages.slice(-10),
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages((prev) => [...prev, { role: 'model', text: data.reply }]);
      } else {
        throw new Error(data.error || 'Tahlil qilishda xato');
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages((prev) => [...prev, {
        role: 'model',
        text: "Kechirasiz, javob olishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring. 🔌",
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!mounted || typeof document === 'undefined') return null;

  const chip = (label: string, big = false) => (
    <button
      key={label}
      type="button"
      data-student-button="plain"
      onClick={() => handleSendMessage(label)}
      disabled={chatLoading}
      className={`rounded-xl font-bold transition-all border disabled:opacity-50 ${
        big ? 'px-3.5 py-2.5 text-xs' : 'px-3 py-1.5 text-[10px] uppercase'
      } ${
        isLight
          ? 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
          : 'bg-white/5 border-white/10 text-slate-200 hover:border-cyan-400/40 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );

  return createPortal(
    <>
      <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-28 right-3 sm:right-6 z-[9999] pointer-events-auto">
        <button
          onClick={() => setIsChatOpen(true)}
          className={`flex items-center justify-center p-3 sm:p-4 rounded-full border shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 group ${
            isLight
              ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-blue-500/20'
              : 'bg-gradient-to-r from-cyan-500 to-indigo-600 border-cyan-400/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]'
          }`}
        >
          <Sparkles className="size-5 sm:size-6 animate-pulse" />
        </button>
      </div>

      {isChatOpen && (
        <div className="fixed inset-0 z-[10000] flex justify-end bg-black/50">
          {/* Backdrop Click */}
          <div className="absolute inset-0 pointer-events-auto" onClick={() => setIsChatOpen(false)} />

          <div className={`relative w-full max-w-md h-full flex flex-col shadow-2xl border-l pointer-events-auto ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0b101d] border-white/10 text-white'
          }`}>
            {/* Header */}
            <div className={`p-4 sm:p-5 border-b ${hairline} flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-cyan-500/10 text-cyan-400'}`}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-wider ${textStrong}`}>Yotoqxona AI</h3>
                  <p className={`text-[10px] ${textMuted}`}>Savollarga real vaqtda javob beradi</p>
                </div>
              </div>
              <button
                type="button"
                data-student-button="plain"
                onClick={() => setIsChatOpen(false)}
                aria-label="Yopish"
                className={`p-2 rounded-xl transition-all border ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Chat History */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar text-xs sm:text-sm">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-3.5 rounded-2xl border leading-relaxed ${
                    msg.role === 'user'
                      ? isLight
                        ? 'bg-blue-600 border-blue-600 text-white rounded-br-md'
                        : 'bg-indigo-600 border-indigo-600 text-white rounded-br-md'
                      : isLight
                        ? 'bg-slate-100 border-slate-200 text-slate-900 rounded-bl-md'
                        : 'bg-white/5 border-white/10 text-white rounded-bl-md'
                  }`}>
                    {msg.role === 'model' ? (
                      <ChatMarkdownMessage text={msg.text} />
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}

              {isFresh && (
                <div className="pt-1">
                  <p className={`mb-2.5 text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Tez savollar</p>
                  <div className="grid grid-cols-1 gap-2">
                    {QUICK_CHIPS.map((c) => chip(c, true))}
                  </div>
                </div>
              )}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className={`p-3.5 rounded-2xl border rounded-bl-md flex items-center gap-2 ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'
                  }`}>
                    <div className="flex gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isLight ? 'bg-blue-500' : 'bg-cyan-400'}`} />
                      <span className={`w-1.5 h-1.5 rounded-full animate-bounce delay-75 ${isLight ? 'bg-blue-500' : 'bg-cyan-400'}`} />
                      <span className={`w-1.5 h-1.5 rounded-full animate-bounce delay-150 ${isLight ? 'bg-blue-500' : 'bg-cyan-400'}`} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className={`p-3.5 sm:p-4 border-t ${hairline} space-y-3 shrink-0 ${isLight ? 'bg-slate-50/60' : 'bg-white/[0.02]'}`}>
              {/* Compact chips once the conversation is going. */}
              {!isFresh && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CHIPS.map((c) => chip(c))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Savolingizni kiriting..."
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  className={`flex-1 border rounded-xl px-4 py-3 text-xs sm:text-sm outline-none transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                      : 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500/40'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={chatLoading || !userMessage.trim()}
                  aria-label="Yuborish"
                  className={`px-4 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                    isLight
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
