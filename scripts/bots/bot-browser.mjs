// ---------------------------------------------------------------------------
// Drift · load-test harness — the browser driver.
//
// A handful of these run alongside the HTTP bots. They are slow and expensive,
// so they are not the volume; they are the PROOF. The HTTP driver is a model of
// what the app does, and a model can be wrong in a way that still produces a
// confident report. A real Chromium signing in, dismissing the welcome, pulling
// threads and watching card titles change is the thing that can catch that.
//
// One browser, one CONTEXT per bot. A context has its own localStorage and its
// own IndexedDB, which is what makes each bot a separate reader — and it costs a
// fraction of a whole browser per bot, on a machine that is also hosting three
// copies of the app.
//
// Driven by KEYBOARD, not by simulated swipes. The feed binds these itself (the
// keydown effect in drift/ContinuousFeed.tsx): ArrowDown scrolls on one card,
// 1/2/3 pull the first, second or third thread, ArrowUp scrolls back. They move
// the real scroller by exactly one snap point, and they do not depend on
// hit-testing an element that is moving, which is what makes a gesture-driven
// bot flaky rather than informative.
//
// ⚠️ FOUR CARDS ARE IN THE DOM AT ONCE AND `.first()` IS THEREFORE A TRAP. The
// feed is a scroll-snap scroller: the committed trail is above the reader, a
// three-card queue is below, and the topmost `main h1` is the FIRST STOP OF THE
// SESSION, forever. Measured against the real feed: three ArrowDowns, and
// `main h1`.first() still read "Volcano" while the reader was on "Glacier". A
// bot reading it sees a title that never changes, presses three times, and
// reports the app as `stopped advancing` on its very first move — a completely
// healthy app, scored as broken, in a report nobody would doubt. Everything here
// reads the ACTIVE slot instead (`currentTitle` below), the same way
// scripts/verify-feed.mjs does.
// ---------------------------------------------------------------------------

import {
  dwellMs,
  chooseMove,
  shouldReadMore,
  sessionLength,
} from "./behaviour.mjs";

/** The scroller. Its aria-label is what a keyboard reader is offered, and it is
 *  the only stable handle on the feed from outside. */
const SCROLLER = '[aria-label="Your drift"]';

