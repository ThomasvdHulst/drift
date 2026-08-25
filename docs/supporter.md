# The supporter unlock — what you have to do by hand

Phase 32. Free readers get a daily reading allowance; a one-time **€7** purchase lifts it.
This file is the walkthrough for the human half. Follow it top to bottom.

> **Status: everything on the code side is built and verified (M1 to M5).**
> What is left is in §6: three things only you can do, and none of them takes long.

---

## 0. What exists, in one paragraph

Reading a card records a "stop" against your account for the day. The count lives in Supabase
and is written by a database function that can only ever add one, so nobody can edit their own
counter from the browser console. When the allowance runs out the session ends into the trail
map (the reward belongs at the exit), and opening the feed on a spent day shows a calm closing
page instead. **It fails open**: if the database is unreachable, nobody is ever stopped.

Two things are worth knowing before you start.

- **It is a soft meter.** It stops the easy bypass, not a determined person who blocks one
  request. For a few dozen readers that is the right trade, and it is written down rather than
  pretended away.
- **The day is Amsterdam midnight**, computed on the server. Not UTC (which rolls over at 01:00
  or 02:00 local, in the middle of an evening's reading) and not the device clock (which anyone
  can move).

---

## 1. Run the migration (5 minutes, once)

This is the only step that touches your database, and nothing counts until it is done.

1. Open **Supabase Studio → SQL Editor → New query**.
2. Paste the whole of `supabase/migrations/0005_phase32_supporter.sql` and press **Run**.
3. You should see `Success. No rows returned`.

It creates two tables (`entitlements`, `usage_daily`) and two functions (`record_stop`,
`supporter_status`), all with Row-Level Security.

> ### ⚠️ Run this at the point you actually go live, not before
>
> The file ends with a one-off sweep that grants the unlock, permanently and free, to **every
> account that exists at the moment it runs**. That is the grandfathering: the people who tested
> Drift back when it cost nothing were never going to be the revenue.
>
> The sweep is guarded so it can only ever happen once — re-running the file later does nothing,
> which is what stops it silently handing the unlock to everyone who signed up since. The
> practical consequence is that if you run it now, on a Tuesday, and go live in three weeks,
> everyone who joined in between is a paying reader. If that is not what you want, grant them by
> hand (§4) or ask me to re-run the sweep with a later cut-off.

**Check it landed.** In the SQL editor:

```sql
select count(*) from public.entitlements;   -- one row per account that existed
select * from public.entitlements limit 5;  -- source should read 'beta'
```

---

## 2. Choose the allowance (later, and on purpose)

The limit is one environment variable, `NEXT_PUBLIC_FREE_DAILY_STOPS`.

**Leave it unset for now.** Unset means *count but never stop*: every stop is recorded, nobody
is ever blocked. Give it a week or two, then look at what an ordinary day actually is:

```sql
-- your own busiest days
select day, stops from public.usage_daily
where user_id = '<your-user-id>' order by day desc limit 14;

-- everyone, so you are not choosing a number from a sample of one
select day, count(*) as readers, round(avg(stops)) as avg_stops, max(stops) as busiest
from public.usage_daily group by day order by day desc limit 14;
```

Then set it. Local (`.env.local`) and on Vercel (**Project → Settings → Environment Variables**,
then redeploy):

```
NEXT_PUBLIC_FREE_DAILY_STOPS=50
```

Two things to keep in mind when picking the number:

- **Keep it comfortably above 25.** The gentle "want to see your trail?" nudge sits at 25 stops.
  A limit near it would collide with the nudge and, worse, would read as engineered to sell.
- **Anything unusable falls back to no limit.** `0`, a negative, a typo: all mean "no limit"
  rather than "limit of nothing", so a mistake here can never lock everybody out.

To test the behaviour without waiting, run the dev server with a tiny value:

```bash
NEXT_PUBLIC_FREE_DAILY_STOPS=3 npm run dev
```

