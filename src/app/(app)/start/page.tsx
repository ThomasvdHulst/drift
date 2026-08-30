import Link from "next/link";
import { Wordmark } from "@/components/BrandLogo";
import { PublicFooter } from "@/components/PublicFooter";
import { StartInstall } from "@/components/InstallGuide";
import { KindIcon } from "@/components/ThreadChips";

export const metadata = {
  title: "Start here",
  description:
    "You scanned a Drift code. Here is what Drift is, and how to put it on your home screen.",
  // Public, crawlable, and deliberately NOT indexed. This page retells the
  // landing page for someone holding a phone, so letting it into the index puts
  // a near-duplicate of `/` in search results and splits the one page that is
  // actually meant to rank. It is left OUT of robots.ts on purpose: robots.txt
  // only asks a crawler not to FETCH a URL, and a crawler that never fetches
  // never learns the page said noindex. See PUBLIC_UTILITY_ROUTES in lib/site.ts.
  robots: { index: false, follow: true },
  // No `alternates.canonical`: a canonical URL is a request to index.
};

// ---------------------------------------------------------------------------
// /start — where a QR code from a sticker or a flyer lands.
//
// The reader arrives standing up, on a phone, from a code on a lamppost, knowing
// nothing. That is a different person from the one who visits `/`, so this is a
// different page and not a redirect to the landing:
//
//   * `/` is a long scroll that argues the case. This has one screen to say what
//     Drift is before a thumb closes it.
//   * `/install` explains both platforms to someone who already wants Drift.
//     This has to create the wanting first, then install, in that order.
//
// So the shape is: what this is, what it looks like, then the three steps, with
// the home-screen step carrying real platform-aware help rather than a link
// somewhere else. Every claim on this page is one the site already makes
// elsewhere in the same words (CLAUDE.md §2: a flyer that oversells Drift
// contradicts the only thing Drift is selling).
//
// It is PUBLIC, so it renders for someone who is already signed in too, and that
// person needs the opposite button. The swap is done in CSS off the pre-paint
// `data-session` flag rather than in a branch here, for the reason spelled out
// in globals.css: the session lives in localStorage, so the server cannot know,
// and a post-hydration branch would flash the wrong button first.
export default function StartPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* Catch Chrome's install prompt BEFORE React hydrates. The event fires on
          load, usually earlier than <StartInstall> can mount, and it is only
          usable if it was preventDefault()ed at that moment. Parking it on
          `window` from an inline script scoped to this page is the difference
          between the one-tap install button appearing reliably and appearing by
          luck. With the script blocked, nothing breaks: the written steps are
          the fallback and are never wrong. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{window.__driftInstall=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__driftInstall=e;window.dispatchEvent(new Event('drift:installable'));});}catch(e){}})();",
        }}
      />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10 sm:py-14">
        {/* --- What is this --- */}
        <header>
          <Wordmark className="h-12 sm:h-14" />
          <h1 className="mt-7 font-serif text-4xl leading-tight text-ink sm:text-5xl">
            Pull a thread. See where it goes.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink/75">
            Drift is a calm feed of full-screen knowledge cards, from Wikipedia
            and The Metropolitan Museum of Art. Every card shows threads you can
            pull to decide what comes next, and nothing moves until you do. When
            you stop, you get a map of where you went.
          </p>

          <div className="mt-7 flex flex-col gap-3">
            {/* Both buttons ship in the HTML every visitor receives; CSS picks. */}
            <Link
              data-cta-signed-out
              href="/#join"
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
            >
              Create your free account
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              data-cta-signed-in
              href="/drift"
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
            >
              Open Drift
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/"
              className="focus-ring rounded text-center text-sm text-ink-soft transition hover:text-ink"
            >
              or look around first
            </Link>
          </div>

          {/* The site's own wording, kept verbatim. "Free" on its own stopped
              being the whole truth in Phase 32: reading is free every day, but
              free reading has a daily allowance, so this says the part that is
              unconditional and nothing more. */}
          <p className="mt-4 text-xs text-ink-soft">
            Free to read · your trails stay private to your account
          </p>
        </header>

        {/* --- What it looks like --- */}
        <section className="mt-12">
          <CardPreview />
          <p className="mt-3 text-center text-sm leading-relaxed text-ink-soft">
            One card at a time, with the threads visible.
          </p>
        </section>

        {/* --- How to get there --- */}
        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Three steps
          </h2>

          <ol className="mt-5 space-y-8">
            <BigStep n={1} title="Create your free account">
              <p>
                It keeps your trails on your own account, so they follow you
                between your phone and your laptop. No one else can see them.
              </p>
              <Link
                data-cta-signed-out
                href="/#join"
                className="focus-ring mt-3 inline-flex items-center gap-1 rounded font-medium text-accent-strong hover:underline"
              >
                Create an account
                <span aria-hidden="true">→</span>
              </Link>
            </BigStep>

            <BigStep n={2} title="Add Drift to your home screen">
              <p className="mb-4">
                Drift is a web app, so there is no app store and nothing to
                download. Adding it to your home screen gives it its own icon and
                opens it full screen, with no browser bar. It takes a few taps
                and is worth doing.
              </p>
              <StartInstall />
            </BigStep>

            <BigStep n={3} title="Pull a thread">
              <p>
                Pick a card that looks interesting and follow it. Nothing
                autoplays and nothing is queued up behind it, so you set the
                pace. When you stop, you get the map.
              </p>
            </BigStep>
          </ol>
        </section>

        {/* --- The reassurance a stranger actually wants --- */}
        <section className="mt-12 rounded-2xl border border-line bg-paper-raised p-5">
          <p className="text-sm leading-relaxed text-ink/75">
            <span className="font-medium text-ink">
              No advertising, no tracking, no third-party cookies.
            </span>{" "}
            Nothing ranks the cards for you; the threads under each one are the
            steering. Drift is one person&apos;s project, and everything in it
            comes from openly licensed sources written by people.
          </p>
          <p className="mt-3 text-sm">
            <Link
              href="/principles"
              className="focus-ring rounded text-accent-strong hover:underline"
            >
              Read the principles
            </Link>
            <span className="text-ink-soft"> · </span>
            <Link
              href="/privacy"
              className="focus-ring rounded text-accent-strong hover:underline"
            >
              What Drift stores
            </Link>
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function BigStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 font-serif text-base text-accent-strong"
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-serif text-xl text-ink">{title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-ink/75">
          {children}
        </div>
      </div>
    </li>
  );
}

