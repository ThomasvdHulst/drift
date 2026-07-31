"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useAuth } from "@/components/AuthProvider";
import {
  CONTACT_TOPICS,
  MESSAGE_MAX,
  NAME_MAX,
  EMAIL_MAX,
  LOCATION_MAX,
  isReportTopic,
  validateFields,
  fillTimeRemaining,
} from "@/lib/contact";

// The contact form (Phase 22). Client-side because it needs the signed-in email,
// the mount timestamp for the fill-time check, and the Turnstile widget.
//
// Turnstile is OPTIONAL: with no site key configured the script never loads and
// nothing about the form changes. The server enforces whichever layers are live,
// so this component never has to be trusted.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Minimal shape of the global the Turnstile script installs.
interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      appearance?: string;
      size?: string;
    },
  ) => string;
  reset: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Status = "idle" | "sending" | "sent";

export function ContactForm() {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<string>(CONTACT_TOPICS[0].id);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // The DSA Article 16 mode. Choosing "Report illegal content" turns this into a
  // notice-and-action form: where the content is, why it is illegal, and a
  // good-faith statement. The extra fields are hidden the rest of the time, so
  // the ordinary path stays a three-field form.
  const report = isReportTopic(topic);

  // When the form was rendered, so the server can reject a submission returned
  // faster than a human could type one. Set in an effect (never during render).
  const startedAtRef = useRef(0);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  // Prefill the address for a signed-in user, but leave it editable: someone may
  // be writing about a different account than the one they're signed in to.
  useEffect(() => {
    const known = user?.email;
    if (!known) return;
    // Deferred off the effect body (React 19 forbids sync setState there), the
    // same pattern the rest of the app uses.
    queueMicrotask(() => setEmail((cur) => cur || known));
  }, [user]);

  // ----- Turnstile (invisible) -----
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string>("");
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!SITE_KEY || !scriptReady || !widgetRef.current) return;
    if (widgetIdRef.current) return; // already rendered
    const api = window.turnstile;
    if (!api) return;
    try {
      widgetIdRef.current = api.render(widgetRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => {
          tokenRef.current = token;
        },
        "error-callback": () => {
          tokenRef.current = "";
        },
        // Tokens last 5 minutes; clear ours so a slow writer re-solves rather
        // than submitting one the server will reject as expired.
        "expired-callback": () => {
          tokenRef.current = "";
          window.turnstile?.reset(widgetIdRef.current ?? undefined);
        },
        appearance: "interaction-only",
      });
    } catch {
      /* widget failed to mount: the server still has the other spam layers */
    }
  }, [scriptReady]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setError(null);

    // Only the field rules run here, so every error a person sees is about
    // something they can actually see and fix. The bot traps are the server's job.
    const local = validateFields({ name, email, topic, message, location, goodFaith });
    if (!local.ok) {
      setError(local.error);
      return;
    }

    setStatus("sending");

    // The server drops submissions returned faster than a human could type one.
    // Rather than risk silently swallowing a real message from a very fast (or
    // autofilled) visitor, wait out whatever is left of that floor. Invisible:
    // it just looks like a beat longer of "Sending…".
    const wait = fillTimeRemaining(startedAtRef.current);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          topic,
          message,
          location,
          goodFaith,
          website,
          startedAt: startedAtRef.current,
          turnstileToken: tokenRef.current,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("idle");
        // A token is single-use, so get a fresh one before any retry.
        tokenRef.current = "";
        window.turnstile?.reset(widgetIdRef.current ?? undefined);
        return;
      }
      setStatus("sent");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-line bg-paper-raised p-8 text-center">
        <h2 className="font-serif text-2xl text-ink">
          {report ? "Report received" : "Message sent"}
        </h2>
        {/* For a report this screen is the first half of DSA Article 16(4), the
            confirmation of receipt, and the promise of 16(5), the outcome and
            the redress that goes with it. Both are stated plainly rather than
            left to the email, which may not arrive and may not be wanted. */}
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
          {report ? (
            email ? (
              <>
                Your report has been received. We sent a confirmation to {email}.
                A person will read it and decide, and you will be told what was
                decided and what you can do if you disagree.
              </>
            ) : (
              <>
                Your report has been received. A person will read it and decide.
                You did not leave an address, so there is no way to tell you the
                outcome, which is the trade for reporting anonymously.
              </>
            )
          ) : (
            <>
              Thank you for writing. We sent a copy to {email} so you have a
              record of it, and a real person will read yours. You can expect a
              reply within a few days.
            </>
          )}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/drift"
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
          >
            Back to drifting
          </Link>
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setLocation("");
              setGoodFaith(false);
              setStatus("idle");
              startedAtRef.current = Date.now();
            }}
            className="rounded-full border border-line px-5 py-2.5 text-sm text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Write another
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {SITE_KEY && (
        <Script
          src={TURNSTILE_SCRIPT}
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
        />
      )}

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-line bg-paper-raised p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Your name (optional)
            <input
              type="text"
              value={name}
              maxLength={NAME_MAX}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>

          <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft">
            {report ? "Your email (optional)" : "Your email"}
            <input
              type="email"
              required={!report}
              value={email}
              maxLength={EMAIL_MAX}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>
        </div>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink-soft">
          What is this about?
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
          >
            {CONTACT_TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {/* DSA Article 16(2)(b): a clear indication of the exact electronic
            location of the content. Free text rather than a URL field, because
            most of what can be reported here has no URL of its own: a handle, a
            display name, or something a friend sent you. */}
        {report && (
          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Where is it?
            <input
              type="text"
              required
              value={location}
              maxLength={LOCATION_MAX}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="A handle, a link, or what you saw and where"
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>
        )}

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink-soft">
          {report ? "Why do you believe it is illegal?" : "Your message"}
          <textarea
            required
            rows={7}
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              report
                ? "Say what the content is and what makes it unlawful, and name the law if you know it."
                : "Tell us what is on your mind."
            }
            className="mt-1 w-full resize-y rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm leading-relaxed text-ink focus-ring"
          />
        </label>
        <p className="mt-1 text-right text-xs text-ink-soft">
          {message.length} / {MESSAGE_MAX}
        </p>

        {/* Article 16(2)(d): the notifier's statement that what they have said
            is accurate and complete. Never pre-ticked, and the form does not
            submit without it. */}
        {report && (
          <>
            <label className="mt-3 flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
              <input
                type="checkbox"
                required
                checked={goodFaith}
                onChange={(e) => setGoodFaith(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)] focus-ring"
              />
              <span>
                I believe in good faith that the information and allegations
                above are accurate and complete.
              </span>
            </label>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              Your name and email are optional here. Without them we cannot
              confirm that your report arrived or tell you what was decided. A
              report about an offence under Articles 3 to 7 of Directive
              2011/93/EU, which covers child sexual abuse material, can always be
              made anonymously. If someone is in immediate danger, contact the
              police first.
            </p>
          </>
        )}

        {/* Honeypot. Hidden from people, catches form-filling bots. Kept out of
            the tab order and announced to nobody. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {/* Turnstile mounts here. In interaction-only appearance it stays
            invisible unless Cloudflare decides a human check is warranted. */}
        <div ref={widgetRef} className="mt-4 empty:mt-0" />

        {error && (
          <p className="mt-4 text-sm text-ink" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="mt-5 w-full rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong disabled:opacity-60"
        >
          {status === "sending"
            ? "Sending…"
            : report
              ? "Send report"
              : "Send message"}
        </button>

        {/* GDPR Article 13 requires the disclosure to be made "at the time when
            personal data are obtained", which for a public form means here, not
            only on a privacy page the sender may never open (compliance audit
            Mi-5). An IP address is personal data (CJEU C-582/14 Breyer), and
            both the throttle and Turnstile process one, so both are named. The
            Cloudflare half is conditional on Turnstile actually being
            configured: describing a check that is not running would be the same
            error the audit found on /privacy. */}
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          We use your email only to reply to you. Nothing here is added to a
          mailing list. To keep spam out, the server counts recent submissions
          from your IP address. That count is held in the memory of a short-lived
          server process, is never written to disk, and goes when the process
          does
          {SITE_KEY
            ? ". Cloudflare Turnstile also checks that you are not a bot, which means Cloudflare receives your IP address too"
            : ""}
          . The basis for both is our legitimate interest in preventing abuse.
          See{" "}
          <Link
            href="/privacy"
            className="text-accent-strong underline-offset-2 hover:underline"
          >
            what Drift stores
          </Link>
          .
        </p>
      </form>
    </>
  );
}
