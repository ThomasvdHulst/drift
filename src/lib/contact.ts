// Pure validation + normalization for the contact form (Phase 22). No React/DOM
// and no network, so the rules that decide what reaches the inbox are unit-tested
// in one place and shared by the client (instant feedback) and the API route (the
// real gate). The client copy of these checks is a convenience only: the route
// re-runs every one of them, because anything the browser asserts can be forged.

/** What the user picked as the subject of their message. Kept as a small closed
 *  set so the notification subject line is scannable in an inbox. */
export const CONTACT_TOPICS = [
  { id: "feedback", label: "Feedback" },
  { id: "bug", label: "Something is broken" },
  { id: "idea", label: "An idea" },
  { id: "account", label: "Help with my account" },
  { id: "other", label: "Something else" },
] as const;

export type ContactTopicId = (typeof CONTACT_TOPICS)[number]["id"];

export function topicLabel(id: string): string {
  return CONTACT_TOPICS.find((t) => t.id === id)?.label ?? "Message";
}

export const MESSAGE_MAX = 4000;
export const MESSAGE_MIN = 10;
export const NAME_MAX = 80;
export const EMAIL_MAX = 254; // RFC 5321 practical maximum

// A form a human filled in takes longer than this. Anything faster is a script
// that posted the moment the page loaded. Deliberately forgiving: a fast typist
// pasting a prepared message still clears it comfortably.
export const MIN_FILL_MS = 3000;

// Deliberately permissive: the goal is to catch typos and obvious junk, not to
// adjudicate RFC 5322. The address only has to be good enough to reply to, and
// an over-strict pattern rejecting a real address is the worse failure.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export interface ContactInput {
  name?: string;
  email?: string;
  topic?: string;
  message?: string;
  /** Honeypot: a field hidden from humans, so any value means a bot filled it. */
  website?: string;
  /** Client clock at form mount, used for the fill-time check. */
  startedAt?: number;
}

export interface ContactValid {
  ok: true;
  value: {
    name: string;
    email: string;
    topic: ContactTopicId;
    topicLabel: string;
    message: string;
  };
}

export interface ContactInvalid {
  ok: false;
  /** Which field to point the user at, or null for a silent bot rejection. */
  field: "name" | "email" | "message" | null;
  error: string;
  /** True when the submission looks automated. The caller should answer with a
   *  normal-looking success so a bot learns nothing about why it failed. */
  bot?: boolean;
}

export type ContactResult = ContactValid | ContactInvalid;

/**
 * How much longer this form must stay open before the fill-time floor is met,
 * or 0 if it already is. The CLIENT uses this to wait out the remainder instead
 * of erroring, so the check stays invisible to a person and can never silently
 * swallow a real message. A missing or nonsense timestamp means "no wait".
 */
export function fillTimeRemaining(
  startedAt: number | undefined,
  now: number = Date.now(),
): number {
  const t = Number(startedAt);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, MIN_FILL_MS - (now - t));
}

/**
 * Validate only the fields a person actually filled in. This is the half the
 * client runs, so its errors are always about something the user can see and fix.
 * The bot traps live in validateContact and are the server's business.
 */
export function validateFields(input: ContactInput): ContactResult {
  const name = (input.name ?? "").trim().slice(0, NAME_MAX);
  const email = (input.email ?? "").trim().toLowerCase();
  const message = (input.message ?? "").trim();

  if (!email) {
    return { ok: false, field: "email", error: "Please add your email so we can reply." };
  }
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    return { ok: false, field: "email", error: "That email address doesn't look right." };
  }
  if (!message) {
    return { ok: false, field: "message", error: "Please write a message." };
  }
  if (message.length < MESSAGE_MIN) {
    return {
      ok: false,
      field: "message",
      error: "Could you say a little more? A sentence or two helps.",
    };
  }
  if (message.length > MESSAGE_MAX) {
    return {
      ok: false,
      field: "message",
      error: `That message is a bit long. Please keep it under ${MESSAGE_MAX} characters.`,
    };
  }

  const topic = (CONTACT_TOPICS.find((t) => t.id === input.topic)?.id ??
    "feedback") as ContactTopicId;

  return {
    ok: true,
    value: { name, email, topic, topicLabel: topicLabel(topic), message },
  };
}

/**
 * The full server-side gate: bot traps first, then the field rules.
 *
 * Order matters. A bot that also sends a malformed address must get the silent
 * rejection, never a helpful message telling it what to fix.
 *
 * `now` is injected so the fill-time check is deterministic in tests.
 */
export function validateContact(
  input: ContactInput,
  now: number = Date.now(),
): ContactResult {
  // The honeypot is hidden from humans; anything in it is automated.
  if ((input.website ?? "").trim() !== "") {
    return { ok: false, field: null, error: "rejected", bot: true };
  }
  // Returned faster than a person could type it. A missing or garbled timestamp
  // is treated as fine, so a real visitor is never blocked by this check alone.
  if (fillTimeRemaining(input.startedAt, now) > 0) {
    return { ok: false, field: null, error: "rejected", bot: true };
  }
  return validateFields(input);
}

/** The owner-facing subject line. Front-loads the topic and who it's from, so the
 *  forwarded copy is triageable from an inbox list without opening it. */
export function notificationSubject(v: {
  topicLabel: string;
  name: string;
  email: string;
}): string {
  const who = v.name ? `${v.name} (${v.email})` : v.email;
  return `[Drift] ${v.topicLabel} from ${who}`;
}
