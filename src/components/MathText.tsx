"use client";

import katex from "katex";
import { splitMath, hasMath } from "@/lib/mathtext";

// Render card text that may contain inline LaTeX markers (produced server-side by
// lib/mathtext's preprocessMath) with KaTeX. Plain text passes straight through
// via a fast path. KaTeX is told never to throw (throwOnError:false), so an odd
// fragment degrades to its raw source rather than breaking the card (§4 spirit:
// the enhancement never breaks the read). The KaTeX stylesheet is loaded once in
// app/layout.tsx.
export function MathText({ text }: { text: string }) {
  if (!hasMath(text)) return <>{text}</>;
  return (
    <>
      {splitMath(text).map((s, i) =>
        s.type === "text" ? (
          <span key={i}>{s.value}</span>
        ) : (
          <MathSpan key={i} latex={s.value} />
        ),
      )}
    </>
  );
}

function MathSpan({ latex }: { latex: string }) {
  let html: string;
  try {
    html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      output: "html",
    });
  } catch {
    return <span>{latex}</span>;
  }
  return (
    <span
      className="drift-math"
      // Trusted: HTML is KaTeX output over our own preprocessed LaTeX.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
