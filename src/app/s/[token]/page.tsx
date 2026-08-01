import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/BrandLogo";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicShareView } from "@/components/PublicShareView";
import { fetchPublicShare } from "@/lib/publicshare/server";
import { shareDescriptionOf, shareTitleOf } from "@/lib/publicshare/link";

// ---------------------------------------------------------------------------
// /s/<token> — what someone sees when a Drift link arrives in their chat.
//
// This is the only page in Drift that is BOTH reachable without an account and
// carrying real content. Everything about it follows from that.
//
// A SERVER COMPONENT, and it has to be. Two independent reasons:
//   1. WhatsApp's link-preview crawler runs no JavaScript, so the og: tags must
//      be in the HTML the server sends. `generateMetadata` needs the share,
//      which means the fetch cannot live in a client effect.
//   2. The reader may have no account and did not ask to be here. Serving the
//      thing they were promised immediately, rather than a spinner that resolves
//      into it, is the difference between a link worth opening and one that
//      feels like a landing page.
//
// The interactive parts (saving it if you are signed in, the short trial if you
// are not) are a client island below. The READ never depends on them.
// ---------------------------------------------------------------------------

// Dynamic by nature: one row per token, and revocation must take effect at once.
// A share that is revoked has to stop resolving immediately, so nothing here is
// cached at the edge.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const share = await fetchPublicShare(token);

  // ⚠️ `noindex` on BOTH branches, deliberately. A share token is a capability:
  // a search engine that lists one has handed it to everyone. See
  // PUBLIC_SHARE_PREFIX in lib/site.ts for the other two reasons.
  const robots = { index: false, follow: false } as const;

  if (!share) {
    return { title: "This link is not available", robots };
  }

  const title = shareTitleOf(share);
  const description = shareDescriptionOf(share);
  return {
    title,
    description,
    robots,
    // No `alternates.canonical`: a canonical URL is a request to index, which is
    // the opposite of what this page wants.
    openGraph: {
      type: "article",
      siteName: "Drift",
      title,
      description,
      // The image itself comes from opengraph-image.tsx in this folder, which
      // Next wires up automatically. It carries titles and shape only, never the
      // source images: arranging third-party pictures into a composite is what
      // makes an artefact Adapted Material under CC BY-SA 4.0, which is the same
      // reasoning that took images out of the PNG export (audit B-5).
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const share = await fetchPublicShare(token);

  if (!share) {
    // One state for every kind of dead link: revoked, mistyped, expired from a
    // deleted account, or never real. A reader cannot act on the difference, and
    // anyone probing for tokens learns nothing from it.
    return (
      <div className="flex min-h-dvh flex-col bg-paper">
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <Monogram className="h-9" />
          <h1 className="font-serif text-3xl text-ink">
            This link is not available
          </h1>
          <p className="text-base leading-relaxed text-ink-soft">
            It may have been withdrawn by the person who shared it, or the
            address may be incomplete. Chat apps sometimes cut long links in
            half, so it is worth checking you copied all of it.
          </p>
          <Link
            href="/"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong focus-ring"
          >
            See what Drift is
          </Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-12 pt-10 sm:pt-14">
        <header className="flex flex-col items-center gap-3 text-center">
          <Link href="/" className="transition hover:opacity-80">
            <Monogram className="h-7" />
          </Link>
          {/* Says what happened, not who did it. The sender's identity is not in
              the payload and is not ours to add: a link is often forwarded on,
              and by the third hop "Thomas sent you this" would be false. */}
          <p className="text-sm text-ink-soft">
            Someone shared {share.kind === "trail" ? "a trail" : "this"} from
            Drift with you
          </p>
        </header>

        <PublicShareView share={share} />
      </main>
      <PublicFooter />
    </div>
  );
}
