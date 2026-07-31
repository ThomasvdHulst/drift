# Prompt for an independent legal and copyright audit of Drift

Copy everything below the line into a fresh conversation with a capable, internet-connected model.
The facts in it were verified against the running code and the live site on 2026-07-31.

---

## Your role

You are acting as an independent compliance auditor. You have web access; use it.

You are auditing a live, small-scale web application called Drift, operated by a single individual
resident in the Netherlands. Your client is that operator. They believe they are compliant. **Treat
that belief as an untested hypothesis, not as a starting position.** Your value here comes entirely
from being willing to reach the opposite conclusion.

Two failure modes to avoid, in order of importance:

1. **Rubber-stamping.** Do not confirm compliance because the description below sounds careful and
   well-intentioned. A description written by the operator will naturally emphasise what they got
   right. Look specifically for what is missing, what is asserted without a mechanism behind it, and
   what is correct for one source but has been generalised to another where it does not hold.
2. **Vague alarmism.** "This may carry risk, consult a lawyer" is not an audit finding. Every
   concern must name the instrument and provision, quote or closely paraphrase the operative
   language, and explain the specific way the described behaviour engages it.

Where the law is genuinely unsettled, or where the answer depends on facts not supplied, say so
explicitly and say what fact would resolve it. Do not manufacture certainty in either direction.

## What to research

Do not rely on memory for anything load-bearing. Retrieve and cite primary sources, and note the
date you retrieved each. In particular you will need:

- The Creative Commons **CC BY-SA 4.0** legal code itself, not the deed summary. The deed and the
  legal code differ in ways that matter here, especially around what counts as Adapted Material and
  what Section 3(b) ShareAlike actually requires.
- **CC0 1.0** legal code.
- The **Wikimedia Foundation Terms of Use**, especially the section on licensing of contributions
  and the attribution methods it accepts for reuse, plus **Wikipedia:Copyrights**, **Wikipedia:Reusing
  Wikipedia content**, and the Wikimedia **User-Agent policy** and API rate-limit guidance.
- The licensing situation for **images on Wikipedia**, which is materially different from the
  situation for article text. Read how the MediaWiki API's `pilicense=free` filter behaves and which
  licences fall inside "free".
- The **Art Institute of Chicago's API terms of use** and its published position on its open-access
  images and on the accompanying catalogue metadata.
- **arXiv's** API Terms of Use and its position on the licensing of abstracts and metadata.
- **GDPR** (Regulation 2016/679), the **ePrivacy Directive** Article 5(3), and the Dutch
  implementations: **Telecommunicatiewet** Article 11.7a and the **UAVG**. Also check the Autoriteit
  Persoonsgegevens' current published guidance on cookie walls and consent.
- **Google's EU User Consent Policy** and the current AdSense requirement regarding certified
  consent management platforms for traffic from the EEA and UK, including when it took effect.
- The **EU Digital Services Act**, specifically whether and how it applies to a very small hosting
  service that lets users send content to each other, and what the micro and small enterprise
  exemptions cover.
- The **EU sui generis database right** (Directive 96/9/EC) as it may apply to extracting and
  re-using structured selections from a third-party database.
- The **European Accessibility Act** and its Dutch implementation, including the microenterprise
  exemption and whether a free service falls within scope.

If your research turns up an obligation not anticipated by this prompt, that is a valuable finding.
Report it.

## The subject of the audit

Everything in this section is a statement of fact about how the software actually behaves, verified
against the source code and the live production site. Where something is uncertain it is marked as
an open question rather than asserted.

### 1. What Drift is

A web application at `https://www.usedrift.org`, installable as a progressive web app. Built with
Next.js and React, hosted on Vercel, with a Postgres database and authentication provided by
Supabase. Currently in a private beta with roughly 20 to 50 users, all personally known to the
operator. It is free, has no paid tier, and is operated by one individual in the Netherlands, not by
a company. The interface is in English and the site is reachable worldwide.

