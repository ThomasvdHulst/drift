# What still needs you

Last rewritten 1 August 2026, after a full re-check of what the compliance work actually left open.

This file used to be 450 lines and it frightened you, which was a failure of the file rather than a
fair reflection of your position. It has been cut down to what is true. The reasoning behind every
item is still in `docs/drift-compliance-audit.md` if you ever want it; you do not need it to act.

---

## Where you actually stand

**Nothing here is on fire, and nothing is stopping you handing out flyers tomorrow.**

The audit found one thing that was genuinely unlawful: the Google AdSense script was loading on every
public page and setting a cookie, with no consent mechanism, on a site earning nothing. That is
fixed, verified in a browser, and cannot come back by accident. Everything else it found was either a
document you did not have yet or a credit you were not giving. Those are all built now.

What is left for you is four small tasks, one decision about advertising, and a few judgement calls
that can wait indefinitely. Total time for the tasks: about half an hour.

Two things worth holding on to while you read:

- **Scale genuinely matters, and the audit says so itself.** The Dutch regulator's own enforcement
  path is a warning letter first, then roughly three months to fix it, then escalation. It does not
  go hunting for solo operators. A free, login-gated app used by your family is not a target. That is
  not a licence to be sloppy, and it is not what got you here, but it does mean you can do the
  remaining items calmly rather than this weekend.
- **You do not need a lawyer.** The audit named four questions for one, and three of them have since
  become moot: the address question resolved itself when you published the address the KvK already
  has, the "is this an information society service yet" question stopped mattering once you published
  the imprint anyway, and the third was only ever about historic exposure for a sentence that is now
  corrected. The fourth is the trade mark, and see §4 for why that one can wait too.

---

## 1. Four things to do, about half an hour

Sit down once, do these, and this section is finished.

- [ ] **Click "Download your data" on `/account`, signed in.** One minute. This is the only thing
      built for the audit that has never actually been run: its logic is unit tested and the page
      builds, but the button only renders for a signed-in user and there were no credentials for your
      backend. Check the file that lands has your trails in it. If you have set a handle, check the
      `profile`, `friends` and `shares` sections are there too, since those three come from the
      database rather than the browser and are the part most likely to surprise.

- [ ] **Open Supabase, Organisation, Legal Documents, and see whether there is a DPA to accept.**
      Five minutes. This is the only item on the whole list that is a legal requirement with no
      small-operator exemption anywhere in it (GDPR Article 28: if a company processes personal data
      on your behalf, there has to be a written contract). Vercel's and Resend's are already binding,
      because their DPAs are written to take effect when you accepted their terms. Supabase's may be
      the same or may want a click. Look, and if there is a button, press it.

- [ ] **Save Vercel's and Resend's DPAs as dated PDFs**, somewhere you will find them in two years.
      <https://vercel.com/legal/dpa> and <https://resend.com/legal/dpa>. Five minutes. The agreements
      exist either way; this is so that "it is incorporated into terms I accepted in 2026" is
      something you can say with the document in front of you.

- [ ] **Write your two hosting regions into `docs/processing-record.md` §2.** Two minutes. You already
      looked them up, but the answers were never written down anywhere, so the file that is supposed
      to record them still says "unknown". One line for the Supabase project region, one for the
      Vercel function region.

That is the whole of what is genuinely outstanding.

---

## 2. The advertising decision, which is the one that actually matters

Read this before doing anything else about ads, because it may save you the entire rest of the work.

**Almost everything left on the long version of this list existed because of advertising.** With ads
off, you need no consent platform, no Google data-processing terms, no VAT number, no under-18 ad
signalling, and the imprint requirement is arguable rather than certain (you have published one
anyway, so it costs you nothing either way).

**And the money does not work at your scale.** Three things stack up:

1. **Vercel Hobby is licensed for non-commercial personal use only.** The day an advert renders, you
   need Vercel Pro, which is about $20 a month, about $240 a year. This is not optional and it is not
   a grey area.
2. **AdSense has already refused you once**, for "low value content", and the honest read in
   `docs/adsense-resubmission.md` is that domain age and organic traffic are the deciding factors
   rather than anything you can write. You cannot reapply usefully before around 20 October 2026.
3. **Revenue at fifty readers is a rounding error.** A few euros a month at the optimistic end.

So the realistic arithmetic is: advertising would cost you roughly $240 a year plus a day of setup,
to earn a few euros, on an account that is not approved. Meanwhile your actual running costs today
are close to nothing: Vercel Hobby, Supabase free, Resend free and Cloudflare free are all €0, and
the domain is on the order of €12 a year. Check your own bills, but that is the shape of it.

**My recommendation: leave `NEXT_PUBLIC_ADS_ENABLED` off and stop thinking about ads.** Not because
ads are wrong, and not because the code is not ready. The consent gate is built, it works, and it
was verified in a real browser: nothing from Google loads before a choice, Accept and Reject are
measurably identical buttons, and refusing costs nothing. It is there if you want it. But at your
size it is a cost centre wearing the costume of a revenue stream, and it is the source of most of
the anxiety this whole exercise produced.

