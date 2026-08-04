import { describe, it, expect } from "vitest";
import {
  doorArrival,
  doorBranchHref,
  doorHref,
  doorsFrom,
  doorsOf,
  engagedWith,
  openDoorCounts,
  parseDoorParam,
  DOOR_DWELL_MS,
} from "./doors";
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

  it("says where each door was offered, so a branch knows where to fork", () => {
    const steps = [
      step("Octopus", [door("Squid"), door("Nautilus")]),
      step("Cuttlefish"),
    ];
    expect(doorsOf(steps)).toMatchObject([
      { stepIndex: 0, doorIndex: 0 },
      { stepIndex: 0, doorIndex: 1 },
    ]);
  });
});

describe("openDoorCounts", () => {
  const door = (title: string): Door => ({ pageTitle: title, displayTitle: title });

  it("counts per stop, indexed like the trail", () => {
    const steps = [
      step("Octopus", [door("Squid"), door("Nautilus")]),
      step("Cuttlefish"),
      step("Cephalopod", [door("Yarn")]),
    ];
    expect(openDoorCounts(steps)).toEqual([2, 0, 1]);
  });

  it("stops counting a door once the trail walks through it", () => {
    const steps = [step("Octopus", [door("Squid"), door("Nautilus")]), step("Squid")];
    expect(openDoorCounts(steps)).toEqual([1, 0]);
  });

  it("credits a repeated door to the later stop only", () => {
    const steps = [step("A", [door("Squid")]), step("B", [door("Squid")])];
    expect(openDoorCounts(steps)).toEqual([0, 1]);
  });

  it("is all zeroes for a trail with no doors", () => {
    expect(openDoorCounts([step("A"), step("B")])).toEqual([0, 0]);
    expect(openDoorCounts([])).toEqual([]);
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

// Walking a door continues the trail (Phase 29) rather than replacing it.
describe("doorBranchHref / parseDoorParam", () => {
  it("carries a reference to the stop and the door, not the door itself", () => {
    const href = doorBranchHref("t-1", {
      door: { pageTitle: "Event horizon", displayTitle: "Event horizon" },
      from: "Black hole",
      stepIndex: 3,
      doorIndex: 1,
    });
    expect(href).toBe("/drift?continue=t-1&door=3.1");
  });

  it("round-trips", () => {
    expect(parseDoorParam("3.1")).toEqual({ stepIndex: 3, doorIndex: 1 });
    expect(parseDoorParam(" 12.0 ")).toEqual({ stepIndex: 12, doorIndex: 0 });
  });

  it("refuses junk, so a hand-edited URL just resumes the trail", () => {
    for (const bad of [null, "", "3", "3.", ".1", "a.b", "-1.0", "3.1.2", "1e3.0"]) {
      expect(parseDoorParam(bad)).toBeNull();
    }
  });
});

describe("doorArrival", () => {
  const from = { pageTitle: "Black hole", source: undefined };

  it("reads as the thread it is, marked as one you came back for", () => {
    const via = doorArrival(
      {
        pageTitle: "Event horizon",
        displayTitle: "Event horizon",
        kind: "deeper",
        bridge: "The boundary of no escape is called the event horizon.",
      },
      from,
    );
    expect(via).toEqual({
      type: "thread",
      label: "Event horizon",
      fromTitle: "Black hole",
      viaDoor: true,
      kind: "deeper",
      bridge: "The boundary of no escape is called the event horizon.",
    });
  });

  it("records the realm it left when the door crosses one", () => {
    const via = doorArrival(
      { pageTitle: "129884", displayTitle: "The Bedroom", source: "artic" },
      from,
    );
    expect(via.crossedFrom).toBe("encyclopedia");
  });

  it("does not claim a crossing within one realm", () => {
    expect(
      doorArrival({ pageTitle: "Squid", displayTitle: "Squid" }, from).crossedFrom,
    ).toBeUndefined();
    expect(
      doorArrival(
        { pageTitle: "1", displayTitle: "One", source: "artic" },
        { pageTitle: "2", source: "artic" },
      ).crossedFrom,
    ).toBeUndefined();
  });
});
