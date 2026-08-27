'use client';

import { useEffect, useState } from 'react';
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

  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';
  const textStrong = isLight ? 'text-slate-900' : 'text-white';

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

  return createPortal(
    <>
      <div className="fixed bottom-24 sm:bottom-28 right-6 z-[9999] pointer-events-auto">
        <button
          onClick={() => setIsChatOpen(true)}
          className={`flex items-center justify-center p-4 rounded-full border shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 group ${
            isLight
              ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-blue-500/20'
              : 'bg-gradient-to-r from-cyan-500 to-indigo-600 border-cyan-400/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]'
          }`}
        >
          <Sparkles className="size-6 animate-pulse" />
        </button>
      </div>

      {isChatOpen && (
        <div className="fixed inset-0 z-[10000] flex justify-end bg-black/60 backdrop-blur-xs">
          {/* Backdrop Click */}
          <div className="absolute inset-0 pointer-events-auto" onClick={() => setIsChatOpen(false)} />

          <div className={`relative w-full max-w-md h-full shadow-2xl border-l flex flex-col justify-between backdrop-blur-2xl transition-all duration-300 pointer-events-auto ${
            isLight
              ? 'bg-white/95 border-slate-200 text-slate-900'
              : 'bg-[#0b101d]/95 border-white/5 text-white'
          }`}>
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-wider ${textStrong}`}>🤖 Yotoqxona AI</h3>
                  <p className={`text-[10px] ${textMuted}`}>Savollarga real vaqtda javob beradi</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className={`p-2 rounded-xl transition-all border ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 pr-3 custom-scrollbar text-xs sm:text-sm">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-3.5 rounded-2xl border ${
                    msg.role === 'user'
                      ? isLight
                        ? 'bg-blue-600 border-blue-500 text-white rounded-br-none shadow-md shadow-blue-500/10'
                        : 'bg-indigo-600 border-indigo-500 text-white rounded-br-none shadow-md shadow-indigo-600/10'
                      : isLight
                        ? 'bg-slate-100 border-slate-200 text-slate-900 rounded-bl-none'
                        : 'bg-white/5 border-white/5 text-white rounded-bl-none'
                  }`}>
                    {msg.role === 'model' ? (
                      <ChatMarkdownMessage text={msg.text} />
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className={`p-3.5 rounded-2xl border rounded-bl-none flex items-center gap-2 ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-white/5 border-white/5 text-white'
                  }`}>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce delay-75" />
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce delay-150" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Chips & Input Footer */}
            <div className="p-4 border-t border-white/5 space-y-3.5 shrink-0 bg-white/[0.01]">
              {/* Quick Reply Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSendMessage(chip)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/15'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Savolingizni kiriting..."
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  className={`flex-1 border rounded-xl px-4 py-3 text-xs outline-none transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'
                      : 'bg-white/5 border-white/5 text-white focus:border-indigo-500/30'
                  }`}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={chatLoading || !userMessage.trim()}
                  className={`px-4 rounded-xl transition-all flex items-center justify-center ${
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