The product is a feed of full-screen "knowledge cards". Each card is one article or artwork. Beneath
each card are "threads", which are links to related articles the reader can follow. A reading
session is recorded as a "trail", which the reader can name, save, export as an image, and send to
another Drift user.

The whole application except a small set of public informational pages is behind a login. The public
pages are: `/`, `/about`, `/how-it-works`, `/principles`, `/sources`, `/faq`, `/notes` and its four
articles, `/colophon`, `/privacy`, `/install`, `/contact`. Everything else requires an account and is
excluded from search engines via robots.txt.

### 2. Content sources and how they are used

**a. English Wikipedia**, via the MediaWiki Action API at `en.wikipedia.org/w/api.php`.

Retrieved per card: the canonical page title, display title, short description, a plain-text extract
of the article's introduction (`prop=extracts&exintro=1&explaintext=1` with `exsentences` set to 2 or
3), a thumbnail image URL (`prop=pageimages&piprop=thumbnail&pithumbsize=800&pilicense=free`), the
canonical article URL, and a disambiguation flag.

Related articles come from `action=query&generator=search&gsrsearch=morelike:{TITLE}`, which returns
a ranked set of textually similar pages together with their descriptions, extracts and thumbnails in
a single request.

When a reader taps "read more", the app calls `action=parse` and receives the **rendered HTML of the
full article** (or of one section). It parses that into paragraphs, tables and the infobox and
displays them inside the card. Images embedded in that HTML are stripped out entirely by the parser.

Requests carry a User-Agent of the form `Drift/1.0 (https://www.usedrift.org; <operator email>)`,
sent as both the `Api-User-Agent` and `User-Agent` headers. All Wikimedia requests are serialised
through a gate that keeps them at least 300 milliseconds apart, with automatic retry on HTTP 429 and
503.

`pilicense=free` is set explicitly to exclude non-free files that Wikipedia hosts under fair use, on
the reasoning that such files are not covered by the article's CC BY-SA licence.

**b. The Art Institute of Chicago**, via `api.artic.edu/api/v1`.

Every query is constrained to works where `is_public_domain` is true. Retrieved: the artwork id,
title, artist name, date, medium, dimensions, an image identifier, alt text, a tiny base64 blur
placeholder, and in some cases the catalogue description and provenance text. Requests carry an
`AIC-User-Agent` header with the same identifying string.

**c. arXiv**, via its public API. This is a third "realm" behind an environment flag
(`NEXT_PUBLIC_REALM_PAPERS`) which is **off in production**, so it is not currently reaching users.
It fetches paper titles, authors and abstracts. The code deliberately makes **no licence claim** for
arXiv content, on the reasoning that abstracts are not uniformly openly licensed; those cards link to
the paper and state nothing about licensing.

**d. Wikipedia's current events portal.** For its "in the news" feature, Drift fetches the daily
pages `Portal:Current events/<Year> <Month> <Day>` for the last 30 days, as raw wikitext via
`prop=revisions&rvprop=content`. From those pages it extracts **only the targets of the wiki links**,
that is, which article titles are being pointed at, how often, and under which section heading. The
surrounding prose written by Wikipedia editors is parsed to locate the links and then discarded; it is
never stored or displayed. No commercial news source is used anywhere in the application.

### 3. How images are delivered

Images are **not copied to, proxied by, or stored on Drift's servers**. The card markup contains
plain `<img>` elements whose `src` points directly at the origin: `upload.wikimedia.org` for
Wikipedia thumbnails, and the Art Institute's IIIF image server for artworks. The reader's browser
fetches them directly from those hosts. Drift stores and transmits only the URL.

### 4. What text is copied, stored and transmitted

This is the part most relevant to a copyright assessment, so it is set out precisely.

- The **short extract** (2 to 3 sentences of Wikipedia article text), along with the title,
  description, image URL and source URL, is held in the reader's browser in IndexedDB, and when the
  reader is signed in it is **synced to Drift's own Postgres database** (Supabase), stored as JSON in
  a `trails.steps` column. So Wikipedia-derived text is reproduced on infrastructure the operator
  controls, not merely passed through.
