import { describe, it, expect } from "vitest";
import {
  TOUR_STEPS,
  TOUR_ROUTES,
  firstStep,
  stepById,
  indexOf,
  totalSteps,
  nextStep,
  advancesOn,
  advancesOnRoute,
  matchRoute,
  isOnStepRoute,
  type TourStep,
  type TourEvent,
} from "./steps";

const KNOWN_ROUTES = Object.values(TOUR_ROUTES) as string[];
const EVENTS: TourEvent[] = [
  "reacted",
  "orbited",
  "threaded",
  "drifted",
  "crossed",
  "ended",
  "saved",
];

function copyOf(step: TourStep): string {
  return [step.title, ...(Array.isArray(step.body) ? step.body : [step.body])].join(
    " ",
  );
}

describe("tour steps — integrity", () => {
  it("has a non-empty script", () => {
    expect(TOUR_STEPS.length).toBeGreaterThan(0);
    expect(totalSteps).toBe(TOUR_STEPS.length);
  });

  it("has unique ids", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every step lives on a known route", () => {
    for (const s of TOUR_STEPS) {
      expect(KNOWN_ROUTES).toContain(s.route);
    }
  });

  it("every step has a title and body", () => {
    for (const s of TOUR_STEPS) {
      expect(s.title.trim().length).toBeGreaterThan(0);
      const body = Array.isArray(s.body) ? s.body.join("") : s.body;
      expect(body.trim().length).toBeGreaterThan(0);
    }
  });

  it("a spotlight step names a target; a non-spotlight step is fine either way", () => {
    for (const s of TOUR_STEPS) {
      if (s.spotlight) expect(s.target, `step ${s.id}`).not.toBeNull();
    }
  });

  it("event-advancing steps use a valid TourEvent", () => {
    for (const s of TOUR_STEPS) {
      if (typeof s.advance === "string" && s.advance !== "next") {
        expect(EVENTS, `step ${s.id}`).toContain(s.advance);
      }
    }
  });

  it("a route-advancing step is followed by a step on that route", () => {
    for (const s of TOUR_STEPS) {
      if (typeof s.advance === "object") {
        const next = nextStep(s.id);
        expect(next, `step ${s.id} has a following step`).not.toBeNull();
        expect(
          matchRoute(next!.route, s.advance.route, s.advance.match),
          `step ${s.id} -> ${next!.id} route`,
        ).toBe(true);
      }
    }
  });
});

describe("tour steps — no em/en dashes in copy (standing preference)", () => {
  it("contains no em dash or en dash", () => {
    for (const s of TOUR_STEPS) {
      const copy = copyOf(s);
      expect(copy.includes("—"), `em dash in ${s.id}`).toBe(false);
      expect(copy.includes("–"), `en dash in ${s.id}`).toBe(false);
    }
  });
});

