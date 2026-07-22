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
