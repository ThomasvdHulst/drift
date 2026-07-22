// The guided-tour script (Phase 20). Kept as pure, typed data in src/lib so it's
// version-controlled, diff-reviewable, trivially editable, and unit-testable, and
// so the tour runs fully with the cloud off (no DB table / RLS / fallback needed).
// This mirrors the decision to keep the landing EXAMPLE_TRAILS static in code.
//
// The overlay + provider (src/components/tour/*) render these; the only coupling
// to the rest of the app is a `data-tour="<target>"` attribute on each spotlighted
// element and ~4 guarded `signal()` calls in the drift page for forced actions.

// A real in-app action the drift page emits while the tour waits on a forced step.
// "drifted" = a vertical drift onward; "crossed" = a horizontal realm cross;
// "threaded" = a thread pull; "reacted" = a thumbs up/down.
export type TourEvent =
  | "reacted"
  | "threaded"
  | "drifted"
  | "crossed"
  | "ended"
  | "saved";

// How a step advances to the next one:
// - "next": the coach card shows a Next / Got it button (explanatory step).
// - a TourEvent: advances when the app emits that event (a forced real action on
//   the current page, e.g. the user actually swipes to drift or taps End).
// - { route }: advances when the user navigates to a matching route (a forced
//   navigation; the step spotlights the real link/button that goes there).
export type RouteMatch = "exact" | "prefix";
export type TourAdvance =
  | "next"
  | TourEvent
  | { route: string; match?: RouteMatch };

export type GestureHint = "swipe-up" | "swipe-side" | "tap";

export interface TourStep {
  id: string;
  // The route this step lives on (the provider keeps the user here; navigating
  // to it if needed). `routeMatch: "prefix"` covers dynamic routes (/trails/:id).
  route: string;
  routeMatch?: RouteMatch;
  // The data-tour key of the element to spotlight, or null for a centered step.
  target: string | null;
  // "auto" places the coach card opposite the target; "center" is a modal-style
  // card (used for target-less steps and the swipe step).
  placement: "auto" | "center";
  // Cut a spotlight hole around the target (true) or just dim with a light,
  // non-blocking scrim so a real gesture reaches the app underneath (false).
  spotlight: boolean;
  advance: TourAdvance;
  title: string;
  body: string | string[];
  gestureHint?: GestureHint;
  // Offer a quiet "Look around" button that hides the coach + scrim so the user
  // can read/scroll/Read more freely, while navigation (swipe, thread, End, cross)
  // is held so they stay on the content they're studying. For steps that sit on a
  // full card or the trail map and would otherwise be blocked by the coach.
  explore?: boolean;
  // Skip this step when the cloud isn't configured / signed out (future-proofing
  // for any account-only step; nothing uses it yet since friends stays out).
  requiresCloud?: boolean;
}

// Route constants the tour walks through.
export const TOUR_ROUTES = {
  home: "/",
  drift: "/drift",
  trail: "/trails/", // a single saved trail: /trails/:id (prefix match)
  atlas: "/atlas",
  interests: "/interests",
} as const;

