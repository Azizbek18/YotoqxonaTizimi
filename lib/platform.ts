import { Capacitor } from '@capacitor/core'

/**
 * True when the app is running inside the packaged Capacitor shell
 * (Android/iOS native app), as opposed to a regular mobile/desktop browser
 * or installed PWA. Safe to call during SSR — returns false on the server.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
