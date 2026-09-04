'use client'

import { apiRequest } from '@/lib/api-client'
import type { AppSettings, FacultyFee } from '../types'

export function fetchAppSettings() {
  return apiRequest<AppSettings>('/api/settings')
}

export function updateAppSettings(input: Partial<AppSettings>) {
  return apiRequest<AppSettings>('/api/dekan/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
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
