# Drift auth email templates (paste into Supabase)

These are generated from `src/lib/email/messages.ts` (the same renderer used for the
welcome / goodbye emails), so all four emails share one look. Do not hand-edit; change
the copy in `messages.ts` and regenerate.

## How to install
Supabase Dashboard -> Authentication -> Emails -> Templates. For each template below,
set the Subject and paste the HTML into the message body, then Save.

| Template | Subject | File |
|---|---|---|
| Confirm signup | Confirm your email for Drift | confirm-signup.html |
| Reset password | Reset your Drift password | reset-password.html |

## The link, and why it is not `{{ .ConfirmationURL }}`

Both buttons point at:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=signup   (or type=recovery)
```

**Do not change this back to `{{ .ConfirmationURL }}`.** That variable routes the
reader through Supabase's `/verify`, which bounces back to the app carrying a PKCE
`?code=`. Exchanging that code needs a `code_verifier` held in the localStorage of the
browser that *started* the sign-up, so the link only worked in that one browser
profile. Anyone who signed up on a laptop and opened the email on their phone, or used
a private tab, or tapped the link inside a mail app's in-app browser, landed on the
homepage **silently signed out**. That was a real bug, reported 2026-07-27.

`{{ .TokenHash }}` carries a token that Drift's `/auth/confirm` page redeems with
`verifyOtp`, which needs nothing from local storage and therefore works in whichever
browser actually opened the email.

Make sure the Auth **Site URL** is your production origin (`https://www.usedrift.org`),
because `{{ .SiteURL }}` is what these links are built from.

`src/lib/email/templates.test.ts` asserts these files still match `messages.ts` and
still use the token_hash link, so neither can rot unnoticed.
