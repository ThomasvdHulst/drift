# Record of processing activities (GDPR Article 30)

**Controller:** Thomas van der Hulst, trading as Usedrift, Uilenstede 138, 1183 AN Amstelveen,
Netherlands. Registered with the Dutch Chamber of Commerce under number 90992318. Published at
<https://www.usedrift.org/legal>.
**Contact:** `contact@usedrift.org`, and <https://www.usedrift.org/contact>.
**Data protection officer:** none appointed. Drift meets no Article 37(1) condition: it is not a
public authority, monitoring is not a core activity, and it processes no special categories.
**Version:** 1, 31 July 2026. Keep this current when a processing activity, a processor or a
retention period changes.

---

## Why this file exists even though Drift has one employee

**Article 30(5) does not exempt it.** The exemption applies to an organisation with fewer than 250
employees *unless* the processing is likely to result in a risk to rights and freedoms, **is not
occasional**, or involves special categories or criminal conviction data. Those carve-outs are
disjunctive: any one of them defeats the exemption. Drift's processing of accounts, trails,
reactions and interests is continuous business-as-usual, not occasional, so the exemption falls at
the second carve-out and the record is required.

This is the single most commonly missed obligation at this size, precisely because the
"fewer than 250 employees" line gets read on its own (compliance audit Mi-4).

Article 30(3) requires the record in writing, "including in electronic form". A Markdown file in the
repository is writing.

---

## 1. Processing activities

Each row is one purpose. The legal basis, the recipients and the retention are the same ones
published at [/privacy](https://www.usedrift.org/privacy); if the two ever disagree, the published
notice is the one people relied on and this file is the one that is wrong.

| # | Purpose | Data subjects | Categories of personal data | Legal basis | Recipients | Retention |
|---|---|---|---|---|---|---|
| 1 | **Accounts and authentication.** Let a person sign in and keep their data theirs. | Registered users | Email address, password hash, user id, sign-in timestamps | Art 6(1)(b) contract (the Terms) | Supabase (database + auth), Vercel (hosting) | Until the user deletes the account. Deletion of the `auth.users` row cascades to every app table. |
| 2 | **The reading service.** Store saved trails, the cards in them, reactions, derived interest weightings and settings, and sync them between a user's devices. | Registered users | Trail names and step payloads, card ids and reactions, topic weightings, UI settings, list of seen page titles, per-session counts | Art 6(1)(b) contract | Supabase, Vercel | Until the user deletes the item or the account. |
| 3 | **Handles, friends and sharing.** Let a user be findable by handle and send a trail or card to a mutual friend. | Registered users who set a handle | Handle, display name, friend request rows, share payload and note | Art 6(1)(b) contract | Supabase, Vercel | A share until either party deletes it or either account is deleted. Friend rows until removed or an account is deleted. |
| 4 | **Transactional email.** Confirm an address, reset a password, welcome, and confirm deletion. | Registered users | Email address, message content | Art 6(1)(b) contract. Transactional, not marketing, so Art 11.7 Tw opt-in does not bite. There is no mailing list. | Resend (Plus Five Five, Inc.) | Address held per row 1. Resend's own delivery logs under its retention. |
| 5 | **Answering the contact form.** | Anyone who writes in, signed in or not | Name (optional), email address, topic, message body | Art 6(1)(b) where the message concerns the writer's use of the service; otherwise Art 6(1)(f), the legitimate interest in replying to correspondence | Resend (delivery), Cloudflare (email routing to the operator's mailbox) | 12 months in the operator's mailbox, then deleted. |
| 6 | **Abuse prevention on the contact form.** | Anyone who submits the form | IP address, submission timing; where Turnstile is configured, IP plus browser signals | Art 6(1)(f). Interest: keeping a public form usable and not paying to deliver spam. Necessity: a public form with no checks becomes a relay within days; the honeypot and fill-time checks process no personal data, so the IP counter is the least that works. Balancing: the data is a counter in volatile memory, is never combined with anything, and never reaches a profile. | Cloudflare (Turnstile only, when configured) | Throttle entries live in the memory of an ephemeral serverless instance, are never written to disk, and are lost when the instance ends. Cloudflare's own retention for Turnstile applies to its copy. |
| 7 | **Handling reports of illegal content** (DSA Article 16). | Notifiers, and the users a notice concerns | Notifier's name and email where given (a notice may be anonymous), the location reported, the explanation, the good-faith statement | Art 6(1)(c), compliance with the legal obligation in DSA Articles 16 to 18 | Resend (delivery of the acknowledgement and the work item), Cloudflare (email routing). Law enforcement or Europol where DSA Art 18 applies. | With the contact correspondence at row 5, unless a longer period is needed to evidence the decision. |
| 8 | **Advertising.** | Visitors | Whatever Google's advertising services collect | Art 6(1)(a) consent, and nothing else | Google | **Not active.** No advertising runs and no advertising script loads. This row exists so that turning it on is a change to a record rather than the discovery of a gap. |

---

## 2. Processors and international transfers

Article 30(1)(d) wants recipients including those in third countries, and 30(1)(e) wants transfers
outside the EEA identified with the safeguard relied on.

