# Things only you can do

Everything in this file needs a human: a dashboard login, a legal decision, a bank detail, or a
judgement about your own circumstances. None of it can be done from the codebase.

It comes from `docs/drift-compliance-audit.md` (31 July 2026). Each item names the audit finding it
closes so you can read the reasoning.

Status key: **[NOW]** do it soon regardless. **[BEFORE ADS]** must be done before
`NEXT_PUBLIC_ADS_ENABLED=1`. **[WHEN APPROVED]** after AdSense approves.

---

## 1. Vercel environment variables

**[NOW] Nothing needs changing. Deploy the code and the breach is fixed.**

Worth understanding why, because it is the one place a wrong click would undo it. Your `.env` has
`NEXT_PUBLIC_ADS_ENABLED=0` and **no** publisher id. Production has the publisher id set in Vercel's
own environment variables, which is why the bug never reproduced locally.

Before: the AdSense loader ran whenever a publisher id existed. After: it needs
`NEXT_PUBLIC_ADS_ENABLED=1` **and** a publisher id. Since production has the switch off (or unset,
which parses the same way), deploying the code is sufficient.

| Variable | Where | Set it to |
|---|---|---|
| `NEXT_PUBLIC_ADS_ENABLED` | Vercel | `0`, or delete it. **Do not set to `1`** until the consent gate ships. |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Vercel | Leave as is. Harmless now that the switch governs it. |

**To confirm after deploying**, open `https://www.usedrift.org` in a private window, open dev tools,
and check the Network and Application tabs. You should see **no request to `googlesyndication.com` or
`fundingchoicesmessages.google.com`, and no `FCCDCF` cookie.** Before the fix there were two requests
and one cookie.

---

## 2. Hosting regions *(audit Q-2, M-9)*

**[NOW]** and genuinely time-sensitive, because it gets harder with every user.

- [X] **Find your Supabase project region.** Supabase dashboard → Project Settings → General.
- [X] **If it is not in the EU** (`eu-central-1`, `eu-west-1`, `eu-west-2`), plan a migration. A
      Supabase project's region **cannot be changed in place**: it needs a new project and a data
      migration. At 20 to 50 users that is an evening. At 5,000 it is a project.
- [X] **Set the Vercel function region** to an EU region: Vercel → Project → Settings → Functions →
      Function Region → Frankfurt (`fra1`) or Amsterdam.
- [X] Note that Vercel's CDN is global by design. That is fine: it caches Wikipedia and museum
      content, not user data, and the code now has a guard so a route carrying user data can never be
      cached publicly.

Why it matters: an EU-region database removes the largest international-transfer question in the
audit before you have to answer it.

---

## 3. Processor agreements *(audit M-9, Q-3)* — **mostly already done, and nobody told you**

**I had this wrong and you were right to push back.** My earlier instruction sent you hunting for
an "accept" button in dashboards that mostly do not have one. Here is what is actually going on.

### What a DPA is, in one paragraph

When another company handles personal data **on your behalf and on your instructions**, GDPR
Article 28(3) says there has to be a written contract between you saying what they may do with it.
You are the **controller** (you decide why the data exists), they are the **processor** (they just
run the machines). The contract has to cover eight specific things: sub-processors, confidentiality,
security, helping you answer user requests, helping with breaches, deletion at the end, audit
rights, and the subject matter itself. It has no small-business exemption. That contract is the
"DPA", sometimes called a "DPA addendum" or "Data Processing Addendum".

### The thing nobody explains: most DPAs are already signed

You expected to sign something. For three of your four providers, **you already did, when you
accepted their terms of service.** The DPA is written as an *addendum* that is incorporated into the
main agreement automatically. The PDF you found on Vercel is exactly that: a **pre-signed template**.
It looks unsigned because your half is the click you already made, not a signature block.

Vercel's own wording, which I checked today:

> "This Addendum shall become legally binding upon Customer entering into the Agreement or upon
> execution of this Addendum."

and, for the international transfer clauses inside it:

> "By entering into the Agreement, Data Exporter is deemed to have signed these Standard Contractual
> Clauses incorporated herein, including their Annexes, as of the Effective Date of the Agreement."

"Deemed to have signed" is the whole answer. There is no ceremony to perform.

### Where each one actually stands

