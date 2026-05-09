import type { Metadata } from "next";
import { Exo_2, Fugaz_One } from "next/font/google";
import AppProviders from "@/components/providers/AppProviders";
import { THEME_STORAGE_KEY } from "@/lib/theme/constants";
import "./globals.css";

const exo2 = Exo_2({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-exo2",
  display: "swap",
});

const fugazOne = Fugaz_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-fugaz-one",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: "MTalaba | Yotoqxona tizimi",
  description: "Yotoqxonani kuchli nazorat qiladigan platforma",
  icons: {
    icon: '/logo.png',
  },
  openGraph: {
    title: "Yotoqxona.uz - Aqlli boshqaruv tizimi",
    description: "Yotoqxonani raqamli boshqarish platformasi",
    images: [
      {
        url: '/rasm.png',
        width: 1200,
        height: 630,
      }
    ],
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
      root.classList.remove('theme-dark', 'theme-light');
      root.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');
    } catch (error) {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.style.colorScheme = 'dark';
      document.documentElement.classList.add('theme-dark');
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
      className={`h-full antialiased ${exo2.variable} ${fugazOne.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`min-h-full flex flex-col ${exo2.className}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