If you decide otherwise, §5 is the checklist. Do not turn the switch on without working through it.

---

## 3. Judgement calls, none urgent

Each of these is a decision I should not make for you. Each has my recommendation, so you can agree
in ten seconds rather than reason from scratch.

- [ ] **Your home address is on `/legal`, and it is meant to be.** Uilenstede is student housing, and
      what is published is the establishment address registered at the KvK, which is the legally
      correct one. **Recommendation: leave it.** The alternatives (a registered-office or co-working
      address, or incorporating a BV) cost real money for a hobby project. But be clear with yourself
      that this is a privacy and personal-safety call rather than a legal one: it is a public page
      with your home on it. Changing it later is one line in `src/lib/imprint.ts`.

- [ ] **The Gallery got smaller, and one part of it noticeably so.** Drift now shows an artwork only
      if every named artist died in 1955 or earlier, or, where no artist is recorded, the work was
      finished before 1830. That second rule is what bites: a Japanese print from 1860 is certainly
      out of copyright, but the museum records no death date, so the filter declines. Japanese prints
      dropped to 13 of 20 on a sample page, botanical illustration to 9 of 20.
      **Recommendation: relax it to 1870 if the Gallery feels thin to you, otherwise leave it.** 1870
      is derivable and still very conservative: an artist was at least fifteen when they made the
      work and lived at most a hundred years, so a work from year Y implies death by Y plus 85, and
      1955 minus 85 is 1870. Say the word and it is a one line change plus its tests.

- [ ] **A cookie arrives from Wikimedia when a card's picture loads.** `WMF-Uniq`, set by
      `upload.wikimedia.org` on Wikimedia's own domain. It is httpOnly, unreadable by Drift, gets us
      nothing, and appears only once you are reading cards. The thirteen public pages set nothing at
      all. `/privacy` and `/faq` describe this accurately rather than claiming "no cookies", which
      was the important part. **Recommendation: leave it.** Removing it would mean serving every
      Wikipedia image through your own server, which puts real bandwidth on your Vercel bill for no
      benefit to anyone.

- [ ] **Two Hubble photographs on the landing page have two publishers who disagree about their
      licence.** NASA says its imagery is generally not copyrighted; ESA publishes the same files
      under CC BY 4.0. Nobody recorded where these were downloaded from, so both are credited on
      `/colophon`, which is compliant if ESA is right and merely polite if NASA is.
      **Recommendation: leave it.** Offer stands to swap them for NASA-only imagery if you want zero
      residual argument.

- [ ] **Check the four US providers are certified** at <https://www.dataprivacyframework.gov/list>
      and write the date into `docs/processing-record.md` §2. Ten minutes, and worth doing eventually
      rather than now: it turns a position you have asserted into one you have evidenced. Nobody is
      going to ask.

---

## 4. The trade mark, and why it can wait

You found `W01615903 - DRIFT`, owned by **Studio Drift Holding B.V.**, an Amsterdam art studio, in
Nice classes 9, 41 and 42. Those are the software, education/culture and software-as-a-service
classes, so it is a real hit rather than a false alarm, and the audit's trigger for escalating was
exactly this.

**What it does not mean.** It is not automatically infringement. Infringement needs a *likelihood of
confusion*, judged on how similar the signs are, how similar the actual goods are, and how
distinctive the earlier mark is. "Drift" is an ordinary dictionary word, which narrows protection
considerably. A kinetic-light-art studio and a free encyclopedia reading app are not obviously
confusable, and their software claim looks ancillary to their artworks rather than a consumer app
business. Registering "Usedrift" at the KvK gave you a **trade name**, which is a real right that
arises from use, but it is not a trade mark and is no defence against one.

**The realistic sequence, if it ever happens, is a letter and not a lawsuit**, years from now, and
what it would cost you is the effort of renaming. That cost grows with how much brand equity you have
built, which is the entire argument for looking early. You have looked early. That was the right
move and it is enough for now.

- [ ] **Free, do it and forget it:** always present the brand as **usedrift.org** in commercial and
      legal contexts, never as a bare "Drift" styled like somebody else's product. A distinguishing
      prefix genuinely helps. This is already how the imprint and terms read.
- [ ] **The €200 to €400 hour with a Benelux trade mark attorney: not now.** The audit recommended it
      and the audit was right for a business. For a hobby project with a handful of users and no
      money in the brand, it is buying certainty you do not yet need. **Revisit if any of these
      happen:** Drift passes a few hundred real users, you spend money on the name (logo design, paid
      promotion, a registration), or you receive a letter. If you do go, bring the register search and
      ask one bounded question: *"I run a free consumer web app called Drift at usedrift.org
      presenting Wikipedia and museum content. Studio Drift Holding B.V. holds DRIFT in classes 9, 41
      and 42 in the Benelux. Do I have freedom to operate under this name?"*