| Provider | Status | What you do |
|---|---|---|
| **Vercel** | ✅ **Already binding.** Pre-signed, incorporated on entering the agreement. | Nothing. Save the PDF (below). |
| **Resend** | ✅ **Already binding.** Same construction, same wording: binding "upon Customer entering into the Agreement". | Nothing. Save the PDF. |
| **Supabase** | ⚠️ **Check.** Supabase publishes a DPA and puts it under **Organisation → Legal Documents** in the dashboard. Some accounts show an accept action there, some show it as already incorporated. | Open that page and see which it is. If there is a button, press it. |
| **Cloudflare** | ❌ **This one genuinely needs accepting.** Cloudflare's DPA says it takes effect "from the date on which Customer signed or the parties otherwise agreed to this DPA", and asks the person accepting to warrant they can bind the customer. It is not automatic. | Only needed **if you turn Turnstile on**. You have not. Do it then. |
| **Google** | ❌ Not yet. The Ads Data Processing Terms are accepted inside the AdSense account. | **[BEFORE ADS]** only. |

- [ ] **Supabase:** open Organisation → Legal Documents and see whether there is an action to take.
- [ ] **Save a dated PDF of Vercel's and Resend's DPAs** somewhere you will find them in two years.
      They are at <https://vercel.com/legal/dpa> and <https://resend.com/legal/dpa>. This is the only
      real task in this section: the agreements exist, but if a regulator ever asks, "it is
      incorporated by reference into terms I accepted in 2026" is much easier to say with the
      document in front of you.
- [ ] **Check each US recipient is certified** at <https://www.dataprivacyframework.gov/list> and
      write the date you checked into `docs/processing-record.md` §2, which currently says the
      certification is asserted from their published terms rather than verified.

### One thing worth knowing that is not a DPA

Vercel's DPA language refers to the **Pro and Enterprise** agreements. If you are on the **Hobby**
plan, note separately that Hobby is licensed for **non-commercial personal use only**. That is fine
today. It stops being fine the day an advert renders, at which point you need Pro (about $20 a
month) regardless of anything in this file. `docs/beta-readiness.md` flags the same thing.

---

## 4. Your legal identity and the imprint *(audit M-6, §6.1)* — ✅ **built**

You gave me the details and `/legal` is live in the codebase, linked from the footer of every public
page and listed in the sitemap. `/privacy` now names you as the data controller with the same
details, which closes the GDPR Article 13(1)(a) gap at the same time.

What is published, from `src/lib/imprint.ts`:

| | |
|---|---|
| Name | Thomas van der Hulst |
| Trading as | Usedrift, a registered trade name of the sole proprietorship also trading as RiskOptimix |
| Establishment address | Uilenstede 138, 1183 AN Amstelveen, Netherlands |
| KvK | 90992318 |
| Email | contact@usedrift.org |

**Two notes, and then this is closed.**

- [ ] **You are publishing what looks like a home address, and I want you to have said yes to that
      on purpose.** Uilenstede is student housing. Article 3:15d BW needs an *establishment* address,
      and the one registered at the KvK is the correct one to publish, so what you gave me is right.
      But this is the decision the audit flagged as the one worth a lawyer, and the alternatives
      (a registered-office or co-working address, or a BV) are still open. Changing it later is one
      line in `src/lib/imprint.ts`. If you are happy, tick this and forget it.
- [ ] **VAT.** You did not say, and I did not guess. `/legal` currently publishes **no VAT number**
      and explains why: Article 3:15d(1)(f) requires it only "insofar as" a VAT-liable activity is
      carried on, and Drift is free, carries no advertising and earns nothing. That is accurate today
      and stops being accurate the day an advert renders. Two things then:
      **(a)** give me your BTW-identificatienummer and I will add one line;
      **(b)** ask an accountant about the small-business scheme (KOR) **before** enabling ads, since
      advertising revenue is a VAT-relevant economic activity.

---

## 5. The landing page cosmos images *(audit M-1, Q-1)* — ✅ **done, and one was worse than expected**

You said you had no idea where these came from, so I identified all five by eye and traced each
credit to the agency that published it. **One of them was a real problem.**

### The Jupiter image was NonCommercial, and had to be replaced

`cosmos-jupiter.jpg` was the JunoCam "Jupiter Blues" close-up. JPL's own page for it gives the
credit as:

