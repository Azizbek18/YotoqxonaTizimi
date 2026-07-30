import localFont from 'next/font/local'

/**
 * Baloo 2, self-hosted from a local file instead of next/font/google.
 * The Google Fonts variant made `next build` depend on Google's servers
 * being reachable, and when they weren't, the whole app silently fell back
 * to a hard-coded Windows-only system-font stack (Trebuchet MS/Segoe UI) —
 * fonts that don't exist on Android or iOS, so mobile users saw no custom
 * typography at all. Shipping the woff2 in the repo removes that dependency
 * for good while still rendering the real font everywhere.
 */
export const appFont = localFont({
  src: './fonts/baloo2-latin-variable.woff2',
  weight: '400 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-baloo2',
})
