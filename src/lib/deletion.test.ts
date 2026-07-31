import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Does erasure actually erase? (compliance audit BP-4)
//
// GDPR Article 17 erasure that leaves the user's content visible to their
// friends is not erasure. `/api/account/delete` deletes exactly one row, the
// `auth.users` record, and relies entirely on foreign-key cascades to take
// everything else with it. That is the right design, and it is also invisible:
// nothing in the TypeScript says so, and a future migration that adds a table
// without `on delete cascade` would silently leave orphaned personal data behind
// with every test still green.
//
// So this reads the real migration SQL. It is the same trick templates.test.ts
// uses for the Supabase email templates: pin a fact that lives outside the code
// but that the code depends on.
// ---------------------------------------------------------------------------

const dir = join(process.cwd(), "supabase", "migrations");
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n");

/** Every column that points at a user, and therefore has to cascade. */
const USER_REFERENCES = [
  ["trails", "user_id"],
  ["reactions", "user_id"],
  ["user_kv", "user_id"],
  ["profiles", "id"],
  ["friend_requests", "requester_id"],
  ["friend_requests", "addressee_id"],
  // The two that matter most for BP-4: a share is a copy of the sender's content
  // sitting in the recipient's inbox. Deleting the sender must remove it.
  ["shares", "sender_id"],
  ["shares", "recipient_id"],
] as const;

describe("account deletion propagates (Article 17)", () => {
  it.each(USER_REFERENCES)(
    "%s.%s cascades when the auth user is deleted",
    (table, column) => {
      // The declaration, tolerant of whitespace but not of a missing cascade.
      const decl = new RegExp(
        `${column}\\s+uuid[^,]*references\\s+auth\\.users\\s*\\(\\s*id\\s*\\)\\s*on\\s+delete\\s+cascade`,
        "i",
      );
      expect(decl.test(sql), `${table}.${column}`).toBe(true);
    },
  );

  it("has no user-referencing column that forgets to cascade", () => {
    // Catches a table added later: any reference to auth.users anywhere in the
    // migrations has to carry the cascade.
    const refs = sql.match(/references\s+auth\.users\s*\(\s*id\s*\)[^,\n]*/gi) ?? [];
    expect(refs.length).toBeGreaterThanOrEqual(USER_REFERENCES.length);
    for (const ref of refs) {
      expect(ref.toLowerCase(), ref).toContain("on delete cascade");
    }
  });

  // A share the sender deleted their account over must not linger because the
  // recipient still has a row pointing at it. Both directions cascade, so
  // deleting either party removes it.
  it("removes a delivered share when EITHER party is deleted", () => {
    const both = ["sender_id", "recipient_id"].every((col) =>
      new RegExp(
        `${col}\\s+uuid[^,]*references\\s+auth\\.users\\s*\\(\\s*id\\s*\\)\\s*on\\s+delete\\s+cascade`,
        "i",
      ).test(sql),
    );
    expect(both).toBe(true);
  });
});
