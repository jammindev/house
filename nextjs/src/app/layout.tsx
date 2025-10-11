import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import CookieConsent from "@/components/Cookies";
import { GoogleAnalytics } from '@next/third-parties/google'
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { cookies, headers } from "next/headers";


export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_PRODUCTNAME,
  description: "The best way to build your SaaS product.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  let initialLocale: "en" | "fr" = "en";
  if (localeCookie === "fr" || localeCookie === "en") {
    initialLocale = localeCookie;
  } else {
    const headerList = await headers();
    const acceptLanguage = headerList.get("accept-language");
    if (acceptLanguage) {
      const primaryLang = acceptLanguage.split(",")[0]?.trim().toLowerCase();
      if (primaryLang && primaryLang.startsWith("fr")) {
        initialLocale = "fr";
      }
    }
  }
  let theme = process.env.NEXT_PUBLIC_THEME
  if(!theme) {
    theme = "theme-sass3"
  }
  const gaID = process.env.NEXT_PUBLIC_GOOGLE_TAG;
  return (
    <html lang={initialLocale}>
      <body className={theme}>
        <I18nProvider initialLocale={initialLocale}>
          {children}
          <CookieConsent />
        </I18nProvider>
        <Analytics />
        { gaID && (
            <GoogleAnalytics gaId={gaID}/>
        )}
      </body>
    </html>
  );
}
