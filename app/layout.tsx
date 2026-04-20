import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Toaster position="top-left" reverseOrder={false} />
        {children}
      </body>
    </html>
  );
}