> NASA/JPL-Caltech/SwRI/MSSS/Gerald Eichstadt/Sean Doran **© CC NC SA**

That is **CC BY-NC-SA**: a **NonCommercial** licence. Two citizen scientists processed the raw
JunoCam data, and their processing carries their own terms even though NASA hosts the result.
NonCommercial cannot be fixed by crediting, and it is squarely wrong for a site you are preparing to
put adverts on, sitting on the only page of yours that is public and indexed.

**Replaced** with the Cassini Jupiter portrait ([PIA04866](https://images.nasa.gov/details/PIA04866)),
downloaded from `images.nasa.gov`, credited NASA / JPL / Space Science Institute, no copyright
notice. It is a full-disc Jupiter with the Great Red Spot, and it pairs better with the Saturn card
next to it than the old one did. Nothing to do.

**The lesson, which is now written into `CREDITS.md` and `data.ts`: a NASA-hosted image is not
automatically public domain.** NASA says so itself. Citizen-scientist processing of mission data is
the common case and is routinely NC or ND. Check the source page's credit line for a `©`.

### The two Hubble images are credited rather than replaced

`cosmos-nebula.jpg` (Pillars of Creation) and `cosmos-galaxy.jpg` (Whirlpool Galaxy) have two
publishers with two positions on the same file:

- **NASA** says its content, including Hubble outreach imagery, "generally [is] not subject to
  copyright in the United States", and asks only to be acknowledged. `hubblesite.org/copyright` now
  **redirects** to that page, which I verified today.
- **ESA/Hubble** publishes the same images under **CC BY 4.0** and asks for a visible credit.

Since nobody recorded where these were downloaded from, I did not try to win the argument. Both are
now credited on `/colophon` under a new **Illustrations** heading, naming the creators and linking
CC BY 4.0, with the footer of every public page linking to it. That is compliant if ESA is right and
merely polite if NASA is. CC BY 4.0 §3(a)(2) expressly allows attribution via a link to a page
carrying the required information, which is what this is; a caption next to each one is not workable
when they appear as small trail-map thumbnails.

Earthrise and Saturn were always fine: Apollo 8 and Cassini, NASA, public domain.

- [ ] Nothing required. **Optional:** if you want zero residual argument, say so and I will swap the
      two Hubble pictures for NASA-only mission imagery. The landing does not depend on them.

---

## 6. Trademark *(audit Mi-8)* — **what you found matters, so here is the whole thing explained**

You found `W01615903 - DRIFT`, owner **Studio Drift Holding B.V.**, Nice classes **9, 11, 35, 41,
42**, registered 3 March 2021. That is a real hit, in the classes that matter, owned by an Amsterdam
company. Below is what all of that means and what to do about it.

### First, the two different rights, because you have one and not the other

These get confused constantly and they are genuinely different things.

- A **handelsnaam** (trade name) is the name you trade under. You get rights in it simply by
  **using** it, under the Handelsnaamwet. You registered "Usedrift" at the KvK, which is good
  evidence of use but is not what creates the right. It protects you against someone else using a
  confusingly similar name **in the same area and the same line of business**. It is local, it is
  narrow, and it does not appear in any trade mark register.
- A **merk** (trade mark) is a registered monopoly on a sign for particular goods and services,
  across a whole territory. You do **not** have one. Studio Drift does.

So: registering "Usedrift" at the KvK gave you a trade name. It gave you no trade mark, and it is no
defence against someone else's trade mark.

### Second, what the Nice classes are

A trade mark is not registered for "everything". It is registered for a list of goods and services,
sorted into 45 numbered classes. Owning DRIFT in class 25 (clothing) says nothing about apps. The
three that matter for Drift:

| Class | Covers | Why it is Drift's |
|---|---|---|
| **9** | Downloadable software, apps, recorded content | Drift is an installable app |
| **41** | Education, entertainment, cultural activities | Drift is a reading and culture product |
| **42** | Software design and development, software as a service | Drift is a hosted web service |

Classes 11 (lighting) and 35 (advertising and business services) are in Studio Drift's list too but
are not yours.

### Third, what you are actually looking for

Not "does anyone use the word drift". You are looking for a mark that is **all four** of these:

1. **The same or confusingly similar sign.** DRIFT is identical. USEDRIFT is similar.
2. **Covering goods or services like yours**, i.e. in class 9, 41 or 42, and with a
   *goods description* that actually reaches a consumer app rather than something unrelated.
3. **In force** (not expired, not withdrawn) and **valid in the Benelux**, either as an EU trade mark
   or as a Benelux one or as an international registration designating either.
4. **Owned by someone else.**

### What your screenshot is

All four. Studio Drift is the Amsterdam art studio (Lonneke Gordijn and Ralph Nauta) known for
kinetic light works and drone shows. Their class 9 entry has been reported as covering *downloadable
software for creating, organising, presenting, editing, distributing and displaying works*. That is
software, in the EU, under the identical word, owned by someone else, in a cultural field next door
to yours.

That is exactly the trigger the audit set for escalating: *"If class 9 or 42 registrations covering
software subsist in the EU in a third party's name, get a one-hour opinion."*

**Do not panic about it.** What it means in practice:

- **It is not automatically infringement.** Infringement under Article 9(2)(b) EUTMR needs a
  *likelihood of confusion*, judged on the similarity of the signs, the similarity of the actual
  goods, and how distinctive the earlier mark is. "Drift" is an ordinary dictionary word, which
  narrows the protection. An art studio selling installations and a free encyclopedia reading app are
  not obviously confusable. Their software claim looks ancillary to their artworks, not a consumer
  app business.
- **Studio Drift is more relevant to you than Drift.com is**, even though Drift.com is the bigger
  company. Studio Drift is in the Benelux, in a cultural field, and would notice a Dutch
  culture-adjacent product called Drift far sooner than a US B2B sales-chat company would.
- **The realistic sequence is a letter, not a lawsuit.** A brand monitoring service flags
  `usedrift.org`, you get an email asking you to stop. Solo operators nearly always rebrand at that
  point, because defending is not economical. The cost of that outcome grows with how much brand
  equity you have built, which is the whole argument for looking now.

### So what should you do

- [ ] **Nothing urgent.** You are a free, login-gated beta with 20 to 50 users. Nobody is coming.
- [ ] **Finish the search properly, since you are already in there.** In eSearch plus, filter to
      status **"Registered"** and territory covering the **Benelux or the EU**, and look at classes
      **9, 41 and 42** only. Then do the same at BOIP <https://www.boip.int>. What you want out of it
      is a short list: which marks are live, in which of your three classes, owned by whom.
- [ ] **Then spend the €200 to €400 on one hour with a Benelux trade mark attorney,** before you
      spend anything else on the brand. Bring the list. The question to ask, close to verbatim:
      *"I run a free consumer web app called Drift at usedrift.org, presenting Wikipedia and museum
      content, likely to carry advertising. Studio Drift Holding B.V. holds DRIFT in classes 9, 41
      and 42 in the Benelux. Do I have freedom to operate under this name, and is a defensive Benelux
      registration worth filing?"* That is a bounded question with a real answer, not an open-ended
      engagement.
- [ ] **Cheap structural hedge, free, do it now:** always present the brand as **usedrift.org** in
      commercial and legal contexts (the imprint, the terms, invoices), never as a bare "Drift"
      styled like somebody else's product. A distinguishing prefix genuinely helps.
- [ ] **Optional, only after the attorney says the coast is clear:** a Benelux word mark for USEDRIFT
      in classes 9, 41 and 42, from around €250 at BOIP. Filing DRIFT itself would likely be opposed;
      USEDRIFT is the more filable sign and the one you actually use.

---

## 7. The contact address — ✅ **done**

Since `contact@usedrift.org` already works, it is now the **built-in default**. `/contact`,
`/privacy` and `/legal` all publish it, and the contact form delivers there too unless `CONTACT_INBOX`
says otherwise. No environment variable is needed: deploying the code is enough.

- [ ] **Optional tidy-up.** If `CONTACT_INBOX` in Vercel is already set to `contact@usedrift.org`,
      you can delete it, since that is now the default. If it points somewhere else, leave it: it
      controls only where the form delivers, not what is published.
- [ ] `NEXT_PUBLIC_CONTACT_ADDRESS` exists if you ever want the published address to differ from the
      default. You do not need it today.

---

## 8. Click "Download your data" once *(new, one minute)*

`/account` now has a data export next to the delete flow. Its logic is unit tested and the page
builds, but the card only renders for a signed-in user and I have no credentials for your backend,
so **the button itself has never been clicked**. I would rather say that than let you assume it was
tested.

- [ ] Sign in, press it, and check the file that lands has your trails in it.
- [ ] If you have a handle, check the `profile`, `friends` and `shares` sections are there too.
      Those three come from Postgres rather than the browser, so they are the part most likely to
      surprise.

---

## 9. Only if the Gallery is missing images on the LIVE site

Gallery cards had lost their artwork in local development. The cause is the museum's image host,
which now sits behind Cloudflare bot management that refuses a browser-shaped request carrying a
`localhost` referrer. Measured 5 out of 5 each way: `localhost` is blocked, `usedrift.org` is
allowed. So this should only ever have affected you locally, and it is fixed there.

- [ ] **If you actually saw missing artwork on <https://www.usedrift.org>, tell me.** That would
      mean the museum is refusing the live origin too, and the fix is already built: set
      `ARTIC_IMAGE_PROXY=1` in Vercel and images are served through Drift instead.
- [ ] Know the trade before flipping it: that moves image bytes onto your Vercel bandwidth, roughly
      250 KB per artwork viewed and 1 MB per zoom, less whatever the 30 day CDN cache absorbs. It is
      off in production precisely so `docs/beta-readiness.md` stays true.

---

## 10. Answer two questions for the record

- [X] **Is any current user under 16, or under 18?** *(audit Q-11)* With 20 to 50 people you know
      personally you can answer from memory. It decides whether the age gate is urgent or a formality.
- [X] **Do you intend to stay a sole operator?** *(audit Q-13)* Three exemptions depend on it: DSA
      transparency reporting, the European Accessibility Act microenterprise exemption, and the
      general proportionality of everything in the audit. All use the same thresholds: fewer than 10
      employees and under €2m turnover.

---

## 11. Three decisions M3 to M5 left for you

None is urgent. Each is a judgement I should not make on your behalf.

### The Gallery got smaller, and one bucket got noticeably smaller

The EU public-domain filter is live: a work is shown only if every attributed artist died in 1955 or
earlier, or (with no named artist) the work was finished before 1830. Of a 20-item page, most buckets
lose nothing to four. **Japanese prints drop to 13 and botanical to 9.**

That is not modern copyright. It is the 1830 rule catching nineteenth-century work whose artist has
no recorded death date at the museum. A print made in 1860 is certainly out of copyright here, but
the filter cannot prove it, so it declines.

- [ ] **Leave it** (the audit called the 1830 proxy "deliberately conservative" and I left it exactly
      as specified), **or tell me to relax it** to 1870. The derivation for 1870: an artist was at
      least fifteen when they made the work and lived at most a hundred years, so a work from year Y
      implies death by Y + 85, and 1955 minus 85 is 1870. That is still very conservative and it
      would recover most of what is being lost. It is a legal judgement, not a product tweak, which
      is why I did not just do it.

### A cookie arrives from Wikimedia, and it is not ours

While verifying that "ads off" means zero cookies, I found one: **`WMF-Uniq`, set by
`upload.wikimedia.org` every time a card's picture loads.** Reproduced 4 out of 4.

It is Wikimedia's cookie on Wikimedia's domain, httpOnly, unreadable by us, and we get nothing from
it. **The 13 public pages set nothing at all**; it only appears once you are reading cards, behind
the login. It is not a tracker of ours and it is a very long way from the AdSense problem.

`/privacy` and `/faq` now say this accurately instead of "no cookies", which is the important part.

- [ ] **Nothing to do**, unless you want it gone. Removing it means proxying Wikipedia images through
      Drift the way Gallery images already can be (`ARTIC_IMAGE_PROXY`), which puts card image
      bandwidth on your Vercel bill. Say the word and I will build it; I did not, because it is your
      money.

### The consent gate exists but does not make you eligible for personalised ads

`NEXT_PUBLIC_ADS_ENABLED=1` now produces a real gate: nothing from Google loads until someone chooses,
Accept and Reject are identical buttons, and refusing costs nothing. Verified in a browser: zero
third-party requests before a choice, zero after a refusal, and only then `googlesyndication.com`.

**That makes you lawful under ePrivacy and the GDPR. It does not satisfy Google.** Google requires a
Google-CERTIFIED IAB TCF v2.2 platform for personalised ads in the EEA and UK, and certification is a
list you are on, not code I can write. Two things therefore stay open:

- [ ] **[BEFORE ADS]** Use Google's own **Privacy & messaging** (Funding Choices) as the certified
      layer once the AdSense account is approved. It is free and configured inside AdSense. Tell me
      when it is on and I will make our gate read its signal instead of asking twice.
- [ ] **[BEFORE ADS]** **Under-18s.** Google restricts ads personalisation for under-18s. Drift asks
      only "are you 16 or older", so it cannot tell 16 from 18. Either we add a second declaration,
      or the CMP handles it. Not built, because it needs an API I cannot test without an approved
      account, and a guess would be worse than a gap.

---

## 12. AdSense, in order

- [ ] **[WHEN APPROVED]** Move `docs/ads.txt.pending` back to `public/ads.txt`.
- [ ] **[BEFORE ADS]** Accept the Google Ads Data Processing Terms in the AdSense account.
- [ ] **[BEFORE ADS]** Set up a Google-certified TCF v2.2 consent management platform. Google's own
      **Privacy & messaging** (Funding Choices) is free, certified, and configured inside AdSense, so
      it is the natural choice. It needs an approved account, which is no constraint since ads cannot
      run before approval anyway.
- [ ] **[BEFORE ADS]** Only then set `NEXT_PUBLIC_ADS_ENABLED=1`.
- [ ] Re-read `docs/adsense-resubmission.md` before reapplying. Do not reapply before roughly
      20 October 2026: the domain was registered on 19 July 2026 and age is the dominant factor.

---

## What is done in code, and what is not

**Done and verified** (deploy whenever you like; M0 should go out on its own, today):

| | |
|---|---|
| **M0** | The AdSense loader, the ownership meta tag and the consent gate are now governed by one switch. `/privacy` no longer describes a consent prompt that does not exist. `ads.txt` parked. Verified: 10 public pages, zero third-party requests, zero cookies, with the live publisher id still configured. |
| **M1** | Per-image creator and licence on every card, with two fail-closed rules; the modification indication CC BY-SA requires; an attribution block that travels with saved and shared cards; the licence notice on received cards; images removed from the PNG export; the AIC caption and a licence guard on every museum response; the current-events portal credited; `/sources` corrected. |
| **M2** | `/terms` meeting DSA Article 14 (and `/terms.md`, its machine-readable twin); the Article 16 notice-and-action route as a mode of `/contact`, anonymity included; the Article 11/12 contact points; `/privacy` rewritten to the full Article 13 checklist on a contract basis rather than consent; "Download your data" on `/account`; the contact-form IP disclosure; and `docs/processing-record.md`, the Article 30 record. |
| **M2, closing pass** | **`/legal`, the imprint**, with your real details, linked from every public footer and naming you as the data controller on `/privacy` too. `contact@usedrift.org` is now the built-in published address. The NonCommercial Jupiter image is replaced and the Hubble pair credited on `/colophon`. Verified: 798 tests, contrast PASS across 27 views in both themes, and `/legal` rendering signed out against a real gated build. |

| **M3** | The Gallery is filtered for the EU term (life plus 70) rather than the museum's US determination. A work by an artist who died after 1955 is now refused even though the museum flags it public domain. Verified live: a 1966 artist is out, Matisse (1954) is in. |
| **M4** | The consent gate: nothing from Google loads before a choice, Accept and Reject as measured-identical buttons, no cookie wall, withdrawal from every page, Google consent mode v2 denied by default, and consent evidence. Plus the never-pre-ticked 16+ declaration at sign-up, storing only the boolean. |
| **M5** | A structural shared-cache guard that throws in development, `Accept-Encoding: gzip`, `Retry-After` honoured in full including the date form, deletion propagation proved against the real migration SQL, and a licence line on the text export. |

**The audit is now fully implemented in code.** Every finding that could be closed by a commit has
been. What is left in this file is genuine homework that needs a dashboard or a decision: the
Supabase DPA check, saving two PDFs, the DPF certification dates, the VAT number if you are
VAT-liable, the trade mark conversation, and the three judgement calls at §11.

Nothing outstanding is blocking today, because ads are off and the app is behind a login.
