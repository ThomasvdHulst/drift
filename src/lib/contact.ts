// Pure validation + normalization for the contact form (Phase 22). No React/DOM
// and no network, so the rules that decide what reaches the inbox are unit-tested
// in one place and shared by the client (instant feedback) and the API route (the
// real gate). The client copy of these checks is a convenience only: the route
// re-runs every one of them, because anything the browser asserts can be forged.

/** What the user picked as the subject of their message. Kept as a small closed
 *  set so the notification subject line is scannable in an inbox.
 *
 *  `report` is the DSA Article 16 notice-and-action mechanism (compliance audit
 *  M-5), which the Article requires every hosting service to provide regardless
 *  of size. It is a mode of this form rather than a separate page, because the
 *  Article asks for a mechanism that is "easy to access" and "user-friendly",
 *  and one more page to find is neither. It is last in the list on purpose: it
 *  is the rarest reason to write and the heaviest form to fill in. */
export const CONTACT_TOPICS = [
  { id: "feedback", label: "Feedback" },
  { id: "bug", label: "Something is broken" },
  { id: "idea", label: "An idea" },
  { id: "account", label: "Help with my account" },
  { id: "other", label: "Something else" },
  { id: "report", label: "Report illegal content" },
] as const;

export type ContactTopicId = (typeof CONTACT_TOPICS)[number]["id"];

/** The Article 16 mode. One predicate, so the client, the validator and the
 *  route agree on when the extra rules apply. */
export const REPORT_TOPIC: ContactTopicId = "report";
export function isReportTopic(id: string | undefined): boolean {
  return id === REPORT_TOPIC;
}

export function topicLabel(id: string): string {
  return CONTACT_TOPICS.find((t) => t.id === id)?.label ?? "Message";
}

export const MESSAGE_MAX = 4000;
export const MESSAGE_MIN = 10;
/** Article 16(2)(a) wants "a sufficiently substantiated explanation of the
 *  reasons why" the content is alleged to be illegal. A one-line report is not
 *  one, and a notice that cannot be acted on helps nobody, so the floor is
 *  higher here than for an ordinary message. */
export const REPORT_MESSAGE_MIN = 40;
export const LOCATION_MAX = 500;
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
  /** Article 16(2)(b): "a clear indication of the exact electronic location of
   *  that information". Report mode only. */
  location?: string;
  /** Article 16(2)(d): the notifier's bona fide statement. Report mode only. */
  goodFaith?: boolean;
  /** Honeypot: a field hidden from humans, so any value means a bot filled it. */
  website?: string;
  /** Client clock at form mount, used for the fill-time check. */
  startedAt?: number;
}

export interface ContactDetailsValue {
  name: string;
  /** May be EMPTY for an Article 16 report. See `validateFields`. */
  email: string;
  topic: ContactTopicId;
  topicLabel: string;
  message: string;
  /** Report mode only: where the content is. */
  location?: string;
  /** True when this is an Article 16 notice rather than an ordinary message. */
  isReport: boolean;
}

export interface ContactValid {
  ok: true;
  value: ContactDetailsValue;
}

export interface ContactInvalid {
  ok: false;
  /** Which field to point the user at, or null for a silent bot rejection. */
  field: "name" | "email" | "message" | "location" | "goodFaith" | null;
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
 *
 * TWO SHAPES, one function. An ordinary message needs an address, because the
 * whole point is a reply. An Article 16 notice does not: Article 16(2)(c)
 * requires the name and email "except in the case of information considered to
 * involve one of the offences referred to in Articles 3 to 7 of Directive
 * 2011/93/EU" — child sexual abuse material, where the person reporting may have
 * every reason not to identify themselves. Rather than make a notifier
 * self-classify into that category on a web form, which is both a horrible thing
 * to ask and a bad way to get accurate answers, the address is optional for every
 * report and the form explains what is lost by leaving it out. Permitting more
 * anonymity than the Article requires is not a breach of it.
 */
export function validateFields(input: ContactInput): ContactResult {
  const name = (input.name ?? "").trim().slice(0, NAME_MAX);
  const email = (input.email ?? "").trim().toLowerCase();
  const message = (input.message ?? "").trim();
  const topic = (CONTACT_TOPICS.find((t) => t.id === input.topic)?.id ??
    "feedback") as ContactTopicId;
  const report = isReportTopic(topic);
  const location = (input.location ?? "").trim();

  // Optional for a report, required otherwise. Either way, an address that IS
  // given has to be usable, or the confirmation of receipt goes nowhere.
  if (!email && !report) {
    return { ok: false, field: "email", error: "Please add your email so we can reply." };
  }
  if (email && (email.length > EMAIL_MAX || !EMAIL_RE.test(email))) {
    return { ok: false, field: "email", error: "That email address doesn't look right." };
  }

  if (report) {
    if (!location) {
      return {
        ok: false,
        field: "location",
        error: "Please say where the content is, so it can be found.",
      };
    }
    if (location.length > LOCATION_MAX) {
      return {
        ok: false,
        field: "location",
        error: `Please keep the location under ${LOCATION_MAX} characters.`,
      };
    }
    if (!input.goodFaith) {
      return {
        ok: false,
        field: "goodFaith",
        error:
          "Please confirm that what you have written is accurate and complete to the best of your knowledge.",
      };
    }
  }

  const min = report ? REPORT_MESSAGE_MIN : MESSAGE_MIN;
  if (!message) {
    return {
      ok: false,
      field: "message",
      error: report ? "Please explain why you believe it is illegal." : "Please write a message.",
    };
  }
  if (message.length < min) {
    return {
      ok: false,
      field: "message",
      error: report
        ? "A report needs enough detail to act on. Please say what makes this illegal, and under which law if you know it."
        : "Could you say a little more? A sentence or two helps.",
    };
  }
  if (message.length > MESSAGE_MAX) {
    return {
      ok: false,
      field: "message",
      error: `That message is a bit long. Please keep it under ${MESSAGE_MAX} characters.`,
    };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      topic,
      topicLabel: topicLabel(topic),
      message,
      ...(report ? { location } : {}),
      isReport: report,
    },
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
 *  forwarded copy is triageable from an inbox list without opening it.
 *
 *  An Article 16 notice is marked so it cannot be lost in a run of feedback: it
 *  starts a clock (confirm receipt without undue delay, then notify the outcome)
 *  and ordinary messages do not. An anonymous notice says so rather than reading
 *  as a message from nobody. */
export function notificationSubject(v: {
  topicLabel: string;
  name: string;
  email: string;
  isReport?: boolean;
}): string {
  const who = v.name ? `${v.name} (${v.email})` : v.email;
  if (v.isReport) {
    return `[Drift] ACTION: illegal content report from ${who || "an anonymous notifier"}`;
  }
  return `[Drift] ${v.topicLabel} from ${who}`;
}
