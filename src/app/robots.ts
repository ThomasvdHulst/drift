import type { MetadataRoute } from "next";
import { siteUrl, PRIVATE_ROUTES } from "@/lib/site";

// Served at /robots.txt (Next's file convention).
//
// Two jobs: point crawlers at the sitemap, and keep them off the login-gated
// routes. Those all render the same sign-in screen to a crawler, so leaving them
// crawlable spends the site's crawl budget on duplicates of one page and risks
// soft-404 flags that make the real pages harder to index. Nothing here is a
// security boundary (that is the auth gate + RLS); it is purely about pointing
// search engines at the pages worth indexing.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_ROUTES],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
