# Independent compliance audit — Drift (`usedrift.org`)

> ### ⚠️ Later development: one conclusion in this report no longer holds (1 August 2026)
>
> This document is a **historical record** and is not edited in place. But a reader arriving at M-5
> or C-10 needs to know that the product changed underneath one of its findings.
>
> **The DSA classification has changed.** M-5 and C-10 conclude that Drift is *not* an online
> platform, because sharing reached only mutual friends and `are_friends()` enforced that in the
> database. That reasoning was correct and is now spent: **Phase 27 added public share links**
> (`/s/<token>`), and a link anyone can open and forward is not the "closed group consisting of a
> finite number of pre-determined persons" that Recital 14 carves out. Recital 14 also says
> requiring registration does not save it where admission is automatic, which Drift's is. **Drift is
> an online platform.**
>
> The practical effect is small, which is why the feature was allowed to ship: **Article 19 excludes
> micro and small enterprises from Articles 20 to 28**, bar Article 24(3). C-10's observation that
> the database-enforced restriction "removes Articles 20 to 28 from your obligations entirely" is
> now achieved by Article 19 instead, i.e. by the operator remaining one person rather than by the
> architecture. That is a weaker guarantee and it is worth knowing which one is load-bearing.
>
> Current position: `docs/processing-record.md` §3, and `src/lib/terms.ts`.

**Prepared for:** the operator
**Date of report:** 31 July 2026
**Basis:** the operator's written description of the system, plus independent verification against the live production site and primary legal, licence and platform-policy sources. Every external source cited was retrieved on **31 July 2026** unless stated otherwise.

**Independent verification performed.** I fetched `https://www.usedrift.org/` and `https://www.usedrift.org/sources` directly. Two things in the operator's description were confirmed and one was contradicted:

- Confirmed: `<meta name="google-adsense-account" content="ca-pub-3106905427372661">` is present in the HTML served to an unauthenticated, non-logged-in visitor of the public home page, and on `/sources`. The AdSense integration is live on public pages.
- Confirmed: the footer carries the combined "CC BY-SA 4.0 / CC0 1.0" notice with both licences hyperlinked.
- **Contradicted:** §3 of the description states that images "are **not** copied to, proxied by, or stored on Drift's servers." The public landing page serves at least seven raster images from Drift's own origin at `https://www.usedrift.org/landing/*.jpg` — `impressionism.jpg`, `great-wave.jpg`, `monet.jpg`, `ukiyo-e.jpg`, `rainy-day.jpg`, `realm-encyclopedia.jpg`, `realm-gallery.jpg`. These are hosted copies. See Finding M-1.

This is the pattern the engagement asked me to look for: a statement that is true of the mechanism the operator was thinking about (the card renderer) and untrue of the artefact a regulator or rightsholder would actually look at first (the public marketing page).

---

## 1. Verdict

**Drift cannot lawfully operate in its current configuration, and cannot lawfully carry advertising in the configuration currently deployed.** The decisive problem is not the plan to run ads — that is permitted by every licence and every source term involved — but the fact that the AdSense loader script is already being injected into every public page for every visitor, including unauthenticated EEA visitors, with no consent mechanism of any kind and with a privacy page that describes a consent prompt which does not exist. That is a live breach of Article 11.7a Telecommunicatiewet and Article 5(3) ePrivacy, an Article 6 GDPR lawful-basis failure independent of any cookie question, and an Article 5(1)(a)/13 transparency failure aggravated by an affirmatively false statement. It is also, separately, a breach of Google's own EU User Consent Policy. The perverse result is that Drift is currently carrying the entire legal exposure of an ad-funded site while earning nothing, because the AdSense application was refused. On the copyright side the position is better but not clean: the treatment of **article text** is defensible and in one respect (naming *and* hyperlinking the licence) better than most reusers manage, but the treatment of **images** is not — the card asserts CC BY-SA 4.0 over files that may be CC BY, CC0, GFDL or public domain, with different authors and different conditions, and links to none of their file description pages. The exported PNG trail map is the single strongest ShareAlike trigger in the product and has not been noticed. Drift can operate lawfully, and can carry advertising lawfully, on these conditions: (a) the AdSense script is gated behind a Google-certified TCF v2.2 CMP and nothing loads before a choice; (b) the false statement on `/privacy` is removed today; (c) per-image credit is derived from each file's own metadata; (d) a Terms of Service meeting DSA Article 14 and an imprint meeting Article 3:15d BW are published; and (e) Article 28 processor agreements are in place. None of these is expensive. Most are a day's work.

---

## 2. Findings

Ordered by severity. Each is tagged **[Legal requirement]**, **[Licence / contract term]**, or **[Platform policy]**, because these carry different consequences: a legal requirement is enforced by a regulator with fining powers; a licence term is enforced by a rightsholder and, in the case of CC BY-SA, terminates your rights automatically on breach; a platform policy is enforced by the platform switching you off.

---

### BLOCKING

---

#### B-1. The AdSense loader script is served to EEA and UK visitors with no consent mechanism
**[Legal requirement]**

**The issue.** `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…` is injected into every page whenever a publisher id is configured, independently of the `NEXT_PUBLIC_ADS_ENABLED` kill switch. There is no cookie banner, no CMP, no consent signal. The script executes for logged-out visitors on public pages.

**Instruments engaged.**

