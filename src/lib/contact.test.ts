import { describe, it, expect } from "vitest";
import {
  validateContact,
  validateFields,
  fillTimeRemaining,
  notificationSubject,
  topicLabel,
  MESSAGE_MAX,
  MIN_FILL_MS,
  CONTACT_TOPICS,
} from "./contact";

const T0 = 1_700_000_000_000;
// A submission that always passes, so each test varies exactly one thing.
const good = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  topic: "feedback",
  message: "I really enjoy the trail maps at the end of a session.",
  startedAt: T0,
};
const later = T0 + MIN_FILL_MS + 1000;

describe("validateContact", () => {
  it("accepts and normalizes a good submission", () => {
    const res = validateContact(good, later);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      topic: "feedback",
      topicLabel: "Feedback",
      message: "I really enjoy the trail maps at the end of a session.",
    });
  });

  it("trims whitespace and lowercases the email", () => {
    const res = validateContact(
      { ...good, name: "  Ada  ", email: "  ADA@Example.COM ", message: `  ${good.message}  ` },
      later,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.name).toBe("Ada");
    expect(res.value.email).toBe("ada@example.com");
    expect(res.value.message).toBe(good.message);
  });

  it("treats a name as optional", () => {
    const res = validateContact({ ...good, name: "" }, later);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.name).toBe("");
  });

  it("falls back to the default topic for a missing or unknown one", () => {
    for (const topic of [undefined, "", "'; drop table--", "not-a-topic"]) {
      const res = validateContact({ ...good, topic }, later);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.topic).toBe("feedback");
    }
  });

  it("accepts every advertised topic", () => {
    for (const t of CONTACT_TOPICS) {
      const res = validateContact({ ...good, topic: t.id }, later);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.topic).toBe(t.id);
      expect(res.value.topicLabel).toBe(t.label);
    }
  });

  describe("email", () => {
    it("requires one", () => {
      const res = validateContact({ ...good, email: "  " }, later);
      expect(res).toMatchObject({ ok: false, field: "email" });
    });

    it("rejects malformed addresses", () => {
      for (const email of ["ada", "ada@", "@example.com", "ada@example", "a b@c.com", "ada@ex..com"]) {
        const res = validateContact({ ...good, email }, later);
        expect(res.ok, email).toBe(false);
      }
    });

    it("accepts realistic addresses", () => {
      for (const email of [
        "ada+drift@example.com",
        "ada.lovelace@sub.example.co.uk",
        "a_b-c@example-host.org",
      ]) {
        const res = validateContact({ ...good, email }, later);
        expect(res.ok, email).toBe(true);
      }
    });
  });

  describe("message", () => {
    it("requires one", () => {
      expect(validateContact({ ...good, message: "   " }, later)).toMatchObject({
        ok: false,
        field: "message",
      });
    });

    it("asks for more than a couple of characters", () => {
      expect(validateContact({ ...good, message: "hi" }, later)).toMatchObject({
        ok: false,
        field: "message",
      });
    });

    it("caps the length", () => {
      const res = validateContact({ ...good, message: "a".repeat(MESSAGE_MAX + 1) }, later);
      expect(res).toMatchObject({ ok: false, field: "message" });
      // Exactly at the cap is fine.
      expect(validateContact({ ...good, message: "a".repeat(MESSAGE_MAX) }, later).ok).toBe(true);
    });
  });

  describe("bot traps", () => {
    it("rejects a filled honeypot, and flags it as a bot", () => {
      const res = validateContact({ ...good, website: "http://spam.example" }, later);
      expect(res).toMatchObject({ ok: false, bot: true, field: null });
    });

    it("ignores a honeypot that is present but empty or whitespace", () => {
      expect(validateContact({ ...good, website: "" }, later).ok).toBe(true);
      expect(validateContact({ ...good, website: "   " }, later).ok).toBe(true);
    });

    it("rejects a submission returned faster than a human could type it", () => {
      const res = validateContact(good, T0 + MIN_FILL_MS - 1);
      expect(res).toMatchObject({ ok: false, bot: true, field: null });
    });

    it("accepts one right at the threshold", () => {
      expect(validateContact(good, T0 + MIN_FILL_MS).ok).toBe(true);
    });

    it("does not block a human whose timestamp is missing or nonsense", () => {
      // A garbled clock must never be the sole reason a real person is refused.
      for (const startedAt of [undefined, 0, -1, NaN, "abc" as unknown as number]) {
        expect(validateContact({ ...good, startedAt }, later).ok, String(startedAt)).toBe(true);
      }
    });

    it("checks bot traps BEFORE field validation", () => {
      // A bot that also sends a bad email must still get the silent bot answer,
      // never a helpful message telling it what to fix.
      const res = validateContact(
        { ...good, email: "nope", message: "x", website: "spam" },
        later,
      );
      expect(res).toMatchObject({ ok: false, bot: true });
    });
  });
});

describe("validateFields (the half the client runs)", () => {
  it("ignores the bot traps entirely", () => {
    // The client must never refuse a person because of a honeypot or a clock.
    // Both of these are rejected by validateContact and accepted here.
    expect(validateFields({ ...good, website: "spam" }).ok).toBe(true);
    expect(validateFields({ ...good, startedAt: T0 }).ok).toBe(true);
  });

  it("still enforces every field rule", () => {
    expect(validateFields({ ...good, email: "nope" })).toMatchObject({ field: "email" });
    expect(validateFields({ ...good, message: "" })).toMatchObject({ field: "message" });
  });
});

describe("fillTimeRemaining", () => {
  it("counts down the remaining floor", () => {
    expect(fillTimeRemaining(T0, T0)).toBe(MIN_FILL_MS);
    expect(fillTimeRemaining(T0, T0 + 1000)).toBe(MIN_FILL_MS - 1000);
  });

  it("is 0 once the floor has passed", () => {
    expect(fillTimeRemaining(T0, T0 + MIN_FILL_MS)).toBe(0);
    expect(fillTimeRemaining(T0, T0 + 999_999)).toBe(0);
  });

  it("is 0 for a missing or nonsense timestamp, so nobody waits forever", () => {
    for (const t of [undefined, 0, -1, NaN]) {
      expect(fillTimeRemaining(t, T0), String(t)).toBe(0);
    }
  });

  it("agrees with validateContact's own bot verdict", () => {
    // The client waits out exactly the window the server would reject in.
    for (const elapsed of [0, 1000, MIN_FILL_MS - 1, MIN_FILL_MS, MIN_FILL_MS + 1]) {
      const now = T0 + elapsed;
      const waits = fillTimeRemaining(T0, now) > 0;
      const rejected = (validateContact(good, now) as { bot?: boolean }).bot === true;
      expect(waits, `elapsed=${elapsed}`).toBe(rejected);
    }
  });
});

describe("notificationSubject", () => {
  it("includes the topic, the name, and the address", () => {
    expect(
      notificationSubject({ topicLabel: "Feedback", name: "Ada", email: "ada@example.com" }),
    ).toBe("[Drift] Feedback from Ada (ada@example.com)");
  });

  it("falls back to the address alone when no name was given", () => {
    expect(
      notificationSubject({ topicLabel: "An idea", name: "", email: "ada@example.com" }),
    ).toBe("[Drift] An idea from ada@example.com");
  });
});

describe("topicLabel", () => {
  it("maps known ids and falls back for unknown ones", () => {
    expect(topicLabel("bug")).toBe("Something is broken");
    expect(topicLabel("nope")).toBe("Message");
  });
});
