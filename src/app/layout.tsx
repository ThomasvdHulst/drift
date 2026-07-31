import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { adsConfig, adsenseScriptEnabled } from "@/lib/ads";
import { consentModeBootstrap } from "@/lib/consent";
import {
  AdSenseLoader,
  ConsentBanner,
  ConsentProvider,
} from "@/components/ConsentGate";
import { siteUrl } from "@/lib/site";
import { AUTH_STORAGE_KEY } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthProvider } from "@/components/AuthProvider";
import { StorageNotice } from "@/components/StorageNotice";

// Runs before first paint to set the theme with no flash of the wrong one.
// IndexedDB (our settings store) is async, so the theme is mirrored to a
// synchronous localStorage key just for this pre-paint read (documented
// deviation from "settings live in localforage").
const themeScript = `(function(){try{var t=localStorage.getItem('drift-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

// Also runs before first paint, for the same reason: no flash of the wrong thing.
// `/` server-renders the landing page (so search engines and first-time visitors
// get real content in the HTML instead of a spinner), but someone who is already
// signed in would otherwise glimpse it while the session resolves. The session
// lives in localStorage, so only a synchronous pre-paint read can know: this
// flags <html data-session="1"> and globals.css swaps the landing for the quiet
// placeholder until AuthGate takes over. Everyone is served identical HTML; what
// shows depends on the visitor's own local state, exactly like the theme above.
const sessionScript = `(function(){try{var s=localStorage.getItem('${AUTH_STORAGE_KEY}');if(s&&s.indexOf('access_token')>-1){document.documentElement.setAttribute('data-session','1');}}catch(e){}})();`;

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

// Ads config, read once at module scope from statically-inlined NEXT_PUBLIC_* env.
const ADS = adsConfig();

export const metadata: Metadata = {
  // Absolute-URL base for canonical + OpenGraph links (search engines and social
  // cards want fully-qualified URLs). Per-page `alternates.canonical` resolves
  // against this, and `title`/`description` propagate into og:/twitter: below.
  metadataBase: new URL(siteUrl()),
  title: "Drift: pull a thread, see where it goes",
  description:
    "A calm feed of knowledge cards where you are the algorithm. Pull threads to steer your own rabbit hole.",
  applicationName: "Drift",
  alternates: { canonical: "/" },
  // Only the non-text fields here: Next fills og:/twitter: title + description
  // from the resolved page `title`/`description`, so every public page gets an
  // accurate card without repeating itself.
  openGraph: {
    type: "website",
    siteName: "Drift",
    locale: "en_US",
    // No static `url` here: it would report the homepage as og:url on every
    // subpage. The per-page `alternates.canonical` already carries the correct
    // absolute URL, which is the one search engines actually use.
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Drift" }],
  },
  twitter: {
    card: "summary",
    images: ["/icon-512.png"],
  },
  // Installable-web-app hints (Phase 13). The manifest (app/manifest.ts), favicon
  // (app/icon.svg + app/favicon.ico), and Apple touch icon (app/apple-icon.png)
  // are auto-linked by Next's file conventions; this adds the iOS standalone meta.
  appleWebApp: {
    capable: true,
    title: "Drift",
    statusBarStyle: "default",
  },
  // AdSense ownership verification: <meta name="google-adsense-account"> in the
  // static HTML. Gated on the SAME switch as the loader script below, not merely on
  // a publisher id being configured. The meta tag alone sets no cookie, but it
  // advertises an active ad integration on a site that must not have one until the
  // consent gate exists, and keeping the two on one condition is what stops them
  // drifting apart again (compliance audit B-1).
  ...(adsenseScriptEnabled(ADS)
    ? { other: { "google-adsense-account": ADS.client as string } }
    : {}),
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
  // Ads are OFF by default, and "off" now means genuinely nothing: no loader, no
  // meta tag, no third-party request, no cookie. Both are gated on
  // `adsenseScriptEnabled`, which requires NEXT_PUBLIC_ADS_ENABLED and not merely a
  // publisher id. See lib/ads.ts for what that used to do and why it mattered.
  //
  // When the switch goes on, the loader is NOT the first thing that happens: the
  // consent gate runs first and nothing third-party loads before the reader has
  // chosen (compliance audit B-1). `AdSenseLoader` is the only place a Google
  // script can enter the page, and it requires the switch AND a granted choice.
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: sessionScript }} />
        {/* Google consent mode v2, with every signal DENIED. It has to be in
            place before anything Google could run, so it is a blocking inline
            script in the head rather than an effect. Present only when the ads
            switch is on: with ads off there is no Google anything to signal to,
            and an unexplained `gtag` on an ad-free page is the sort of thing
            that makes a privacy page harder to believe. */}
        {adsenseScriptEnabled(ADS) && (
          <script dangerouslySetInnerHTML={{ __html: consentModeBootstrap() }} />
        )}
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like data-gr-ext-installed onto <body> before React hydrates,
          which otherwise trips a false-positive hydration mismatch. */}
      <body className="min-h-full" suppressHydrationWarning>
        <ConsentProvider>
          <AuthProvider>
            {/* The login gate lives in `(app)/layout.tsx`, one level down, so
                that it wraps the real pages but NOT `not-found.tsx` / the error
                boundaries, which are siblings of that group. Gating the 404
                meant a signed-out visitor who mistyped a URL saw the landing
                page under a "Page not found" tab title. */}
            {children}
            <ThemeToggle />
            <StorageNotice />
          </AuthProvider>
          <ConsentBanner />
          <AdSenseLoader />
        </ConsentProvider>
      </body>
    </html>
  );
}
