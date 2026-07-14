"use client";

import type { RealmId } from "@/lib/realms/types";

// The segmented realm switcher on the homepage. Each tab carries its own
// `data-realm`, so an active tab glows in that realm's accent (sage / terracotta
// / …) via the scoped --accent vars. Calm, no badges (§6).
export function RealmTabs({
  realms,
  active,
  onSelect,
}: {
  realms: { id: RealmId; label: string; glyph: string }[];
  active: RealmId;
  onSelect: (id: RealmId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Realms"
      className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-line bg-paper-raised p-1"
    >
      {realms.map((r) => {
        const on = r.id === active;
        return (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={on}
            data-realm={r.id}
            onClick={() => onSelect(r.id)}
            className={
              on
                ? "inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-4 py-1.5 text-sm font-semibold text-accent-strong ring-1 ring-accent/30 transition"
                : "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
            }
          >
            <span aria-hidden="true">{r.glyph}</span>
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
