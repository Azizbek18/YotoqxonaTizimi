export type StudentAnnouncement = {
  id: string
  title: string
  text: string
  type: 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish'
  audience: 'all' | 'faculty' | 'floor'
  faculty: string | null
  created_at: string
  published_at: string | null
  author_name: string
  is_from_captain: boolean
  captain_floor?: number
}

export type StudentAnnouncementsPayload = {
  elonlar: StudentAnnouncement[]
  currentFaculty: string | null
}

export const ANNOUNCEMENT_TYPES = ['Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'] as const

export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number]

/** An announcement as its own author sees it (dekan "E'lonlar" bo'limi). */
export type AuthoredAnnouncement = {
  id: string
  title: string
  text: string
  type: AnnouncementType
  audience: string
  faculty: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  published_at: string | null
}

export type AnnouncementInput = {
  title: string
  text: string
  type: AnnouncementType
  is_published: boolean
}
