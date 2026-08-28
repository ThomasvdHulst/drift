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
// Driven by KEYBOARD, not by simulated swipes. The feed binds these itself
// (the keydown effect in drift/page.tsx): ArrowDown drifts onward, 1/2/3 pull
// the first, second or third thread, ArrowUp goes back. They run through
// exactly the same handlers a gesture does, and they do not depend on
// hit-testing an animated element,
// which is what makes a gesture-driven bot flaky rather than informative.
// ---------------------------------------------------------------------------

import {
  dwellMs,
  chooseMove,
  shouldReadMore,
  sessionLength,
} from "./behaviour.mjs";

/** The card heading. Two cards are in the DOM mid-transition, hence `.first()`. */
const TITLE = "main h1";

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
      const chips = await page
        .locator('[data-tour="card-threads"] button')
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
      if (move === "thread") stats.threads++;
      else stats.drifts++;
      await page.keyboard.press(key);

      // The proof that the move landed: the heading changed. Without this a
      // wedged bot would keep "reading" the same card and the report would count
      // cards that were never shown.
      //
      // ⚠️ AND IT HAS TO BE PRESSED AGAIN WHEN NOTHING HAPPENS. Both `advance`
      // and `onThread` early-return while `busyRef` is set (drift/useDriftSession.ts),
      // which it is for the whole of a buffer refill — so a press that lands
      // during one is dropped. A reader sees the loading state and presses
      // again; a bot that waited 30 seconds and gave up recorded the app as
      // broken when it was merely busy, which is how all three browser bots
      // "stopped advancing" in the 25-bot run while the museum was throttling.
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

/** The heading currently on screen, or "". */
async function currentTitle(page) {
  return await page
    .locator(TITLE)
    .first()
    .textContent({ timeout: 5000 })
    .then((t) => (t ?? "").trim())
    .catch(() => "");
}

/**
 * Wait until a card heading is present and different from `previous`.
 *
 * Polling rather than `waitForSelector`, because during a transition BOTH the
 * outgoing and incoming card are in the DOM and the first match can briefly
 * still be the old one.
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
