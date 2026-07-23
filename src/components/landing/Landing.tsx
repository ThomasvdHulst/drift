"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Wordmark, Monogram } from "@/components/BrandLogo";
import { PublicFooter } from "@/components/PublicFooter";
import { AuthForm } from "@/components/AuthForm";
import { TrailMap } from "@/components/TrailMap";
import { KindIcon, KIND_META } from "@/components/ThreadChips";
import type { ThreadKind } from "@/lib/types";
import { ThreadDemo } from "./ThreadDemo";
import { Reveal } from "./Reveal";
import { DEMO_CARDS, EXAMPLE_TRAILS } from "./data";

// The logged-out landing page. This IS the AuthGate's signed-out view when the
// cloud is configured (the hosted app) — so the app stays fully login-gated, and
// a backend-less clone never sees any of this (graceful degradation, §4). It's a
// calm, concept-first pitch: show the core mechanic (the interactive demo), the
// shape of a session, and why Drift is the opposite of a slot machine — then
// invite people in. Everything honors §2 even here: no autoplay, honest copy.

const HERO = DEMO_CARDS[3]; // Impressionism (Monet, Stacks of Wheat), a warm
// counterpoint to the demo below, which starts on The Great Wave.

export function Landing() {
  const reduce = useReducedMotion();

  // Show a random example trail in the "reward" section on each visit, so the
  // page feels a little fresh. Chosen after mount rather than during render, so
  // it can't cause a hydration mismatch now that `/` server-renders this page
  // (AuthGate), and the reward section sits below the fold so there's no flash.
  const [trailIdx, setTrailIdx] = useState(0);
  useEffect(() => {
    // Defer off the synchronous effect path (React 19 forbids sync setState in
    // an effect body — same pattern as AuthProvider).
    queueMicrotask(() =>
      setTrailIdx(Math.floor(Math.random() * EXAMPLE_TRAILS.length)),
    );
  }, []);

  function goToJoin(e: React.MouseEvent) {
    e.preventDefault();
    document
      .getElementById("join")
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="min-h-dvh">
      {/* --- Sticky top bar --- */}
      <header className="sticky top-0 z-20 border-b border-line/60 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <Wordmark className="h-7" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/about"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:text-accent-strong sm:px-4"
            >
              About
            </Link>
            <a
              href="#join"
              onClick={goToJoin}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:text-accent-strong sm:px-4"
            >
              Sign in
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6">
        {/* --- Hero --- */}
        <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-14">
          <div className="text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <Wordmark className="h-20 sm:h-24" />
            </div>
            <p className="-mt-1 text-lg text-ink-soft sm:text-xl">
              Pull a thread. See where it goes.
            </p>
            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-ink/80 lg:mx-0">
              A calm feed of knowledge cards where <em>you</em> are the
              algorithm. No autoplay, no hidden ranking. Every card shows visible
              threads you can pull to steer your own rabbit hole, and every
              session ends with a map of where your curiosity wandered.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <a
                href="#join"
                onClick={goToJoin}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong sm:w-auto"
              >
                Create your account
                <span aria-hidden="true">→</span>
              </a>
              <a
                href="#join"
                onClick={goToJoin}
                className="text-sm text-ink-soft transition hover:text-ink"
              >
                or sign in
              </a>
            </div>
            <p className="mt-4 text-xs text-ink-soft/80">
              Free · your trails stay private to your account
            </p>
          </div>

          <FloatingCard reduce={!!reduce} />
        </section>

        {/* --- Interactive demo (the centerpiece) --- */}
        <Reveal as="section" className="py-14 sm:py-20">
          <SectionHeading
            eyebrow="Try it. You steer"
            title="Pull a thread, and the feed follows you"
          />
          <p className="mx-auto mb-8 max-w-xl text-center text-base leading-relaxed text-ink/75">
            Here&apos;s a little rabbit hole you can actually wander. Pull a
            thread and watch where it leads. Nothing moves until you do. That&apos;s
            the whole idea.
          </p>
          <ThreadDemo />
        </Reveal>

        {/* --- How it works — every session has a shape --- */}
        <Reveal as="section" className="py-14 sm:py-20">
          <SectionHeading
            eyebrow="Every session has a shape"
            title="A beginning, a middle, and an end you can keep"
          />
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            <Step
              n={1}
              title="Start"
              body="Begin with a topic seed, pick a realm, or let curiosity surprise you. A clear beginning, not an endless feed."
            />
            <Step
              n={2}
              title="Steer"
              body="Pull the visible threads to choose your own direction. You always see why the next card appeared: the thread you chose, or an honest “drift”."
            >
              <DirectionGlyphs />
            </Step>
            <Step
              n={3}
              title="Arrive"
              body="Every wander becomes a trail map you can save and share. The reward waits at the exit, never at the next swipe."
            />
          </ol>
        </Reveal>

        {/* --- The trail-map reward (reuses the real component) --- */}
        <Reveal as="section" className="py-14 sm:py-20">
          <SectionHeading
            eyebrow="The reward"
            title="Where your curiosity actually went"
          />
          <p className="mx-auto mb-8 max-w-xl text-center text-base leading-relaxed text-ink/75">
            No streaks, no counters to feed. Just a quiet map of your rabbit
            hole: the stops you made and the threads that took you there.
          </p>
          <div className="mx-auto max-w-xl rounded-2xl border border-line bg-paper-raised/60 p-4 sm:p-6">
            <TrailMap steps={EXAMPLE_TRAILS[trailIdx]} />
          </div>
        </Reveal>

        {/* --- What makes it different (the anti-slot-machine soul) --- */}
        <Reveal as="section" className="py-14 sm:py-20">
          <SectionHeading
            eyebrow="The opposite of a casino"
            title="Built to be put down, not to trap you"
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <Principle
              title="Transparency over opacity"
              body="You always see why a card appeared. No hidden ranking deciding what's good for you."
              icon={
                <>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                </>
              }
            />
            <Principle
              title="Agency over autoplay"
              body="Nothing advances on its own. Every card waits for you to choose. No bottomless feed teasing “just one more”."
              icon={
                <>
                  <path d="M8 5v14l11-7z" />
                  <path d="M3 4v16" />
                </>
              }
            />
            <Principle
              title="Sessions have shape"
              body="A beginning, a middle, and an end. The trail map is the payoff, placed at the exit."
              icon={
                <>
                  <path d="M4 19c4-1 4-9 8-10s4 8 8 7" />
                  <circle cx="4" cy="19" r="1.6" />
                  <circle cx="20" cy="16" r="1.6" />
                </>
              }
            />
            <Principle
              title="Gentle awareness, not guilt"
              body="A quiet count of your stops and a soft nudge after a while. No red badges, no streaks, no notification bait."
              icon={
                <>
                  <path d="M12 3a6 6 0 0 0-6 6c0 4-2 5-2 5h16s-2-1-2-5a6 6 0 0 0-6-6z" />
                  <path d="M10 20a2 2 0 0 0 4 0" />
                </>
              }
            />
          </div>
        </Reveal>

        {/* --- Realms --- */}
        <Reveal as="section" className="py-14 sm:py-20">
          <SectionHeading
            eyebrow="Vetted human knowledge"
            title="Vetted realms, one calm reading room"
          />
          <p className="mx-auto mb-8 max-w-xl text-center text-base leading-relaxed text-ink/75">
            Everything comes from sources curated by people, never scraped. AI is
            never in the driver&apos;s seat. You are.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <RealmPanel
              image="/landing/realm-encyclopedia.jpg"
              glyph="✦"
              label="Encyclopedia"
              body="All of Wikipedia, as full-screen cards. Threads become real directions: go deeper, zoom out, or take a tangent."
            />
            <RealmPanel
              realm="gallery"
              image="/landing/realm-gallery.jpg"
              glyph="❖"
              label="Gallery"
              body="Public-domain art from the Art Institute of Chicago. Follow a thread to more by an artist, a style, or a place."
            />
          </div>
        </Reveal>

        {/* --- Join --- */}
        <section id="join" className="scroll-mt-20 py-14 sm:py-20">
          <div className="mx-auto max-w-md">
            <div className="mb-6 text-center">
              <div className="flex justify-center">
                <Monogram className="h-10" />
              </div>
              <h2 className="mt-4 font-serif text-3xl text-ink sm:text-4xl">
                Ready to wander?
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink/75">
                Create a free account to start drifting. Your trails, interests,
                and reactions stay private to your account and follow you across
                devices.
              </p>
            </div>
            <AuthForm initialMode="signup" />
          </div>
        </section>
      </main>

      {/* Shared across every public page, so navigation is consistent everywhere. */}
      <PublicFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-accent-strong">
        {eyebrow}
      </p>
      <h2 className="mx-auto mt-2 max-w-2xl font-serif text-3xl leading-tight text-ink sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}

// The hero's gently-floating example card — a peek at a real knowledge card. It
// bobs softly (disabled under reduced motion). Decorative only; the interactive
// version lives just below.
function FloatingCard({ reduce }: { reduce: boolean }) {
  const float = reduce
    ? {}
    : {
        animate: { y: [0, -10, 0] },
        transition: {
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };
  return (
    <div className="flex justify-center">
      <motion.div
        {...float}
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-paper-raised shadow-[0_18px_50px_-18px_rgba(43,39,35,0.35)] ring-1 ring-line"
      >
        <div className="relative h-52 overflow-hidden bg-ink/[0.04]">
          <img
            src={HERO.image}
            alt={HERO.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
        <div className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {HERO.description}
          </p>
          <h3 className="mt-1 font-serif text-2xl leading-tight text-ink">
            {HERO.title}
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <StaticChip kind="deeper" label="Claude Monet" />
            <StaticChip kind="tangent" label="Ukiyo-e" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// A non-interactive chip that matches the app's thread chips — for decoration in
// the hero card (the real, tappable ones live in <ThreadDemo/>).
function StaticChip({ kind, label }: { kind: ThreadKind; label: string }) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5 rounded-2xl border border-accent/35 bg-accent/10 px-3.5 py-1.5 text-sm font-medium text-accent-strong">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent-strong/80">
        <KindIcon kind={kind} size={11} />
        {KIND_META[kind].word}
      </span>
      <span>{label}</span>
    </span>
  );
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col items-center text-center sm:items-start sm:text-left">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/12 font-serif text-lg font-semibold text-accent-strong ring-1 ring-accent/25">
        {n}
      </span>
      <h3 className="mt-4 font-serif text-xl text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/75">{body}</p>
      {children}
    </li>
  );
}

// The four thread directions, shown as calm glyph pills under the "Steer" step.
function DirectionGlyphs() {
  const kinds: ThreadKind[] = ["deeper", "zoomout", "tangent", "nearby"];
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
      {kinds.map((k) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/8 px-2.5 py-1 text-[11px] font-medium text-accent-strong"
        >
          <KindIcon kind={k} size={11} />
          {KIND_META[k].word}
        </span>
      ))}
    </div>
  );
}

function Principle({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-paper-raised/60 p-5">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent-strong">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon}
        </svg>
      </span>
      <div>
        <h3 className="font-serif text-lg leading-snug text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink/75">{body}</p>
      </div>
    </div>
  );
}

function RealmPanel({
  realm,
  image,
  glyph,
  label,
  body,
}: {
  realm?: "gallery";
  image: string;
  glyph: string;
  label: string;
  body: string;
}) {
  return (
    <div
      data-realm={realm}
      className="overflow-hidden rounded-2xl border border-line bg-paper-raised/60"
    >
      <div className="relative h-44 overflow-hidden bg-ink/[0.04] sm:h-52">
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="p-5">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong ring-1 ring-accent/30">
          <span aria-hidden="true">{glyph}</span>
          {label}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink/75">{body}</p>
      </div>
    </div>
  );
}
