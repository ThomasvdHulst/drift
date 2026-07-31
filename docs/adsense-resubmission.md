# AdSense resubmission: what to do, and when

Written 2026-07-29, after the first application was rejected for "Low value content".

This is the part I cannot do for you. The code changes are done and deployed; what is left is a
Search Console step, a wait, and a resubmission.

---

## Why the first application failed

Three reasons, in order of how much they mattered.

**1. The domain was 10 days old.** `usedrift.org` was registered 2026-07-19 and you applied within
about a week. "Low value content" is Google's catch-all for sites with no history, and the
practical threshold people report is 3 to 6 months. Nothing on this list matters as much as this
one, and the only fix is time.

**2. There was almost nothing to crawl.** 5 pages, about 2,040 words, and only two of those pages
were content (`/` and `/about`). `/privacy`, `/install` and `/contact` are utility pages that do
not count. Google's own description of this rejection is that the site "may not have enough text,
and/or the site was deemed to be 'under construction'".

**3. The product is behind a login, and the fix for that does not exist before approval.** Google
does offer a "crawler login" so ads can serve on login-protected pages, but the help page is
explicit: *"After your account has been activated, you can display Google ads on the pages of your
site behind a login by creating a crawler login."* After activation. So the public pages have to
carry the application by themselves. There is no way to let the reviewer in first.

## What changed

The public reading surface went from 5 URLs / ~2,040 words to **15 URLs / ~8,000 words**, all of it
original writing about Drift:

| | before | after |
|---|---|---|
| indexable URLs | 5 | 15 |
| crawlable words | ~2,040 | ~8,000 |
| real content pages | 2 | 12 |

New: `/how-it-works`, `/principles`, `/sources`, `/faq`, `/colophon`, `/notes` and four notes. All
are in `sitemap.xml`, all render to a signed-out visitor (verified against a real gated build), and
all are reachable from the footer on every public page.

---

## Your checklist

### Now, once this is deployed

- [ ] **Deploy**, then confirm the pages are live signed out. Open them in a private window:
      `/how-it-works`, `/principles`, `/sources`, `/faq`, `/notes`, `/colophon`. You should see the
      page, not the sign-in screen.
- [ ] **Read the copy.** It goes out under your name and it says "I" in places. Change anything that
      does not sound like you. `/colophon` names you and the Netherlands; `/faq` promises replies
      "within a few days"; `/notes/why-drift-exists` says Drift only partly works for you. Those are
      all yours to adjust.
- [ ] **Verify the property in Google Search Console** at <https://search.google.com/search-console>,
      if you have not already. Use the *Domain* property type (`usedrift.org`) and add the TXT
      record it gives you at your registrar. Domain properties cover `www` and non-`www` together.
- [ ] **Submit the sitemap.** Search Console > Sitemaps > enter `sitemap.xml`. The full URL is
      <https://www.usedrift.org/sitemap.xml>.
- [ ] **Request indexing for the new pages.** Search Console > URL Inspection, paste each new URL,
      then "Request indexing". Do the six section pages at least. This is a nudge, not a guarantee.

### About two weeks later

- [ ] **Check they actually indexed.** Search Console > Pages. You want the new URLs under "Indexed",
      not "Crawled - currently not indexed" or "Discovered - currently not indexed". If they are
      stuck in "Discovered" after three or four weeks, that is a signal the site is still too new
      rather than something broken.
- [ ] **Sanity check by hand:** search Google for `site:usedrift.org`. It should list the new pages.
      If it lists nothing at all, indexing has not started and resubmitting is pointless.

### The resubmission itself

- [ ] **Do not resubmit before roughly 20 October 2026.** That is three months after the domain was
      registered, and it is the earliest date where age stops being the obvious reason to say no.
      Later is safer. There is no penalty for reapplying, but each attempt on a site that has not
      changed teaches Google nothing and wastes a review cycle.
- [ ] **Before you resubmit, add one or two more notes.** "Update your site regularly" is one of the
      few things Google names explicitly, and a journal whose newest entry is three months old
      argues against you. Two more posts between now and October is enough.
- [ ] **Resubmit** in the AdSense dashboard: Sites > your site > Request review.
- [ ] **Leave the ad kill-switch off** until you are approved. `NEXT_PUBLIC_ADS_ENABLED` stays unset.
      Ad slots on a site with no approval are pointless and the AdSense script sets third-party
      cookies, which would make the current `/privacy` copy untrue.

### If it is approved

- [ ] **Set up the crawler login** so ads can serve inside the app. AdSense > Account > Access and
      authorization > Crawler login. This is the thing that does not exist until now.
- [ ] **Check `public/ads.txt`** still matches your publisher id.
- [ ] **Update `/privacy` and the `/faq` answer about ads** before flipping the switch. Both
      currently say there is no advertising cookie, which stops being true the moment the AdSense
      script loads. `privacy/page.tsx` already branches on `adsenseScriptEnabled`, so check what that
      branch says and make sure the FAQ agrees with it.

---

## Do not do these

- **Do not open the feed to signed-out visitors** to bulk up crawlable content. This is the one
  change that would actively hurt. A crawler at `/drift` gets a single random Wikipedia extract in
  an app shell, which is exactly Google's named violation: "copy and republish content from other
  sites without adding any original content". It invites a worse rejection, and on a live account
  scraped content is a suspension risk. Everything that makes Drift worth using (choosing threads,
  the trail) is invisible to a crawler anyway.
- **Do not publish card content as pages.** Same reason. Trail pages, article pages, "explore"
  indexes built from Wikipedia text: all the same category.
- **Do not pad `/notes` with filler.** Thin posts written to hit a count are the thing being
  screened for, and low-effort generated bulk is itself a rejection reason. Four real notes beat
  twenty empty ones. If there is nothing to say, say nothing.
- **Do not remove the robots.txt `Disallow` rules.** The gated routes all render the same sign-in
  screen, so crawling them spends crawl budget on duplicates of one page and risks soft-404 flags
  that make the pages you *want* indexed harder to index.

---

## Honest expectation

This may still not be approved, and it is worth knowing that before you spend more effort on it.
Drift is a login-gated app with a small user base and a public surface that is, legitimately, a
dozen pages about one product. That is a thin case for a publisher network no matter how well
written, and the deciding factor is likely to be domain age and organic traffic rather than
anything in the copy.

The reason to have done it anyway is that the pages are worth having regardless. They are the SEO
surface, they explain the project to someone deciding whether to sign up, and `/principles` is the
clearest statement of what Drift is for that exists anywhere. If AdSense never approves, none of
that was wasted.

If it is refused a second time with the same reason, my read is: stop applying, keep writing when
you feel like it, and revisit in six months or not at all. Ad revenue at this scale is a rounding
error, and the app is better without the pressure.
