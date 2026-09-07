/**
 * Canonical public origin of the site, with no trailing slash.
 *
 * Order of preference:
 *  1. NEXT_PUBLIC_APP_URL — the real custom domain in production
 *     (`https://www.meningyotoqxonam.uz`) and in any preview env that sets it.
 *  2. VERCEL_URL — the per-deployment *.vercel.app host, so preview builds
 *     still produce absolute URLs (Vercel injects this without a scheme).
 *  3. localhost — local dev.
 *
 * Used by `app/layout.tsx` (metadataBase / OpenGraph), `app/robots.ts` and
 * `app/sitemap.ts` so every crawler-facing absolute URL agrees on one origin.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}
