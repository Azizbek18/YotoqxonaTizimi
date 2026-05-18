'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'

type Language = 'uz' | 'en' | 'ru'

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
    { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
]

export default function LanguageSwitcher({ currentLang }: { currentLang: string }) {
    const router = useRouter()
    const pathname = usePathname()

    const handleLanguageChange = (lang: Language) => {
        // Remove current language prefix and add new one
        const segments = pathname.split('/')
        if (['uz', 'en', 'ru'].includes(segments[1])) {
            segments[1] = lang
        } else {
            segments.splice(1, 0, lang)
        }
        router.push(segments.join('/'))
    }

    return (
        <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-slate-300 transition-all">
                <Globe size={16} />
                <span className="hidden sm:inline uppercase">{currentLang}</span>
            </button>

            <div className="absolute right-0 top-full mt-2 w-48 bg-[#0b1120] border border-white/10 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {LANGUAGES.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-2 border-b border-white/5 last:border-b-0 ${currentLang === lang.code ? 'bg-purple-500/20 text-purple-400' : 'text-slate-300'
                            }`}
                    >
                        <span>{lang.flag}</span>
                        <span className="text-sm">{lang.label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