You should get exactly three cards, a quiet "N left today" next to the stop counter for the last
stretch, and then the trail map with "That is a day's wandering" over it.

---

## 3. Stripe

Work in **test mode** the whole way through this section. There is a toggle at the top right of the
Stripe dashboard; leave it on "Test mode" until §3.7 says otherwise. Test keys start `sk_test_`.

### 3.1 Create the account

<https://dashboard.stripe.com/register>. Sign up as a **sole proprietor / eenmanszaak** in the
Netherlands, using the details already on `/legal`, and give **KVK 90992318** when asked. The name
you register must match what the site says, or activation stalls.

You can build and test everything below before Stripe has finished activating the account. Only
taking real money waits for activation.

### 3.2 Create the €7 product

**Product catalogue → Add product.**

| Field | Value |
|---|---|
| Name | `Drift supporter unlock` |
| Description | `One-time unlock. Removes the daily reading limit on your Drift account.` |
| Pricing model | **One off** (not recurring, and this cannot be changed later) |
| Price | **7.00 EUR** |
| Tax behaviour | **Inclusive** |
| Tax code | Digital services / electronically supplied services |

Copy the **price id** (`price_…`, not the product id). That is `STRIPE_PRICE_ID`.

> ⚠️ **The price lives in two places.** Stripe decides what is charged; `PRICE_CENTS` in
> `src/lib/billing/price.ts` decides what the page and the receipt SAY. They must agree. If you
> ever change the price, change both, or the receipt becomes a wrong tax document. The webhook logs
> a loud warning when a payment does not match, which is how you find out you forgot.

### 3.3 Switch on Stripe Tax

**Settings → Tax.** Add your Dutch registration and set the origin address to the one on `/legal`.

This costs about 0.5% per transaction, roughly 3.5 cents on €7, and it is worth every cent: it works
out the right VAT per country automatically, which is what stops a buyer outside the EU being
charged Dutch VAT they do not owe. It also produces the figures for your quarterly BTW return.

### 3.4 Turn on iDEAL

**Settings → Payment methods.** Enable **iDEAL** and **Cards**. Nothing in the code pins the payment
methods, so this is a settings change rather than a deploy. iDEAL only appears for buyers in the
Netherlands paying in euros, which is most of yours.

### 3.5 The webhook

**Developers → Webhooks → Add endpoint.**

- URL: `https://www.usedrift.org/api/billing/webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`

Copy the **signing secret** (`whsec_…`). That is `STRIPE_WEBHOOK_SECRET`.

This endpoint is the only thing that grants the unlock, and its signature check is the whole
security boundary, which is why it refuses to process anything at all when the secret is missing.

For local testing, `stripe listen --forward-to localhost:3000/api/billing/webhook` gives you a
different `whsec_` to use in `.env.local`.

### 3.6 Set the variables

Three, all server-only, none with a `NEXT_PUBLIC_` prefix:

```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

Locally in `.env.local`; in production under **Vercel → Project → Settings → Environment
Variables**, then redeploy. Swap all three together when you move to live keys: a live key with a
test webhook secret fails in a way that looks exactly like a signature bug.

### 3.7 Run a purchase before a real euro moves

Still in test mode:

1. Sign in with an account that does **not** hold the unlock (a brand-new one; everybody who existed
   when you ran §1 was grandfathered).
2. Go to `/supporter` and press the button. You should land on Stripe's own page, in euros, with
   iDEAL offered.
3. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC. For iDEAL, pick any test
   bank and choose "Authorize test payment".
4. You should return to `/account`, and within a few seconds it should say you hold the unlock.
5. Check the receipt email arrived and reads correctly: the total, the BTW inside it, your KVK
   number, and the fourteen day withdrawal line.
6. Confirm the meter is gone: with `NEXT_PUBLIC_FREE_DAILY_STOPS=3`, read past three cards.
7. **Refund it** (dashboard → the payment → Refund). Within a few seconds the unlock should be gone
   and the limit back. That is the withdrawal path working.

Only when all seven pass, switch the dashboard to live mode, redo §3.2 and §3.5 there (test-mode
objects do not carry over), and swap the three variables.

### 3.8 Vercel Pro

The day checkout goes live on the real site you need **Vercel Pro**, about €220 a year. Hobby is
licensed for non-commercial use and a billing integration is explicitly outside it. This is not a
grey area and it is not optional. Break-even is roughly 40 buyers a year.

---

## 4. Granting the unlock by hand

For a payment that goes strange, or someone you want to give it to. In the SQL editor:

```sql
-- find them
select id, email from auth.users where email = 'someone@example.com';

