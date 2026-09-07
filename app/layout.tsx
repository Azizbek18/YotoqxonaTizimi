import type { Metadata } from "next";
import { headers } from "next/headers";
import AppProviders from "@/components/providers/AppProviders";
import PwaInstallPrompt from "@/components/pwa/PwaInstallPrompt";
import { THEME_STORAGE_KEY } from "@/lib/theme/constants";
import { appFont } from "@/lib/app-font";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const getBaseUrl = siteUrl;

const SITE_NAME = 'Meningyotoqxonam.uz'
const SITE_TITLE = `${SITE_NAME} — Aqlli talabalar yotoqxonasi boshqaruv tizimi`

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: "Talabalar yotoqxonasi boshqaruvini avtomatlashtirish, arizalar yuborish, to'lovlarni amalga oshirish va navbatchilik jadvallarini real vaqt rejimida boshqarish platformasi.",
  keywords: ["meningyotoqxonam", "yotoqxona", "talaba", "tizim", "aqlli boshqaruv", "arizalar", "navbatchilik", "yotoqxona boshqaruvi", "yotoqxonaga joylashish", "my.gov.uz yo'llanma", "supabase", "nextjs", "AI yordamchi"],
  manifest: '/manifest.json',
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "Mening Yotoqxonam",
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: SITE_TITLE,
    description: "Yotoqxonadagi barcha jarayonlar: arizalar, to'lovlar va navbatchilikni elektron boshqarish. AI yordamchi bilan tezkor muloqot.",
    url: getBaseUrl(),
    siteName: SITE_NAME,
    locale: 'uz_UZ',
    type: 'website',
    // og:image is supplied by app/opengraph-image.tsx (correct 1200×630).
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: "Yotoqxonadagi barcha jarayonlarni (arizalar, to'lovlar, navbatchilik) elektron va AI orqali boshqarish platformasi.",
    // twitter:image is supplied by app/twitter-image.tsx.
  }
};

const themeInitScript = `
  (function () {
    try {
      var saved = localStorage.getItem('${THEME_STORAGE_KEY}');
      var parsed = saved ? JSON.parse(saved) : null;
      var theme = parsed && parsed.state && parsed.state.theme ? parsed.state.theme : 'dark';
      var root = document.documentElement;
      root.dataset.theme = theme;
      root.style.colorScheme = theme;
      root.classList.remove('theme-dark', 'theme-light', 'dark', 'light');
      root.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');
      root.classList.add(theme);
    } catch (error) {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.style.colorScheme = 'dark';
      document.documentElement.classList.remove('theme-dark', 'theme-light', 'dark', 'light');
      document.documentElement.classList.add('theme-dark', 'dark');
    }
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const baseUrl = getBaseUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: SITE_NAME,
        description: 'Talabalar yotoqxonasi boshqaruv tizimi — yo\'llanma yuborish, xonaga joylashish, to\'lovlar va navbatchilik.',
        inLanguage: 'uz',
      },
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: SITE_NAME,
        url: baseUrl,
        logo: `${baseUrl}/logo.png`,
      },
    ],
  };

  return (
    <html
      lang="uz"
      suppressHydrationWarning
      className={`h-full antialiased ${appFont.variable}`}
    >
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AppProviders>
          {children}
          <PwaInstallPrompt />
        </AppProviders>
      </body>
    </html>
  );
}