export async function runBrowserBot({
  browser,
  id,
  realm,
  base,
  rng,
  speed,
  account,
  deadline,
  signal,
}) {
  const stats = {
    id,
    driver: "browser",
    realm,
    speed: Number(speed.toFixed(2)),
    cards: 0,
    drifts: 0,
    threads: 0,
    backs: 0,
    readMores: 0,
    refills: 0,
    retries: 0,
    requests: 0,
    errors: [],
    consoleErrors: [],
    titles: [],
    startedAt: Date.now(),
    timeToFirstCardMs: null,
    cardLatencies: [],
    endedAt: null,
    endedBecause: "finished",
  };

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    // Reduced motion keeps the card transition short, so a bot is not measuring
    // spring animation. It is a real setting real readers use, not a test hack.
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  // Count every request this bot makes, so the browser driver's cost per card
  // can be compared against the HTTP driver's. That comparison is the
  // calibration gate: if the two disagree, the volume bots are lying.
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith("/api/")) {
      stats.requests++;
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") stats.consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on("pageerror", (err) => stats.consoleErrors.push(String(err).slice(0, 200)));

  try {
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 45000 });

    // ----- sign in through the real form -----
    // Not by injecting a session into localStorage: only a few bots do this, so
    // the per-IP cost is nothing, and it means the run also proves the sign-in
    // path still works under load rather than assuming it.
    const form = page.locator("form").filter({ has: page.locator('input[type="email"]') }).first();
    await page.locator('a[href="#join"]').first().click().catch(() => {});
    await form.waitFor({ state: "visible", timeout: 30000 });
    await form.getByRole("button", { name: "Sign in", exact: true }).click();
    await form.locator('input[type="email"]').fill(account.email);
    await form.locator('input[autocomplete="current-password"]').fill(account.password);
    await form.locator('button[type="submit"]').click();

    // The app itself only renders once AuthGate has a user, so the realm tabs
    // appearing IS the proof that the sign-in landed.
    await page.locator('[data-tour="realm-tabs"]').waitFor({ state: "visible", timeout: 45000 });

    // ----- the first-run welcome -----
    // It auto-offers once per account, so every fresh bot meets it. "Maybe
    // later" is the dismissal (tour/WelcomeModal.tsx:62). `.catch` because a bot
    // reusing an account from a previous run will not be offered it again.
    await page
      .getByRole("button", { name: "Maybe later" })
      .click({ timeout: 6000 })
      .catch(() => {});

    // ----- start a drift in this bot's realm -----
    if (realm === "gallery") {
      await page.getByRole("tab", { name: /Gallery/i }).click();
    }
    await page.locator('[data-tour="drift-cta"]').click();

    const firstTitle = await waitForCard(page, null, 60000);
    if (!firstTitle) {
      stats.endedBecause = "no seed card";
      return await finish();
    }
    stats.timeToFirstCardMs = Date.now() - stats.startedAt;
    stats.titles.push(firstTitle);

    const target = sessionLength(rng);
    let title = firstTitle;

    while (stats.cards < target && Date.now() < deadline && !signal.aborted) {
      stats.cards++;

      if (shouldReadMore(rng)) {
        const more = page.locator('[data-tour="card-readmore"]').first();
        if (await more.isVisible().catch(() => false)) {
          await more.click().catch(() => {});
          stats.readMores++;
        }
      }

      await sleep(dwellMs(rng, speed), signal);
      if (signal.aborted || Date.now() >= deadline) break;

      // How many thread chips are actually on screen decides which keys mean
      // anything: pressing "3" with two chips does nothing at all, and a bot
      // that did it would sit there looking like a broken app.
      // `:visible` because the card renders its threads TWICE — pinned beside
      // the text on a desktop, inlined for a phone, one of them always
      // `md:hidden`. Without it the count is exactly doubled (measured: 8 for
      // four chips), which makes a bot press "3" on a card with two threads.
      const chips = await page
        .locator('[data-tour="card-threads"] button:visible')
        .count()
        .catch(() => 0);

      const move = chips > 0 ? chooseMove(rng) : "drift";
      const moveStarted = Date.now();

      if (move === "back") {
        stats.backs++;
        await page.keyboard.press("ArrowUp");
        await sleep(Math.round(dwellMs(rng, speed) * 0.4), signal);
        title = await currentTitle(page);
        continue;
      }

      const key =
        move === "thread"
          ? String(1 + Math.floor(rng() * Math.min(3, chips)))
          : "ArrowDown";
      // The keys are bound on `window`, but the scroller has to hold focus or a
      // stray click on a card leaves focus somewhere that swallows them.
      await page.locator(SCROLLER).focus().catch(() => {});
      if (move === "thread") stats.threads++;
      else stats.drifts++;
      await page.keyboard.press(key);

      // The proof that the move landed: the heading changed. Without this a
      // wedged bot would keep "reading" the same card and the report would count
      // cards that were never shown.
      //
      // ⚠️ AND IT HAS TO BE PRESSED AGAIN WHEN NOTHING HAPPENS. The reason
      // changed with the feed and is worth stating precisely, because the
      // counter it feeds is a real signal about the app. It used to be the busy
      // lock: `advance` and `onThread` early-returned while `busyRef` was set,
      // which it was for the whole of a buffer refill. In the scroller ArrowDown
      // always scrolls — but it can only scroll onto a card that EXISTS, so a
      // press that finds the queue empty (a refill in flight, or a source
      // backing off) lands on nothing. Either way it is a moment a reader felt
      // the app not respond, which is what `retries` counts.
      //
      // The retry count is kept, because it is a real signal about the app: a
      // press needing a second go is a moment a reader felt the app not respond.
      let next = await waitForCard(page, title, 8000);
      for (let attempt = 0; !next && attempt < 2; attempt++) {
        stats.retries++;
        await page.keyboard.press(key);
        next = await waitForCard(page, title, 12000);
      }
      if (!next) {
        stats.errors.push(
          `card did not advance after ${move}, three presses (was "${title}")`,
        );
        stats.endedBecause = "stopped advancing";
        break;
      }
      stats.cardLatencies.push(Date.now() - moveStarted);
      title = next;
      stats.titles.push(next);
    }

    if (stats.cards >= target) stats.endedBecause = "finished";
    else if (Date.now() >= deadline && stats.endedBecause === "finished") {
      stats.endedBecause = "time up";
    }
    return await finish();
  } catch (err) {
    if (!signal.aborted) {
      stats.errors.push(String(err?.message ?? err).slice(0, 200));
      stats.endedBecause = `error: ${String(err?.message ?? err).slice(0, 120)}`;
    } else {
      stats.endedBecause = "run ended";
    }
    return await finish();
  }

  async function finish() {
    stats.endedAt = Date.now();
    await context.close().catch(() => {});
    return stats;
  }
}

/**
 * The heading of the card the reader is actually ON, or "".
 *
 * Derived from the scroller's own geometry rather than from the DOM order,
 * because every item is exactly one scroller-height by construction (that is
 * invariant 5 of the feed, and the thing the whole design rests on). So
 * `scrollTop / clientHeight` IS the index of the active slot. Same shape as
 * `activeSlot()` in scripts/verify-feed.mjs — deliberately, so there is one way
 * to ask this question and not two that can disagree.
 */
async function currentTitle(page) {
  return await page
    .evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return "";
      const i = Math.round(el.scrollTop / el.clientHeight);
      const slot = el.querySelectorAll("[data-slot]")[i];
      return slot?.querySelector("h1")?.textContent?.trim() ?? "";
    }, SCROLLER)
    .catch(() => "");
}

/**
 * Wait until the active card's heading is present and different from `previous`.
 *
 * Polling rather than `waitForSelector`, because the selector never changes —
 * the question is which slot the scroller has settled on, which only the
 * geometry above can answer.
 */
async function waitForCard(page, previous, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const t = await currentTitle(page);
    if (t && t !== previous) return t;
    await page.waitForTimeout(200);
  }
  return null;
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}
