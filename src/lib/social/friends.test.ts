import { describe, it, expect } from "vitest";
import {
  deriveRelationship,
  partition,
  otherPartyId,
  type FriendRequest,
} from "./friends";

const req = (
  id: string,
  requester_id: string,
  addressee_id: string,
  status: FriendRequest["status"],
): FriendRequest => ({ id, requester_id, addressee_id, status });

const ME = "me";

describe("deriveRelationship", () => {
  it("none when no request involves the pair", () => {
    expect(deriveRelationship([], ME, "x")).toBe("none");
    expect(deriveRelationship([req("1", "a", "b", "pending")], ME, "x")).toBe("none");
  });
  it("friends when an accepted row exists (either direction)", () => {
    expect(deriveRelationship([req("1", ME, "x", "accepted")], ME, "x")).toBe("friends");
    expect(deriveRelationship([req("1", "x", ME, "accepted")], ME, "x")).toBe("friends");
  });
  it("outgoing when I sent a pending request", () => {
    expect(deriveRelationship([req("1", ME, "x", "pending")], ME, "x")).toBe("outgoing");
  });
  it("incoming when they sent me a pending request", () => {
    expect(deriveRelationship([req("1", "x", ME, "pending")], ME, "x")).toBe("incoming");
  });
  it("treats declined as none (re-request allowed)", () => {
    expect(deriveRelationship([req("1", ME, "x", "declined")], ME, "x")).toBe("none");
  });
});

describe("partition", () => {
  it("splits into friends / incoming / outgoing", () => {
    const reqs = [
      req("1", ME, "a", "accepted"),
      req("2", "b", ME, "pending"), // incoming
      req("3", ME, "c", "pending"), // outgoing
      req("4", ME, "d", "declined"), // dropped
    ];
    const p = partition(reqs, ME);
    expect(p.friends.map((r) => r.id)).toEqual(["1"]);
    expect(p.incoming.map((r) => r.id)).toEqual(["2"]);
    expect(p.outgoing.map((r) => r.id)).toEqual(["3"]);
  });
});

describe("otherPartyId", () => {
  it("returns the non-me id in either direction", () => {
    expect(otherPartyId(req("1", ME, "x", "accepted"), ME)).toBe("x");
    expect(otherPartyId(req("1", "x", ME, "accepted"), ME)).toBe("x");
  });
});