| Processor | Role | Establishment | Transfer basis |
|---|---|---|---|
| Vercel Inc. | Hosting, serverless functions, CDN | United States | DPF adequacy where certified, otherwise SCCs in Vercel's DPA |
| Supabase Inc. | Postgres database, authentication | United States | DPF adequacy where certified, otherwise SCCs in Supabase's DPA |
| Plus Five Five, Inc. (Resend) | Transactional email delivery | United States | DPF adequacy where certified, otherwise SCCs in Resend's DPA |
| Cloudflare, Inc. | Turnstile (when configured), email routing | United States | DPF adequacy where certified, otherwise SCCs in Cloudflare's standard terms |
| Google | Advertising (not active); identity provider only where `NEXT_PUBLIC_OAUTH_PROVIDERS` is set | Ireland / United States | Ads Data Processing Terms; DPF adequacy where certified |

The adequacy decision relied on is the European Commission's decision of **10 July 2023** on the
EU-US Data Privacy Framework. It remains valid: the General Court dismissed the challenge in
*Latombe v Commission* (T-553/23) on 3 September 2025, with an appeal pending as C-703/25 P. It is
the third such framework and its two predecessors were both struck down, so a fallback to SCCs
should be assumed to be needed one day.

### Article 28(3) processor agreements

Checked 31 July 2026 against each provider's published DPA. **Most are already in force and were
never a task**, which the earlier version of this file got wrong.

| Processor | Article 28(3) contract | Basis |
|---|---|---|
| Vercel | ✅ In force | Pre-signed addendum: "shall become legally binding upon Customer entering into the Agreement". The SCCs inside it are signed by deeming: "Data Exporter is deemed to have signed these Standard Contractual Clauses". |
| Resend | ✅ In force | Same construction, same wording, binding on acceptance of the Terms of Service. |
| Supabase | ⚠️ To confirm | A DPA is published and surfaced under Organisation → Legal Documents. Whether the account has it incorporated or awaiting an action has not been checked. |
| Cloudflare | ❌ Not in force | Cloudflare's DPA is **not** automatic: it takes effect "from the date on which Customer signed or the parties otherwise agreed to this DPA". Only needed if Turnstile is enabled, which it is not. |
| Google | ❌ Not in force | The Ads Data Processing Terms are accepted inside the AdSense account. **[BEFORE ADS]** |

### ⚠️ Still open

- **The hosting regions are unknown.** If the Supabase project sits in a US region, row 1 to 3 data
  is transferred rather than merely accessible, and a project's region cannot be changed in place.
  `docs/owner-actions.md` item 2.
- **DPF certification has not been checked per provider** at <https://www.dataprivacyframework.gov/list>.
  Until it is, treat the "Transfer basis" column above as the position that *will* apply, not the
  position that has been evidenced. Write the date checked in here.
- **VAT.** No VAT identification number is published, on the basis that Drift carries on no
  VAT-liable activity. That changes when advertising runs.

---

## 3. Technical and organisational measures (Article 32)

A general description, which is what Article 30(1)(g) asks for.

- **Access control is enforced by the database, not the application.** Every user table carries
  Row-Level Security with `user_id = auth.uid()`. A bug in the client cannot read another user's
  rows, because the policy is evaluated in Postgres. `npm run verify:supabase` checks it.
- **Sharing is restricted in the same place.** The `shares` insert policy calls `are_friends()`, so
  content cannot reach a non-friend even if the interface were wrong. `npm run verify:social`
  checks it. This is also what keeps Drift outside the DSA definition of an online platform.
- **The service-role key is server-only**, used by exactly one route (`/api/account/delete`), which
  verifies the caller's own JWT before acting so a user can only delete themselves. It never carries
  a `NEXT_PUBLIC_` prefix.
- **Transport is TLS throughout**, terminated by Vercel and by Supabase.
- **Passwords are never held in readable form**; Supabase stores a hash.
- **No analytics, no tracking pixels, no third-party analytics script, and no first-party HTTP
  cookies.** There is correspondingly little to leak.
- **Cached API responses carry no user data.** Routes with a shared-CDN `s-maxage` proxy Wikipedia
  and museum content only and never read the session.
- **Local-first storage.** A session lives in the browser's IndexedDB; the cloud is a sync layer.
  Signing out clears the device.
- **Deletion is a hard delete with cascades**, not a flag, so erasure under Article 17 removes rows
  rather than hiding them.

**Known gap:** whether deletion propagates everywhere has not been fully verified. Three places to
check are shares already delivered to a recipient, any CDN cache, and Resend's message logs (audit
BP-4). Write the answer here when it is known.

---

## 4. Breach procedure (Articles 33 and 34)

There is no team to escalate to, so the procedure is short and worth having written down before it
is needed.

1. Contain: revoke the affected key or take the deployment down. Both are single actions.
2. Write down what happened, when it was discovered, which categories of data and roughly how many
   people are affected, and the likely consequences.
3. If a risk to rights and freedoms is likely, notify the **Autoriteit Persoonsgegevens within 72
   hours** of becoming aware, at <https://autoriteitpersoonsgegevens.nl>. Late is still better than
   not, with reasons for the delay.
4. If the risk is high, tell the affected users directly, in plain language.
5. Record it here whether or not it was notifiable. Article 33(5) requires a record of every breach.

---

## 5. Review

Review this record when any of the following happens, and at least once a year:

- a new processor is added, or one is dropped;
- advertising is enabled (row 8 becomes live, and a consent record under Article 7(1) starts);
- the hosting regions change;
- a new category of personal data is collected;
- the operator stops being a sole individual.
