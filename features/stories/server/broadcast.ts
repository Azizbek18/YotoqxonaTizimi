import 'server-only'
import { sendTelegramPhoto } from '@/lib/telegram'
import { sendPushForUsers } from '@/lib/push-notifications'
import type { AnnouncementStoryRow } from '@/types/database.generated'
import { createStoryRepository, type StoryRepository } from './repository'

// Telegram tolerates ~30 messages/second to different chats. Stay well under
// that: send in small batches with a pause between them.
const TG_BATCH = 25
const TG_PAUSE_MS = 1_100

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function caption(story: Pick<AnnouncementStoryRow, 'title' | 'caption'>) {
  const head = `📢 <b>${escapeHtml(story.title)}</b>`
  const body = story.caption ? `\n\n${escapeHtml(story.caption)}` : ''
  // Telegram photo captions are capped at 1024 chars.
  return `${head}${body}`.slice(0, 1024)
}

/**
 * Fire-and-forget after a story is published: deliver the image + short text to
 * every linked student of the poster's faculty via Telegram, and an in-app Web
 * Push to their subscribed devices. A failure of either channel only logs — it
 * must never surface to the poster or undo the insert.
 */
export async function broadcastStory(
  story: AnnouncementStoryRow,
  repository: StoryRepository = createStoryRepository(),
) {
  try {
    const studentIds = await repository.listActiveStudentIdsByFaculty(story.faculty)
    if (studentIds.length === 0) return

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const replyMarkup = appUrl
      ? {
          inline_keyboard: [[{ text: 'Yangiliklarni ochish', url: `${appUrl}/talaba/dashboard` }]],
        }
      : undefined
    const text = caption(story)

    // --- Telegram ---
    try {
      const chatIds = await repository.listTelegramChatIds(studentIds)
      for (let i = 0; i < chatIds.length; i += TG_BATCH) {
        const batch = chatIds.slice(i, i + TG_BATCH)
        await Promise.allSettled(
          batch.map((chatId) =>
            sendTelegramPhoto(String(chatId), story.image_url, text, {
              parseMode: 'HTML',
              replyMarkup,
            }),
          ),
        )
        if (i + TG_BATCH < chatIds.length) await sleep(TG_PAUSE_MS)
      }
    } catch (error) {
      console.error('broadcastStory: Telegram fan-out failed:', error)
    }

    // --- Web Push ---
    try {
      await sendPushForUsers(studentIds, {
        title: story.title,
        body: story.caption || 'Yangi yangilik joylandi',
        url: '/talaba/dashboard',
        tag: 'story',
      })
    } catch (error) {
      console.error('broadcastStory: Web Push fan-out failed:', error)
    }
  } catch (error) {
    console.error('broadcastStory failed:', error)
  }
}
