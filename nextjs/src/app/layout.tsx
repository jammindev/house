// nextjs/src/app/layout.tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import CookieConsent from "@/components/Cookies";
import { GoogleAnalytics } from '@next/third-parties/google'
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { NavigationOverlayProvider } from "@/components/layout/NavigationOverlayProvider";

const productName = process.env.NEXT_PUBLIC_PRODUCTNAME ?? "House";

export const metadata: Metadata = {
  title: productName,
  applicationName: productName,
  description: "Centralisez la connaissance de votre foyer avec House.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: productName },
  icons: { apple: [
    { url: "/icons/apple-touch-icon-120.png", sizes: "120x120" },
    { url: "/icons/apple-touch-icon-152.png", sizes: "152x152" },
    { url: "/icons/apple-touch-icon-167.png", sizes: "167x167" },
    { url: "/icons/apple-touch-icon-180.png", sizes: "180x180" },
  ]},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = process.env.NEXT_PUBLIC_THEME ?? "theme-sass3";
  const gaID = process.env.NEXT_PUBLIC_GOOGLE_TAG;

  // On ne lit plus cookies()/headers() ici.
  // L’I18nProvider lit la locale côté client via le cookie 'locale' (ou 'en' fallback).
  return (
    <html lang="en">
      <body className={theme}>
        <I18nProvider initialLocale="en">
          <NavigationOverlayProvider>
            {children}
            <CookieConsent />
          </NavigationOverlayProvider>
        </I18nProvider>
        <Analytics />
        {gaID && <GoogleAnalytics gaId={gaID} />}
      </body>
    </html>
  );
}