- **ePrivacy Directive 2002/58/EC, Article 5(3)**, which requires that storing information, or gaining access to information already stored, in a user's terminal equipment is permitted only where the user "has given his or her consent, having been provided with clear and comprehensive information," subject to a narrow exemption for storage that is strictly necessary to provide a service explicitly requested by the subscriber.
- **Implemented in the Netherlands as Article 11.7a Telecommunicatiewet.** The Dutch provision requires prior consent, obtained after the user has been clearly and completely informed about the purposes, before data are stored in or read from terminal equipment. See the explanatory memorandum at [kst-33902-3](https://zoek.officielebekendmakingen.nl/kst-33902-3.html), which states plainly that cookies may only be placed on a user's computer or smartphone once the user has been informed and has given consent. The 2015 amendment created a narrow third exception for analytics with no or negligible privacy impact; advertising cookies were expressly excluded from it.
- **GDPR Article 6(1)** — and this limb is independent of the cookie analysis. Even if you argued that the loader script sets nothing before an ad unit renders, the mere loading of the script transmits the visitor's **IP address**, user-agent and referring URL to Google. IP addresses are personal data (CJEU C-582/14 *Breyer*). There is no Article 6 basis for that disclosure: it is not necessary for a contract (the visitor is logged out and has no contract), and legitimate interest is not available because the AP's and EDPB's settled position is that ad-tech disclosures of this kind require consent under Article 5(3) ePrivacy, and where consent is the ePrivacy gateway you cannot fall back on legitimate interest under GDPR for the same operation.
- **GDPR Articles 13 and 44** — no information is given about the disclosure, and no transfer mechanism is identified.

**Triggering facts.** §8 of the description, independently verified on 31 July 2026: the `google-adsense-account` meta tag is present in the served HTML of `/` and `/sources` for an unauthenticated request. The description states the loader script is present on the same basis and is independent of the kill switch.

**Realistic risk at this scale.** The AP (Autoriteit Persoonsgegevens) and the ACM share supervision here — the AP under the GDPR, the ACM under the Telecommunicatiewet. The AP has run a semi-automated crawl-based cookie enforcement programme since April 2025 with dedicated annual budget, sending warning letters to over 200 Dutch sites, and has stated that **pre-consent script loading** is one of the specific things it checks. The AP's published enforcement path is: warning letter → roughly three months to remediate → formal investigation → fine or `last onder dwangsom`. Its first cookie fine was €600,000 against AS Watson for tracking cookies on Kruidvat.nl ([AP, July 2024](https://www.autoriteitpersoonsgegevens.nl/actueel/boete-van-600000-euro-voor-tracking-cookies-op-kruidvatnl); under appeal). A 20–50 user private beta on a `.org` domain is not going to be at the top of a crawl-based priority list. But the AP's crawler does not know Drift is a private beta — it sees a public, indexable home page loading a third-party ad script with no banner, which is exactly the fingerprint the programme is looking for. And a single complaint from any of the 20–50 users, all of whom are personally known to you and technically literate enough to open dev tools, changes the picture instantly. The realistic first event is a warning letter, not a fine. But the exposure is entirely gratuitous: you are running the script that creates the exposure and getting nothing back from it.

**Remedy.** Two parts, and do the first one today.

*Immediate (minutes):* make the script injection conditional on the same kill switch as the ad units, or simply remove the publisher id from the environment until a CMP is live. This alone removes the breach. There is no reason for the loader to be present while no ads render and the AdSense application stands refused.

*Before advertising (see B-2 for the CMP requirement):* a compliant flow here must do all of the following, and "obtain consent" is not a specification.

1. **Nothing third-party loads before a choice.** No `adsbygoogle.js`, no Google Fonts from Google's origin, no Turnstile, no OAuth SDK, until the visitor has acted. Strictly-necessary first-party storage (the Supabase session token, the offline card cache) may load.
2. **First layer presents "Accept all" and "Reject all" side by side, on the first screen**, at equal visual weight — same size, same font weight, comparable contrast. Refusing must take exactly one click, the same as accepting. This is the AP's published `vuistregels` standard ([AP, *Ga slim om met cookies*](https://www.autoriteitpersoonsgegevens.nl/ga-slim-om-met-cookies)), and it is the single most common failure the AP writes letters about.
3. **No pre-ticked boxes.** All non-essential purposes default to off.
4. **No cookie wall.** Access to Drift must not be conditioned on accepting. The AP's December 2019 position, restated since, is that denying access to a site when cookies are refused makes consent not freely given and therefore invalid under Article 7 GDPR.
5. **Withdrawal as easy as giving.** A persistent "Cookie settings" link in the footer of every page that reopens the CMP. Withdrawal must actually delete the cookies and stop the processing.
6. **Evidence.** Log per visitor: timestamp, the TCF consent string, the CMP/banner version, and the choices made. Article 7(1) GDPR puts the burden of demonstrating consent on you.
7. **The signal must reach Google.** Implement Google consent mode v2 with `ad_storage`, `ad_user_data`, `ad_personalization` and `analytics_storage` all defaulting to `denied`, updated from the CMP.
8. **On refusal, serve nothing.** Google's "limited ads" mode is available but still involves some terminal-equipment access in certain configurations; at your scale the revenue difference is nil and the simplest defensible position is that a refusing visitor gets no ad script at all.

---

#### B-2. Google's certified-CMP requirement is not met
**[Platform policy]**

**The issue.** Drift has an AdSense publisher id configured, publishes `ads.txt` with it, and serves the AdSense loader — but has no consent management platform at all, let alone a Google-certified one integrated with IAB TCF.

**Instrument engaged.** Google's **EU User Consent Policy** and the certified-CMP requirement. Per [Google AdSense Help](https://support.google.com/adsense/answer/13554116?hl=en): to comply with the EU User Consent Policy, partners using Google AdSense, Ad Manager or AdMob are required to use a consent management platform certified by Google and integrated with the IAB Transparency and Consent Framework when serving personalised ads to users in the EEA and UK **as of 16 January 2024** (Switzerland from 31 July 2024). Google states that where these requirements are not met, the publisher is not eligible to serve personalised ads. The underlying policy requires publishers to make specified disclosures to EEA, UK and Swiss users and obtain consent for the use of cookies or other local storage where legally required, and for the collection, sharing and use of personal data for ads personalisation. Google's announcement of the requirement is at [blog.google](https://blog.google/products/adsense/new-consent-management-platform-requirements-for-serving-ads-in-the-eea-and-uk/).

**Realistic risk.** The consequence is contractual and operational, not regulatory: ineligibility to serve personalised ads to EEA/UK traffic, degradation to limited ads, and — under the AdSense Program Policies and the online terms — Google's discretion to disable ad serving or terminate the account. Note that a policy strike is more damaging to a solo operator than a fine at this scale, because AdSense account terminations are hard to reverse and are tied to the individual, not the site.

**A separate practical observation.** The application was refused for "Low value content." A site consisting almost entirely of third-party CC-licensed encyclopedia text and museum catalogue metadata, with the app itself behind a login and excluded from search engines, is close to the paradigm case for that refusal. Re-applying without changing the public surface is likely to fail again. Adding substantial original writing — the `/notes` articles are the right instinct — is the route, but note the tension: original commentary is what AdSense wants and is also what moves Drift further from "pure reproduction," which is where its copyright position is currently safest. That is a product decision, not a legal one, but it should be made consciously.

**Remedy.** Select a CMP from [Google's certified list](https://support.google.com/adsense/answer/13554116?hl=en) that supports TCF v2.2 — Cookiebot, CookieYes, consentmanager, Usercentrics, OneTrust and Complianz all appear on it at various tiers, several with free plans at Drift's traffic volume. Implement per B-1. Do not rely on a CMP's default configuration: the AP explicitly warns that CMP defaults frequently do not meet the GDPR, and that responsibility for the banner remains with you even when a CMP supplies it. Until then, remove the publisher id and consider removing `public/ads.txt`, which currently advertises an intention to monetise that is relevant to the imprint analysis at M-6 while producing no revenue.

---

#### B-3. `/privacy` describes a consent prompt that does not exist
**[Legal requirement]**

**The issue.** The `/privacy` branch that is active when a publisher id is configured tells readers: *"With your consent, AdSense may set third-party cookies, and you can change that choice from the consent prompt in the app."* There is no consent prompt in the app. The "storage notice" is a dismissible informational box with a "Got it" button; it blocks nothing and records no choice.

**Instruments engaged.**

- **GDPR Article 5(1)(a)** — personal data must be processed "lawfully, fairly and in a **transparent** manner in relation to the data subject." A privacy notice that describes a control the data subject does not have is the opposite of transparent.
- **GDPR Article 12(1)** — information must be provided in a "concise, transparent, intelligible and easily accessible form." Accuracy is implicit; a notice cannot be intelligible if it is false.
- **GDPR Article 13(1)(c) and (2)(c)** — where consent is the basis, the notice must state the basis and the right to withdraw. Drift's notice asserts a consent mechanism that does not exist and therefore misstates both.
- **Article 6:193c(1)(g) Burgerlijk Wetboek**, implementing Article 6(1)(g) of the Unfair Commercial Practices Directive 2005/29/EC. A commercial practice is misleading where factually incorrect information is given, including about "de rechten van de consument" — the consumer's rights — such that the average consumer takes, or may take, a transactional decision they would not otherwise have taken ([text](https://maxius.nl/burgerlijk-wetboek-boek-6/artikel193c)). The Dutch enforcement precedent for sub (g) is real: the Consumentenautoriteit fined Goltex €100,000 for misleading consumers about their repair-and-replacement rights.

**Honest assessment of the UCPD limb.** This is the weaker of the two. Article 6:193a BW requires a "handelspraktijk" directly connected with the promotion, sale or supply of a product to consumers, and Article 6:193c requires effect on a "besluit over een overeenkomst." Drift is currently free and serves no ads, so there is an argument that no commercial practice is in play and no transactional decision is affected. Against that: the decision to create an account and hand over personal data is capable of being a transactional decision, the Modernisation Directive extended consumer protection to free digital services where the consumer supplies personal data, and the site is manifestly being prepared for monetisation. My conclusion: the UCPD limb is **arguable but not strong today, and becomes strong the moment ads run**. The GDPR transparency limb, by contrast, is not arguable — it is simply a false statement in a privacy notice.

**Realistic risk.** Low probability of standalone enforcement; high aggravating value if anything else goes wrong. The AP has stated that transparency under Articles 12–14 is one of its three 2026 priorities, alongside pre-consent tracking and cookie compliance. A regulator who arrives because of B-1 and then finds a privacy notice promising a control that was never built will treat that as bad faith rather than oversight, and it will move the case from "warning letter" toward "formal investigation." Correcting it is the cheapest risk reduction available anywhere in this report.

**Remedy.** Change the sentence today. While no consent mechanism exists and no ads render, the accurate text is:

> **Advertising.** Drift does not currently show advertising and sets no advertising cookies. If advertising is introduced, this page will be updated first and you will be asked for consent before any advertising script loads. You will be able to change or withdraw that choice at any time from a "Cookie settings" link in the footer.

Once a CMP is live, replace it with a description of what the CMP actually does, naming Google as the recipient and linking to Google's privacy policy and to how Google uses data from sites that use its services.

---

#### B-4. Images carry the article's licence, which is not their licence
**[Licence / contract term]**

**The issue.** Every card's licence notice states "CC BY-SA 4.0". For a Wikipedia card, that is the licence of the **article text**. The thumbnail retrieved via `prop=pageimages&pilicense=free` is a **separate work**, with a **different author**, under **whatever licence its uploader chose**. Its file description page is not linked, its creator is not named, and its own licence is not stated. `/sources` compounds this by describing the Encyclopedia realm as comprising "card titles, descriptions, extracts, the full article body behind 'read more', and **the freely licensed images on those pages**," and then saying "The text is used under CC BY-SA 4.0" — presenting the images as covered by the article's licence.

**What `pilicense=free` actually does.** It is worth being precise, because the operator's reasoning is half right and half wrong. The parameter is documented as "Limit page images to a certain license type," with values `any` and `free`, and `free` as the default. Its purpose, per [Phabricator T320661](https://phabricator.wikimedia.org/T320661) and [T131105](https://phabricator.wikimedia.org/T131105), is to exclude files that a local wiki hosts under a non-free Exemption Doctrine Policy — i.e. fair-use files. The WMF Board's Licensing Policy is explicitly more restrictive than fair use, and PageImages stores both a free and a non-free candidate per article so callers can choose.

So the operator is **correct** that `pilicense=free` excludes fair-use files, and correct that fair-use files are not covered by CC BY-SA. Setting it deliberately was the right call. But "free" in this API means *not tagged non-free on the local wiki*. It does **not** mean "no attribution required," and it does not mean "same licence as the article." The set of licences the filter admits includes at least:

| Licence family admitted | What a compliant credit must contain |
|---|---|
| CC BY-SA 2.0 / 3.0 / 4.0 | Creator name as designated, title if supplied, link to the file page, licence name **and** link, indication of modification |
| CC BY 2.0 / 3.0 / 4.0 | Same as above, minus any ShareAlike consequence |
| CC0 1.0 / PD dedication | Nothing required; crediting is courteous only |
| Public domain (age, US federal work, PD-Art) | Nothing required |
| GFDL (often dual-licensed with CC BY-SA) | Author list plus the GFDL notice, or rely on the CC BY-SA arm of the dual licence — in practice, use the CC arm |
| Free-software licences on diagrams/logos (rare) | Per that licence |

**Instrument engaged.** **CC BY-SA 4.0, Section 3(a)(1)** ([legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)) requires that if you Share the Licensed Material you must retain, if supplied by the Licensor: identification of the creator(s) and any others designated to receive attribution; a copyright notice; a notice referring to the licence; a notice referring to the disclaimer of warranties; and a URI or hyperlink to the Licensed Material to the extent reasonably practicable — and separately must indicate the Licensed Material is licensed under **this** Public License, including the text of or a link to it. Section 3(a)(2) allows all of this to be satisfied "by providing a URI or hyperlink to a resource that includes the required information." For images, that resource is the **file description page**, not the article page.

Wikipedia's own guidance says exactly this. [Wikipedia:Copyrights](https://en.wikipedia.org/wiki/Wikipedia:Copyrights): "Every image has a description page that indicates the license under which it is released." [Wikipedia:FAQ/Copyright](https://en.wikipedia.org/wiki/Wikipedia:FAQ/Copyright): for CC BY-SA or similarly free images you must "include a link back to the wikipage for that picture or to the creator's website and license any modified version you create under the same license as the original." [Commons:Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) is explicit that the person who *uploaded* a file may not be its creator, that it is the creator who must be credited, and that each file's licensing is specified on its own file description page.

**The Wikimedia Terms of Use do not fix this.** The operator's reasoning — that a hyperlink to the article suffices because the history page lists authors — is correct **for text** and only for text. The relevant clause reads: "When you **reuse or redistribute a text page** developed by the Wikimedia community, you agree to attribute the authors in any of the following fashions: Through hyperlink (where possible) or URL to the page or pages that you are reusing (since each page has a history page that lists all contributors, authors and editors)…" ([Policy:Terms of Use §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)). The parenthetical is the whole justification, and it is about *text page* histories. An article's history page does not list the author of a photograph transcluded into it. The permission does not extend to media, and Wikimedia's own guidance routes media attribution to the file description page.

**Hotlinking makes it worse, not better.** MediaWiki's own [InstantCommons documentation](https://www.mediawiki.org/wiki/InstantCommons/en) identifies precisely this defect in hotlinking: it "does not respect the license terms of the image, and does not allow for other metadata to be reliably transported. Besides failing to properly credit the author of the media file, it also does not give credit to Wikimedia." Hotlinking reduces your *reproduction* exposure; it does nothing for your *attribution* exposure, and by design it strips the metadata that would have carried the credit.

**Realistic risk.** This is the finding most likely to produce an actual complaint. Wikimedia Commons photographers are a well-organised constituency who monitor reuse and who routinely send demand letters; German photographers in particular have built a small industry around CC BY-SA attribution failures, and Dutch and German courts have awarded damages for exactly this. The mechanism is a takedown demand or a licence-fee invoice, not a regulator. Note also **CC BY-SA 4.0 Section 6(a)**: if you fail to comply, your rights under the licence **terminate automatically**. Section 6(b)(1) reinstates them automatically if the violation is cured within 30 days of your discovery of it — which means that fixing this within 30 days of reading this report reinstates you by operation of the licence.

**Remedy — exactly what a compliant image credit must contain, and how to get it.**

Add one API call per card (batchable via a generator). `pageimages` with `piprop=name` returns the file title; then:

```
action=query&format=json&formatversion=2
&titles=File:Example.jpg
&prop=imageinfo
&iiprop=extmetadata|url
&iiextmetadatafilter=Artist|Credit|LicenseShortName|LicenseUrl|License|AttributionRequired|Attribution|ObjectName|Restrictions
&iiurlwidth=800
```

`extmetadata` gives you `Artist` (HTML, sanitise it), `LicenseShortName` (e.g. "CC BY-SA 4.0"), `LicenseUrl`, `AttributionRequired` (`true`/`false`), `Attribution` (a licensor-specified credit string, which under §3(a)(1)(A)(i) you must follow "in any reasonable manner requested by the Licensor" where present), `ObjectName` (title) and `Restrictions` (flags trademark or personality-rights constraints). `imageinfo.descriptionurl` gives the file description page.

Render, beneath or adjacent to the image on the card:

> Image: **{Artist}** — *{ObjectName}* · **{LicenseShortName}** *(hyperlinked to {LicenseUrl})* · [file page]({descriptionurl})

Concrete worked examples:

- CC BY-SA: `Image: Diego Delso — "Catedral de Sevilla" · CC BY-SA 4.0 · file page`
- CC0 / PD: `Image: public domain · file page` (nothing else required, but the file page link is cheap and good practice)
- Licensor-specified string present: use the `Attribution` string verbatim in place of `{Artist}`.

Then add these rules:

1. If `AttributionRequired` is `true` and `Artist` is empty or unparseable, **do not display the image**. Fail closed.
2. If `Restrictions` is non-empty, do not display the image — that field flags trademarked or personality-rights-encumbered files that are copyright-free but not use-free.
3. Change the card's combined notice so the text licence and the image licence are visibly separate. Right now one notice covers both and is wrong about one of them.
4. Amend `/sources` to stop describing images as covered by the article's licence. Replacement text: *"Images on Wikipedia articles are separate works with their own authors and their own licences, which are not the article's licence. Drift reads each file's own licence and author from Wikipedia and shows them on the card, with a link to the file's description page."*
5. Note that resizing to a thumbnail is **not** a modification requiring disclosure: CC BY-SA 4.0 §2(a)(4) provides that technical modifications necessary to exercise the licensed rights "never produce Adapted Material."

Also note the reliability caveat: T320661 records that non-free images were in fact surfacing as thumbnails on Wikimedia's own search interfaces until the flag was requested explicitly. `pilicense=free` depends on correct tagging on the local wiki. It is a good filter, not a guarantee. The `AttributionRequired`/`Restrictions` fail-closed rules above give you a second line of defence.

#### B-5. The exported PNG trail map is Adapted Material and is shared with no attribution and no licence
**[Licence / contract term]**

**The issue.** A reader can export a trail map as a PNG containing card titles **and card images**, rendered client-side, and then save or share that file anywhere. The exported file carries no attribution, no licence notice and no link.

**Why this is the strongest ShareAlike trigger in the product.** Take the four candidate artefacts in turn against the CC BY-SA 4.0 definition of Adapted Material — material "derived from or based upon the Licensed Material and in which the Licensed Material is translated, altered, arranged, **transformed**, or otherwise modified in a manner requiring permission."

| Artefact | Adapted Material? | Reasoning |
|---|---|---|
| **(i) The card format** | **No** | Taking 2–3 sentences via `exsentences` and stripping wiki markup is *excerpting and format-shifting*. §2(a)(1)(A) grants the right to "reproduce and Share the Licensed Material, **in whole or in part**." Truncation reproduces part; it does not alter the retained expression. §3(b) is not engaged. §3(a)(1)(B) is — see M-2. |
| **(ii) A saved trail** | **No** | A curated sequence of unmodified extracts is a *collection*, not an adaptation. CC 4.0 deleted the 3.0 "Collection" definition, but the operative test is unchanged: assembling separate works requires permission to *reproduce* each, not to *adapt* any. §4(b) does create a ShareAlike hook where a reuser puts "all or a substantial portion of the database contents" into their own database — a 5–15 step trail is not a substantial portion of English Wikipedia. §3(b) not engaged. **But** §3(a) travels with the trail: a trail shared to another user, and the received view of it, must carry the attribution and licence notice. Verify that the recipient's view does. |
| **(iii) The exported PNG** | **Yes, on the better reading** | The PNG takes multiple third-party images and **arranges** them into a new composite graphic — a map with a layout, a path and typography. That is arrangement and transformation of the images, not mere reproduction of each. Titles alone would be *de minimis*; the images are what make this Adapted Material. |
| **(iv) The plain-text export** | **No** | Trail name, display titles and source URLs. Titles are too short to carry protected expression and URLs are facts. §8(a) is directly on point: the licence "does not, and shall not be interpreted to, reduce, limit, restrict, or impose conditions on any use of the Licensed Material that could lawfully be made without permission." Correct as designed. |

**Consequence of (iii).** If the PNG is Adapted Material, **§3(b)** applies on top of §3(a): the Adapter's Licence you apply "must be a Creative Commons license with the same License Elements, this version or later, or a BY-SA Compatible License," and you must include the text of, or a URI or hyperlink to, that Adapter's Licence. Right now the PNG is exported bare and the reader may post it anywhere. Neither §3(a) nor §3(b) is satisfied at the moment of that Share.

**Realistic risk.** Low in absolute terms — 20–50 users, exports that mostly go into private chats. But this is the artefact designed to leave Drift and travel, and it is the one carrying images with no credit attached. If any exported map ends up on social media, it is a freestanding CC BY-SA breach with your product's branding on it.

**Remedy — pick one.**

*Option A (cheapest, and my recommendation for now):* **omit images from the export.** Render the map with titles, thread labels and the trail shape only. This removes the arrangement-of-images that makes it Adapted Material, removes the image-attribution problem entirely, and produces a cleaner graphic anyway. Add a single footer line burned into the PNG:

> Titles from Wikipedia · CC BY-SA 4.0 · creativecommons.org/licenses/by-sa/4.0 · Made with Drift

*Option B (if images must stay):* burn a credit block into the PNG footer, one line per stop, plus a licence statement for the composite:

> 1. *Ukiyo-e* — image: {Artist}, {LicenseShortName}
> 2. *Impressionism* — image: {Artist}, {LicenseShortName}
> Text and images from Wikipedia, modified. This map is licensed CC BY-SA 4.0 — creativecommons.org/licenses/by-sa/4.0

To do this you must persist the per-image credit fields in `trails.steps` at capture time. That is the same data B-4 requires you to fetch, so the two fixes share the work.

Either way, extend the plain-text export with one line: `Text from Wikipedia, CC BY-SA 4.0 (modified). Images not included.` Not strictly required, but free.

---

### MATERIAL

---

#### M-1. Images *are* hosted on Drift's servers, on the public landing page, with no per-image credit
**[Licence / contract term]** — **could be Blocking; I cannot determine which without one fact from you**

**The issue.** §3 of the description asserts that images are never copied to or stored on Drift's servers, and that Drift stores and transmits only URLs. That is true of the card renderer. It is not true of the public landing page, which serves at least seven images from Drift's own origin: `/landing/impressionism.jpg`, `/landing/great-wave.jpg`, `/landing/monet.jpg`, `/landing/ukiyo-e.jpg`, `/landing/rainy-day.jpg`, `/landing/realm-encyclopedia.jpg`, `/landing/realm-gallery.jpg`.

Several of these are self-evidently derived from the two sources. *Paris Street; Rainy Day* is a Caillebotte in the Art Institute's collection — if sourced from AIC's open-access set that is CC0 and there is no issue. *The Great Wave off Kanagawa*, *Ukiyo-e*, *Impressionism* and *Claude Monet* are the subjects of Wikipedia articles and are most plausibly Wikipedia or Commons files.

**Why the distinction matters.** Hotlinking is a *display* of a file the reader's browser fetches from the rightsholder's chosen host. Copying the file to your own origin and serving it is **reproduction and distribution** by you — the core act CC BY-SA §2(a)(1) licenses subject to §3(a). The attribution obligation is identical in content but far harder to argue away, and the footer's blanket "Content from Wikipedia, under CC BY-SA 4.0" does not name any creator, does not link any file page, and asserts a single licence over files that may be under several.

**Realistic risk.** The landing page is the one page that is public, indexed and designed to be seen. If a Commons photographer's reverse-image search ever surfaces Drift, this is the page it surfaces. Higher discovery probability than anything behind the login.

**Remedy.** For each of the seven files, determine the source and licence, then:

- **CC0 / public domain / AIC open access:** no action required. Add the AIC caption anyway (see M-4).
- **CC BY or CC BY-SA:** add a visible credit adjacent to or beneath the image — `{Artist}, {LicenseShortName}` with the licence hyperlinked and the file description page linked — or replace the file with a CC0/PD alternative. On a marketing page, replacing is usually easier than crediting.
- **Unknown provenance:** replace it. Do not keep an image you cannot licence-trace on your only public page.

Then amend §3 of your internal description, and any equivalent public claim, so it says what is true: *card images are hotlinked; a small number of static illustrations on the landing page are hosted copies and are credited individually.*

---

#### M-2. No indication that the Licensed Material has been modified
**[Licence / contract term]**

**The issue.** Drift truncates each article to 2–3 sentences, strips wiki markup, discards embedded images from the `action=parse` HTML, and re-lays out the remainder into paragraphs, tables and an infobox. Nothing anywhere states that the material has been modified.

**Instrument engaged.** **CC BY-SA 4.0 §3(a)(1)(B)**: if you Share the Licensed Material you must "indicate if You modified the Licensed Material and retain an indication of any previous modifications." This is a separate and mandatory limb of §3(a), distinct from creator identification and from the licence notice — it is not satisfied by either. [Wikipedia:Copyrights](https://en.wikipedia.org/wiki/Wikipedia:Copyrights) restates it: "If you make modifications or additions, you must indicate in a reasonable fashion that the original work has been modified."

**Why I rate this Material and not Blocking.** By the letter of the rubric this is a breach of an express licence condition as currently deployed, with automatic termination under §6(a) — which is the Blocking test. I rate it Material because the remedy is one line of markup, the reader is in no way misled, no rightsholder has ever litigated a truncation-disclosure failure that I am aware of, and the cure-within-30-days reinstatement in §6(b)(1) makes the exposure self-healing the moment you act. Do not read that as "compliant." It is a breach with a trivial fix.

**Remedy.** Change the card's licence notice from a bare licence name to:

> Wikipedia · CC BY-SA 4.0 · **excerpted and reformatted by Drift**

and on the "read more" full-article view:

> Wikipedia · CC BY-SA 4.0 · **reformatted by Drift; images removed**

`/sources` already says "Drift cuts an article into a card," which is the right admission in the wrong place — §3(a)(2) allows you to satisfy §3(a)(1) via a link to a resource containing the required information, so linking the card's notice to `/sources` would also work. Putting it on the card is better and costs nothing.

---

#### M-3. The full-article view can reproduce text whose additional attribution requirements are silently discarded
**[Licence / contract term]**

**The issue.** When a reader taps "read more," Drift calls `action=parse` and displays the **rendered HTML of the entire article**. Wikipedia articles are not uniformly CC BY-SA 4.0 with attribution satisfied by the history page. [Wikipedia:Copyrights](https://en.wikipedia.org/wiki/Wikipedia:Copyrights) states: "Some text has been imported only under CC BY-SA and CC BY-SA-compatible license and cannot be reused under GFDL; such text will be identified **on the page footer, in the page history, or on the discussion page** of the article that utilizes the text." The Wikimedia Terms of Use add that where imported text is under a CC licence requiring attribution, "you must credit the author(s) in a reasonable fashion," and that "text from external sources may attach additional attribution requirements to the work."

Drift's parser extracts paragraphs, tables and the infobox. It does not extract the page footer, and there is no mechanism for surfacing a discussion-page attribution template. So for exactly the subset of articles that carry extra attribution obligations, Drift reproduces the whole article and drops the notice that says who else must be credited.

**Realistic risk.** Low frequency — the affected article population is small — but the exposure per instance is higher than for ordinary Wikipedia text, because the rightsholder is an identifiable external party rather than a diffuse pool of volunteer editors. This is the kind of thing nobody notices until someone does.

**Remedy — cheapest first.**

1. **Minimum:** on the full-article view, add: *"This article may incorporate text from other sources with their own attribution requirements. See the article's page on Wikipedia for the full licensing footer."* — with the existing canonical link right there. This is a §3(a)(2) "link to a resource that includes the required information" argument, and it is defensible.
2. **Better:** parse the `action=parse` output for the `printfooter` / licence-footer div and for `Category:Articles containing ...` style attribution categories, and if present, render the footer text verbatim beneath the article body.
3. **Also worth doing:** the same parser should be checked for `<math>` rendering and for any remaining `<img>` after stripping — SVGs and formula images can survive naive image stripping.

---

#### M-4. Art Institute of Chicago: `is_public_domain` is a **US** determination, and Drift operates in the Netherlands
**[Legal requirement]** — this is the finding the description did not anticipate

**The issue.** Every AIC query is constrained to `is_public_domain = true`, which is treated as dispositive. It is not, for a Dutch operator serving European readers. AIC's flag reflects US copyright status. In the US, published works enter the public domain 95 years after publication — as of 1 January 2026, works published before 1931. In the EU and the Netherlands, the term is the life of the author plus 70 years, running from 31 December of the year of death. As of 2026 that means a work is in the public domain in the Netherlands only if its author **died in 1955 or earlier**.

The gap is real and not narrow. A painting published in the United States in 1925 by an artist who died in 1970 is public domain in the US and protected in the Netherlands until 2041. AIC's collection is full of early-twentieth-century work of exactly this profile.

**Instruments engaged.**

- **Directive 2006/116/EC** on the term of protection, Article 1: 70 years post mortem auctoris; implemented in the Netherlands in Article 37 Auteurswet.
- **AIC's own terms** ([artic.edu/terms](https://www.artic.edu/terms)) put the burden squarely on you: "it is the **sole responsibility of the image user** to identify and obtain any necessary third-party permissions, if any, required to use images or data designated public domain or otherwise," and "AIC MAKES NO REPRESENTATIONS OR WARRANTIES WHATSOEVER WITH RESPECT TO YOUR RIGHT TO REPRODUCE OR OTHERWISE USE ANY MATERIALS."

**One point in your favour.** Where the underlying artwork *is* out of copyright in the EU, the museum's photograph of it does not create a fresh layer of protection: **Article 14 of Directive (EU) 2019/790 (DSM)** provides that when the term of protection of a work of visual art has expired, material resulting from an act of reproduction of that work is not subject to copyright or related rights unless it is itself an original intellectual creation. A faithful reproduction photograph of a two-dimensional painting is not. So for genuinely EU-public-domain works, AIC's IIIF images are free in the EU regardless of what US law would say about the photograph.

**Realistic risk.** Low but non-trivial. The enforcers are artists' estates and collecting societies (Pictoright in the Netherlands), which do pursue online reproduction of twentieth-century art. The scale is small enough that no one is looking. The correctness cost is one filter.

**Remedy.** Add a second constraint on top of `is_public_domain`. The AIC API exposes `artist_id`, and the `/agents` endpoint returns `birth_date` and `death_date`. Concretely:

- Fetch or cache the artist agent record for each artwork.
- Admit the work only where `death_date` is present **and** `death_date <= 1955` (recompute annually: the cut-off is the current year minus 71).
- Where `death_date` is null, admit only if `date_end` on the artwork is before **1830** — a rough but safe proxy that no living-memory author is involved. Anonymous and collective works have their own rules; the proxy is deliberately conservative.
- Exclude works with multiple attributed artists unless all satisfy the test.

This will shrink the Gallery realm, mostly at the modern end. That is the correct outcome, and the pre-1900 European and Japanese material — which is where the landing page's own examples sit — is unaffected.

---

#### M-5. No Terms of Service — this is a DSA Article 14 breach, not merely a commercial gap
**[Legal requirement]**

**The issue.** There is no Terms of Service, Terms of Use, acceptable-use policy or content policy of any kind. Users can choose handles and display names and can transmit content to one another.

**Classification under the DSA, done properly.** This matters because it determines which obligations bite.

- Drift stores information provided by a recipient of the service at that recipient's request — the `shares` table, handles, display names, trail payloads. It is therefore a **hosting service** under Article 3(g)(iii) of Regulation (EU) 2022/2065.
- Is it an **online platform**? Article 3(i) requires a hosting service that, at the request of a recipient, stores **and disseminates information to the public**, where "dissemination to the public" (Article 3(k)) means making information available to a **potentially unlimited number of third parties**. Drift's sharing is restricted to mutual friends and that restriction is enforced by a database policy, not merely by the interface. There is no public feed and no public trail page. **Drift is not an online platform.** That is a genuinely useful conclusion: Section 3 of Chapter III — internal complaint handling (Art 20), out-of-court dispute settlement (Art 21), trusted flaggers (Art 22), platform transparency reporting (Art 24), minor-protection measures (Art 28) — does not apply at all. You never even need Article 19's micro-enterprise exclusion, because you are outside the section it excludes you from.
- **What does apply, regardless of size:** Articles 11–15 (all intermediary services) and Articles 16–18 (all hosting services). The ACM's own guidance confirms this framing: "All intermediary service providers must comply with the obligations in Articles 11 to 15 of the DSA… **regardless of the size of your enterprise**" ([ACM, *Guidelines: DSA due diligence obligations for intermediary services*](https://www.acm.nl/system/files/documents/guidelines-dsa-due-diligence-obligations-for-intermediary-services.pdf)).
- **The one size-based relief you do get:** Article 15(2) — annual content-moderation transparency reporting does not apply to micro or small enterprises. A sole operator is a micro enterprise. **You do not need to publish a transparency report.**
- **Article 13** (legal representative) does not apply: it is for providers not established in the EU. You are established in the Netherlands.

**So the live obligations are:**

| Article | Obligation | Status |
|---|---|---|
| 11 | Single point of contact for Member State authorities, the Commission and the Board, published | **Missing** |
| 12 | Point of contact for recipients, allowing direct and rapid communication by electronic means | Arguably met by `/contact`; must be designated as such |
| 14 | Terms and conditions, with specified content | **Missing entirely** |
| 15 | Transparency report | **Exempt** (Art 15(2), micro enterprise) |
| 16 | Notice-and-action mechanism | **Missing** — `/contact` is not one |
| 17 | Statement of reasons on restriction | **Missing** |
| 18 | Notification of suspicions of criminal offences | Procedure needed, no artefact |

**Instrument engaged.** **DSA Article 14(1)** requires providers to include in their terms and conditions "information on any restrictions that they impose in relation to the use of their service in respect of information provided by the recipients," including "policies, procedures, measures and tools used for the purpose of content moderation, **including algorithmic decision-making and human review**," in "clear, plain, intelligible, user-friendly and unambiguous language," publicly available in an easily accessible and **machine-readable** format. Article 14(4) requires those terms to be applied diligently, objectively and proportionately, with due regard to fundamental rights.

**A trap to avoid when you write them.** Do **not** include a standard clause prohibiting users from copying or redistributing content from the service. **CC BY-SA 4.0 §2(a)(5)(C)** — "No downstream restrictions" — provides that you "may not offer or impose any additional or different terms or conditions on, or apply any Effective Technological Measures to, the Licensed Material if doing so restricts exercise of the Licensed Rights by any recipient." A boilerplate no-redistribution clause over an app whose content is almost entirely CC BY-SA would be a licence breach caused by the very document you are writing to fix a compliance gap. Your terms must expressly carve the source content out.

**Realistic risk.** The ACM has been the Dutch Digital Services Coordinator since 4 February 2025, jointly with the AP ([AP, DSA page](https://www.autoriteitpersoonsgegevens.nl/en/about-the-ap/digital-services-act-dsa)). The ACM has published guidance and stated it will enforce rather than merely advise. A 20–50 user beta is not an enforcement target. But the DSA obligations are unusual in having no de minimis threshold for Articles 11, 12, 14 and 16, and the practical exposure is not the regulator — it is that with no terms you have no contractual basis to suspend an abusive account, no defined rules for handles and display names, no disclaimer, no limitation of liability, and no basis for the mutual-friend restriction beyond code.

**Remedy — minimum content of a Terms of Service for Drift.**

*DSA-mandated (Article 14):*
1. What users may not do: no illegal content; no harassment; no impersonation in handles or display names; no sending content to users who have not accepted the friend relationship.
2. How content moderation works: state that Drift does not proactively monitor shares; that the operator reviews on notice; that the optional local model labels threads and orders results and does **not** moderate; that decisions are made by a human.
3. What happens on breach: removal of a share, removal of a handle, suspension, termination — and that you will give reasons (Article 17).
4. How to complain about a decision, and to whom.
5. Published in clear language at a stable URL and served in a machine-readable form (a `terms.md` or JSON-LD alongside the HTML satisfies this cheaply).

*Article 16 notice-and-action, as a separate form or a mode of `/contact`:* an electronic form that captures (a) a substantiated explanation of why the information is alleged to be illegal, (b) the exact location, e.g. a share id or URL, (c) the notifier's name and email — **except** for notices concerning offences under Articles 3–7 of Directive 2011/93/EU, where the form must permit anonymity, and (d) a bona fide accuracy statement. Send an automated confirmation of receipt (Art 16(4)) and, on decision, notify the outcome and the available redress (Art 16(5)).

*Article 11/12 contact points:* one line on `/contact` — *"Single point of contact for authorities under Regulation (EU) 2022/2065: {email}. Language of communication: English and Dutch. Recipients of the service may contact the operator at the same address."*

*Ordinary commercial terms:* eligibility (16+, see M-8), account termination by either side, no warranty, limitation of liability, governing law (Dutch law, expressly without prejudice to the mandatory consumer protections of a user's country of residence), a statement that Drift claims no rights in the source content and that the source content remains available to users under its own licences, and that Drift's own software, branding and layout are separate.

---

#### M-6. No imprint: operator identity and establishment address are not disclosed
**[Legal requirement]**

**The issue.** `/colophon` names the operator by first name and country only. No legal name, no address, no registration number.

**Instrument engaged.** **Article 3:15d(1) Burgerlijk Wetboek**, implementing Article 5 of the e-Commerce Directive 2000/31/EC. A provider of an information society service must make the following "gemakkelijk, rechtstreeks en permanent toegankelijk" — easily, directly and permanently accessible: (a) **his identity and address of establishment**; (b) details enabling rapid, direct and effective communication, including an electronic mail address; (c) insofar as registered in a trade register, the register and registration number; (f) insofar as carrying on a VAT-liable activity, the VAT identification number ([text](https://maxius.nl/burgerlijk-wetboek-boek-3/artikel15d)).

Dutch enforcement practice is strict on what "easily and directly accessible" means. Per the Consumentenautoriteit decisions summarised in the standard commentary, stating the identity only in general terms and conditions is insufficient, naming only a trade name is insufficient because trade names need not be registered, and giving an email address alone does not satisfy sub (b).

**Does it apply to a free service?** Article 3:15d(3) defines an information society service as one "gewoonlijk tegen vergoeding" — normally provided for remuneration. The settled reading, from Recital 18 of the e-Commerce Directive onward, is that "normally for remuneration" is assessed by reference to the *type* of service, and that services not paid for by the recipient but **funded by advertising** are information society services. Today Drift takes no payment and shows no ads, so there is a narrow argument it falls outside. That argument does not survive `ads.txt`, a configured publisher id and a stated intention to monetise, and it dies entirely the day an ad renders. Treat this as: **arguable now, certain before advertising.**

**Realistic risk.** The ACM enforces under the Wet handhaving consumentenbescherming. It does not go looking for solo operators. The practical consequence is different: a user with a complaint, a rightsholder with a takedown demand, or a regulator with a question has no one to write to in a legal capacity, which converts routine correspondence into escalation.

**Remedy.** Publish an imprint — extend `/colophon` or add `/legal` — linked from the footer of every page, containing:

- Full legal name of the operator (natural person, or the BV if you incorporate).
- Establishment address. If you trade as a natural person this is your business address, which by default is your home address. Two lawful ways to avoid publishing a home address: register with the KvK using a business address (a co-working or registered-office address is acceptable if it is a genuine place of business), or incorporate a BV and use its registered address. Note the KvK's non-mailing indicator does not remove the Article 3:15d obligation.
- Email address, plus a second means of rapid direct contact (a contact form counts, provided you actually answer — the commentary on 3:15d treats a form as acceptable where questions are answered within roughly 30–60 minutes, so if that is unrealistic, add a phone number or state a response-time commitment honestly).
- KvK number, if registered.
- VAT identification number, if VAT-liable. Advertising revenue is a VAT-relevant economic activity; take advice on the small-business scheme (KOR) before enabling ads.
- The DSA Article 11/12 contact-point line from M-5.

---

#### M-7. `/privacy` does not meet the Articles 13 and 14 information requirements
**[Legal requirement]**

**The issue.** The notice is written in deliberately plain language, which is a virtue and should be kept. It is missing most of the mandatory content.

**Instrument engaged.** **GDPR Articles 13 and 14**, read with Article 12(1) (concise, transparent, intelligible, easily accessible, clear and plain language). The AP has identified transparency under Articles 12–14 as a 2026 supervisory priority.

**Precisely what is missing, item by item.**

| Provision | Required | Present? |
|---|---|---|
| 13(1)(a) | Identity and contact details of the controller | **No** — no legal controller named, no contact in that capacity |
| 13(1)(b) | DPO contact details | Not applicable — but say so: *"No data protection officer is appointed; Drift does not meet the Article 37 criteria."* |
| 13(1)(c) | Purposes **and legal basis for each** | **No** |
| 13(1)(d) | The legitimate interests pursued, where Art 6(1)(f) is relied on | **No** |
| 13(1)(e) | Recipients or categories of recipients | **No** — no processor is named |
| 13(1)(f) | Third-country transfers, the adequacy decision or safeguard relied on, and how to obtain a copy | **No** |
| 13(2)(a) | Retention period, or the criteria used to determine it | **No** |
| 13(2)(b) | Rights of access, rectification, erasure, restriction, objection, portability | **Partly** — only deletion is mentioned |
| 13(2)(c) | Right to withdraw consent | **No** |
| 13(2)(d) | Right to lodge a complaint with a supervisory authority | **No** |
| 13(2)(e) | Whether provision of data is a statutory or contractual requirement and the consequences of not providing | **No** |
| 13(2)(f) | Existence of automated decision-making within Art 22 | **No** — state that there is none |

**Remedy — the legal-basis mapping, which is the part people get wrong.** Do not write "we process your data with your consent" across the board; that is both inaccurate and strategically bad, because it makes every processing operation withdrawable.

| Processing | Basis | Note |
|---|---|---|
| Account creation, authentication, session | **Art 6(1)(b)** — performance of a contract | The contract is your Terms of Service, which is another reason to publish one |
| Saved trails, reactions, interests weighting, settings | **Art 6(1)(b)** | These are the service the user asked for |
| Handles, display names, friend relationships, shares | **Art 6(1)(b)** | |
| Welcome email on address confirmation | **Art 6(1)(b)** | Transactional, not marketing; Art 11.7 Tw opt-in does not bite. If it ever carries promotional content, it does |
| Contact form: name, email, message | **Art 6(1)(b)** where about the service, otherwise **6(1)(f)** | |
| Per-IP throttle, honeypot, minimum fill time | **Art 6(1)(f)** — legitimate interest in preventing abuse | State the interest expressly |
| Cloudflare Turnstile | **Art 6(1)(f)** | Turnstile receives the visitor's IP; Cloudflare is a recipient |
| AdSense, once enabled | **Art 6(1)(a)** — consent | And only consent |

**Retention periods to state:** account and trail data until the user deletes the account; shares until deleted by sender or recipient, or on account deletion; contact-form correspondence in the operator's inbox — pick a real number, twelve months is defensible; in-memory IP throttle entries — minutes, and note they never reach persistent storage; Supabase auth logs — whatever Supabase's retention actually is, which is an open question (Q-2).

**Recipients to name:** Vercel (hosting and CDN), Supabase (database and authentication), Resend (transactional email), Cloudflare (bot protection, if enabled), Google (advertising, once enabled), and Google as an identity provider if Google OAuth is live.

Keep the plain-language voice. A layered notice — a short human summary at the top, a full table below — satisfies Article 12(1) better than either extreme.

---

#### M-8. No age gate
**[Legal requirement]** — mostly latent now, material once open and monetised

**The issue.** There is no age verification, no age gate and no minimum-age term anywhere. The service is not directed at children but does nothing to exclude them.

**Instruments engaged.**

- **GDPR Article 8** applies to the offer of information society services **directly to a child**, and only "where point (a) of Article 6(1) applies" — i.e. where consent is the basis. Drift's core processing rests on Article 6(1)(b), and Drift is not directed at children, so Article 8 does not currently bite. **This changes when AdSense consent is introduced**, because that is Article 6(1)(a) processing.
- **The Dutch digital age of consent is 16.** The Netherlands did not exercise the option in Article 8(1) to lower it; Article 5 UAVG retains 16. So where consent is required and the user is under 16, it must be given or authorised by the holder of parental responsibility.
- **Article 1:234 BW** — a contract concluded by a minor without parental consent is voidable. Your Terms of Service, once written, is a contract.
- **Google's own policies** restrict ads personalisation for users under 18. Serving personalised ads to a minor is a policy breach as well as a data protection problem.

**Realistic risk.** Currently nil: 20–50 users, all personally known to you. The risk arrives with the beta ending and the ads starting, and it arrives as a combination — an unverified minor, personalised advertising, and no parental consent mechanism — which is precisely the fact pattern European regulators have been most active on.

**Remedy.** Proportionate to scale; do not build identity verification.

1. Add a term: *"You must be at least 16 years old to use Drift."* Put it in the Terms of Service and in the sign-up flow.
2. At sign-up, a single self-declared date of birth or a "I am 16 or older" checkbox that is not pre-ticked. Self-declaration is what regulators expect from a service not directed at children; it is a good-faith measure, not verification.
3. If a user indicates they are under 18, suppress personalised advertising for that account and pass the appropriate signal to Google. If under 16, do not create the account.
4. State in `/privacy`: *"Drift is not intended for people under 16. We do not knowingly collect data from people under 16. If you believe a child has created an account, contact us and we will delete it."*
5. Do not store the date of birth if you only need the boolean. Store `age_verified_16_plus: true` and discard the date — that is data minimisation under Article 5(1)(c) and removes a category of data you would otherwise have to protect.

---

#### M-9. No Article 28 processor agreements confirmed, and transfers are undocumented
**[Legal requirement]**

**The issue.** Vercel, Supabase, Resend, Cloudflare and Google all process personal data on Drift's behalf. Neither the existence of processor agreements nor the hosting regions could be determined from the source code, and `/privacy` names none of them and addresses transfers not at all.

**Instruments engaged.**

- **GDPR Article 28(3)**: processing by a processor "shall be governed by a contract or other legal act under Union or Member State law, that is binding on the processor with regard to the controller." This is mandatory. There is no small-controller exemption. The contract must cover the subject-matter, duration, nature and purpose, types of data, categories of data subjects, and the eight specified obligations including sub-processor authorisation, confidentiality, Article 32 security, assistance with data subject rights, breach assistance, deletion or return at the end, and audit.
- **GDPR Chapter V** for transfers outside the EEA. **The EU–US Data Privacy Framework adequacy decision remains valid as of today.** The General Court dismissed the challenge in *Latombe v Commission* (T-553/23) on 3 September 2025; an appeal is pending before the Court of Justice as Case C-703/25 P, with no hearing date announced. So an Article 45 adequacy transfer to a DPF-certified US recipient is currently lawful — but this is the third such framework, its two predecessors were both struck down, and one of the institutional safeguards the Commission relied on (the PCLOB) has been operating without quorum since January 2025. Plan for the possibility that this changes.
- **GDPR Article 13(1)(f)**: the fact of the transfer and the mechanism must be disclosed.

**Realistic risk.** Nobody audits a 20–50 user beta for DPAs. But Article 28 is one of the few GDPR obligations with essentially no scale defence, and if a data subject complains about anything else, "no processor agreements" is the first thing an AP case handler will note.

**Remedy — concrete, and mostly click-through.**

1. **Accept each provider's DPA.** All five publish standard Article 28 terms and most require an affirmative acceptance in the dashboard rather than applying automatically. Vercel: Legal → Data Processing Agreement. Supabase: Organisation settings, and request the DPA/SOC 2 package. Resend: DPA on request or in account settings. Cloudflare: incorporated into the standard terms but confirm the current version. Google: the Google Ads Data Processing Terms must be accepted in the AdSense account **before** enabling ads. Save a dated PDF of each.
2. **Confirm regions.** Ask Supabase which region the project sits in and move it to an EU region (`eu-central-1` / `eu-west-*`) if it is not already; a Supabase project region cannot be changed in place, so if it is in `us-east-1` this needs a migration and is better done now with fifty users than later with five thousand. On Vercel, set the function region to an EU region and note that Vercel's edge CDN is global by design — CDN caching of *third-party public content* is not a transfer of personal data, but any route that can return user data must be pinned.
3. **Verify DPF certification** for each US recipient at [dataprivacyframework.gov](https://www.dataprivacyframework.gov/list) and record the date checked. Where a provider is not certified, rely on the Standard Contractual Clauses in their DPA and perform a short transfer impact assessment — at this data sensitivity a one-page assessment is proportionate.
4. **Document it** in `/privacy` per M-7, and keep a one-page sub-processor list at a stable URL.

---

#### M-10. Public CDN caching needs a boundary check
**[Legal requirement / hygiene]**

**The issue.** Drift's own API routes return `Cache-Control: public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`. On the stated facts these routes only proxy Wikipedia and Art Institute responses, which is fine — caching third-party public content on a shared CDN is not a data protection event, and the CC BY-SA analysis is addressed at M-11 below.

The risk is structural rather than actual: `Cache-Control: public` combined with `s-maxage` on Vercel's shared edge is the standard mechanism by which authenticated responses leak between users. If any route under that cache policy ever varies by user — a personalised thread ordering, an interests-weighted batch, a route that echoes back an `Authorization` header's subject — the first user's response is served to everyone for up to 24 hours, and up to a further 7 days stale.

**Instrument engaged.** **GDPR Article 32(1)(b)** — ensuring the ongoing confidentiality of processing systems and services. A cache misconfiguration of this kind is a personal data breach under Article 4(12) and notifiable under Article 33 if it materialises.

**Remedy.**

1. Enumerate every route carrying `s-maxage` and confirm none reads the session. Write it down.
2. Add a hard guard: in the response helper that sets this header, throw if the request carried an `Authorization` header or a Supabase session cookie. Fail loudly in development.
3. For any route that must be both personalised and cached, use `Cache-Control: private, max-age=…` and never `s-maxage`.
4. Consider adding `Vary: Accept-Encoding` explicitly and avoid `Vary` on anything user-derived, since `Vary`-based cache partitioning on a shared CDN is fragile.

---

#### M-11. The licence notice does not travel with the data
**[Licence / contract term]**

**The issue.** Reproduction of the Wikipedia extracts happens in at least four places beyond the card UI: IndexedDB in the reader's browser, the `trails.steps` JSON column in Drift's Postgres, the `shares` table, and Vercel's shared CDN. The licence notice exists only in the rendered card.

**Analysis under the licence.** Storing extracts in your own database is **reproduction**, squarely licensed by §2(a)(1)(A). Serving them from a public shared CDN, and transmitting them to another user via `shares`, is **Sharing** as defined in §1(k) — "to provide material to the public by any means or process that requires permission… including in ways that members of the public may access the material from a place and at a time individually chosen by them." §3(a) conditions attach at the point of Sharing. §3(a)(2) lets you satisfy them "in any reasonable manner based on the medium, means, and context," including by a link to a resource containing the required information.

**Conclusion:** the current arrangement is **defensible but thin**. Because the card UI is the only context in which a human ever encounters the material, and that UI carries the source link and the linked licence, you are within §3(a)(2). Two things weaken it: the JSON payload itself carries no licence field, so anyone reading the API or the database sees unattributed Wikipedia text; and the exports (B-5) leave the UI entirely.

**Remedy — cheap and worth doing.**

1. Add to every card object persisted in `trails.steps`, and to every cached API payload, an explicit block:
   ```json
   "attribution": {
     "source": "English Wikipedia",
     "source_url": "https://en.wikipedia.org/wiki/Ukiyo-e",
     "license": "CC BY-SA 4.0",
     "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
     "modified": true,
     "modification": "excerpted and reformatted"
   }
   ```
   This is a handful of bytes, makes every downstream artefact self-describing, and is what B-5's export fix needs anyway.
2. Confirm that the **recipient's** view of a shared trail renders the same card notice the sender saw. If shares render through the same card component, this is already true — verify it.
3. Add the same `attribution` block for AIC cards with `"license": "CC0 1.0"` and the AIC caption described at Mi-1.

---

#### M-12. arXiv, if enabled, would breach the rate limit — and the licence reasoning is wrong in your favour
**[Licence / contract term]**

**The issue.** The arXiv realm is behind `NEXT_PUBLIC_REALM_PAPERS`, off in production. Two things would need to change before it goes on, and one belief should be corrected.

**(a) The rate limit is 3 seconds, not 300 milliseconds.** The [arXiv API Terms of Use](https://info.arxiv.org/help/api/tou.html) state: "When using the legacy APIs (including OAI-PMH, RSS, and the arXiv API), make **no more than one request every three seconds**, and limit requests to a single connection at a time," and add that the limits apply to all machines under your control as a whole. Drift's serialising gate keeps Wikimedia requests 300 ms apart — ten times too fast for arXiv. If arXiv shares that gate, enabling the realm puts you immediately in breach; if it is ungated, worse. arXiv's stated response to circumvention or excessive load is to "further limit or block your access."

**(b) The licence reasoning is wrong, and wrong in the permissive direction.** The code deliberately makes no licence claim on the reasoning that abstracts are not uniformly openly licensed. That reasoning is understandable and unnecessary. The arXiv API ToU says: "You are free to use **descriptive metadata** about arXiv e-prints under the terms of the Creative Commons Universal (CC0 1.0) Public Domain Declaration," and footnote 1 defines descriptive metadata as including "fields such as **title, abstract, authors**, identifiers, and classification terms." Under "Things that you can (and should!) do" it expressly permits you to "Retrieve, store, transform, and share descriptive metadata about arXiv e-prints" and to build discovery tools and interfaces. Titles, authors and abstracts — exactly what Drift fetches — are inside the CC0 grant.

What is **not** permitted is storing and serving the e-prints themselves: "Store and serve arXiv e-prints (PDFs, source files, or other content) from your servers, unless you have the permission of the copyright holder." Drift does not do this. It also must not "represent your project as endorsed or supported by arXiv.org without our permission."

One honest caveat: arXiv is not the copyright holder in the metadata — it is supplied by authors, moderators, staff and partners. arXiv's CC0 declaration is arXiv's assertion as against you, not a warranted chain of title. As against arXiv's terms you are clear; that is the relevant question.

**Remedy before enabling.**

1. Give arXiv its **own** request gate at ≥3000 ms with concurrency 1, independent of the Wikimedia gate. Do not share a gate between hosts with different limits.
2. Set an identifying User-Agent for arXiv as you do for the others.
3. Link to the **abstract page** (`arxiv.org/abs/{id}`), which arXiv expressly encourages, not the PDF.
4. Optionally state the licence: *"Title, authors and abstract from arXiv, CC0 1.0."* This is more accurate than silence and costs nothing.
5. Add to `/sources` and the footer: *"Drift is not affiliated with, endorsed by, or supported by arXiv."*
6. Do not cache arXiv responses on a public CDN with a 7-day stale window without checking that this is consistent with "no more than one request every three seconds" as an aggregate — it is, and in fact caching helps, but note it.

---

### MINOR

---

#### Mi-1. Art Institute of Chicago: the requested caption, the linking guideline, and the per-response licence field
**[Licence / contract term]**

**What AIC's terms actually permit.** Retrieved from [artic.edu/terms](https://www.artic.edu/terms) on 31 July 2026. Three passages matter and they must be read together.

1. The grant: *"Certain images of works in the collection believed to be in the public domain or to which the museum otherwise waives any copyright it might have been made available by AIC under the Creative Commons Zero (CC0) license. **Additionally, certain data about the museum's collections, publications, and programs has been made available through AIC's Public API under the CC0 license.** You are welcome to use any images or data with the label 'CC0 Public Domain Designation,' or otherwise stated as made available by AIC under the CC0 license, **for any purpose, including commercial and noncommercial uses**, without additional permission from AIC."*
2. The residual restriction: *"Except as otherwise provided above, you may not copy, distribute, modify, transmit, download, or otherwise use the contents of the Site **for commercial purposes** without the express prior written permission of AIC."*
3. The disclaimer: *"it is the sole responsibility of the image user to identify and obtain any necessary third-party permissions."*

**Conclusion on the assessment question.** AIC's terms **do** permit Drift's use of both the CC0-designated images and the catalogue metadata, **including in a commercial, ad-funded context**. Passage 1 is explicit on both counts and expressly covers API data as well as images. Passage 2 does not cut it down, because it is framed as "except as otherwise provided above." That said, the grant is bounded by the CC0 designation, and passage 2 means anything from AIC that is *not* CC0-designated cannot be used commercially at all. The API confirms the designation per response: `info.license_text` reads *"The data in this response is licensed under a Creative Commons Zero (CC0) 1.0 designation and the Terms and Conditions of artic.edu."* AIC's own [api-data repository](https://github.com/art-institute-of-chicago/api-data) warns: *"Note that all content may have different licensing terms. Please be mindful of the `info.license_text` and `info.license_links` fields within each JSON data file."*

**The gaps, all small.**

1. **Drift does not appear to check `info.license_text`.** It should, per AIC's own instruction, and should refuse to display any response whose licence text is not the CC0 form. One conditional.
2. **The requested caption is not being given.** AIC's [Open Access Images page](https://www.artic.edu/open-access/open-access-images) states: *"The museum **requests** that you include the following caption with reproductions of the images: **Artist. Title, Date. The Art Institute of Chicago.**"* This is a request, not a condition — CC0 imposes no attribution obligation and AIC does not purport to add one. Drift already surfaces artist, title and date; it is missing the institutional credit. Adding "The Art Institute of Chicago" completes the requested caption at zero cost and is exactly the kind of goodwill that keeps open-access programmes open.
3. **The linking guideline.** AIC's terms open with linking conditions: *"You should identify the Art Institute of Chicago in one of the following ways: by name with statutory trademark notice: **The Art Institute of Chicago®**; by URL: **www.artic.edu**."* Drift links to the canonical `artic.edu` artwork URL, which satisfies the second limb — so you comply. But note that where you name the institution in prose (the landing page does, and `/sources` does), the guideline asks for the ® symbol. Also note the same section: *"You may not reproduce the Art Institute of Chicago's logo, lion statues, or building image"* and *"You may not frame or transport viewers to any other location outside the Art Institute's website using the Art Institute's name."* Drift does neither. Keep it that way.
4. **Governing law.** AIC's terms specify Illinois law and exclusive jurisdiction in Cook County, Illinois. Worth knowing; not worth acting on.

**Remedy.** Add `The Art Institute of Chicago` to the card credit line so it reads `{Artist}. {Title}, {Date}. The Art Institute of Chicago.`; add the ® on first prose use of the institution's name on `/sources`; add a guard that rejects any AIC response whose `info.license_text` is not the CC0 form.

---

#### Mi-2. `Portal:Current events` is CC BY-SA material and is not credited
**[Licence / contract term]**

**The database-right question, answered.** Extracting link targets from 30 daily portal pages does **not** engage the sui generis database right, for three independent reasons.

1. **Not a substantial part.** Article 7(1) of [Directive 96/9/EC](https://www.wipo.int/wipolex/en/text/126788) protects against extraction or re-utilisation of "the whole or of a substantial part, evaluated qualitatively and/or quantitatively." Thirty daily portal pages is not a substantial part of English Wikipedia by any measure. Article 8(1) expressly preserves a lawful user's right to extract insubstantial parts "for any purposes whatsoever." Article 7(5) catches repeated systematic extraction of insubstantial parts only where it conflicts with normal exploitation or unreasonably prejudices the maker's legitimate interests — thirty page reads a day, gated and serialised, does neither. The CJEU's framing in C-762/19 puts the test on prejudice to the maker's investment; there is none here.
2. **It is licensed anyway.** **CC BY-SA 4.0 §4(a)** provides that where the licensed rights include sui generis database rights, "§2(a)(1) grants You the right to **extract, reuse, reproduce, and Share all or a substantial portion of the contents** of the database."
3. **Contributors have waived it.** The Wikimedia Terms of Use state: *"Where you own Sui Generis Database Rights covered by CC BY-SA 4.0, you waive these rights. As an example, this means facts you contribute to the projects may be reused freely without attribution."*

**But there is a distinct issue, and it is a copyright one, not a database one.** What Drift extracts is precisely the editors' **selection** — which articles were pointed at, how often, under which heading. Selection and arrangement is the subject-matter of Article 3 of the Database Directive (copyright in databases that "by reason of the selection or arrangement of their contents constitute the author's own intellectual creation") and of ordinary compilation copyright. Whether a day's current-events portal page clears the originality threshold is genuinely arguable. If it does, Drift's "in the news" feature is derived from a CC BY-SA 4.0 work — and §3(a) attribution then applies to *that feature*, not only to the individual article cards it surfaces. Drift currently credits the underlying articles and credits the portal nowhere.

**Would ShareAlike attach?** No. §4(b) makes a reuser's own database Adapted Material for §3(b) purposes only where it includes "all or a substantial portion of the database contents." Drift's ranking does not.

**Realistic risk.** Essentially zero. Nobody has ever sued over attribution of a Wikipedia portal page. But the fix is one sentence and it also improves the product's honesty about how "in the news" works.

**Remedy.** On the "in the news" surface, add: *"Selected from Wikipedia's Current events portal · CC BY-SA 4.0"*, with the portal name linked to `https://en.wikipedia.org/wiki/Portal:Current_events` and the licence linked. `/sources` already explains the mechanism well; it just needs the credit and the link.

---

#### Mi-3. No data portability mechanism
**[Legal requirement]**

**Instrument.** **GDPR Article 20(1)**: the data subject has the right to receive the personal data they provided to a controller "in a structured, commonly used and machine-readable format," where processing is based on consent or contract and carried out by automated means. Article 20(2) adds a right to direct transmission where technically feasible.

**Analysis.** Article 20 does **not** require a self-service export button. It requires you to *fulfil requests* within one month (Article 12(3)). The absence of a feature is therefore not itself non-compliance — the absence of any process, and the absence of any mention of the right in `/privacy`, is. The in-scope data is: email address, handle, display name, saved trails including their step JSON, reactions, the derived interests weighting, settings, friend relationships and shares. Note that the derived interests weighting is arguably *inferred* rather than *provided*, and inferred data falls outside Article 20 per the Article 29 Working Party guidance — but including it is easier than arguing about it.

**Remedy.** Two acceptable options at this scale.

- *Minimum:* document a manual process. On request, run a parameterised SQL query, export to JSON, and email it. Write the query now so it exists when asked. Add to `/privacy`: *"You can ask for a copy of your data in a machine-readable format at any time by emailing {address}. We will respond within one month."*
- *Better, and about two hours' work:* a "Download my data" button next to the existing delete flow that returns a single JSON file. You already have the account-deletion query enumerating the same tables; the export is the same joins with `select` instead of `delete`. Doing it also gives you a clean way to honour Article 15 access requests.

---

#### Mi-4. No Article 30 record of processing — and the small-organisation exemption does not apply
**[Legal requirement]**

**Instrument.** **GDPR Article 30(1)** requires controllers to maintain a record of processing activities. **Article 30(5)** exempts organisations with fewer than 250 employees **unless** the processing is likely to result in a risk to rights and freedoms, **is not occasional**, or includes special categories of data or criminal conviction data.

**Analysis.** Drift has one employee, so the headcount test is met. But the exemption is conjunctive in the wrong direction: any one of the three carve-outs defeats it. Drift's processing of account data, trails, reactions and interests is **continuous, not occasional**. The EDPB's position (and the AP's) is that "occasional" means genuinely sporadic, not routine business-as-usual. **So Article 30 applies and a record is required.** This is the single most commonly missed obligation among small operators, precisely because the "fewer than 250 employees" line is read in isolation.

**Realistic risk.** The record exists to be produced to the AP on request. Nobody will ask at this scale. But it is a one-page document, it is the natural place to write down the answers to M-7 and M-9 anyway, and if the AP ever does write to you about cookies, "we have no Article 30 record" is a needless second finding.

**Remedy.** One table, kept as a file in the repository. Columns: name and contact details of the controller; purpose; categories of data subjects; categories of personal data; categories of recipients including third-country recipients; transfers and the safeguard relied on; retention period; a general description of the Article 32 technical and organisational measures. Six or seven rows covers Drift entirely. Article 30(3) requires it in writing, including electronic form — a Markdown file is fine.

---

#### Mi-5. IP handling and Turnstile are undisclosed
**[Legal requirement]**

**The issue.** The contact form applies a per-IP throttle held in server memory and optionally calls Cloudflare Turnstile, which receives the visitor's IP. Neither is mentioned anywhere.

**Instrument.** IP addresses are personal data (CJEU C-582/14 *Breyer*). **Article 13(1)(c), (d) and (e)** require the purpose, the legitimate interest relied on, and the recipients to be disclosed **at the time the data are obtained** — which for a public contact form means at or adjacent to the form, not only in a privacy page a user may never open.

**Remedy.**

1. Under the contact form, one line: *"To prevent spam we briefly check your IP address and, if enabled, use Cloudflare Turnstile. See our privacy page."* — with the link.
2. In `/privacy`, add a row: *Purpose: preventing abuse of the contact form. Data: IP address, timing of submission. Basis: Article 6(1)(f), our legitimate interest in preventing spam and abuse. Recipients: Cloudflare, Inc. (Turnstile). Retention: throttle entries are held in server memory only and are lost on restart; they are never written to disk.*
3. Confirm the in-memory claim. On Vercel, "server memory" means per-instance memory in an ephemeral function, which is genuinely short-lived — say so accurately rather than describing it as a database.
4. Note the sender's message and email are also copied into the operator's own inbox with `reply_to` set. That is a recipient too, and the retention answer for it is whatever your mail retention actually is.

---

#### Mi-6. `ads.txt` is published for an account that is not approved
**[Platform policy]**

Low consequence. `ads.txt` under the IAB spec simply declares authorised sellers; publishing it with an unapproved publisher id is not a policy breach and creates no direct exposure. Two reasons to remove it for now: it is a public declaration of intent to monetise, which is one of the facts that pushes the Article 3:15d BW imprint analysis at M-6 from "arguable" to "certain"; and a stale `ads.txt` pointing at an id whose application was refused serves no purpose. Restore it when the account is approved.

---

#### Mi-7. Wikimedia trademark and the no-endorsement condition
**[Licence / contract term]**

**Instruments.** **CC BY-SA 4.0 §2(a)(6)** — "Nothing in this Public License constitutes or may be construed as permission to assert or imply that You are, or that Your use of the Licensed Material is, connected with, or sponsored, endorsed, or granted official status by, the Licensor." **CC BY-SA 4.0 §2(b)(2)** — "Patent and trademark rights are not licensed under this Public License." The Wikimedia Foundation's trademark policy permits nominative use of "Wikipedia" to identify the source of content, but not use of the marks or logos in a way suggesting affiliation.

**Analysis.** Drift's use is nominative and no Wikimedia logo appears. But the landing page's framing — "**Vetted** human knowledge", "**Vetted realms**", "Everything comes from sources **curated by people**" — is doing a little work that edges toward implying an editorial relationship with the sources. It is not a breach. It is close enough to be worth a disclaimer, and a disclaimer costs nothing.

**Remedy.** Add to the footer or `/sources`: *"Drift is an independent project. It is not affiliated with, endorsed by, or sponsored by the Wikimedia Foundation or the Art Institute of Chicago."* Do the same for arXiv before enabling that realm, where the ToU makes it an explicit prohibition rather than an inference.

---

#### Mi-8. Trademark exposure in the name "Drift"
**[Legal requirement — third-party rights]**

**What I can determine from public sources.** There is at least one substantial commercial user of "DRIFT" as a mark for software: **Drift.com, Inc.**, the B2B conversational-marketing platform, which holds US trademark registrations for DRIFT (e.g. USPTO serial 88328230) and which was acquired by Salesloft in February 2024 and continues to trade under the Drift name, including in Europe — Salesloft lists London and Warsaw offices. A company of that size operating in the EU will normally hold corresponding EU trade mark registrations in classes 9 and 42, and quite possibly 35 and 38.

**How the risk actually assesses.**

- *Against you:* the goods and services overlap at the level of the class. Both are software delivered as a website. Registered marks in class 9 and 42 for "software" are drafted broadly, and infringement under Article 9(2)(b) EUTMR turns on likelihood of confusion assessed across similar goods, not identical products.
- *For you:* "drift" is an ordinary English dictionary word with low inherent distinctiveness, which narrows the scope of protection. The actual fields are far apart — enterprise B2B sales chat versus a consumer reading app. Your name in commerce is "Drift" but your domain and brand presentation is `usedrift.org`, and the "use-" prefix is a recognised differentiator. There is no realistic prospect of a B2B buyer confusing the two. And EU trade mark rights are not infringed by uses that do not affect a function of the mark.
- *The realistic sequence:* not litigation. A brand-monitoring service flags a new `usedrift.*` domain, and you receive a letter asking you to stop. Solo operators almost always rebrand at that point because defending is not economic. The cost of that outcome scales with how much brand equity you have built, which is an argument for checking now rather than at ten thousand users.

**Limits of what I can determine without a formal search.** I have not run, and cannot run from public web sources, a proper clearance search. I do not know: whether an EUTM or Benelux registration for DRIFT subsists in classes 9, 41 or 42 and in whose name; whether any registration is vulnerable to revocation for non-use in the relevant classes; whether there are earlier Benelux rights from an unrelated party; or whether there are unregistered rights in the Netherlands under the Handelsnaamwet, which protects trade names on the basis of use rather than registration and is a separate and quite easily triggered claim.

**Remedy.**

1. Run a free preliminary search yourself, today, in two registers: **EUIPO eSearch plus** (`euipo.europa.eu`) and **BOIP** (`boip.int`), for the word mark DRIFT and for `DRIFT*` in **Nice classes 9, 41 and 42**. Also search the Dutch **Handelsregister** for trade names containing "Drift" in software or media activities.
2. If class 9 or 42 registrations covering software subsist in the EU in a third party's name, get a one-hour opinion from a Benelux trade mark attorney before spending anything further on the brand. That is a €200–400 conversation, not a litigation budget.
3. Consider a Benelux word-mark registration for DRIFT or USEDRIFT in classes 9, 41 and 42 — BOIP filing fees start around €250 for three classes. This does not defeat an earlier right, but it establishes your position against later ones and forces any conflict to surface at examination rather than after launch.
4. Cheapest structural hedge: use "Drift" consistently as `usedrift.org` in all commercial and legal contexts, and never present it in a form resembling a competing product's styling.

---

### BEST PRACTICE

---

**BP-1. Accessibility — not required, worth doing.** The **European Accessibility Act, Directive (EU) 2019/882**, has applied since 28 June 2025 and is implemented in the Netherlands by the *Implementatiewet toegankelijkheidsvoorschriften producten en diensten*, with the ACM among the designated regulators. **It does not apply to Drift, on two independent grounds.**

First and decisively, **Article 4(5)**: "**Microenterprises providing services shall be exempt** from complying with the accessibility requirements referred to in paragraph 3 of this Article and any obligations relating to the compliance with those requirements." A microenterprise is fewer than 10 employees and annual turnover or balance sheet total not exceeding €2 million. A sole operator qualifies comfortably. Note the asymmetry: the exemption is full for *service* providers; providers of *products* get only alleviated obligations, not exemption. Drift is a service.

Second and more arguably, scope. The EAA's relevant service category is "e-commerce services," defined as services provided at a distance through websites, by electronic means and at the individual request of a consumer **with a view to concluding a consumer contract**. Drift is free and concludes no contract for goods or services for a price. Whether a free account creation is a "consumer contract" for these purposes is unsettled and I would not rest on it — but you do not need to, because Article 4(5) resolves it.

**The exemption is attached to your status, not to the product.** If you incorporate and stay under 10 employees and €2m, you remain exempt. If you cross either threshold, the exemption falls away and Section III and IV of Annex I apply — in practice, EN 301 549 and WCAG 2.1 AA. Build to WCAG 2.1 AA now while the app is small; retrofitting a full-screen card interface with gesture-driven navigation is far more expensive later. One specific note: if you add a cookie banner per B-1, the banner itself is part of the interface and, if the exemption ever ceases to apply, must be keyboard-navigable and screen-reader-accessible with the reject control reachable without a mouse.

**BP-2. Add a licence line to the plain-text export.** Not required — see the B-5 table, row (iv) — but one line costs nothing and makes every artefact self-describing.

**BP-3. Send `Accept-Encoding: gzip` on Wikimedia requests.** The [Wikimedia robot policy](https://wikitech.wikimedia.org/wiki/Robot_policy) asks clients to "always request content with an `Accept-Encoding: gzip` HTTP header to reduce bandwidth usage." Cheap goodwill with a source you depend on entirely.

**BP-4. Verify deletion propagates.** Account deletion removes the auth user and associated data. Check three things it may not reach: shares *sent* by the deleted user and still visible to recipients; the Vercel CDN cache, if any user-derived route is ever cached; and Resend's message logs. Article 17(1) erasure that leaves the user's content visible to their friends is not erasure. Document the answer in the Article 30 record.

**BP-5. Write down the "no AI-generated card text" rule as a commitment, not just a behaviour.** `/principles` and `/sources` already state it. Once ads run, a claim about how content is produced becomes a commercial representation, and Article 6:193c(1)(b) BW makes false claims about a product's main characteristics a misleading practice. Keep the claim true, and keep it precise: "the local model labels threads and orders results; it never writes card text" is accurate and defensible, where "AI is never in the driver's seat" is a slogan.

---

## 3. What is already correct

The engagement asked me to be as rigorous here as in the findings. Where something holds only on a particular reading, I say which reading.

**C-1. Setting `pilicense=free` was the right call, for the right reason.** The reasoning in the description — that Wikipedia hosts some files under fair use, that those files are not covered by the article's CC BY-SA licence, and that they must therefore be excluded — is correct. It matches the actual purpose of the parameter, which exists because the WMF Board's Licensing Policy is more restrictive than fair use and requires non-free content to be minimal and confined to community-approved Exemption Doctrine Policies. Most reusers never think about this at all. **Caveat, and it is why B-4 exists:** the flag means "not tagged non-free on the local wiki." It does not mean "no attribution required," and its accuracy depends on wiki-side tagging that has demonstrably failed before (Phabricator T320661 documents non-free images surfacing as thumbnails on Wikimedia's own search until the parameter was requested explicitly). It is a good filter, not a guarantee.

**C-2. Stripping images from the `action=parse` HTML is prudent and correct.** The embedded images in a rendered article are exactly where non-free files live, since they are transcluded under the local Exemption Doctrine Policy and are not covered by the article's licence at all. Removing them is the safest possible handling. This should not change.

**C-3. The Wikimedia request discipline is genuinely good and better than most.** The User-Agent format `Drift/1.0 (https://www.usedrift.org; <email>)` matches the format Wikimedia asks for verbatim — the documented example is `CoolBot/0.0 (https://example.org/coolbot/; coolbot@example.org)`. Sending it as **both** `User-Agent` and `Api-User-Agent` is right: the [API etiquette page](https://www.mediawiki.org/wiki/API:Etiquette) notes that browser-originated JavaScript cannot always set `User-Agent`, which is what `Api-User-Agent` exists for. Serialising through a single gate at 300 ms is concurrency 1 at roughly 3.3 requests per second, comfortably inside the published guidance of three or fewer concurrent requests and under 5 requests per second unauthenticated. Automatic retry on 429 and 503 is what [Wikimedia APIs/Rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits) asks for. There is a live and increasing benefit to this: Wikimedia has been progressively rate-limiting and blocking unidentified clients, and a correctly formatted contactable User-Agent is what keeps you out of the lowest access class. **One improvement:** honour the `Retry-After` header value rather than a fixed backoff, and add `Accept-Encoding: gzip` (BP-3).

**C-4. Hyperlink attribution for article *text* is correct, and the operator's reasoning is sound.** The Wikimedia Terms of Use reuse clause permits attribution "Through hyperlink (where possible) or URL to the page or pages that you are reusing (since each page has a history page that lists all contributors, authors and editors)." Drift links every card to the canonical article URL. That satisfies the ToU, and under CC BY-SA 4.0 §3(a)(2) it is a reasonable manner of satisfying §3(a)(1) by linking to a resource containing the required information. **Which reading this holds under:** it holds for text developed by the Wikimedia community. It does **not** extend to images (B-4), it does not cure the separate §3(a)(1)(B) modification requirement (M-2), and it does not reach text imported from external sources with additional attribution requirements (M-3).

**C-5. Naming *and* hyperlinking the licence was a deliberate choice and a correct one.** §3(a)(1)(C) requires you to "indicate the Licensed Material is licensed under this Public License, **and include the text of, or the URI or hyperlink to,** this Public License." Naming the licence alone would not satisfy the second limb. [Wikipedia:Copyrights](https://en.wikipedia.org/wiki/Wikipedia:Copyrights) says the same: a licensing notice plus either a hyperlink or URL to the licence text or a copy of it. Putting the notice **on the card** rather than only in a footer is also the better reading of §3(a)(2)'s "medium, means, and context" test, since the card is the unit a reader actually encounters. This is done well.

**C-6. Hotlinking is permitted by both hosts.** Wikimedia Commons' guidance states that using a file by embedding its URL "is also possible, but is not recommended," and the technical page confirms hotlinking is allowed while recommending download instead; the reasons given against it are practical (a hotlinked file can be renamed, replaced or deleted; it consumes Wikimedia bandwidth), not permissive. It is discouraged, not prohibited. AIC's IIIF image server likewise imposes no anti-hotlinking condition and the CC0 designation carries none. **Which reading:** permitted as a matter of the hosts' policies, and it reduces your reproduction exposure. But note MediaWiki's own criticism of the practice, which is precisely the B-4 point: hotlinking "does not respect the license terms of the image, and does not allow for other metadata to be reliably transported." Fixing B-4 makes hotlinking a clean choice rather than a partially compensating one.

**C-7. Commercial use is permitted by every licence and every source term involved.** Taking the assessment question directly:

- **CC BY-SA 4.0** contains no NonCommercial element. §2(a)(1) grants the licensed rights "royalty-free" and worldwide with no purpose restriction, and §2(b)(3) records that the Licensor waives any right to collect royalties. Commercial use is squarely permitted.
- **The Wikimedia Terms of Use** say so expressly: "Please note that these licenses do allow commercial uses of your contributions, as long as such uses are compliant with the terms of the respective licenses."
- **CC0 1.0** waives copyright and related rights "for any purpose whatsoever, including without limitation commercial, advertising or promotional purposes."
- **AIC's terms** permit CC0-designated images and API data to be used "for any purpose, including commercial and noncommercial uses, without additional permission."
- **arXiv's API ToU** places descriptive metadata under CC0, with no commercial restriction.

**What commercial status *does* add** is not a licensing restriction but three collateral obligations: the imprint duty under Article 3:15d BW hardens from arguable to certain (M-6); the no-endorsement condition in CC BY-SA §2(a)(6) and the Wikimedia trademark policy matter more, because an ad-funded site implying an association with Wikipedia looks different from a hobby project doing the same (Mi-7); and the unfair commercial practices regime becomes fully engaged (B-3). Note also that the Wikimedia Foundation runs a paid product, Wikimedia Enterprise, for high-volume commercial reusers. Drift's volume is nowhere near the threshold where that is relevant, and the free APIs remain available to commercial users on the same terms as everyone else — this is worth stating explicitly because operators sometimes assume otherwise.

**C-8. No analytics, no tracking pixels, no third-party analytics script, and no first-party HTTP cookies.** This is genuinely unusual and genuinely good. It means that once B-1 is fixed, Drift has essentially no ePrivacy surface at all. It also makes the consent flow far simpler to build than for a typical site, because there is exactly one thing to gate.

**C-9. `localStorage` and IndexedDB use falls within the strictly-necessary exemption.** Article 11.7a(3) Telecommunicatiewet exempts storage or access that is solely for the purpose of carrying out the transmission, or strictly necessary to provide a service explicitly requested by the user. Applying that:

| Stored item | Exempt? | Reasoning |
|---|---|---|
| Supabase session token in `localStorage` | **Yes** | Authentication is strictly necessary to a service the user explicitly requested by logging in |
| Card and trail data in IndexedDB | **Yes** | This *is* the service — an installable PWA that works offline |
| Theme and settings | **Yes** | A user-set preference, the textbook exempt case |
| "Storage notice" dismissal flag | **Yes** | Records a UI state the user created by clicking; collects nothing |
| Anything AdSense writes | **No** | Advertising is expressly outside the exemption; the 2015 Dutch amendment's third exception covers only analytics with no or negligible privacy impact |

**Which reading this holds under:** it holds as long as none of the client-side storage feeds advertising, cross-site profiling, or any purpose beyond serving the signed-in user their own content. The moment the interests weighting is used to target ads rather than to order the user's own feed, the analysis changes. Keep that line bright.

**C-10. Row-level security and the database-enforced friend restriction are the right architecture, and they have a legal payoff.** `user_id = auth.uid()` enforced in Postgres rather than in the interface is the correct implementation of Article 32(1) GDPR (appropriate technical measures) and Article 25 (data protection by design). Enforcing the mutual-friend restriction in a database policy rather than only in the UI has a second, larger benefit the description does not claim: it is what keeps Drift outside the DSA definition of an "online platform." Article 3(k) turns on dissemination "to a potentially unlimited number of third parties," and a restriction that only the interface enforces would be far weaker evidence than one the database enforces. That single design decision removes Articles 20–28 DSA from your obligations entirely (M-5).

**C-11. Self-service account deletion behind a type-to-confirm step satisfies Article 17 in substance,** and doing it without requiring the user to email you is better than what most services offer. Subject to BP-4's propagation check.

**C-12. Making no licence claim for arXiv was cautious rather than wrong.** The premise — that abstracts are not uniformly openly licensed — is a reasonable inference from arXiv's licensing page, and erring toward silence rather than a false claim was the right instinct. As it happens arXiv's API ToU is more generous than the operator assumed (M-12). Silence is not a defect; it is simply leaving accuracy on the table.

**C-13. The "storage notice" component is honest about what it is.** It informs, it collects nothing, and it does not pretend to be consent. Keep it that way. The one thing that must not happen is repurposing it as the consent mechanism by adding a second button — a "Got it" dismissal cannot become valid consent by acquiring a sibling. Build the CMP separately.

**C-14. Excluding the app from search engines and having no public feed or public trail page** is the right default for a private beta and is what keeps the copyright analysis narrow. Almost all of Drift's reproduction of third-party content happens behind a login to a closed group, which materially reduces both the discovery probability and the seriousness of any breach.

---

## 4. Open questions

Facts I would need from you to complete the assessment, and what each would change.

**Q-1. What are the five landing-page illustrations, and under what licences?** `impressionism.jpg`, `great-wave.jpg`, `monet.jpg`, `ukiyo-e.jpg`, `rainy-day.jpg`. *Changes:* if any is a CC BY or CC BY-SA file, M-1 becomes **Blocking** — you are hosting and publicly distributing a copy of a CC-licensed photograph with no credit on your only indexed page. If all are CC0, PD, or AIC open access, M-1 drops to a documentation correction.

**Q-2. Which regions are the Supabase project and the Vercel functions in?** *Changes:* whether Chapter V GDPR is engaged for the primary datastore at all. An EU-region Supabase project removes the most significant transfer question. A `us-east-1` project makes M-9 a migration task rather than a paperwork task, and migrations get harder with every user.

**Q-3. Have DPAs been executed with Vercel, Supabase, Resend, Cloudflare and Google?** *Changes:* M-9 from a task to a documentation exercise. Most of these require an affirmative click in a dashboard and do not apply by default.

**Q-4. Can any route carrying `Cache-Control: public, s-maxage=86400` ever return user-specific data?** *Changes:* M-10 from a hygiene item to a live Article 32 issue and, if it has already happened, a potential Article 33 notifiable breach.

**Q-5. Are you registered with the KvK, and are you VAT-liable?** *Changes:* the exact content of the imprint at M-6. It also determines whether the establishment address you must publish is a business address or your home address, which is worth solving before you publish rather than after.

**Q-6. Does the arXiv client share the 300 ms Wikimedia gate?** *Changes:* whether M-12(a) is a configuration change or a new component. Either way it must be resolved before the realm is enabled.

**Q-7. Does the recipient's view of a shared trail render the same card component, with the source link and licence notice?** *Changes:* whether §3(a) is satisfied at the point of the share. If shares render through a different, lighter component, that is an additional attribution gap not covered elsewhere in this report.

**Q-8. Does `trails.steps` currently persist the source URL and any licence information?** *Changes:* the effort estimate on B-5 and M-11. If the URL is already stored, the export fix is presentational. If it is not, historic trails cannot be retro-attributed and you will need a migration or an accepted gap for existing data.

**Q-9. Does the exported PNG currently embed anything beyond titles and images?** *Changes:* whether B-5 Option A is a deletion or a redesign.

**Q-10. Is Google OAuth enabled in production?** *Changes:* the consent analysis. Google's identity SDK loads from Google's origin and may set storage before authentication. If it is live on the public sign-in surface, it needs the same B-1 treatment as AdSense, or must be deferred until the user actively chooses "Continue with Google" — the live home page shows a "Continue with Google" control, so this needs checking. Loading it only on click is both compliant and better for performance.

**Q-11. Is any current user under 16, or under 18?** *Changes:* whether M-8 is latent or live. With 20–50 personally known users you can simply answer this from memory.

**Q-12. Does the AIC client read `info.license_text` per response?** *Changes:* Mi-1 from a one-line guard to a code change, and determines whether you are relying on AIC's licensing assertion or merely assuming it.

**Q-13. Do you intend to remain a sole operator?** *Changes:* three separate exemptions — DSA Article 15(2) transparency reporting, EAA Article 4(5) microenterprise exemption, and the practical proportionality of everything in this report. All three turn on the Recommendation 2003/361/EC thresholds of fewer than 10 employees and €2m turnover.

---

## 5. Prioritised action list

### Do today, regardless of anything else — under an hour total

1. **Remove the AdSense publisher id from the production environment**, or gate the loader script behind `NEXT_PUBLIC_ADS_ENABLED`. *Effort: minutes.* This single change ends the only live unlawful processing in the product (B-1).
2. **Rewrite the advertising paragraph on `/privacy`** to describe what is actually true. Replacement text is at B-3. *Effort: minutes.* This is the cheapest risk reduction available anywhere in this report.
3. **Answer Q-1** — identify the five landing-page images. *Effort: minutes.* If any is CC BY or CC BY-SA, either credit it or swap it the same day.
4. **Answer Q-4** — confirm no `s-maxage` route reads the session. *Effort: 15 minutes with grep.*

### Must happen regardless of advertising — a week of evenings

5. **Per-image credit line on every card**, using the `imageinfo`/`extmetadata` call specified at B-4, with the fail-closed rules. *Effort: half a day.* Highest-probability rightsholder complaint in the product.
6. **Add the "excerpted and reformatted" modification indication** to the card and full-article notices. *Effort: 15 minutes* (M-2).
7. **Fix the PNG export** — Option A, drop the images, is the fast path. *Effort: an hour or two* (B-5).
8. **Amend `/sources`** to stop describing images as covered by the article's licence, and add the Current events portal credit. *Effort: 20 minutes* (B-4, Mi-2).
9. **Add the `attribution` block to persisted card objects.** *Effort: an hour, plus a decision about historic rows* (M-11).
10. **Publish a Terms of Service** meeting DSA Article 14, plus the Article 11/12 contact-point line and an Article 16 notice route. Watch the CC BY-SA §2(a)(5)(C) trap. *Effort: a day, using the content list at M-5.*
11. **Complete `/privacy`** against the Article 13 checklist at M-7, keeping the plain-language voice. *Effort: half a day.*
12. **Accept the five processor DPAs and record the regions.** *Effort: an hour of clicking, plus a possible Supabase migration.* (M-9, Q-2, Q-3.)
13. **Write the Article 30 record.** One table, six rows. *Effort: an hour, and most of the content comes from step 11* (Mi-4).
14. **Add the AIC institutional caption and the `info.license_text` guard.** *Effort: 30 minutes* (Mi-1).
15. **Disclose the IP throttle and Turnstile** at the contact form and in `/privacy`. *Effort: 15 minutes* (Mi-5).
16. **Document or build the data export.** *Effort: 15 minutes for the documented process, two hours for the button* (Mi-3).
17. **Add the "not affiliated" disclaimer.** *Effort: 5 minutes* (Mi-7).
18. **Run the EUIPO and BOIP preliminary searches.** *Effort: 30 minutes* (Mi-8).

### Must happen before advertising is enabled — none of it optional

19. **Implement a Google-certified TCF v2.2 CMP** to the full specification at B-1, with Google consent mode v2. *Effort: a day, plus a CMP subscription; several certified CMPs are free at Drift's volume.* (B-1, B-2.)
20. **Publish the imprint** with legal identity, establishment address, KvK and VAT numbers as applicable. Solve the home-address question before publishing. *Effort: an hour, plus whatever the address decision requires* (M-6).
21. **Add the 16+ gate** and the personalised-ads suppression for under-18s. *Effort: an hour* (M-8).
22. **Accept the Google Ads Data Processing Terms** in the AdSense account (M-9).
23. **Restore `ads.txt`** once the account is approved (Mi-6).
24. **Re-read the "Low value content" refusal** honestly before re-applying (B-2).

### Before the arXiv realm is enabled

25. **Separate rate gate at ≥3000 ms, concurrency 1**, plus the abstract-page linking, the optional CC0 statement, and the no-endorsement disclaimer (M-12).

### Before the AIC Gallery realm is opened beyond a closed beta

26. **Add the artist-death-date filter** so `is_public_domain` is not treated as a European determination (M-4). This can wait behind the closed beta; it should not wait behind a public launch.

---

## 6. Where a qualified Dutch lawyer is genuinely needed

Everything above has been taken as far as public sources allow. Four questions cannot be, and for each I have set out exactly what to ask so that you are buying an answer rather than an education.

**6.1 — The establishment address under Article 3:15d BW.** *Ask:* "I am a sole operator, not incorporated, running a free ad-funded website from the Netherlands. Article 3:15d(1)(a) BW requires me to make my identity and address of establishment easily, directly and permanently accessible. Must I publish my home address, or is a KvK-registered business address at a co-working or registered-office provider sufficient? Does registering a BV change the answer, and at what cost and administrative burden?" *Why a lawyer:* the interaction between 3:15d, the Handelsregisterwet and the KvK's address-shielding practice is technical, and getting it wrong means either non-compliance or publishing your home address unnecessarily. This is a 30-minute question with a clear answer.

**6.2 — Whether Drift is an information society service today.** *Ask:* "The service is currently free, shows no advertising, has a refused AdSense application, and publishes an `ads.txt`. Is it a 'dienst van de informatiemaatschappij' within Article 3:15d(3) BW now, or only once advertising is served? What is the position on 'gewoonlijk tegen vergoeding' for a service that is being prepared for advertising but is not yet monetised?" *Why a lawyer:* this determines whether M-6 is a "before advertising" item or a "now" item, and the answer turns on Dutch case law on 3:15d rather than on anything retrievable from public guidance.

**6.3 — Whether the false consent-prompt statement is an unfair commercial practice.** *Ask:* "Article 6:193c(1)(g) BW requires a misleading practice to affect a 'besluit over een overeenkomst.' The service is free but users provide personal data and create an account. In light of the Modernisation Directive's extension of consumer protection to free digital services, does an inaccurate statement in a privacy notice about a non-existent consent control constitute a misleading commercial practice, and does the answer change once advertising is served?" *Why a lawyer:* I have taken this as far as the statutory text and one enforcement precedent allow, and reached "arguable but not strong today, strong once ads run." A Dutch consumer-law practitioner can narrow that. **Note that the answer does not change what you should do**, which is to fix the sentence today, so this is a question worth asking only if you want to know your exposure for the period the statement has already been live.

**6.4 — Trade mark clearance for "Drift."** *Ask a Benelux trade mark attorney, not a general lawyer:* "Please run a clearance search for DRIFT and USEDRIFT as word marks in Nice classes 9, 41 and 42 across the EUTM and Benelux registers, plus Dutch trade-name rights under the Handelsnaamwet, for a consumer web application that presents encyclopedia and museum content. Advise on freedom to operate in the Benelux and on whether a defensive Benelux registration is worth filing." *Why a specialist:* clearance requires register access and judgement about class scope that cannot be replicated from public web searching, and Handelsnaamwet rights arise from use and do not appear in any register at all.

**One thing you do not need a lawyer for.** The CC BY-SA analysis in this report is settled licence interpretation, not contested law. Section 3(a) says what it says, the Wikimedia Terms of Use say what they say, and Wikipedia's own reuse guidance says the same thing in plainer words. If you want a second view, the right place to ask is not a law firm but the Wikimedia community itself — the `Commons:Village pump/Copyright` page will tell you within a day whether a proposed image credit format is adequate, from people who deal with nothing else.

---

## Sources retrieved

All retrieved 31 July 2026.

**Licences.** [CC BY-SA 4.0 legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en) · [CC0 1.0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en)

**Wikimedia.** [Policy:Terms of Use](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use) · [Wikipedia:Copyrights](https://en.wikipedia.org/wiki/Wikipedia:Copyrights) · [Wikipedia:Reusing Wikipedia content](https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content) · [Wikipedia:FAQ/Copyright](https://en.wikipedia.org/wiki/Wikipedia:FAQ/Copyright) · [Commons:Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) · [Commons:Reusing content outside Wikimedia/technical](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical) · [InstantCommons](https://www.mediawiki.org/wiki/InstantCommons/en) · [API:Etiquette](https://www.mediawiki.org/wiki/API:Etiquette) · [Wikimedia APIs/Rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits) · [Robot policy](https://wikitech.wikimedia.org/wiki/Robot_policy) · [Policy:Wikimedia Foundation API Usage Guidelines](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines) · [Phabricator T320661](https://phabricator.wikimedia.org/T320661) · [Phabricator T131105](https://phabricator.wikimedia.org/T131105)

**Art Institute of Chicago.** [Terms and Conditions](https://www.artic.edu/terms) · [Open Access Images](https://www.artic.edu/open-access/open-access-images) · [api-data repository](https://github.com/art-institute-of-chicago/api-data)

**arXiv.** [Terms of Use for arXiv APIs](https://info.arxiv.org/help/api/tou.html) · [Licenses](https://info.arxiv.org/help/license/index.html) · [Permissions and Reuse](https://info.arxiv.org/help/license/reuse.html)

**EU and Dutch law.** [Directive 96/9/EC (databases)](https://www.wipo.int/wipolex/en/text/126788) · [Directive (EU) 2019/882 (EAA)](https://eur-lex.europa.eu/eli/dir/2019/882/oj) · DSA Regulation (EU) 2022/2065, [Art 15](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_15.html), [Art 16](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_16.html), [Art 19](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_19.html) · [Art 3:15d BW](https://maxius.nl/burgerlijk-wetboek-boek-3/artikel15d) · [Art 6:193c BW](https://maxius.nl/burgerlijk-wetboek-boek-6/artikel193c) · [Tw art. 11.7a explanatory memorandum](https://zoek.officielebekendmakingen.nl/kst-33902-3.html)

**Regulators.** [AP — Ga slim om met cookies](https://www.autoriteitpersoonsgegevens.nl/ga-slim-om-met-cookies) · [AP — Kruidvat fine](https://www.autoriteitpersoonsgegevens.nl/actueel/boete-van-600000-euro-voor-tracking-cookies-op-kruidvatnl) · [AP — DSA supervision](https://www.autoriteitpersoonsgegevens.nl/en/about-the-ap/digital-services-act-dsa) · [ACM — DSA due diligence guidelines](https://www.acm.nl/system/files/documents/guidelines-dsa-due-diligence-obligations-for-intermediary-services.pdf)

**Platform policy.** [Google AdSense — certified CMP requirement](https://support.google.com/adsense/answer/13554116?hl=en) · [Google AdSense — EU user consent policy](https://support.google.com/adsense/answer/7670013?hl=en) · [Google announcement](https://blog.google/products/adsense/new-consent-management-platform-requirements-for-serving-ads-in-the-eea-and-uk/)

**Site under audit.** `https://www.usedrift.org/` and `https://www.usedrift.org/sources`, both fetched unauthenticated on 31 July 2026.

---

*This report is a compliance assessment based on public sources and the facts supplied. It is not legal advice, and I am not a Dutch lawyer. Section 6 identifies the four points where qualified Dutch advice is needed and what to ask for.*