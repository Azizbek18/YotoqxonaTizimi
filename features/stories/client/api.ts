'use client'

import { apiRequest } from '@/lib/api-client'
import { ClientCache } from '@/lib/client-cache'
import type { StaffStory, StaffStoriesPayload, Story, StudentStoriesPayload } from '../types'

// Re-read on every dashboard visit; stories change a few times a day at most.
const studentStoriesCache = new ClientCache<Story[]>(60_000)

export function fetchStudentStories(): Promise<Story[]> {
  return studentStoriesCache.get('mine', async () => {
    const result = await apiRequest<StudentStoriesPayload>(
      '/api/stories',
      undefined,
      "Yangiliklarni yuklab bo'lmadi",
    )
    return result.stories
  })
}

export async function fetchStaffStories(): Promise<StaffStory[]> {
  const result = await apiRequest<StaffStoriesPayload>(
    '/api/dekan/stories',
    undefined,
    "Yangiliklarni yuklab bo'lmadi",
  )
  return result.stories
}

export async function createStaffStory(form: FormData): Promise<StaffStory> {
  const result = await apiRequest<{ story: StaffStory }>(
    '/api/dekan/stories',
    { method: 'POST', body: form },
    "Yangilikni joylab bo'lmadi",
  )
  return result.story
}

export function deleteStaffStory(id: string) {
  return apiRequest<{ ok: true }>(
    `/api/dekan/stories?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    "Yangilikni o'chirib bo'lmadi",
  )
}

export async function fetchCouncilStories(): Promise<StaffStory[]> {
  const result = await apiRequest<StaffStoriesPayload>(
    '/api/kengash/stories',
    undefined,
    "Yangiliklarni yuklab bo'lmadi",
  )
  return result.stories
}

export async function createCouncilStory(form: FormData): Promise<StaffStory> {
  const result = await apiRequest<{ story: StaffStory }>(
    '/api/kengash/stories',
    { method: 'POST', body: form },
    "Yangilikni joylab bo'lmadi",
  )
  return result.story
}

export function deleteCouncilStory(id: string) {
  return apiRequest<{ ok: true }>(
    `/api/kengash/stories?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    "Yangilikni o'chirib bo'lmadi",
  )
}
