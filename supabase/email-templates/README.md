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

Both use Supabase's `{{ .ConfirmationURL }}` variable, so the confirm / reset links
are filled in automatically at send time. Make sure the Auth "Site URL" is set to your
production origin (https://www.usedrift.org) so those links point at the live app.
