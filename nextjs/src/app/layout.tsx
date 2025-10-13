import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import CookieConsent from "@/components/Cookies";
import { GoogleAnalytics } from '@next/third-parties/google'
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { cookies, headers } from "next/headers";


const productName = process.env.NEXT_PUBLIC_PRODUCTNAME ?? "House";

export const metadata: Metadata = {
  title: productName,
  applicationName: productName,
  description: "Centralisez la connaissance de votre foyer avec House.",
  manifest: "/manifest.json",
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: productName,
  },
  icons: {
    apple: [
      { url: "/icons/apple-touch-icon-120.png", sizes: "120x120" },
      { url: "/icons/apple-touch-icon-152.png", sizes: "152x152" },
      { url: "/icons/apple-touch-icon-167.png", sizes: "167x167" },
      { url: "/icons/apple-touch-icon-180.png", sizes: "180x180" },
    ],
  },
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
