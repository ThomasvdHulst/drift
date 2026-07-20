import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "katex/dist/katex.min.css";
import { adsConfig, adsenseScriptEnabled } from "@/lib/ads";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthProvider } from "@/components/AuthProvider";
import { AuthGate } from "@/components/AuthGate";
import { AccountButton } from "@/components/AccountButton";
import { StorageNotice } from "@/components/StorageNotice";
import { TourProvider } from "@/components/tour/TourProvider";

// Runs before first paint to set the theme with no flash of the wrong one.
// IndexedDB (our settings store) is async, so the theme is mirrored to a
// synchronous localStorage key just for this pre-paint read (documented
// deviation from "settings live in localforage").
const themeScript = `(function(){try{var t=localStorage.getItem('drift-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

// Warm serif display for card titles; clean sans for body — see CLAUDE.md §6.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drift: pull a thread, see where it goes",
  description:
    "A calm feed of Wikipedia knowledge cards where you are the algorithm. Pull threads to steer your own rabbit hole.",
  applicationName: "Drift",
  // Installable-web-app hints (Phase 13). The manifest (app/manifest.ts), favicon
  // (app/icon.svg + app/favicon.ico), and Apple touch icon (app/apple-icon.png)
  // are auto-linked by Next's file conventions; this adds the iOS standalone meta.
  appleWebApp: {
    capable: true,
    title: "Drift",
    statusBarStyle: "default",
  },
};

// theme-color follows the OS light/dark preference; viewportFit: "cover" lets the
// app extend under the notch / home indicator so env(safe-area-inset-*) works when
// launched standalone from the home screen.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1917" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Ads (Phase 21) are OFF by default. The AdSense loader script loads as soon as
  // a publisher id (NEXT_PUBLIC_ADSENSE_CLIENT) is set — this is what Google needs
  // live to review the site, and it stays independent of the ad kill switch (so
  // the site can be "under review" with no visible ads). With no client id set, no
  // third-party request is made and no cookies are set. The GDPR consent message is
  // enabled in the AdSense dashboard and served by this script.
  const ads = adsConfig();
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like data-gr-ext-installed onto <body> before React hydrates,
          which otherwise trips a false-positive hydration mismatch. */}
      <body className="min-h-full" suppressHydrationWarning>
        <AuthProvider>
          <AuthGate>
            {/* The guided tour (Phase 20) is mounted inside the gate, so it never
                renders on the signed-out Landing, and it survives client-side
                route changes so one tour can flow across pages. */}
            <TourProvider>
              {children}
              <AccountButton />
            </TourProvider>
          </AuthGate>
          <ThemeToggle />
          <StorageNotice />
        </AuthProvider>
        {adsenseScriptEnabled(ads) && (
          <Script
            id="adsbygoogle-init"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.client}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
