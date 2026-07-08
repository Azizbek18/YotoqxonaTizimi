'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone, Share, PlusSquare, Sparkles } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://')
      
      setIsStandalone(isStandaloneMode)
      return isStandaloneMode
    }

    if (checkStandalone()) return

    // 2. Detect iOS
    const detectIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase()
      const isIphoneOrIpad = /iphone|ipad|ipod/.test(userAgent)
      // Safari detection (excluding Chrome, Firefox on iOS)
      const isSafari = /safari/.test(userAgent) && !/crios|fxios|opr|mercury/.test(userAgent)
      
      setIsIos(isIphoneOrIpad)
      return isIphoneOrIpad && isSafari
    }

    // 3. Listen to beforeinstallprompt event (Android / Desktop Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Delay showing the custom prompt by 2.5 seconds for better UX
      const isDismissed = localStorage.getItem('pwa-prompt-dismissed') === 'true'
      if (!isDismissed) {
        const timer = setTimeout(() => {
          setShowPrompt(true)
        }, 2500)
        return () => clearTimeout(timer)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // 4. For iOS Safari, show the prompt manually after 3 seconds since there is no beforeinstallprompt event
    const isSafariOnIos = detectIos()
    const isDismissed = localStorage.getItem('pwa-prompt-dismissed') === 'true'
    if (isSafariOnIos && !isDismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 3000)
      return () => clearTimeout(timer)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIos) {
      // Show iOS guided instructions modal
      setShowIosGuide(true)
      return
    }

    if (!deferredPrompt) return

    // Show native browser install prompt
    await deferredPrompt.prompt()
    
    // Wait for choice
    const choiceResult = await deferredPrompt.userChoice
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the PWA install prompt')
      setShowPrompt(false)
    } else {
      console.log('User dismissed the PWA install prompt')
    }
    
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Save dismissal in localStorage so we don't annoy the user
    localStorage.setItem('pwa-prompt-dismissed', 'true')
  }

  // If already running standalone or not supposed to show prompt, return null
  if (isStandalone || !showPrompt) return null

  return (
    <>
      {/* 1. FLOATING INSTALL BANNER */}
      <AnimatePresence>
        {showPrompt && !showIosGuide && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[420px] z-[99999]"
          >
            <div className="relative overflow-hidden rounded-[28px] bg-slate-950/85 dark:bg-slate-950/90 backdrop-blur-2xl border border-white/10 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] shadow-indigo-500/10">
              {/* Decorative background glows */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex gap-4 items-start relative z-10">
                {/* App Circular Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20 p-0.5">
                  <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-indigo-400" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">MTalaba Ilovasi</h4>
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-black uppercase tracking-wider">
                      <Sparkles size={8} /> PWA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">
                    Yotoqxona tizimidan tezroq va qulayroq foydalanish uchun ilovani telefoningiz yoki kompyuteringizga o&apos;rnating!
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-4 relative z-10 pl-[72px]">
                <button
                  onClick={handleInstallClick}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                >
                  <Download size={14} />
                  O&apos;rnatish
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Keyinroq
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. IOS GUIDED INSTRUCTIONS MODAL */}
      <AnimatePresence>
        {showIosGuide && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative overflow-hidden rounded-[32px] bg-slate-900 border border-white/10 p-6 shadow-2xl max-w-sm w-full text-center space-y-6"
            >
              {/* App Circular Icon */}
              <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 p-0.5">
                <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center">
                  <Smartphone className="w-7 h-7 text-indigo-400" />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Ilovani O&apos;rnatish</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  iOS qurilmalarida ilovani o&apos;rnatish uchun quyidagi oddiy amallarni bajaring:
                </p>
              </div>

              {/* Guide steps */}
              <div className="bg-slate-950/50 rounded-2xl p-4 text-left space-y-3.5 border border-white/5">
                <div className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs">
                    1
                  </div>
                  <p className="text-xs text-slate-300 font-sans flex items-center gap-1.5">
                    Safari brauzerida <span className="p-1 rounded-md bg-white/5 text-white"><Share size={12} /></span> <b>&apos;Ulashish&apos; (Share)</b> tugmasini bosing.
                  </p>
                </div>
                <div className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs">
                    2
                  </div>
                  <p className="text-xs text-slate-300 font-sans flex items-center gap-1.5">
                    Menyudan <span className="p-1 rounded-md bg-white/5 text-white"><PlusSquare size={12} /></span> <b>&apos;Bosh ekranga qo&apos;shish&apos; (Add to Home Screen)</b> bandini tanlang.
                  </p>
                </div>
                <div className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs">
                    3
                  </div>
                  <p className="text-xs text-slate-300 font-sans">
                    Oynaning tepasidagi <b>&apos;Qo&apos;shish&apos; (Add)</b> tugmasini bosib tasdiqlang.
                  </p>
                </div>
              </div>

              {/* Close guide button */}
              <button
                onClick={() => {
                  setShowIosGuide(false)
                  setShowPrompt(false)
                  localStorage.setItem('pwa-prompt-dismissed', 'true')
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
              >
                Tushundim
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
