import 'server-only'
import { sendPushForPermit, sendPushForUser, sendPushForUsers, type PushMessage } from '@/lib/push-notifications'
import { sendFcmForUser, sendFcmForUsers } from '@/lib/fcm'

/**
 * Fans a notification out to every channel a student might be reachable on:
 * browser Web Push (existing) and the native Flutter app's FCM token (new).
 * One provider's outage never suppresses the other's delivery.
 *
 * Drop-in replacement for the sendPushFor*() calls in lib/push-notifications.ts
 * at the 7 real call sites — same signatures, same sendPushWithoutBreaking()
 * wrapping convention at the call site.
 */
export async function notifyStudent(userId: string, message: PushMessage) {
  await Promise.allSettled([
    sendPushForUser(userId, message),
    sendFcmForUser(userId, message),
  ])
}

/** Fan-out to many students at once (e.g. a faculty-wide story broadcast). */
export async function notifyStudents(userIds: string[], message: PushMessage) {
  if (userIds.length === 0) return
  await Promise.allSettled([
    sendPushForUsers(userIds, message),
    sendFcmForUsers(userIds, message),
  ])
}

/**
 * Permit-anchored notifications (pre-registration applicants) have no FCM
 * counterpart: the Flutter app is login-only, and an applicant at this stage
 * has no account yet to have logged into it with. Web Push is the only
 * channel until they register.
 */
export async function notifyPermit(permitRequestId: string, message: PushMessage) {
  await sendPushForPermit(permitRequestId, message)
}