// A still of one card, so the page shows the product instead of only describing
// it. Deliberately the same artwork and the same three threads as the landing
// page's interactive demo and the printed flyer, so someone who scanned a
// sticker, then opened the site, sees one thing rather than three.
//
// The picture is the copy already hosted at /landing/, credited on /colophon
// under "Illustrations" (CC0, The Art Institute of Chicago), which the footer at
// the bottom of this page links to. `aria-hidden` on the chips: they are a
// picture of an interface, not an interface, so a screen reader should read the
// caption underneath and skip this.
function CardPreview() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-sm"
    >
      <img
        src="/landing/great-wave.jpg"
        alt=""
        className="h-44 w-full object-cover sm:h-52"
      />
      <div className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
          Woodblock print · Hokusai, c. 1831
        </p>
        <p className="mt-1 font-serif text-xl text-ink">
          The Great Wave off Kanagawa
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink/75">
          A towering wave curls over three boats while Mount Fuji sits small and
          calm in the distance.
        </p>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
          Pull a thread
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {/* The words match KIND_META in ThreadChips.tsx. They are written out
              rather than imported because that module is a client component and
              this page is server-rendered. */}
          <PreviewChip kind="zoomout" word="Zoom out" label="Ukiyo-e" />
          <PreviewChip kind="tangent" word="Tangent" label="Impressionism" />
          <PreviewChip kind="nearby" word="Nearby" label="Mount Fuji" />
        </div>
      </div>
    </div>
  );
}

function PreviewChip({
  kind,
  word,
  label,
}: {
  kind: "zoomout" | "tangent" | "nearby";
  word: string;
  label: string;
}) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5 rounded-2xl border border-accent/35 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent-strong">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
        <KindIcon kind={kind} size={11} />
        {word}
      </span>
      <span>{label}</span>
    </span>
  );
}
