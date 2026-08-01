import type { MetadataRoute } from "next";
import { siteUrl, PRIVATE_ROUTES, PUBLIC_SHARE_PREFIX } from "@/lib/site";

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
      // `/s/` is public but must never be indexed: a share token is a
      // capability, the content is someone's own trail, and a crawlable page of
      // Wikipedia extracts is republication (see PUBLIC_SHARE_PREFIX). The page
      // also sends `noindex`, because robots.txt asks a crawler not to FETCH a
      // URL and does not stop one that learns of it elsewhere from listing it.
      disallow: [...PRIVATE_ROUTES, PUBLIC_SHARE_PREFIX],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
