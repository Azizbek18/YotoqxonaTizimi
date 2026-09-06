import { ANNOUNCEMENT_TYPES, type AnnouncementType } from '@/features/announcements/types'

export { ANNOUNCEMENT_TYPES }
export type StoryType = AnnouncementType

/** A story as the student dashboard renders it. */
export type Story = {
  id: string
  title: string
  caption: string | null
  type: StoryType
  image_url: string
  link_url: string | null
  author_name: string
  created_at: string
  expires_at: string
}

/** A story as its poster (tarbiyachi / dekan) manages it. */
export type StaffStory = Story & { created_by: string | null }

/** Validated payload the service persists (image already uploaded by the route). */
export type StoryInput = {
  title: string
  caption: string | null
  type: StoryType
  link_url: string | null
  image_url: string
  image_path: string
}

export type StudentStoriesPayload = { stories: Story[] }
export type StaffStoriesPayload = { stories: StaffStory[] }
