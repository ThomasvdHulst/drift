import type { MetadataRoute } from "next";
import { siteUrl, INDEXABLE_ROUTES } from "@/lib/site";
import { NOTES } from "@/lib/notes";

// Served at /sitemap.xml (Next's file convention). This is the URL to hand to
// Google Search Console: https://www.usedrift.org/sitemap.xml
//
// It lists only the routes that show real content to a signed-out visitor (see
// INDEXABLE_ROUTES in lib/site.ts for why the gated ones are left out), plus one
// entry per note. Notes come from the registry rather than the route list so
// publishing one is a single edit in lib/notes.ts.
//
// Everything here is a static page, so `lastModified` is the build time: it moves
// on each deploy, which is exactly when their content can have changed.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();
  const url = (route: string) => (route === "/" ? `${base}/` : `${base}${route}`);

  return [
    ...INDEXABLE_ROUTES.map((route) => ({
      url: url(route),
      lastModified,
      changeFrequency: "monthly" as const,
      // The landing page is the one we actually want ranked; the explainer pages
      // sit just under it, and the support pages are the tail.
      priority:
        route === "/"
          ? 1
          : route === "/privacy" || route === "/install" || route === "/contact"
            ? 0.4
            : 0.7,
    })),
    ...NOTES.map((n) => ({
      url: url(`/notes/${n.slug}`),
      lastModified,
      changeFrequency: "yearly" as const, // a published note is done
      priority: 0.6,
    })),
  ];
}
