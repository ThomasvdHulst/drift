"use client";

import { useEffect, useState } from "react";
import { TileGrid } from "./TileGrid";
import {
  ARTIC_FORMS,
  ERA_ALL,
  articFormById,
  erasForForm,
} from "@/lib/realms/artic.forms";

// "Or drift a form and a period" (Phase 24, Gallery homepage). Pick an art form,
// then optionally a period, and drift stays inside that slice for the session.
//
// Two steps rather than one grid of 70 combinations: the form is the decision
// that matters, the period is a refinement, and most people will take a form and
// go. Choosing a form does NOT start the drift — it reveals its periods, with
// "All periods" first and selected, so one more tap is always enough.
//
// Only periods the collection actually holds are offered (see artic.forms.ts):
// the Art Institute has no photographs before 1800, so those chips simply do not
// exist rather than existing and disappointing.
export function FormEraPicker({
  onStart,
}: {
  onStart: (formId: string, eraId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);

  // Open on desktop, folded on phones — same rule as TileDisclosure, and for the
  // same reason (ten cards is a browsable sheet on a wide screen and a long
  // scroll on a narrow one). First paint is closed on both server and client so
  // hydration always matches.
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setOpen(!!window.matchMedia?.("(min-width: 640px)")?.matches);
      } catch {
        /* no matchMedia: leave it folded */
      }
    });
  }, []);

  const form = articFormById(formId);
  const eras = formId ? erasForForm(formId) : [];

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group mt-9 w-full"
    >
      <summary
        data-tour="form-focus"
        className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-ink-soft transition hover:text-accent-strong"
      >
        Or drift a form and a period
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="transition-transform group-open:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>

      <TileGrid
        className="mt-4"
        tiles={ARTIC_FORMS.map((f) => ({
          id: f.id,
          label: f.label,
          glyph: f.glyph,
          blurb: f.blurb,
          tint: f.tint,
        }))}
        onPick={(id) => setFormId((cur) => (cur === id ? null : id))}
      />

      {form && (
        <div className="mt-5 flex flex-col items-center gap-3">
          <p className="text-sm text-ink-soft">
            <span className="font-serif text-base text-ink">{form.label}</span>
            {" · pick a period, or drift them all"}
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {eras.map((era) => (
              <li key={era.id}>
                <button
                  type="button"
                  onClick={() => onStart(form.id, era.id)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition hover:border-accent/50 hover:text-accent-strong ${
                    era.id === ERA_ALL
                      ? "border-accent/40 bg-accent/10 font-medium text-ink"
                      : "border-line bg-paper-raised text-ink"
                  }`}
                >
                  {era.label}
                  <span className="ml-2 text-xs text-ink/50">
                    {era.works.toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
