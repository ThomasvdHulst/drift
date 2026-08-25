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

**Refunds are self-service.** A reader who changes their mind inside fourteen days presses a button
on their account page and Stripe returns the money immediately. You are not in the loop and there is
nothing in your inbox to action. §4 covers the cases that do still reach you.

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
> hand (§4b) or ask me to re-run the sweep with a later cut-off.

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

### 3.3 Switch on Stripe Tax  ⚠️ this one is not optional

**Settings → Tax.** Three separate things, and the third is the one that actually bites:

1. **Activate Stripe Tax.**
2. **Set the head office address** to the one on `/legal` (Uilenstede 138, 1183 AN Amstelveen, NL).
   Registrations cannot be added until this is complete: Stripe answers "you must set your head
   office address" and nothing else works.
3. **Add the Netherlands registration** (Registrations → Add registration → Netherlands).

> ### ⚠️ THE REGISTRATION IS MANDATORY *BECAUSE* MANAGED PAYMENTS IS OFF
>
> These two settings are coupled, and the coupling is invisible until it bites.
>
> With **Managed Payments on**, Stripe is the merchant of record for tax. Sessions come back with
> `automatic_tax.liability: { type: "stripe" }` and Stripe works the VAT out against *its own*
> registrations, so a €7.00 sale to a Dutch buyer records €1.21 whether or not you have registered
> anything. That is why tax worked before §3.4's fix.
>
> Turning Managed Payments **off** to get iDEAL back moves liability to
> `{ type: "self" }`. The VAT is now computed against **your** registrations, and with none it is
> €0.00 for everybody, silently, on a `status: "complete"` session that looks perfectly healthy.
>
> Two real payments an hour apart proved it: identical price, tax behaviour, product tax code,
> currency and Dutch billing address, differing in exactly one field, `liability`. The one with
> `stripe` recorded 121 cents of tax; the one with `self` recorded 0.
>
> **So: iDEAL and your own tax registration come as a pair.** Keeping Managed Payments off is still
> the right call, since you need the NL registration for your own BTW return regardless. But it has
> to exist in whichever mode you are taking money in.
>
> ### And all three are per mode
>
> Test mode and live mode do not share tax settings or registrations, so doing this in one does
> nothing for the other. "Your tax information is verified" on the account status page is about your
> business details; it is not a registration and it does not make Stripe calculate anything.
>
> Check from the API rather than by eye, in whichever mode you care about:
> `tax.settings.retrieve()` should return a complete head office address, and
> `tax.registrations.list()` should return one row for NL.

It costs about 0.5% per transaction, roughly 3.5 cents on €7. It works out the right VAT per
country, which is what stops a buyer outside the EU being charged Dutch VAT they do not owe, and it
produces the figures for your quarterly BTW return.

> **Why this is the dangerous step.** With no registration, Stripe Tax calculates **zero tax on
> every sale**, silently. Checkout shows "Belasting € 0,00", `amount_tax` comes back 0, and nothing
> errors. But a €7.00 sale to a Dutch consumer still contains €1.21 of BTW that you owe the
> Belastingdienst, so you would be paying it out of the €7 without knowing.
>
> Two things now guard against it. The receipt refuses to write "BTW none (supplied outside the
> EU)" for a buyer inside the EU, because that would be a wrong tax document; it says "not
> itemised" instead. And the server log shouts `NO TAX on session …` every time it happens. If you
> see that line, come back here.

**What correct looks like.** With a Dutch buyer, the checkout summary reads `Btw € 1,21` under a
`Subtotaal € 7,00`, with `Totaal verschuldigd bedrag € 7,00`: the tax is inside the price, not added
to it. The session's `automatic_tax.status` is `complete` and `total_details.amount_tax` is `121`. A
buyer outside the EU correctly gets 0.

If `automatic_tax.status` comes back **`requires_location_inputs`**, Stripe simply does not know
where the buyer is yet; that resolves itself once they enter a billing address. If the tax stays at
zero **after** an address is entered, it is the registration, not the address.

### 3.4 Turn on iDEAL

**Settings → Payment methods.** Enable **iDEAL | Wero** and **Cards**. Nothing in the code pins the
list, so adding another later is a settings change rather than a deploy.

> ⚠️ **If iDEAL is enabled and still does not appear at checkout, it is not your settings.** Stripe
> switches **Managed Payments** on by default for new accounts and lets it choose which methods to
> show. On this account it chose card and Bancontact and dropped iDEAL, the single most used payment
> method in the Netherlands, while the account capabilities and the payment method configuration
> both had iDEAL on.
>
> The checkout route therefore sends `managed_payments: { enabled: false }` on every session, which
> falls back to your dashboard configuration and brings iDEAL back. It is set per request rather
> than as an account toggle so a dashboard click cannot undo it.
>
> ⚠️ **That line also moves the VAT liability onto you**, which makes the tax registration in §3.3
> mandatory rather than merely correct. The two settings are coupled; §3.3 explains it. If you ever
> decide you would rather have Stripe carry the tax and lose iDEAL, deleting that one line in
> `src/app/api/billing/checkout/route.ts` is the whole change.

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
7. **Refund it, as the reader would.** On `/account`, press "Get a refund", then "Yes, refund it".
   The money goes back through Stripe immediately, the unlock disappears, the limit returns, and a
   confirmation email arrives. Check the payment shows as refunded in the Stripe dashboard.
