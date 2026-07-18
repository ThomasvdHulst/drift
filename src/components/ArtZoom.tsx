"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// A calm, fullscreen deep-zoom for an artwork (Phase 14 M-G2). Opened by tapping
// the art on a Gallery card; loads the sanctioned larger public-domain image
// (IIIF 1686px) and lets you pinch / double-tap / wheel to zoom and drag to pan.
//
// Rendered through a PORTAL to <body> so it visually escapes the card, but React
// synthetic events still bubble through the COMPONENT tree (a portal's events
// reach its React parent, not just its DOM parent). So we explicitly stop touch
// and wheel events at the dialog root — otherwise a pinch/pan/drag while zooming,
// or the tap that closes it, bubbles up to the feed's gesture handlers on /drift
// and gets read as an advance or a realm-cross (you close the image and land on a
// new card). The stop happens ABOVE the zoom library's own inner handlers, so
// pinch/pan/double-tap still work. Close via ✕, Esc, or a tap on the empty
// backdrop; body scroll is locked while open.
export function ArtZoom({
  src,
  alt,
  blurDataUrl,
  onClose,
}: {
  src: string;
  alt: string;
  blurDataUrl?: string;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Capture phase so our close fires before the zoom library can swallow the
    // first Escape keydown internally.
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  // Move focus into the dialog on open (proper modal behavior + so Escape works
  // even when the trigger button kept focus).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Artwork, zoomable"}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/95"
      // A tap on the empty backdrop (not the image or controls) closes.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // Keep the zoom's gestures from reaching the feed's advance/cross handlers,
      // which sit above this portal in the React tree (see the note above). Stop
      // (never preventDefault) so the zoom library keeps its native pinch/pan.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {blurDataUrl && !loaded && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-30 blur-2xl"
          draggable={false}
        />
      )}

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-paper/90 text-ink shadow ring-1 ring-line transition hover:bg-paper"
        style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={6}
        centerOnInit
        doubleClick={{ mode: "toggle", step: 1.8 }}
        wheel={{ step: 0.18 }}
        pinch={{ step: 6 }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={src}
            alt={alt}
            onLoad={() => setLoaded(true)}
            className="max-h-[92vh] max-w-[96vw] select-none object-contain"
            draggable={false}
          />
        </TransformComponent>
      </TransformWrapper>

      <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs text-paper/70">
        Pinch or double-tap to zoom · ✕ to close
      </p>
    </div>,
    document.body,
  );
}
