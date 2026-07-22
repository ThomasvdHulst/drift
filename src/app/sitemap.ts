import type { MetadataRoute } from "next";
import { siteUrl, INDEXABLE_ROUTES } from "@/lib/site";

// Served at /sitemap.xml (Next's file convention). This is the URL to hand to
// Google Search Console: https://www.usedrift.org/sitemap.xml
//
// It lists only the routes that show real content to a signed-out visitor (see
// INDEXABLE_ROUTES in lib/site.ts for why the gated ones are left out). All four
// are static pages, so `lastModified` is the build time: it moves on each deploy,
// which is exactly when their content can have changed.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();
  return INDEXABLE_ROUTES.map((route) => ({
    url: route === "/" ? `${base}/` : `${base}${route}`,
    lastModified,
    changeFrequency: "monthly" as const,
    // The landing page is the one we actually want ranked; the rest are support
    // pages a visitor reaches from it.
    priority: route === "/" ? 1 : 0.5,
  }));
}
