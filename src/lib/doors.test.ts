import { describe, it, expect } from "vitest";
import { doorsFrom, doorsOf, doorHref, engagedWith, DOOR_DWELL_MS } from "./doors";
import type { Door, Thread, TrailStep } from "./types";

const thread = (title: string, extra: Partial<Thread> = {}): Thread => ({
  candidate: { pageTitle: title, displayTitle: title, source: "wikipedia" },
  label: title,
  kind: "nearby",
  ...extra,
});

const step = (title: string, doorsLeft?: Door[]): TrailStep => ({
  card: {
    pageTitle: title,
    displayTitle: title,
    extract: "x",
    sourceUrl: `https://en.wikipedia.org/wiki/${title}`,
  },
  arrivedVia: { type: "drift" },
  timestamp: 0,
  expanded: false,
  ...(doorsLeft ? { doorsLeft } : {}),
});

describe("doorsFrom", () => {
  it("keeps what was offered, minus where you went", () => {
    const doors = doorsFrom(
      [thread("Squid"), thread("Cuttlefish"), thread("Nautilus")],
      "Cuttlefish",
    );
    expect(doors.map((d) => d.pageTitle)).toEqual(["Squid", "Nautilus"]);
  });

  it("carries the quote that made the thread interesting", () => {
    const doors = doorsFrom(
      [thread("Squid", { bridge: { sentence: "Squids are cephalopods.", anchor: "squids" } })],
      "Elsewhere",
    );
    expect(doors[0].bridge).toBe("Squids are cephalopods.");
  });

  it("records the realm only when it is not the default", () => {
    const gallery = thread("129884");
    gallery.candidate.source = "artic";
    expect(doorsFrom([gallery], "x")[0].source).toBe("artic");
    expect(doorsFrom([thread("Squid")], "x")[0].source).toBeUndefined();
  });

  it("caps a stop at two, so twenty stops cannot leave fifty-five doors", () => {
    const doors = doorsFrom(
      [thread("A"), thread("B"), thread("C"), thread("D")],
      "Elsewhere",
    );
    expect(doors).toHaveLength(2);
  });

  it("is empty when the only thread offered is the one taken", () => {
    expect(doorsFrom([thread("Squid")], "Squid")).toEqual([]);
    expect(doorsFrom([], undefined)).toEqual([]);
  });
});

describe("doorsOf", () => {
  const door = (title: string): Door => ({ pageTitle: title, displayTitle: title });

  it("lists the most recent first: the freshest curiosity, not the oldest", () => {
    const steps = [
      step("Octopus", [door("Squid")]),
      step("Cephalopod", [door("Nautilus")]),
    ];
    expect(doorsOf(steps).map((d) => d.door.pageTitle)).toEqual(["Nautilus", "Squid"]);
  });

  it("names the stop each door was offered at", () => {
    expect(doorsOf([step("Octopus", [door("Squid")])])[0].from).toBe("Octopus");
  });

  it("drops a door you ended up walking through anyway", () => {
    // Declined at stop 1, reached by another route at stop 3. It is not a road
    // not taken; it is just a road.
    const steps = [step("Octopus", [door("Squid")]), step("Cuttlefish"), step("Squid")];
    expect(doorsOf(steps)).toEqual([]);
  });

  it("shows one door once, however many stops offered it", () => {
    const steps = [step("Octopus", [door("Squid")]), step("Cuttlefish", [door("Squid")])];
    expect(doorsOf(steps)).toHaveLength(1);
  });

  it("caps the list and copes with trails that have no doors at all", () => {
    const steps = [
      step("A", [door("a1"), door("a2")]),
      step("B", [door("b1"), door("b2")]),
      step("C", [door("c1"), door("c2")]),
    ];
    expect(doorsOf(steps, { max: 3 })).toHaveLength(3);
    expect(doorsOf([step("A"), step("B")])).toEqual([]);
    expect(doorsOf([])).toEqual([]);
  });
});

describe("engagedWith", () => {
  // A card you scrolled straight past did not offer you a choice you declined.
  it("counts reading, reacting, or simply staying a while", () => {
    expect(engagedWith({ expanded: true })).toBe(true);
    expect(engagedWith({ reacted: true })).toBe(true);
    expect(engagedWith({ dwellMs: DOOR_DWELL_MS })).toBe(true);
  });

  it("does not count a glance", () => {
    expect(engagedWith({})).toBe(false);
    expect(engagedWith({ dwellMs: DOOR_DWELL_MS - 1 })).toBe(false);
  });
});

describe("doorHref", () => {
  it("reopens an article as an Encyclopedia drift", () => {
    const href = doorHref({ pageTitle: "Event horizon", displayTitle: "Event horizon" });
    expect(href).toContain("realm=encyclopedia");
    expect(href).toContain("title=Event+horizon");
    expect(href).toContain("seed=Event+horizon");
  });

  it("reopens a Gallery doorway in the Gallery", () => {
    // The seed path is realm-generic, so a crossing left unopened is not lost.
    expect(
      doorHref({ pageTitle: "129884", displayTitle: "The Bedroom", source: "artic" }),
    ).toContain("realm=gallery");
  });
});
