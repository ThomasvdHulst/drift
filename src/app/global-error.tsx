"use client";

import { useEffect } from "react";

// Root error boundary (App Router). Only fires if the ROOT LAYOUT itself throws,
// which replaces the whole document — so this renders its own <html>/<body> and
// carries self-contained styling (the app's CSS isn't guaranteed here). Kept calm
// and theme-aware via a tiny inline stylesheet. Errors are logged for Vercel.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[drift] fatal error", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <style>{`
          :root { --p:#f5efe4; --pr:#fbf7ef; --i:#2b2723; --is:#6f665b; --a:#4f6d55; --l:#e4dbcb; }
          @media (prefers-color-scheme: dark) {
            :root { --p:#1b1917; --pr:#24211d; --i:#ece4d6; --is:#a79d8d; --a:#a9c6ad; --l:#37322c; }
          }
          .drift-fatal {
            min-height:100dvh; margin:0; display:flex; flex-direction:column;
            align-items:center; justify-content:center; gap:1.5rem; padding:1.5rem;
            text-align:center; background:var(--p); color:var(--i);
            font-family: ui-sans-serif, system-ui, -apple-system, "Inter", sans-serif;
          }
          .drift-fatal h1 { font-family: Georgia, "Fraunces", serif; font-size:1.75rem; font-weight:400; margin:0; }
          .drift-fatal p { max-width:24rem; font-size:.9rem; line-height:1.6; color:var(--is); margin:0; }
          .drift-fatal button {
            border:0; cursor:pointer; border-radius:9999px; padding:.65rem 1.5rem;
            font-size:.85rem; font-weight:600; background:var(--a); color:var(--pr);
          }
          .drift-fatal a {
            border:1px solid var(--l); border-radius:9999px; padding:.65rem 1.25rem;
            font-size:.85rem; color:var(--i); text-decoration:none;
          }
          .drift-fatal .row { display:flex; gap:.75rem; align-items:center; }
        `}</style>
        <main className="drift-fatal">
          <div>
            <h1>Something drifted off course</h1>
            <p>
              A small hiccup, not your fault. Your saved trails are safe. Try
              again, or head back home.
            </p>
          </div>
          <div className="row">
            <button type="button" onClick={reset}>
              Try again
            </button>
            {/* A hard navigation is intentional here: this only renders when the
                root layout has crashed, so a full reload is the reliable recovery
                (next/link's client router may not be available). */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Back home</a>
          </div>
        </main>
      </body>
    </html>
  );
}
