import 'server-only'
import webpush from 'web-push'
import { getServiceSupabase } from '@/lib/server-supabase'

export type PushMessage = {
  title: string
  body: string
  url?: string
  tag?: string
}

type StoredSubscription = {
  id: number
  endpoint: string
  p256dh: string
  auth: string
}

let configuredFor = ''

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return false

  const fingerprint = `${publicKey}:${privateKey}`
  if (configuredFor !== fingerprint) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@meningyotoqxonam.uz',
      publicKey,
      privateKey,
    )
    configuredFor = fingerprint
  }
  return true
}

async function deliver(rows: StoredSubscription[], message: PushMessage) {
  if (rows.length === 0 || !configureWebPush()) return

  const supabase = getServiceSupabase()
  const expiredIds: number[] = []
  const payload = JSON.stringify({
    ...message,
    url: message.url || '/talaba/dashboard',
    icon: '/icons/icon-192.webp',
    badge: '/icons/icon-96.webp',
  })

  await Promise.allSettled(rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
        { TTL: 60 * 60 * 24, urgency: 'high' },
      )
    } catch (error) {
      const statusCode = (error as { statusCode?: number } | null)?.statusCode
      if (statusCode === 404 || statusCode === 410) expiredIds.push(row.id)
      else console.error('Web Push delivery failed:', error)
    }
  }))

  if (expiredIds.length > 0) {
    const { error } = await supabase.from('push_subscriptions').delete().in('id', expiredIds)
    if (error) console.error('Expired push subscriptions cleanup failed:', error)
  }
}
async function rowsFor(column: 'user_id' | 'permit_request_id', id: string) {
  const { data, error } = await getServiceSupabase()
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq(column, id)
    .eq('enabled', true)
  if (error) throw error
  return data as StoredSubscription[]
}

export async function sendPushForUser(userId: string, message: PushMessage) {
  await deliver(await rowsFor('user_id', userId), message)
}

export async function sendPushForPermit(permitRequestId: string, message: PushMessage) {
  await deliver(await rowsFor('permit_request_id', permitRequestId), message)
}

export async function sendPushWithoutBreaking<T>(send: () => Promise<T>) {
  try {
    await send()
  } catch (error) {
    // A browser/provider outage must never undo the database operation that
    // produced the notification.
    console.error('Push notification failed:', error)
  }
}
