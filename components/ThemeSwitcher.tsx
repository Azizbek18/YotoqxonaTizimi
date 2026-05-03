'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="group relative flex items-center justify-center w-10 h-10 rounded-xl 
                 bg-slate-100 dark:bg-slate-800 transition-all duration-300 
                 hover:ring-2 hover:ring-blue-500/50 dark:hover:ring-blue-400/40"
            aria-label="Mavzuni almashtirish"
        >
            <Sun
                size={20}
                className="text-amber-500 transition-all duration-500 rotate-0 scale-100 
                   dark:-rotate-90 dark:scale-0"
            />

            <Moon
                size={20}
                className="absolute text-blue-400 transition-all duration-500 rotate-90 scale-0 
                   dark:rotate-0 dark:scale-100"
            />
        </button>
    );
}