8. **Then refund one from the dashboard too** (buy again, then dashboard → the payment → Refund).
   Within a few seconds the unlock should be gone. That is the `charge.refunded` webhook, and it is
   the path you will use for anything outside the fourteen days.

Only when all eight pass, switch the dashboard to live mode, redo §3.2 and §3.5 there (test-mode
objects do not carry over), and swap the three variables.

### 3.8 Vercel Pro

The day checkout goes live on the real site you need **Vercel Pro**, about €220 a year. Hobby is
licensed for non-commercial use and a billing integration is explicitly outside it. This is not a
grey area and it is not optional. Break-even is roughly 40 buyers a year.

---

## 4. What still reaches you, and what to do with it

Almost nothing. A reader inside the fourteen days refunds themselves. Three cases still land in your
inbox through `/contact`, and all three are handled the same way:

| What they write | What you do |
|---|---|
| "I want a refund" and they are **past fourteen days** | Your call: there is no obligation. If you say yes, refund it in the Stripe dashboard (the payment → Refund) and the webhook removes the unlock within seconds. |
| A refund that could not be issued automatically (rare: the entitlement has no payment reference) | Same. Find the payment by their email address in Stripe, refund it, done. |
| "I paid and nothing happened" | Check `entitlements` for their user id. If the payment is in Stripe but the row is not there, the webhook missed it: grant it by hand below, and check **Developers → Webhooks** for a failed delivery. |

**You never need to reply to a refund request to make it happen.** Refunding in the dashboard is the
whole action; the webhook does the rest.

## 4b. Granting the unlock by hand

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
| The refund button is not offered | Check why in `entitlements`: a `beta` or `manual` grant has nothing to refund, a row with no `stripe_payment_intent` cannot be refunded automatically, and past fourteen days it points at `/contact` instead. Each case says which it is on the page. |
| A refund succeeded but the unlock stayed | The route revokes directly and does not wait for the webhook, so this should not happen. If it does, the server log has `refunded but could not revoke` and the fix is one `update` (see 4b). |
| A reader refunded and wants to buy again | They can, straight away. The webhook and the withdraw route both leave `revoked_at` set, and a new purchase clears it. |
| No `Btw` line at all when the page first opens | Normal. Stripe does not know where the buyer is yet (`automatic_tax.status: requires_location_inputs`). It appears as soon as a country is chosen. |
| `Btw € 0,00` **after** a country is chosen | That mode has no tax registration, and because Managed Payments is off the liability is yours. §3.3. Fix it before taking real money; you owe that BTW either way. |
| Tax worked, then stopped, with no code change in between | Check `automatic_tax.liability` on the two sessions. `stripe` means Managed Payments was carrying it; `self` means it is yours and needs your registration. |
| Stripe says "you must set your head office address" | The head office address is incomplete **in that mode**. Set it, then add the registration. §3.3. |
| `NO TAX on session …` in the server log | Same cause. It means a real payment came through with no tax itemised on it. |
| iDEAL is enabled but not offered | Managed Payments is overriding it. The route already disables that per request (§3.4); if it comes back, check that line survived. |

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

### 6.2 Activate Stripe Tax and add the Netherlands registration  ⚠️

§3.3. This is the one step in the whole file with a cost attached to forgetting it: with no
registration, every sale records zero BTW while you still owe it. Checkout currently shows
"Belasting € 0,00", which is how it was spotted.

### 6.3 Finish the rest of the Stripe setup

§3 above, top to bottom, ending with the eight-step test-mode run. Nothing takes real money until
you switch to live keys.

### 6.4 Upgrade to Vercel Pro

§3.8. The day checkout goes live on the real site, Hobby is no longer licensed for it.

---

## 7. Decisions already taken, so they are not re-litigated

- **No DSA Article 14(2) notice was sent for the terms change** (25 August 2026), even though
  `/terms` promises that a significant change is emailed to every account before it takes effect.
  The owner's reasoning, recorded here rather than left implicit: every account existing at that
  point was a test account belonging to the owner or to someone who knew the project, so there was
  nobody to notify. **This does not carry forward.** From the first real user onward, a change of
  this size does need the email, and the promise in `/terms` is what makes that binding.
- **Withdrawal is automatic, not a request.** The obligation since 19 June 2026 is a withdrawal
  *function*, continuously available. A form that emails the owner to go and press Refund satisfies
  the letter of that and misses the point, because the reader's money then waits on somebody reading
  an inbox. The button issues the refund. It is safe to automate because it is so narrow: only the
  caller's own purchase, in full, once, inside fourteen days, and only when there is a Stripe
  payment to refund against.
- **The 14 day withdrawal right is honoured, not excluded.** Most sellers of digital goods exclude
  it with a consent box at checkout. Doing that properly needs an express consent plus a separate
  acknowledgement, gathered as two deliberate acts, and getting it subtly wrong turns a 14 day
  window into a 12 month one. At €7 the occasional refund is cheaper than the mechanism, and it
  reads better.
- **Supporters stop being counted** once a limit is configured. With a limit live their daily count
  serves no purpose, and a per-day record of how much somebody read is behavioural data (Art
  5(1)(c)). During the measure-first period everyone is counted, which is the point of it.
