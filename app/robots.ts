import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

// Served at /robots.txt. Everything public is crawlable; the authenticated
// panels and the API are not (nothing there is useful in a search result and
// most of it 401s for a crawler anyway).
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/talaba/',
          '/dekan/',
          '/tarbiyachi/',
          '/sardor/',
          '/admin/',
          '/kirish/',
          '/update-password',
          '/forgot-password',
          '/auth/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
