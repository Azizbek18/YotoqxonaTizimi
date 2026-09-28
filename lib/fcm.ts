import 'server-only'
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { getServiceSupabase } from '@/lib/server-supabase'

export type FcmMessage = {
  title: string
  body: string
  url?: string
  tag?: string
}

type StoredFcmToken = {
  id: number
  token: string
}

let app: App | null = null

function configureFcm(): App | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()
  if (!projectId || !clientEmail || !privateKey) return null

  if (app) return app
  const existing = getApps()[0]
  if (existing) {
    app = existing
    return app
  }
  app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // Vercel env vars are single-line — the PEM's newlines are stored
      // \n-escaped and must be restored before use.
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  })
  return app
}

async function rowsForUser(userId: string): Promise<StoredFcmToken[]> {
  const { data, error } = await getServiceSupabase()
    .from('fcm_tokens')
    .select('id, token')
    .eq('user_id', userId)
    .eq('enabled', true)
  if (error) throw error
  return data as StoredFcmToken[]
}

async function rowsForUsers(userIds: string[]): Promise<StoredFcmToken[]> {
  if (userIds.length === 0) return []
  const { data, error } = await getServiceSupabase()
    .from('fcm_tokens')
    .select('id, token')
    .in('user_id', userIds)
    .eq('enabled', true)
  if (error) throw error
  return data as StoredFcmToken[]
}

async function deliver(rows: StoredFcmToken[], message: FcmMessage) {
  const firebaseApp = configureFcm()
  if (rows.length === 0 || !firebaseApp) return

  const messaging = getMessaging(firebaseApp)
  const tokens = rows.map((row) => row.token)
  const tokenById = new Map(rows.map((row) => [row.token, row.id]))

  // sendEachForMulticast caps at 500 tokens per call.
  const batches: string[][] = []
  for (let i = 0; i < tokens.length; i += 500) batches.push(tokens.slice(i, i + 500))

  const staleIds: number[] = []
  for (const batch of batches) {
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title: message.title, body: message.body },
      data: {
        ...(message.url ? { url: message.url } : {}),
        ...(message.tag ? { tag: message.tag } : {}),
      },
    })
    response.responses.forEach((result, index) => {
      if (result.success) return
      const code = result.error?.code
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        const id = tokenById.get(batch[index])
        if (id) staleIds.push(id)
      } else {
        console.error('FCM delivery failed:', result.error)
      }
    })
  }

  if (staleIds.length > 0) {
    const { error } = await getServiceSupabase().from('fcm_tokens').delete().in('id', staleIds)
    if (error) console.error('Stale FCM token cleanup failed:', error)
  }
}

export async function sendFcmForUser(userId: string, message: FcmMessage) {
  await deliver(await rowsForUser(userId), message)
}

export async function sendFcmForUsers(userIds: string[], message: FcmMessage) {
  await deliver(await rowsForUsers(userIds), message)
}