- The **full article body** obtained from `action=parse` is fetched on demand and held only in
  browser memory for as long as the card is open. It is not written to the card object and not
  persisted anywhere.
- **Sharing**: a reader can send a trail or a single card to another Drift user. The payload,
  containing the same short extracts, is written to a `shares` table in the same database. Sending is
  restricted to mutual friends and that restriction is enforced by a database policy, not only by the
  interface. Nothing is ever published publicly; there is no public feed and no public trail page.
- **Edge caching**: the app's own API routes, which proxy Wikipedia and Art Institute responses,
  return `Cache-Control: public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`. Third
  party derived content is therefore cached at Vercel's shared CDN, publicly, for up to one day fresh
  and one week stale.
- **Image export**: a reader can export their trail map as a PNG, rendered client-side in the
  browser. The exported image contains the card titles and the card images. The reader can then save
  or share that file anywhere.
- **Text export**: a plain-text version of a trail, consisting of the trail name and, per stop, the
  card's display title and its source URL. No extract text.

### 5. Attribution and licence notices as currently implemented

- Every card links to the canonical URL of its source page.
- On the card itself, next to that source link, the licence is **named and hyperlinked to the
  licence text**: "CC BY-SA 4.0" linking to `creativecommons.org/licenses/by-sa/4.0/` for Wikipedia
  cards, "CC0 1.0" linking to `creativecommons.org/publicdomain/zero/1.0/` for Art Institute cards.
  The hyperlink (rather than merely naming the licence) was deliberate.
- The same combined notice appears in the footer of every public page.
- A public `/sources` page describes both sources, both licences, and what the software does and does
  not do to the content.
- Cards from arXiv carry no licence claim at all.
- **No individual author or contributor is named anywhere.** The reasoning applied was that the
  Wikimedia Terms of Use accept a hyperlink or URL to the article as a permitted attribution method,
  because the article's history page lists its authors.
- **The image on a card is attributed only by the link to the article it appeared on.** The image's
  own file description page is not linked, its photographer or creator is not named, and the image's
  own specific licence is not stated. The card's licence notice states CC BY-SA 4.0, which is the
  licence of the article text.

### 6. Use of AI

Optional and currently disabled in production. When enabled it runs locally against a self-hosted
model and is limited to labelling threads and ordering results for variety. It never generates the
text shown on a card. If it is unavailable the application behaves identically.

### 7. Accounts and personal data

- Sign-up is by email address and password, via Supabase Auth. OAuth with Google is available behind
  configuration; Apple is built but not enabled.
- Stored per user: email address, saved trails (including the card content described above),
  thumbs up/down reactions, a derived weighting of broad subject areas ("interests"), small settings
  such as theme, and optionally a handle and display name, friend relationships, and shares.
- Access control is enforced by Postgres row-level security (`user_id = auth.uid()`).
- **Account deletion** is self-service inside the app, behind a type-to-confirm step, and deletes the
  authentication user and associated data.
- There is **no data export or portability feature**.
- **No age verification or age gate of any kind.**
- No analytics product, no tracking pixel, no third-party analytics script.
- The origin sets **no HTTP cookies**. The Supabase session token is kept in `localStorage`.
- One transactional **welcome email** is sent after a user confirms their address, once, via Resend.
- The **contact form** at `/contact` is public. It takes a name, email address and message and sends
  two emails via Resend: a receipt to the sender, and a notification to the operator's inbox with
  `reply_to` set to the sender. Anti-spam consists of a honeypot field, a minimum fill time, a
  per-IP throttle held in server memory, and optionally Cloudflare Turnstile.

### 8. Advertising, as currently deployed

This section is stated plainly because the operator wants it examined rather than assumed.

- Drift intends to run **Google AdSense**. A `public/ads.txt` is published containing the operator's
  publisher id.
