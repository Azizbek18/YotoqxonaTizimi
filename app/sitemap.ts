import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

// Served at /sitemap.xml. Only the public, indexable entry points — the
// student application funnel plus the login/registration pages. Authenticated
// routes are deliberately omitted (see app/robots.ts).
const PUBLIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/yotoqxona', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/ariza-yuborish', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/ruxsatnoma-yuborish', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/imtiyozli-ariza', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/ruxsatnoma-tekshirish', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/ariza-tekshirish', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/register', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.5, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return PUBLIC_PATHS.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    changeFrequency,
    priority,
  }));
}