-- grant
insert into public.entitlements (user_id, kind, source)
values ('<their-user-id>', 'supporter', 'manual')
on conflict (user_id) do update set revoked_at = null;

-- take it back
update public.entitlements set revoked_at = now() where user_id = '<their-user-id>';
```

`source` is worth setting honestly: `purchase` rows have Stripe references to refund against,
`beta` was the launch gift, `manual` is you fixing something.

---

## 5. If something looks wrong

| What you see | What it means |
|---|---|
| Nobody is ever stopped | `NEXT_PUBLIC_FREE_DAILY_STOPS` unset (the default), or the migration has not been run. Both are fail-open by design. |
| `usage_daily` stays empty | The migration has not been run, or the reader is signed out. Check the browser console for a 404 on `record_stop`. |
| A supporter got stopped | Should be impossible; `supporter_status` decides it. Check `select * from entitlements where user_id = …` and that `revoked_at` is null. |
| The count looks low for a heavy reader | Supporters stop being counted once a limit is configured, on purpose: with a limit live their count serves no purpose and it is behavioural data we should not collect for nothing. |
| Old rows piling up | They do not. `record_stop` prunes each reader's rows past 30 days on their first stop of a new day. |

---

## 6. What is left, and it is all yours

Three things, in the order they matter.

### 6.1 Publish your btw-id  ⚠️ before the first real payment

`/legal` has to carry it once you are charging VAT (art. 3:15d(1)(f) BW). It is a config value, not
a code change, because this repository is public and the number is a real identifier:

```
NEXT_PUBLIC_VAT_ID=NL123456789B01
```

Set it in `.env.local` and in Vercel, then redeploy. The line appears on `/legal` and in every
receipt automatically. **Nothing will fail if you forget**, which is exactly why it is first here:
unset simply omits the line, and no test can tell the difference between "not selling yet" and
"selling and not saying so".

### 6.2 Do the Stripe setup

§3 above, top to bottom, ending with the seven-step test-mode run. Nothing takes real money until
you switch to live keys.

### 6.3 Upgrade to Vercel Pro

§3.8. The day checkout goes live on the real site, Hobby is no longer licensed for it.

---

## 7. Decisions already taken, so they are not re-litigated

- **No DSA Article 14(2) notice was sent for the terms change** (25 August 2026), even though
  `/terms` promises that a significant change is emailed to every account before it takes effect.
  The owner's reasoning, recorded here rather than left implicit: every account existing at that
  point was a test account belonging to the owner or to someone who knew the project, so there was
  nobody to notify. **This does not carry forward.** From the first real user onward, a change of
  this size does need the email, and the promise in `/terms` is what makes that binding.
- **The 14 day withdrawal right is honoured, not excluded.** Most sellers of digital goods exclude
  it with a consent box at checkout. Doing that properly needs an express consent plus a separate
  acknowledgement, gathered as two deliberate acts, and getting it subtly wrong turns a 14 day
  window into a 12 month one. At €7 the occasional refund is cheaper than the mechanism, and it
  reads better.
- **Supporters stop being counted** once a limit is configured. With a limit live their daily count
  serves no purpose, and a per-day record of how much somebody read is behavioural data (Art
  5(1)(c)). During the measure-first period everyone is counted, which is the point of it.
