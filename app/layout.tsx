import type { Metadata } from "next";
import AppProviders from "@/components/providers/AppProviders";
import PwaInstallPrompt from "@/components/pwa/PwaInstallPrompt";
import { THEME_STORAGE_KEY } from "@/lib/theme/constants";
import "./globals.css";

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
};

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: "Yotoqxona.uz — Aqlli talabalar yotoqxonasi boshqaruv tizimi",
  description: "Talabalar yotoqxonasi boshqaruvini avtomatlashtirish, arizalar yuborish, to'lovlarni amalga oshirish va navbatchilik jadvallarini real vaqt rejimida boshqarish platformasi.",
  keywords: ["yotoqxona", "talaba", "tizim", "aqlli boshqaruv", "arizalar", "navbatchilik", "yotoqxona boshqaruvi", "supabase", "nextjs", "AI yordamchi"],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "MTalaba",
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: "Yotoqxona.uz — Aqlli talabalar yotoqxonasi boshqaruv tizimi",
    description: "Yotoqxonadagi barcha jarayonlar: arizalar, to'lovlar va navbatchilikni elektron boshqarish. AI yordamchi bilan tezkor muloqot.",
    url: getBaseUrl(),
    siteName: 'Yotoqxona.uz',
    locale: 'uz_UZ',
    type: 'website',
    images: [
      {
        url: '/rasm.png',
        width: 1200,
        height: 630,
        alt: "Yotoqxona.uz — Aqlli yotoqxona boshqaruv tizimi namoyishi",
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Yotoqxona.uz — Aqlli yotoqxona boshqaruv tizimi",
    description: "Yotoqxonadagi barcha jarayonlarni (arizalar, to'lovlar, navbatchilik) elektron va AI orqali boshqarish platformasi.",
    images: ['/rasm.png'],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
