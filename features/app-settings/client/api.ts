'use client'

import { apiRequest } from '@/lib/api-client'
import type { AppSettings, FacultyFee } from '../types'

// Every panel layout AND most pages inside it call this on mount, so one
// navigation used to fire several identical uncached requests. Settings change
// only when a dekan saves them, so a short shared cache (plus in-flight
// de-duplication) collapses that burst into a single call without anyone
// seeing stale values for long. updateAppSettings() clears it immediately.
const SETTINGS_TTL_MS = 60_000
let cached: { at: number; value: AppSettings } | null = null
let inFlight: Promise<AppSettings> | null = null

export function clearAppSettingsCache() {
  cached = null
  inFlight = null
}

export function fetchAppSettings(): Promise<AppSettings> {
  if (cached && Date.now() - cached.at < SETTINGS_TTL_MS) return Promise.resolve(cached.value)
  if (inFlight) return inFlight

  inFlight = apiRequest<AppSettings>('/api/settings')
    .then((value) => {
      cached = { at: Date.now(), value }
      return value
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

// Dekan/tarbiyachi-scoped read — resolves to the CALLER's own faculty (not
// always the primary one /api/settings falls back to), and, when the
// faculty holds more than one building (202609300000), an explicit dormId
// names which one; omitted keeps resolving to the primary.
export function fetchDekanSettings(dormId?: string) {
  const qs = dormId ? `?dormId=${encodeURIComponent(dormId)}` : ''
  return apiRequest<AppSettings>(`/api/dekan/settings${qs}`)
}

export async function updateAppSettings(input: Partial<AppSettings>, dormId?: string) {
  const saved = await apiRequest<AppSettings>('/api/dekan/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dormId ? { ...input, dormId } : input),
  })
  // Don't let the read cache above serve the pre-save values back to the
  // dekan who just changed them.
  clearAppSettingsCache()
  return saved
}

// ---- dekan: Telegram notification chat for new permit requests ----

export async function fetchDekanTelegramChat(): Promise<string> {
  const { chatId } = await apiRequest<{ chatId: string }>('/api/dekan/telegram-chat', undefined, "Telegram sozlamasini yuklab bo'lmadi")
  return chatId
}

export async function updateDekanTelegramChat(chatId: string): Promise<string> {
  const result = await apiRequest<{ chatId: string }>('/api/dekan/telegram-chat', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId }),
  }, "Telegram sozlamasini saqlab bo'lmadi")
  return result.chatId
}

// ---- staff: personal Telegram notification chat ----

export async function fetchStaffTelegramChat(): Promise<string> {
  const { chatId } = await apiRequest<{ chatId: string }>('/api/staff/telegram-chat', undefined, "Telegram sozlamasini yuklab bo'lmadi")
  return chatId
}

export async function updateStaffTelegramChat(chatId: string): Promise<string> {
  const result = await apiRequest<{ chatId: string }>('/api/staff/telegram-chat', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId }),
  }, "Telegram sozlamasini saqlab bo'lmadi")
  return result.chatId
}

// ---- superadmin: cross-faculty fee table ----

export async function fetchFacultyFees(): Promise<FacultyFee[]> {
  const result = await apiRequest<{ fees: FacultyFee[] }>('/api/admin/faculty-fees', undefined, "To'lovlarni yuklab bo'lmadi")
  return result.fees
}

export function updateFacultyFee(input: { faculty: string; monthlyFee: number; yearlyContractFee: number }) {
  return apiRequest<FacultyFee>('/api/admin/faculty-fees', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }, "To'lovni saqlab bo'lmadi")
}
