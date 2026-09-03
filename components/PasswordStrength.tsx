'use client'

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy'

// A 5-bar strength meter + rule checklist. Mirrors the rules enforced by
// `getPasswordPolicyError` (lib/password-policy.ts) so the visual state and the
// gate never disagree.
const RULES: { key: string; label: string; test: (p: string) => boolean }[] = [
  { key: 'length', label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} belgi`, test: (p) => p.length >= PASSWORD_MIN_LENGTH && p.length <= PASSWORD_MAX_LENGTH },
  { key: 'upper', label: 'Katta harf', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Kichik harf', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'Raqam', test: (p) => /[0-9]/.test(p) },
  { key: 'symbol', label: 'Maxsus belgi', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export default function PasswordStrength({ password, isLight }: { password: string; isLight: boolean }) {
  const passed = RULES.map((r) => r.test(password))
  const strength = passed.filter(Boolean).length

  return (
    <div className="pt-2 px-1">
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              strength >= step
                ? strength <= 2
                  ? 'bg-rose-500/60'
                  : strength === 3
                    ? 'bg-amber-500/60'
                    : isLight
                      ? 'bg-blue-600'
                      : 'bg-emerald-500'
                : isLight
                  ? 'bg-slate-200'
                  : 'bg-white/5'
            }`}
          />
        ))}
      </div>
      <div className={`grid grid-cols-2 gap-2 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-600'}`}>
        {RULES.map((rule, i) => (
          <div
            key={rule.key}
            className={`flex items-center gap-1.5 transition-colors ${passed[i] ? (isLight ? 'text-blue-600' : 'text-emerald-400') : ''}`}
          >
            <div className={`w-1 h-1 rounded-full ${passed[i] ? (isLight ? 'bg-blue-600' : 'bg-emerald-400') : isLight ? 'bg-slate-400' : 'bg-slate-800'}`} />
            {rule.label}
          </div>
        ))}
      </div>
    </div>
  )
}