---

## 5. Parked: only if you decide to run ads

Ignore this section entirely unless §2 changed your mind. In order:

- [ ] Get AdSense approval first. Not before roughly 20 October 2026, and re-read
      `docs/adsense-resubmission.md` before reapplying.
- [ ] Move `docs/ads.txt.pending` back to `public/ads.txt`.
- [ ] Upgrade to **Vercel Pro**. An advert makes the site commercial and Hobby does not permit that.
- [ ] Accept the **Google Ads Data Processing Terms** inside the AdSense account.
- [ ] Set up a **Google-certified IAB TCF v2.2 consent platform**. Drift's own consent gate makes you
      lawful under EU privacy law, but Google separately requires a certified platform from its own
      list before it will serve personalised ads in the EEA and UK, and certification is a list you
      are on rather than code anyone can write. Google's own **Privacy & messaging** (Funding
      Choices) is free and configured inside AdSense, so it is the natural choice. Tell me when it is
      on and Drift's gate can be made to read its signal instead of asking twice.
- [ ] **Under-18s.** Google restricts ads personalisation for under-18s and Drift only asks whether
      you are 16 or older, so it cannot tell 16 from 18. Either a second declaration gets added or
      the certified platform handles it. Not built, because it needs an API that cannot be tested
      without an approved account.
- [ ] **Ask an accountant about VAT** before the first advert renders. Advertising revenue is a
      VAT-relevant economic activity, and there is a small-business scheme (KOR) worth asking about.
      Once you have a BTW number, `/legal` needs one line added: it currently publishes no VAT number
      and explains why, which is accurate only while Drift earns nothing.
- [ ] Only then set `NEXT_PUBLIC_ADS_ENABLED=1`. Nothing needs changing in Vercel today: the switch
      is off there, and off is what the code now requires before anything from Google can load.

---

## 6. Only if the Gallery is missing artwork on the live site

Gallery cards lost their pictures in local development. The cause is the museum's image host, which
now sits behind bot management that refuses a browser-shaped request carrying a `localhost` referrer.
Measured five times each way: `localhost` is blocked, `usedrift.org` is allowed. So this should only
ever have affected you locally, and it is fixed there.

- [ ] If you have actually seen missing artwork on <https://www.usedrift.org>, say so. The fix is
      already built: set `ARTIC_IMAGE_PROXY=1` in Vercel and images are served through Drift instead.
      Know the trade first: that moves image bytes onto your Vercel bandwidth, roughly 250 KB per
      artwork viewed and 1 MB per zoom, less whatever the 30 day cache absorbs.

---

## What is done, so you can stop carrying it

Every finding in the audit that could be closed by a commit has been, and each was verified rather
than assumed: 855 unit tests, build and lint clean, and a contrast sweep of 27 views in both themes.

| | |
|---|---|
| **The live breach** | One switch now governs everything Google: the loader script, the ownership meta tag and the consent gate. Verified against a production build carrying your real publisher id with the switch off: ten public pages, zero third-party requests, zero cookies. `/privacy` no longer describes a consent prompt that does not exist. |
| **Attribution** | Every card image now carries its own creator and licence, hyperlinked, with a link to the file's own page, because a photograph on a Wikipedia article is a separate work from the article. Two fail-closed rules mean no picture is ever shown that cannot be credited. The "excerpted and reformatted by Drift" line that the licence separately requires. An attribution block that travels with saved and shared cards. Images removed from the exported trail map. The museum's requested caption completed, and every museum response checked against its own licence field. |
| **The documents** | `/terms` meeting DSA Article 14, with a machine-readable twin at `/terms.md`. A notice-and-action route for reporting illegal content, anonymity included. The Article 11 and 12 contact points. `/privacy` rewritten against the full Article 13 checklist, on a contract basis rather than consent. `/legal`, your imprint. A "Download your data" button. `docs/processing-record.md`, the Article 30 record. |
| **The Gallery** | Filtered for the European copyright term (life plus 70) instead of the museum's American determination. A work by an artist who died after 1955 is refused even where the museum flags it public domain. |
| **The consent gate** | Built and verified in a real browser with ads switched on: nothing from Google before a choice, nothing after a refusal, and Accept and Reject as measured-identical buttons. Plus a never-pre-ticked 16-or-older declaration at sign-up that stores only the boolean. |
| **Hygiene** | A structural guard making it impossible to put a user's data in the shared CDN cache. Deletion proved to cascade against the real database migrations. Politer behaviour toward Wikimedia's servers. |
| **The landing page** | One illustration turned out to be NonCommercial licensed and was replaced. The rest are traced and credited on `/colophon`, with the per-file record in `public/landing/CREDITS.md`. |