// The script, in order. Copy stays short (one idea per step) and dash-free (a
// standing copy preference, enforced by a unit test).
export const TOUR_STEPS: TourStep[] = [
  // ----- Home -----
  {
    id: "realms",
    route: TOUR_ROUTES.home,
    target: "realm-tabs",
    placement: "auto",
    spotlight: true,
    advance: "next",
    title: "Realms to wander",
    body: "Encyclopedia is all of Wikipedia. Gallery is public domain art. Tap either to switch rooms.",
  },
  {
    id: "orbit-search",
    route: TOUR_ROUTES.home,
    target: "orbit-search",
    placement: "auto",
    spotlight: true,
    advance: "next",
    title: "Drift around a page",
    body: "Search any page and spiral outward from it, wandering its neighbourhood instead of the whole encyclopedia.",
  },
  {
    id: "field-focus",
    route: TOUR_ROUTES.home,
    target: "field-focus",
    placement: "auto",
    spotlight: true,
    advance: "next",
    title: "Or stay within a field",
    body: "Open this for a card per field, from Physics to Visual Arts. Pick one and the drift keeps to that subject. However you begin, you steer from there.",
  },
  {
    id: "news-focus",
    route: TOUR_ROUTES.home,
    target: "news-focus",
    placement: "auto",
    spotlight: true,
    advance: "next",
    title: "Or read around the news",
    body: "Pick a subject here and you get the Wikipedia articles behind what is going on right now. Not the news itself, the background to it.",
  },
  {
    id: "start",
    route: TOUR_ROUTES.home,
    target: "drift-cta",
    placement: "auto",
    spotlight: true,
    advance: { route: TOUR_ROUTES.drift, match: "prefix" },
    title: "Start your first drift",
    body: "Tap here to begin. The tour picks up on the other side.",
    gestureHint: "tap",
  },

  // ----- Drift (the mini drift) -----
  {
    id: "card",
    route: TOUR_ROUTES.drift,
    target: null,
    placement: "center",
    spotlight: false,
    advance: "next",
    explore: true,
    title: "This is a card",
    body: "Take it in: read the hook, tap Read more for the fuller article, and the chip up top always says why you landed here.",
  },
  {
    id: "react",
    route: TOUR_ROUTES.drift,
    target: "card-reactions",
    placement: "auto",
    spotlight: true,
    advance: "reacted",
    title: "You are the algorithm",
    body: "Tap thumbs up or thumbs down to shape which topics surface later. Try one now.",
    gestureHint: "tap",
  },
  {
    id: "threads",
    route: TOUR_ROUTES.drift,
    target: "card-threads",
    placement: "auto",
    spotlight: true,
    advance: "threaded",
    explore: true,
    title: "Pull a thread to steer",
    body: "Each thread is a direction you can follow deeper. Give one a tap to dive in.",
    gestureHint: "tap",
  },
  {
    id: "try-vertical",
    route: TOUR_ROUTES.drift,
    target: null,
    placement: "center",
    spotlight: false,
    advance: "drifted",
    title: "Swipe up to drift on",
    body: "When nothing pulls you, swipe up to drift to something new. Try it now.",
    gestureHint: "swipe-up",
  },
  {
    id: "try-horizontal",
    route: TOUR_ROUTES.drift,
    target: null,
    placement: "center",
    spotlight: false,
    advance: "crossed",
    title: "Swipe sideways to cross realms",
    body: "A sideways swipe carries you into the other realm, weaving both into one trail. Give it a try.",
    gestureHint: "swipe-side",
  },
  {
    id: "end",
    route: TOUR_ROUTES.drift,
    target: "end-trail",
    placement: "auto",
    spotlight: true,
    advance: "ended",
    explore: true,
    title: "End when you like",
    body: "The reward sits at the exit, not the next card. Tap End to see where you wandered.",
    gestureHint: "tap",
  },

  // ----- The trail map + saving -----
  {
    id: "save",
    route: TOUR_ROUTES.drift,
    target: "save-trail",
    placement: "auto",
    spotlight: true,
    advance: "saved",
    title: "Your trail",
    body: "This map is the shape of your session. Give it a name and save it.",
    gestureHint: "tap",
  },
  {
    id: "open-trail",
    route: TOUR_ROUTES.drift,
    target: "view-trail",
    placement: "auto",
    spotlight: true,
    advance: { route: TOUR_ROUTES.trail, match: "prefix" },
    explore: true,
    title: "Keep it close",
    body: "Take a look at your trail map, then open it in My Trails, where every saved trail lives.",
    gestureHint: "tap",
  },
  {
    id: "trail",
    route: TOUR_ROUTES.trail,
    routeMatch: "prefix",
    target: "trail-view",
    placement: "auto",
    spotlight: true,
    advance: "next",
    title: "A trail you can revisit",
    body: "Come back to any trail, or send it to a friend. Every trail you keep also joins your Atlas.",
  },

  // ----- Atlas + Interests (gently escorted) -----
  {
    id: "atlas",
    route: TOUR_ROUTES.atlas,
    target: "atlas-canvas",
    placement: "auto",
    spotlight: true,
    advance: "next",
    title: "Your Atlas",
    body: "Every trail becomes one growing constellation of your curiosity. It fills in as you wander.",
  },
  {
    id: "interests",
    route: TOUR_ROUTES.interests,
    target: "interests-list",
    placement: "auto",
    spotlight: true,
    advance: "next",
    title: "This is your algorithm",
    body: [
      "The thumbs up and down you give tune what Drift shows you, and it is all here in the open.",
      "Nudge any topic up or down, or switch personalization off entirely. It stays yours.",
    ],
  },

  // ----- Wrap up (escorted back home) -----
  {
    id: "outro",
    route: TOUR_ROUTES.home,
    target: null,
    placement: "center",
    spotlight: false,
    advance: "next",
    title: "That's the tour",
    body: [
      "You've seen the whole loop: pick a direction, pull threads, and end with a map of where you wandered.",
      "Tap Surprise me to start your first real drift. You can retake this tour anytime from here.",
    ],
  },
];

// ----- Pure helpers (unit-tested) -----

/** The first step of the tour. */
export function firstStep(): TourStep {
  return TOUR_STEPS[0];
}

/** Look up a step by id, or undefined. */
export function stepById(id: string): TourStep | undefined {
  return TOUR_STEPS.find((s) => s.id === id);
}

/** The step's index in the script, or -1. */
export function indexOf(id: string): number {
  return TOUR_STEPS.findIndex((s) => s.id === id);
}

/** Total number of steps (for the progress indicator). */
export const totalSteps = TOUR_STEPS.length;

/**
 * The next step after `id`, skipping any `requiresCloud` steps when the cloud
 * isn't configured. Returns null at the end of the tour. `steps` is injectable
 * for testing; it defaults to the live script.
 */
export function nextStep(
  id: string,
  opts: { cloud: boolean } = { cloud: true },
  steps: TourStep[] = TOUR_STEPS,
): TourStep | null {
  const start = steps.findIndex((s) => s.id === id);
  if (start < 0) return null;
  for (let i = start + 1; i < steps.length; i++) {
    const s = steps[i];
    if (s.requiresCloud && !opts.cloud) continue;
    return s;
  }
  return null;
}

/** Whether a forced step advances on the given app event. */
export function advancesOn(step: TourStep, event: TourEvent): boolean {
  return step.advance === event;
}

/** Whether a step advances on arriving at `pathname`. */
export function advancesOnRoute(step: TourStep, pathname: string): boolean {
  if (typeof step.advance !== "object") return false;
  return matchRoute(pathname, step.advance.route, step.advance.match);
}

/** Match a pathname to a route, exact by default or by prefix. */
export function matchRoute(
  pathname: string,
  route: string,
  mode: RouteMatch = "exact",
): boolean {
  return mode === "prefix" ? pathname.startsWith(route) : pathname === route;
}

/** Whether the user is currently on the route where a step lives. */
export function isOnStepRoute(step: TourStep, pathname: string): boolean {
  return matchRoute(pathname, step.route, step.routeMatch ?? "exact");
}
