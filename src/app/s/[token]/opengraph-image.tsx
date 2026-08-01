import { ImageResponse } from "next/og";
import { fetchPublicShare } from "@/lib/publicshare/server";
import { shareTitleOf } from "@/lib/publicshare/link";
import type { TrailSnapshot } from "@/lib/social/share";
import type { Card } from "@/lib/types";

// ---------------------------------------------------------------------------
// The link preview: the card WhatsApp draws under a pasted Drift link.
//
// ⚠️ NO SOURCE IMAGES IN HERE, AND THAT IS A LICENCE RULE RATHER THAN A DESIGN
// CHOICE. Arranging several third-party pictures into one new composite graphic
// is what makes an artefact "Adapted Material" under CC BY-SA 4.0, which brings
// §3(b) ShareAlike with it: the composite would itself have to be licensed and
// carry the licence. It is the exact reasoning that took images out of the PNG
// trail-map export (compliance audit B-5), and a preview image is a worse place
// to get it wrong, because this one is BUILT to be forwarded, cached by other
// companies' servers, and seen out of context.
//
// So: titles, the shape of the trail, the Drift mark, and a burned-in credit
// line. Titles alone are de minimis, the same conclusion the audit reached for
// the plain-text export.
//
// WhatsApp specifics that shaped the layout: 1200x630 is the safe size, it
// centre-crops anything that is not roughly 1.91:1, and previews reliably fail
// over ~300KB. Flat colour and no photographs keeps a PNG of this size far under
// that. It also caches previews for days with no way to force a refresh, so this
// has to be right the first time.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A trail shared from Drift";

// The quiet reading room, as literal values: ImageResponse resolves no CSS
// variables, so globals.css cannot be the source of truth here. These are the
// light-theme paper/ink/accent tokens.
const PAPER = "#f5efe4";
const INK = "#2b2723";
const INK_SOFT = "#6b6259";
const ACCENT = "#6f8f74";

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await fetchPublicShare(token);

  // A dead or unknown token still gets a well-formed card. Chat apps cache
  // aggressively and a broken image would outlive the mistake.
  const title = share ? shareTitleOf(share) : "Drift";
  const stops =
    share?.kind === "trail"
      ? (share.payload as TrailSnapshot).steps
          .map((s) => s.card?.displayTitle)
          .filter((t): t is string => !!t)
      : share?.kind === "card"
        ? [(share.payload as Card).displayTitle].filter(Boolean)
        : [];

  // Four is what fits at a readable size; the count below tells the truth about
  // the rest rather than silently dropping it.
  const shown = stops.slice(0, 4);
  const rest = stops.length - shown.length;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: PAPER,
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              color: ACCENT,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Drift
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: title.length > 46 ? 58 : 72,
              lineHeight: 1.1,
              color: INK,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
        </div>

        {/* The trail as a row of stops: a dot per card with its title beneath.
            This is the "shape" the reader is being shown, and it is built from
            titles only. */}
        {shown.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
            {shown.map((t, i) => (
              <div
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 0 }}
              >
                <div style={{ display: "flex", flexDirection: "column", maxWidth: 210 }}>
                  <div
                    style={{
                      display: "flex",
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: ACCENT,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      marginTop: 12,
                      fontSize: 24,
                      color: INK,
                      lineHeight: 1.25,
                    }}
                  >
                    {t.length > 34 ? `${t.slice(0, 33)}…` : t}
                  </div>
                </div>
                {i < shown.length - 1 && (
                  <div
                    style={{
                      display: "flex",
                      width: 56,
                      height: 3,
                      backgroundColor: ACCENT,
                      opacity: 0.45,
                      margin: "0 14px",
                      marginBottom: 40,
                    }}
                  />
                )}
              </div>
            ))}
            {rest > 0 && (
              <div
                style={{
                  display: "flex",
                  marginLeft: 24,
                  marginTop: -2,
                  fontSize: 24,
                  color: INK_SOFT,
                }}
              >
                +{rest} more
              </div>
            )}
          </div>
        )}

        {/* The credit, burned in. Same line the PNG export carries, for the same
            reason: this file travels away from any page that could carry it. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: INK_SOFT,
          }}
        >
          <div style={{ display: "flex" }}>
            Titles from Wikipedia · CC BY-SA 4.0
          </div>
          <div style={{ display: "flex" }}>usedrift.org</div>
        </div>
      </div>
    ),
    size,
  );
}