describe("tour steps — helpers", () => {
  it("firstStep is the first element", () => {
    expect(firstStep()).toBe(TOUR_STEPS[0]);
  });

  it("stepById / indexOf resolve real steps and reject unknowns", () => {
    const s = TOUR_STEPS[2];
    expect(stepById(s.id)).toBe(s);
    expect(indexOf(s.id)).toBe(2);
    expect(stepById("nope")).toBeUndefined();
    expect(indexOf("nope")).toBe(-1);
  });

  it("nextStep walks the script and ends at null", () => {
    expect(nextStep(TOUR_STEPS[0].id)?.id).toBe(TOUR_STEPS[1].id);
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(nextStep(last.id)).toBeNull();
    expect(nextStep("unknown")).toBeNull();
  });

  it("nextStep skips requiresCloud steps when the cloud is off", () => {
    const script: TourStep[] = [
      { ...TOUR_STEPS[0], id: "a", requiresCloud: undefined },
      { ...TOUR_STEPS[0], id: "b", requiresCloud: true },
      { ...TOUR_STEPS[0], id: "c", requiresCloud: undefined },
    ];
    expect(nextStep("a", { cloud: false }, script)?.id).toBe("c");
    expect(nextStep("a", { cloud: true }, script)?.id).toBe("b");
    // The live script currently has no account-only steps (friends stays out).
    expect(TOUR_STEPS.some((s) => s.requiresCloud)).toBe(false);
  });

  it("advancesOn matches only the step's event", () => {
    const reactStep = TOUR_STEPS.find((s) => s.advance === "reacted")!;
    expect(advancesOn(reactStep, "reacted")).toBe(true);
    expect(advancesOn(reactStep, "ended")).toBe(false);
  });

  it("advancesOnRoute matches a route-advancing step by prefix", () => {
    const startStep = TOUR_STEPS.find((s) => s.id === "start")!;
    expect(advancesOnRoute(startStep, "/drift")).toBe(true);
    expect(advancesOnRoute(startStep, "/drift?realm=gallery")).toBe(true);
    expect(advancesOnRoute(startStep, "/")).toBe(false);
    const nextStepEl = TOUR_STEPS.find((s) => s.advance === "next")!;
    expect(advancesOnRoute(nextStepEl, "/anything")).toBe(false);
  });

  it("matchRoute handles exact and prefix", () => {
    expect(matchRoute("/drift", "/drift")).toBe(true);
    expect(matchRoute("/drift/x", "/drift")).toBe(false);
    expect(matchRoute("/trails/abc", "/trails/", "prefix")).toBe(true);
    expect(matchRoute("/trails", "/trails/", "prefix")).toBe(false);
  });

  it("isOnStepRoute respects a step's routeMatch", () => {
    const trailStep = TOUR_STEPS.find((s) => s.id === "trail")!;
    expect(isOnStepRoute(trailStep, "/trails/abc")).toBe(true);
    expect(isOnStepRoute(trailStep, "/atlas")).toBe(false);
    const realmsStep = TOUR_STEPS.find((s) => s.id === "realms")!;
    expect(isOnStepRoute(realmsStep, "/")).toBe(true);
    expect(isOnStepRoute(realmsStep, "/drift")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The card's controls
// ---------------------------------------------------------------------------

describe("tour steps — the card's controls are all explained", () => {
  const ids = TOUR_STEPS.map((s) => s.id);

  it("names the orbit control, which is the one unlabelled icon on a card", () => {
    const orbit = stepById("orbit");
    expect(orbit).toBeDefined();
    expect(orbit!.target).toBe("card-orbit");
    expect(orbit!.spotlight).toBe(true);
  });

  it("asks the reader to actually tap it", () => {
    expect(stepById("orbit")!.advance).toBe("orbited");
  });

  it("introduces it right after the reactions it sits beside", () => {
    expect(ids.indexOf("orbit")).toBe(ids.indexOf("react") + 1);
    expect(ids.indexOf("orbit")).toBeLessThan(ids.indexOf("threads"));
  });

  // The pay-off for the tap: tapping an icon and being left to notice a small
  // pill appear elsewhere taught nothing, so the spotlight follows the result.
  it("follows the tap by spotlighting the focus banner it just turned on", () => {
    const banner = stepById("orbit-banner");
    expect(banner).toBeDefined();
    expect(banner!.target).toBe("focus-banner");
    expect(ids.indexOf("orbit-banner")).toBe(ids.indexOf("orbit") + 1);
    // Explanatory, so a reader who skipped the tap is not asked for anything.
    expect(banner!.advance).toBe("next");
  });

  // Crossing realms is a single-realm intent, so the feed disables it whenever a
  // focus is set. The orbit step turns a focus ON a few steps earlier, so the
  // cross step MUST come later than the banner step that explains letting go,
  // and the feed releases the focus as it opens (see drift/page.tsx). Without
  // that the tour asks for a swipe it has itself just disabled.
  it("puts the cross-realm step after the orbit steps, never before", () => {
    expect(ids.indexOf("try-horizontal")).toBeGreaterThan(ids.indexOf("orbit-banner"));
  });
});

// ---------------------------------------------------------------------------
// "Skip this step" must never strand the tour.
//
// Steps anchored to a route we can only REACH by doing the skipped thing (the
// trail view needs a trail you saved and opened) are marked `match: "prefix"`.
// TourProvider's skipStep walks PAST those to the next showable step, so what
// this guards is the script side of that contract: there must always be such a
// step, or the walk-forward runs off the end and the tour dies early. That was
// the real bug: skipping "open your trail" swallowed the last four steps.
// ---------------------------------------------------------------------------

describe("tour steps — skipping a forced step never dead-ends", () => {
  const prefixIds = TOUR_STEPS.filter(
    (s) => (s.routeMatch ?? "exact") === "prefix",
  ).map((s) => s.id);

  it("the prefix-routed steps are the known, unreachable-by-skip ones", () => {
    // Documented explicitly: adding another one is a decision, not an accident.
    expect(prefixIds).toEqual(["trail"]);
  });

  it("every step can walk forward to a showable step or the end", () => {
    for (const start of TOUR_STEPS) {
      let cursor: TourStep | null = start;
      let hops = 0;
      // Mimic skipStep: step forward, skipping anything prefix-routed.
      while (cursor && hops <= totalSteps + 1) {
        const nxt: TourStep | null = nextStep(cursor.id, { cloud: true });
        if (!nxt) break; // reached the end: finishing the tour is a fine outcome
        if ((nxt.routeMatch ?? "exact") !== "prefix") {
          cursor = null; // found somewhere to land
          break;
        }
        cursor = nxt;
        hops++;
      }
      expect(hops, `${start.id} walked too far`).toBeLessThanOrEqual(totalSteps);
    }
  });
});
