'use client'

import { apiRequest } from '@/lib/api-client'
import type { StaffStory, StaffStoriesPayload, Story, StudentStoriesPayload } from '../types'

export async function fetchStudentStories(): Promise<Story[]> {
  const result = await apiRequest<StudentStoriesPayload>(
    '/api/stories',
    undefined,
    "Yangiliklarni yuklab bo'lmadi",
  )
  return result.stories
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