- An AdSense application was **refused** with the reason "Low value content". No ad units currently
  render: a kill switch (`NEXT_PUBLIC_ADS_ENABLED`) is off.
- **However**, the AdSense loader script
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…` is injected into
  every page whenever a publisher id is configured, and it is **independent of that kill switch**.
  This was verified on the live production site on 2026-07-31: the script tag and a
  `<meta name="google-adsense-account">` tag are both present in the served HTML of the public home
  page, which any visitor including an unauthenticated EU visitor receives.
- **There is no consent management platform in the application.** No cookie banner gates the script,
  no IAB TCF framework is integrated, and no consent signal is passed to Google.
- There is a component called a "storage notice": a one-time, dismissible informational box with a
  "Got it" button whose dismissal is recorded in `localStorage`. It blocks nothing and collects no
  choice.
- The `/privacy` page, in the branch that is active when a publisher id is configured, tells readers:
  *"With your consent, AdSense may set third-party cookies, and you can change that choice from the
  consent prompt in the app."* **No such consent prompt exists in the application.**

### 9. Legal and policy pages that exist, and that do not

- `/privacy` exists. It is written in deliberately plain, non-legalistic language. It does **not**
  name a legal controller or provide contact details in that capacity, does not state legal bases for
  processing, does not state retention periods, does not enumerate processors or sub-processors, does
  not address international transfers, and does not describe data subject rights beyond mentioning
  that the account can be deleted.
- There is **no Terms of Service or Terms of Use page** of any kind.
- There is **no separate cookie policy**.
- There is **no imprint or operator identification page**. The `/colophon` page names the operator by
  first name and country, with no address or legal entity details.

### 10. Third parties in the processing chain

Vercel (hosting and CDN), Supabase (database and authentication), Resend (transactional email),
Cloudflare (Turnstile, optional), Google (AdSense). **Open question for the auditor to put to the
operator:** the hosting regions for Vercel and Supabase, and whether any data processing agreements
have been executed with any of these providers. Neither could be determined from the source code.

## What to assess

Work through at least the following. For each, reach an actual conclusion.

**Copyright and licensing**

1. Whether the CC BY-SA 4.0 attribution obligations are satisfied in full for **article text**, given
   that no contributor is named and attribution is by hyperlink to the article. Assess this against
   both the licence's own Section 3(a) requirements and the Wikimedia Terms of Use.
2. Whether the ShareAlike condition in Section 3(b) is engaged. Specifically: do any of the following
   constitute Adapted Material, and if so, what must Drift do that it is not currently doing?
   (i) the card format itself, (ii) a saved trail, which is a curated sequence of extracts,
   (iii) the exported PNG trail map, (iv) the plain-text trail export.
3. Whether storing extracts in Drift's own database and caching derived responses publicly at a CDN
   constitutes reproduction and distribution under the licence, and whether the current notice
   placement satisfies the licence at the point of that distribution.
4. **Images specifically, treated separately from text.** The card's licence notice states the
   article's licence. Images returned under `pilicense=free` may be under CC BY-SA, CC BY, CC0, a
   public domain dedication, GFDL or others, with different attribution requirements and a different
   author from the article's authors, and their file description pages are not linked. Determine
   whether the current handling is sufficient for each of the licence families that filter admits,
   and if not, state exactly what a compliant image credit would have to contain.
5. Whether hotlinking images directly from `upload.wikimedia.org` and the Art Institute's image
   server is permitted by those hosts' policies.
6. Whether the Art Institute's terms permit the described use of both its **images** and its
   **catalogue metadata**, including in a commercial context, and what attribution it requires or
   requests.
7. Whether extracting and re-using link targets from `Portal:Current events` raises any issue
   distinct from ordinary article reuse, including under the EU database right.
8. Whether **monetising this content with advertising** is permitted by each licence and by each
   source's terms. Address CC BY-SA's position on commercial use, and separately whether the
   Wikimedia Foundation's terms or trademark policy impose anything additional on a commercial reuser.
9. Whether the arXiv realm, **if it were enabled**, would be compliant as described, and what would
   have to change first.

**Data protection and electronic communications**

10. Whether loading the AdSense script for EEA and UK visitors without a consent mechanism complies
    with ePrivacy Article 5(3) as implemented in Dutch law, and with the GDPR. Address the fact that
    the script currently loads on every page including for logged-out visitors.
11. Whether Google's own EU User Consent Policy and its certified-CMP requirement are currently being
    met, and what the consequences of non-compliance are for a publisher.
12. Whether the application's own use of `localStorage` and IndexedDB requires consent, or falls
    within the strictly-necessary exemption.
13. Whether the `/privacy` page meets the Articles 13 and 14 information requirements, and list
    precisely what is missing.
14. Whether the statement on `/privacy` describing a consent prompt that does not exist creates
    exposure beyond data protection law, for instance under unfair commercial practices rules.
15. Whether the absence of a data export function is compliant with the Article 20 portability right,
    and what would satisfy it at this scale.
16. Whether the absence of any age gate is compliant, given Article 8 and the Dutch digital age of
    consent, and given that the service is not directed at children but does not exclude them.
17. Whether an Article 30 record of processing is required at this scale, and whether processor
    agreements under Article 28 are required with each named provider.
18. Whether transfers to US-based processors are lawfully covered, and what the operator must verify.
19. Whether retaining requester IP addresses in memory for spam throttling, and passing an IP to
    Cloudflare Turnstile, needs to be disclosed.

**Other**

20. Whether the absence of Terms of Service creates practical exposure, given that users can choose
    handles and display names and can transmit content to each other, and what a minimal set of terms
    should cover.
21. Whether the Digital Services Act imposes anything on this service, and whether any exemption
    applies.
22. Whether Dutch or EU law requires operator identification (an imprint) on a website of this kind,
    and whether the current `/colophon` suffices.
23. Whether the European Accessibility Act applies, and if so from when and to what extent.
24. Any trademark exposure in the name "Drift" for this class of service. State the limits of what
    you can determine without a formal search.

## How to report

Produce a report in this shape.

**1. Verdict.** One paragraph. Can this service lawfully operate as described, and can it lawfully
carry advertising as described? If there are conditions, state them.

**2. Findings**, ordered by severity, using these labels:

- **Blocking** — reasonably likely to be unlawful, or in breach of a source's terms, as currently
  deployed. Should be fixed before continuing to operate in that respect.
- **Material** — a real gap that a regulator, rightsholder or platform could act on, but not
  immediately hazardous.
- **Minor** — technically required or clearly advisable, low practical risk.
- **Best practice** — not required, worth doing.

For each finding give: what the issue is; the instrument and provision it engages, with a citation
and a link; the specific facts above that trigger it; a realistic assessment of the actual risk at
this scale, including who could enforce it and what would typically happen first; and **a concrete
remedy**. A remedy should be specific enough to act on: the actual text a notice needs to contain,
the actual field that needs to be added, the actual mechanism that needs to gate the script. Not
"obtain consent" but what a compliant consent flow must do here.

Separately mark each finding as a **legal requirement**, a **licence or contract term**, or a
**platform policy** such as Google's own rules. These carry different consequences and conflating
them is unhelpful.

**3. What is already correct.** Explicitly confirm the practices that hold up, with the reasoning.
The operator needs to know what not to change. Be as rigorous here as in the findings: if something
is correct only under a particular reading, say which reading.

**4. Open questions.** Facts you would need from the operator to complete the assessment, and what
each would change.

**5. Prioritised action list.** A short ordered list of what to do first, with a rough sense of
effort. Distinguish what must happen before advertising is enabled from what must happen regardless.

Where a question genuinely requires a qualified Dutch lawyer, say so, but only after you have taken
the analysis as far as public sources allow, and say specifically what you would ask them.
