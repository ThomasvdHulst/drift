// The Drift brand marks (Phase 13 rebrand). Two forms:
//   • Wordmark — "Drift" + the olive sprig (front page / gate hero).
//   • Monogram — the "D" + sprig (compact spots, e.g. the feed top bar).
//
// Each swaps ink → cream between light and dark mode purely via CSS ([data-theme],
// see globals.css .brand-light/.brand-dark), so there's no JS state and no
// hydration flash. We use the baked-in-font PNGs from public/brand/ because the
// brand SVGs rely on the Fraunces webfont, which an <img> can't load. Sizing is
// controlled by `className` on the wrapper (height); images are h-full w-auto.

function Swap({
  base,
  alt,
  className,
}: {
  base: string;
  alt: string;
  className: string;
}) {
  return (
    <span className={`inline-flex ${className}`}>
      {/* Both carry the same alt: exactly one is rendered per theme (the other is
          display:none, so it's excluded from the a11y tree), so "Drift" is
          announced once in either mode. */}
      <img
        src={`/brand/${base}.png`}
        alt={alt}
        className="brand-light h-full w-auto select-none"
        draggable={false}
      />
      <img
        src={`/brand/${base}-reversed.png`}
        alt={alt}
        className="brand-dark h-full w-auto select-none"
        draggable={false}
      />
    </span>
  );
}

/** "Drift" wordmark with the sprig. Pass a height via `className` (e.g. "h-24"). */
export function Wordmark({ className = "h-20" }: { className?: string }) {
  return <Swap base="drift-logo" alt="Drift" className={className} />;
}

/** The "D" + sprig monogram, for compact placements. */
export function Monogram({
  className = "h-7",
  alt = "Drift",
}: {
  className?: string;
  alt?: string;
}) {
  return <Swap base="drift-monogram" alt={alt} className={className} />;
}
