// ---------------------------------------------------------------------------
// Drift · verify the reading feed end to end.
//
//   NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run build
//   … npx next start -p 3106
//   BASE=http://localhost:3106 npm run verify:feed
//
// WHY THIS EXISTS. The feed's occasional half — forks, re-entry into a saved
// trail, a pool running dry, the day's allowance, the fork switch — is exactly
// the half that survives hand testing unnoticed, because you have to be in an
// unusual place to meet it. Every one of those has broken at least once during
// the continuous-feed work, and none of them is reachable from a unit test: the
// logic is pure and tested, but the wiring between the engine, the scroller and
// the observer is not.
//
// So this drives a real Chromium over the real feed and reports a table. It is a
// VERIFICATION script, not a unit test: it needs a running server and is not
// part of `npm test`, exactly like `audit:contrast`.
//
// ⚠️ IT IS NOT A REPLACEMENT FOR LOOKING. It proves that things happen, not that
// they feel right. The settle window, the seam and the peek are judgements.
//
// Two lessons from writing it, both of which cost time and will again:
//   • Several cards are in the DOM at once, so `.first()` is a trap — it
//     resolves to the topmost card, not the one being read. Scope to the active
//     slot, which is what `activeSlot()` below is for.
//   • `data-tour="card-readmore"` marks a CONTAINER holding "Read more" AND the
//     source link, so clicking its centre lands in the gap. Target the button.
// ---------------------------------------------------------------------------

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3106";
const ONLY = process.env.ONLY ?? "";
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

// A reader's pace. Fast enough to keep the run short, slow enough that the
// one-card-ahead preparation has landed — which is the thing being verified.
const DWELL = Number(process.env.DWELL ?? 2600);

const results = [];
let group = "";
function heading(name) {
  group = name;
  console.log(`\n${name}`);
}
function rec(name, ok, detail) {
  results.push({ group, name, ok });
  const mark = ok ? "\x1b[32mok  \x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  ${mark} ${name}${detail !== undefined ? `  ·  ${detail}` : ""}`);
}

const SCROLLER = '[aria-label="Your drift"]';

async function newPage(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    // A real setting real readers use, and it makes programmatic scrolls
    // instant, which keeps the run deterministic.
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => rec(`no page error (${e.message.slice(0, 60)})`, false));
  return page;
}

async function open(page, url) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  // The first-run welcome and the storage notice both cover the feed; the
  // notice in particular sits over the exit screen's Save button.
  await page.getByRole("button", { name: "Maybe later" }).click({ timeout: 4000 }).catch(() => {});
  await page.getByRole("button", { name: "Got it" }).click({ timeout: 4000 }).catch(() => {});
  await page.locator(SCROLLER).waitFor({ timeout: 45000 }).catch(() => {});
}

const steps = (p) => p.locator("[data-slot^='step:']").count();
/** The far end of the line being read. A fork changes this without changing how
 *  many steps are on screen. */
const lastStepKey = async (p) =>
  (await p.evaluate(() => {
    const keys = [...document.querySelectorAll("[data-slot^='step:']")].map((n) => n.dataset.slot);
    return keys[keys.length - 1] ?? null;
  })) ?? null;
/** The trail's own size, from the counter the reader sees. Unlike the step
 *  slots, this counts the WHOLE tree, so a fork moves it. */
const stopCount = async (p) => {
  const t = (await p.getByText(/\d+ stops?/).first().textContent().catch(() => "")) ?? "";
  return Number(t.match(/(\d+)/)?.[1] ?? 0);
};
const queued = (p) => p.locator("[data-slot^='queued:']").count();
const at = (p) =>
  p.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? el.scrollTop / el.clientHeight : -1;
  }, SCROLLER);

/**
 * Make the feed genuinely unable to find anything new.
 *
 * ⚠️ THERE ARE THREE DOORS, NOT TWO, AND THE THIRD IS THE DOORWAY. When the
 * discover buffer comes up empty, `nextDriftCard` falls back to a random untapped
 * THREAD of the card on screen — and the cross-realm doorway chip is one of those
 * threads. Leaving `/api/doorway` open keeps the feed alive on Gallery cards
 * indefinitely, which is correct behaviour and made these checks fail the moment
 * the fallback started working again. (It had been silently dead: `fill` pinned
 * the engine from one render, so the fallback read an empty thread list forever.)
 *
 * `status` chooses which KIND of nothing: 200 with `[]` is a source that answered
 * and had nothing (a pool read dry), 503 is a source that could not be reached.
 * The feed must tell those two apart — see the RESILIENCE section.
 */
async function blockDry(page, status = 200) {
  const nothing = (r) =>
    r.fulfill({
      status,
      contentType: "application/json",
      body: status === 200 ? "[]" : "{}",
    });
  await page.route("**/api/realm/*/discover*", nothing);
  await page.route("**/api/realm/*/related*", nothing);
  await page.route("**/api/wiki/random*", nothing);
  await page.route("**/api/doorway*", nothing);
}

/** The slot the reader is on. Scoped, because `.first()` is the topmost card. */
async function activeSlot(page) {
  const key = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const i = Math.round(el.scrollTop / el.clientHeight);
    return el.querySelectorAll("[data-slot]")[i]?.dataset.slot ?? null;
  }, SCROLLER);
  return key ? page.locator(`[data-slot="${key}"]`) : null;
}

/**
 * Is ANY match visible?
 *
 * ⚠️ `.first()` IS A TRAP HERE, TWICE OVER, and it has produced a false failure
 * on nearly every run of this file. The card renders its threads twice — pinned
 * beside the text on a desktop and inlined for a phone — so the first match is
 * routinely the copy that is `md:hidden`. And four cards are in the DOM at once,
 * so the first match may belong to a card nobody is looking at.
 */
async function anyVisible(locator) {
  const n = await locator.count();
  for (let i = 0; i < n; i++) {
    if (await locator.nth(i).isVisible().catch(() => false)) return true;
  }
  return false;
}

/** The focus banner's text, or null. Asked of the banner ITSELF rather than by
 *  searching the page for "Within" — an article's own prose contains that word
 *  often enough to fake a passing banner. */
const bannerText = (p) =>
  p.evaluate(
    () =>
      document.querySelector('[data-tour="focus-banner"]')?.textContent?.trim() ??
      null,
  );

async function down(page, n = 1) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(DWELL);
  }
}

// ---------------------------------------------------------------------------

async function run(browser, vp) {
  const routes = {};
  const page = await newPage(browser, vp);
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith("/api/")) return;
    const k = u.pathname
      .replace(/\/api\/realm\/[^/]+\//, "/api/realm/*/")
      .replace(/\/api\/img\/met\/.*/, "/api/img/met/*");
    routes[k] = (routes[k] ?? 0) + 1;
  });

  // ----- the substrate -------------------------------------------------------
  heading(`SUBSTRATE (${vp.name} ${vp.width}x${vp.height})`);
  await open(page, "/drift?title=Octopus&seed=Octopus");
  rec("the scroller renders", (await page.locator(SCROLLER).count()) === 1);
  await page
    .waitForFunction(() => document.querySelectorAll("[data-slot^='queued:']").length >= 3, null, { timeout: 45000 })
    .catch(() => {});
  rec("the queue fills to three ahead and stops", (await queued(page)) === 3, `${await queued(page)} queued`);
  const geom = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const items = [...el.querySelectorAll("[data-slot]")];
    return { h: el.clientHeight, sizes: [...new Set(items.map((i) => Math.round(i.getBoundingClientRect().height)))] };
  }, SCROLLER);
  rec(
    "every item is exactly one scroller-height",
    geom.sizes.length === 1 && Math.abs(geom.sizes[0] - geom.h) <= 2,
    JSON.stringify(geom),
  );
  // The heavy image is loaded for the active card and its neighbours only.
  const heavy = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const items = [...el.querySelectorAll("[data-slot]")];
    return items.map((n) => [...n.querySelectorAll("img")].some((i) => i.src.includes("/api/img/met/")));
  }, SCROLLER);
  rec("proxied images are not loaded for every card at once", heavy.filter(Boolean).length <= 2, JSON.stringify(heavy));

  // ----- moving ---------------------------------------------------------------
  heading("MOVING");
  const before = await steps(page);
  await down(page, 5);
  rec("one card per step, committed once each", (await steps(page)) === before + 5, `${before} -> ${await steps(page)}`);
  const slot = await activeSlot(page);
  const chips = await slot.locator('[data-tour="card-threads"] button').count();
  const loading = await slot.locator('[aria-label="Loading threads"]').count();
  rec("chips are ready on the card you land on", chips > 0 && loading === 0, `${chips} chips`);
  const stopsText = (await page.getByText(/\d+ stops?/).first().textContent().catch(() => "")) ?? "";
  rec("the stop counter agrees with the trail", stopsText.includes(String(await steps(page))), stopsText.trim());

  const held = await steps(page);
  for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowUp"); await page.waitForTimeout(900); }
  rec("scrolling back commits nothing", (await steps(page)) === held);
  for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(900); }
  rec("and forward again commits nothing twice", (await steps(page)) === held, `${held} -> ${await steps(page)}`);

  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.scrollBy({ top: el.clientHeight * 3, behavior: "smooth" });
  }, SCROLLER);
  await page.waitForTimeout(2500);
  rec("a fling commits nothing it passed through", (await steps(page)) - held <= 3, `+${(await steps(page)) - held}`);

  // ----- steering -------------------------------------------------------------
  heading("STEERING");
  await page.waitForTimeout(1500);
  const beforePull = await steps(page);
  await page.keyboard.press("1");
  await page.waitForTimeout(3200);
  rec("a thread pull adds a stop", (await steps(page)) > beforePull, `${beforePull} -> ${await steps(page)}`);
  const ordered = await page.evaluate(() => {
    const keys = [...document.querySelectorAll("[data-slot]")].map((n) => n.dataset.slot);
    const lastStep = keys.map((k) => k.startsWith("step:")).lastIndexOf(true);
    return keys.slice(lastStep + 1).every((k) => !k.startsWith("step:"));
  });
  rec("the queue is rebuilt below the new tip", ordered);

  // A fork: go back a stop and pull from there.
  //
  // ⚠️ COUNTING STEP SLOTS HERE IS WRONG, and it looked like a bug for a while.
  // A fork does not LENGTHEN the displayed line, it REPLACES the part below the
  // fork: `step:0 | step:1 | step:2` becomes `step:0 | step:1 | step:3`. The
  // trail grew, the path did not. So the test is that the line now ends on a
  // different stop, and that the trail's own counter went up.
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(1800);
  const lastBefore = await lastStepKey(page);
  const stopsBefore = await stopCount(page);
  rec(
    "a revisited card says its chips will branch",
    await anyVisible(page.getByText(/Another way from here/i)),
  );
  await page.keyboard.press("1");
  await page.waitForTimeout(3500);
  rec(
    "pulling from a stop you scrolled back to forks",
    (await lastStepKey(page)) !== lastBefore && (await stopCount(page)) > stopsBefore,
    `${lastBefore} -> ${await lastStepKey(page)}, ${stopsBefore} -> ${await stopCount(page)} stops`,
  );
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(1600);
  rec(
    "the fork offers a switch between its two lines",
    await anyVisible(page.getByText(/ways from here/i)),
  );

  // ⚠️ A CROSS THAT WILL NOT LAND IS USUALLY THE MUSEUM, NOT THE APP, and this
  // check had no way of saying so — it reported a bare FAIL and sent me reading
  // product code. The Met throttles at roughly 80 requests per 30 seconds and
  // locally there is no CDN in front of it (CLAUDE.md §4), so a run that has just
  // exercised the Gallery — or a second Playwright suite on the same machine —
  // trips the breaker, and `crossRealm` then correctly declines to land on
  // nothing. Retry once after a pause and NAME which it was, exactly as
  // `entryPoints` does.
  let realmNow = null;
  for (let attempt = 0; attempt < 2 && realmNow !== "gallery"; attempt++) {
    if (attempt > 0) await page.waitForTimeout(35000);
    await page.getByRole("button", { name: /^Cross to the/i }).first().click().catch(() => {});
    await page.waitForTimeout(4500);
    realmNow = await page.locator("[data-realm]").first().getAttribute("data-realm");
  }
  const crossed = realmNow === "gallery";
  rec(
    "crossing realms lands in the other realm",
    crossed,
    crossed ? "gallery" : "stayed put (the museum would not answer; see the server log for `circuit open`)",
  );
  const galleryQueue = await page.evaluate(() =>
    [...document.querySelectorAll("[data-slot^='queued:'] img")].map((i) => i.getAttribute("src") ?? ""));
  rec(
    "and the queue is rebuilt from the new realm",
    galleryQueue.length > 0 && galleryQueue.every((u) => u.includes("metmuseum") || u.includes("/api/img/met")),
    crossed ? `${galleryQueue.length} images` : "not reached — the cross above did not land",
  );

  // ----- reading --------------------------------------------------------------
  heading("READING");
  await open(page, "/drift?title=Octopus&seed=Octopus");
  await page.waitForTimeout(4000);
  const s2 = await activeSlot(page);
  // The marker is on a CONTAINER holding "Read more" AND the source link, so
  // clicking its centre lands in the gap between them. Target the button.
  const more = s2.getByRole("button", { name: "Read more" });
  if (await more.isVisible().catch(() => false)) {
    const overOf = () =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const i = Math.round(el.scrollTop / el.clientHeight);
        const r = el.querySelectorAll("[data-slot]")[i]?.querySelector("[data-drift-scroll]");
        return r ? r.scrollHeight - r.clientHeight : -1;
      }, SCROLLER);
    const o0 = await overOf();
    await more.click();
    await page.waitForTimeout(6000);
    const o1 = await overOf();
    rec("Read more expands inside the card's own region", o1 > o0 + 400, `${o0}px -> ${o1}px`);
    const idx0 = await at(page);
    await page.mouse.move(vp.width > 800 ? vp.width * 0.78 : vp.width / 2, vp.height * 0.6);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(90); }
    rec("reading mid-article does not drift you off the card", Math.abs((await at(page)) - idx0) < 0.05, (await at(page)).toFixed(2));
    let ticks = 0;
    while (ticks++ < 200 && (await at(page)) < idx0 + 0.9) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(35);
    }
    await page.waitForTimeout(1200);
    rec("reaching its end carries you on to the next card", (await at(page)) > idx0 + 0.9, `after ${ticks} ticks`);
  } else {
    rec("Read more is offered on the seed card", false);
  }

  await page.context().close();
}

// Cost gets its own session, and that matters: counting requests across a whole
// run and dividing by the stops of whichever session happened to be open last
// gives a number that means nothing. (It read 10 per card once, which is what
// sent me looking.)
async function cost(browser, vp) {
  heading("COST PER CARD");
  const page = await newPage(browser, vp);
  const routes = {};
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith("/api/")) return;
    const k = u.pathname.replace(/\/api\/realm\/[^/]+\//, "/api/realm/*/");
    routes[k] = (routes[k] ?? 0) + 1;
  });
  await open(page, "/drift?title=Octopus&seed=Octopus");
  await page.waitForTimeout(3000);
  await down(page, 9);
  const committed = await steps(page);
  const per = (k) => (routes[k] ?? 0) / Math.max(1, committed);
  // The bar is 1.6 rather than 1.0 because preparing one card ahead means the
  // last prepared card is never reached; that fixed overhead amortises with
  // session length (measured: 1.31 over 13 cards, 1.15 over 26).
  rec("threads: about one lookup per card", per("/api/realm/*/related") <= 1.6, per("/api/realm/*/related").toFixed(2) + " /card over " + committed);
  rec("doorway: about one lookup per card", per("/api/doorway") <= 1.6, per("/api/doorway").toFixed(2) + " /card");
  rec("discover: well under one batch per card", per("/api/realm/*/discover") <= 1.0, per("/api/realm/*/discover").toFixed(2) + " /card");
  await page.context().close();
}

// Entry points and focus kinds get their own pass: each takes a different branch
// of the session-load effect, and a broken one shows up as "no card" rather than
// as an error.
async function entryPoints(browser, vp) {
  heading("ENTRY POINTS AND FOCUS KINDS");
  const page = await newPage(browser, vp);
  const artist = encodeURIComponent("artist:" + encodeURIComponent("Winslow Homer") + ":0");
  const form = encodeURIComponent("form:print:1800-1849");
  const cases = [
    ["?title=", "/drift?title=Octopus&seed=Octopus"],
    ["surprise me", "/drift"],
    ["?mode=endless", "/drift?mode=endless"],
    ["?bucket= (gallery)", "/drift?realm=gallery&bucket=european-paintings"],
    ["field focus", "/drift?focus=field&bucket=biology&seed=Biology&label=Biology"],
    ["orbit focus", "/drift?focus=orbit&title=Octopus&seed=Octopus"],
    ["in-the-news focus", "/drift?focus=current&section=Science%20and%20technology&seed=Science"],
    ["form+era focus", `/drift?realm=gallery&focus=form&form=print&era=1800-1849&bucket=${form}&seed=Prints`],
    ["artist focus", `/drift?realm=gallery&focus=artist&artist=Winslow%20Homer&bucket=${artist}&seed=Winslow%20Homer`],
  ];
  for (const [name, url] of cases) {
    // ⚠️ A GALLERY VIEW THAT WILL NOT LOAD IS USUALLY THE MUSEUM, NOT THE APP.
    // The Met throttles at roughly 80 requests per 30 seconds and repeated
    // tripping shrinks that for a day (CLAUDE.md §4), and locally there is no
    // CDN in front of it — so a run that has just exercised the Gallery hard
    // will be refused. Retry once after a pause before calling it a failure, and
    // say which it was, or the next person chases a phantom for an hour.
    let title = null;
    for (let attempt = 0; attempt < 2 && !title?.trim(); attempt++) {
      if (attempt > 0) await page.waitForTimeout(20000);
      await open(page, url);
      title = await page
        .locator("[data-slot] h1")
        .first()
        .textContent({ timeout: 40000 })
        .catch(() => null);
    }
    const err = await page.getByText(/Couldn't load a card/i).isVisible().catch(() => false);
    rec(
      name,
      !!title?.trim(),
      title?.trim().slice(0, 40) ?? (err ? "upstream would not answer (likely throttled)" : "no card"),
    );
  }
  // Releasing a focus rebuilds the queue rather than leaving cards chosen under
  // a promise that no longer holds.
  await open(page, "/drift?focus=field&bucket=biology&seed=Biology&label=Biology");
  await page.waitForTimeout(5000);
  rec("a focus shows its banner", !!(await bannerText(page)), await bannerText(page));
  await page.getByRole("button", { name: /Drift freely/i }).first().click().catch(() => {});
  await page.waitForTimeout(5000);
  rec("releasing it drops the banner", (await bannerText(page)) === null);
  rec("and the queue is rebuilt", (await queued(page)) > 0, `${await queued(page)} queued`);
  await page.context().close();
}

// The exit screen, saving, and coming back in. Re-entry is the part nobody
// exercises by hand because it needs a saved trail to exist first.
async function endingAndReEntry(browser, vp) {
  heading("ENDING, SAVING AND RE-ENTRY");
  const page = await newPage(browser, vp);
  await open(page, "/drift?title=Octopus&seed=Octopus");
  await page.waitForTimeout(4000);
  await down(page, 2);
  await page.getByRole("button", { name: /^End/i }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  rec("the trail map opens", await page.getByText(/Your trail/i).first().isVisible().catch(() => false));
  await page.getByLabel("Trail name").fill("verify:feed").catch(() => {});
  await page.getByRole("button", { name: "Save trail" }).click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const link = page.getByRole("link", { name: /View in My Trails/i });
  const saved = await link.isVisible().catch(() => false);
  rec("the trail saves under its new name", saved);
  rec("and can be liked", await page.getByRole("button", { name: /Like trail/i }).isVisible().catch(() => false));
  const href = saved ? await link.getAttribute("href") : null;
  if (href) {
    const id = href.split("/").pop();
    await open(page, `/drift?continue=${id}`);
    const t1 = await page.locator("[data-slot] h1").first().textContent().catch(() => null);
    rec("?continue= reopens the trail", !!t1?.trim(), t1?.trim().slice(0, 40));
    rec("and lands on its tip, not its start", (await at(page)) > 0, `slot ${(await at(page)).toFixed(0)}`);
    await open(page, `/drift?continue=${id}&from=0`);
    await page.waitForTimeout(3000);
    rec("?from=<stop> lands on that stop", Math.round(await at(page)) === 0, `slot ${(await at(page)).toFixed(0)}`);
  } else {
    rec("?continue= reopens the trail", false, "nothing was saved to reopen");
  }
  await page.context().close();
}

// The end of the road.
//
// A pool will not run dry inside a short session, so it is FORCED: the discover
// route is answered with an empty list, which is exactly what an exhausted
// bucket or an unavailable source looks like to the feed. That drives the real
// code path rather than a stub of it.
//
// ⚠️ `day-done` is NOT reachable here and that is not an oversight: the meter
// needs a signed-in account and a backend, and with the cloud vars blanked the
// meter correctly FAILS OPEN. Its arithmetic is unit-tested (`queueCapacity`
// clamps to `stopsRemaining` and returns the full depth on null), and it renders
// through the same TerminusCard as the two endings tested below. To exercise it
// end to end you need a real account and NEXT_PUBLIC_FREE_DAILY_STOPS set.
async function endings(browser, vp) {
  heading("THE END OF THE ROAD");
  const page = await newPage(browser, vp);
  // ⚠️ BLOCK BOTH ROUTES, AND BEFORE THE PAGE OPENS. Blocking only `discover`
  // does not dry the feed: `nextDriftCard` deliberately falls back to a random
  // untapped THREAD when the buffer comes up empty, because morelike stays
  // healthy while discover is throttled and a dead button is never acceptable.
  // That fallback is right, and it means an honest "there is nothing left" has
  // to close both doors. Blocking before the first paint also stops the buffer
  // filling with a dozen cards that would have to be drained first.
  await blockDry(page);
  await open(page, "/drift?title=Octopus&seed=Octopus");
  // Two empty refills, FILL_BACKOFF_MS apart, before the feed will say anything:
  // "empty right now" is not "empty" (ContinuousFeed.TRIES_BEFORE_END).
  await page.waitForTimeout(14000);
  const terminus = page.locator("[data-terminus]");
  rec("a dry pool ends the feed with a card, not a toast", (await terminus.count()) === 1);
  rec(
    "and it is the LAST thing in the scroller",
    await page.evaluate(() => {
      const items = [...document.querySelectorAll("[data-slot]")];
      return items[items.length - 1]?.querySelector("[data-terminus]") !== null;
    }),
  );
  rec("no transient toast duplicates it", !(await anyVisible(page.getByText(/Pull a thread, or drift freely/i))));

  // The reader was standing at the dead end, so they are carried onto it.
  const items = await page.locator("[data-slot]").count();
  rec("the reader is carried onto it", Math.round(await at(page)) === items - 1, `slot ${(await at(page)).toFixed(0)} of ${items - 1}`);

  // ...and can go straight back to what they were reading.
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(1200);
  rec("scrolling back up from it still works", Math.round(await at(page)) === items - 2);

  rec("it offers the trail", await anyVisible(page.getByRole("button", { name: /See where you wandered/i })));
  await page.getByRole("button", { name: /See where you wandered/i }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  rec("and that opens the trail map", await page.getByText(/Your trail/i).first().isVisible().catch(() => false));
  await page.context().close();
}

// The auto-snap must never yank somebody who is reading something else. This is
// the guard on the one place this feed moves without a gesture, so it gets its
// own case — together with the rule that produces the situation in the first
// place.
//
// ⚠️ THE OLD VERSION OF THIS CHECK FORCED THE ENDING WHILE THE READER WAS PARKED
// UP THEIR TRAIL, AND THAT MOMENT NO LONGER EXISTS. The queue hangs under the
// TIP, so only the tip may fill it: the engine derives the realm, the focus and
// the fallback threads from the stop the reader is STANDING on, and refilling
// from three stops up stacked the wrong realm underneath them (measured: cross to
// the Gallery, scroll up three, and the session reads as Encyclopedia again with
// three Met cards queued below). So a reader who is re-reading no longer causes
// any fetching at all, and therefore never discovers the end from up there. The
// ending waits until they come back to the tip, which is where the question
// "why did it stop?" is asked anyway.
async function autoSnapGuard(browser, vp) {
  heading("THE AUTO-SNAP GUARD");
  const page = await newPage(browser, vp);
  await open(page, "/drift?focus=field&bucket=biology&seed=Biology&label=Biology");
  await page.waitForTimeout(6000);
  await down(page, 2);
  // Park the reader partway up their own trail, then shut every door.
  for (let i = 0; i < 2; i++) { await page.keyboard.press("ArrowUp"); await page.waitForTimeout(1000); }
  const parked = Math.round(await at(page));
  // Shut every door, then release the focus. Releasing is what actually empties
  // the feed: it drops the buffered cards that were chosen under the promise the
  // reader has just let go of (`releaseFocus` in useDriftSession), so there is
  // nothing left in hand and nothing that can be fetched.
  await blockDry(page);
  await page.getByRole("button", { name: /Drift freely/i }).first().click().catch(() => {});
  await page.waitForTimeout(15000);

  rec(
    "nothing is fetched below a reader who is re-reading",
    (await page.locator("[data-terminus]").count()) === 0,
    `parked at ${parked}`,
  );
  rec(
    "and they are not moved",
    Math.round(await at(page)) === parked,
    `parked at ${parked}, still at ${(await at(page)).toFixed(0)}`,
  );

  // Back at the tip, the feed asks again, finds nothing, and ends there. Walked
  // down rather than counted down: every card the reader passes commits, so the
  // distance to the tip grows as they go.
  for (let i = 0, last = -1; i < 10; i++) {
    const now = Math.round(await at(page));
    if (now === last) break;
    last = now;
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(1600);
  }
  await page.waitForTimeout(14000);
  rec("returning to the tip finds the end", (await page.locator("[data-terminus]").count()) === 1);
  const items = await page.locator("[data-slot]").count();
  rec(
    "and the reader is carried onto it",
    Math.round(await at(page)) === items - 1,
    `slot ${(await at(page)).toFixed(0)} of ${items - 1}`,
  );

  // ...and once it exists, going back up must not drag them down again.
  for (let i = 0; i < 2; i++) { await page.keyboard.press("ArrowUp"); await page.waitForTimeout(1200); }
  const up = Math.round(await at(page));
  await page.waitForTimeout(5000);
  rec(
    "a reader scrolled up is never dragged back to the ending",
    Math.round(await at(page)) === up && up < items - 1,
    `at ${up} of ${items - 1}`,
  );
  await page.context().close();
}

// What the feed does when a source will not answer, and what it does when the
// source comes back.
//
// ⚠️ THIS SECTION EXISTS BECAUSE THE FEED USED TO DIE HERE. One empty refill and
// it announced "You have read this area dry" — on a free drift over the whole of
// Wikipedia, four seconds into a session, off a single 503 — and then never asked
// again, because nothing in the effect graph could wake the refill. Measured: the
// source recovered and fifteen seconds and four ArrowDowns later the scroller was
// still `step:0 | terminus:pool-dry`. A dry pool is final; an unreachable source
// is a pause, and the two are different sentences.
async function resilience(browser, vp) {
  heading("A SOURCE THAT WILL NOT ANSWER");
  const page = await newPage(browser, vp);
  await blockDry(page, 503);
  await open(page, "/drift?title=Octopus&seed=Octopus");
  await page.waitForTimeout(16000);
  const reason = await page
    .locator("[data-terminus]")
    .getAttribute("data-terminus")
    .catch(() => null);
  rec("it says the source is quiet, not that the pool is dry", reason === "source-quiet", reason ?? "no ending");
  // A pause is not an exit, so nobody is carried to it: the reader keeps the last
  // real card they had, and the refill is then free to replace the ending.
  const items = await page.locator("[data-slot]").count();
  rec(
    "and does not carry the reader onto a pause",
    Math.round(await at(page)) < items - 1,
    `slot ${(await at(page)).toFixed(0)} of ${items - 1}`,
  );
  rec("it offers a way to ask again", await anyVisible(page.getByRole("button", { name: /Try again/i })));

  // Now let the source back up. Nothing is touched: the feed has to notice.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.waitForTimeout(20000);
  rec("it clears itself when the source comes back", (await page.locator("[data-terminus]").count()) === 0);
  rec("and the queue refills behind it", (await queued(page)) > 0, `${await queued(page)} queued`);
  await page.context().close();

  // Standing ON the ending is the one case the automatic retry deliberately will
  // not resolve: replacing the card under somebody's eye is the swap §2.1
  // forbids, so the reader gets a button instead. Both halves are checked here,
  // because either one alone would be a trap — a card that never updates, or a
  // feed that rewrites itself while you read it.
  const p3 = await newPage(browser, vp);
  await blockDry(p3, 503);
  await open(p3, "/drift?title=Octopus&seed=Octopus");
  await p3.waitForTimeout(16000);
  await p3.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.scrollTop = el.scrollHeight;
  }, SCROLLER);
  await p3.waitForTimeout(1500);
  const onEnding = await p3.evaluate(
    (sel) => {
      const el = document.querySelector(sel);
      const i = Math.round(el.scrollTop / el.clientHeight);
      return !!el.querySelectorAll("[data-slot]")[i]?.querySelector("[data-terminus]");
    },
    SCROLLER,
  );
  await p3.unrouteAll({ behavior: "ignoreErrors" });
  await p3.waitForTimeout(14000);
  rec(
    "the card under a reader standing on the ending is never swapped",
    onEnding && (await p3.locator("[data-terminus]").count()) === 1,
    onEnding ? "held" : "was not on the ending",
  );
  await p3.getByRole("button", { name: /Try again/i }).first().click().catch(() => {});
  await p3.waitForTimeout(9000);
  rec("and Try again is their way out of it", (await p3.locator("[data-terminus]").count()) === 0);
  rec("which brings cards back", (await queued(p3)) > 0, `${await queued(p3)} queued`);
  await p3.context().close();

  // The degraded path itself: discover answering nothing, everything else fine.
  // `nextDriftCard` falls back to a random untapped thread of the card on screen,
  // which is what keeps the feed alive while a source is throttled. It was
  // silently dead — `fill` pinned the engine from one render, so the fallback read
  // a thread list that was empty when the session started and never refreshed.
  const p2 = await newPage(browser, vp);
  const empty = (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  await p2.route("**/api/realm/*/discover*", empty);
  await p2.route("**/api/wiki/random*", empty);
  await open(p2, "/drift?title=Octopus&seed=Octopus");
  await p2.waitForTimeout(6000);
  const before = await steps(p2);
  for (let i = 0; i < 3; i++) { await p2.keyboard.press("ArrowDown"); await p2.waitForTimeout(2500); }
  rec(
    "a thread neighbour keeps the feed going when discover has nothing",
    (await steps(p2)) > before,
    `${before} -> ${await steps(p2)} stops`,
  );
  const keys = await p2.evaluate(() => [...document.querySelectorAll("[data-slot]")].map((n) => n.dataset.slot));
  rec("and never queues the same card twice", new Set(keys).size === keys.length, keys.join(" | ").slice(0, 90));
  await p2.context().close();
}

// Four cards are laid out at once, so Tab used to walk straight out of the card
// being read and into the queue below it — and the browser scrolls focus into
// view, so a keyboard reader reaching for "Read more" was carried three cards
// down the feed and those cards went into their trail. Every card but the active
// one is `inert`.
async function focusOrder(browser, vp) {
  heading("KEYBOARD FOCUS ORDER");
  const page = await newPage(browser, vp);
  await open(page, "/drift?title=Octopus&seed=Octopus");
  await page.waitForTimeout(7000);
  await page.locator(SCROLLER).focus();
  const start = Math.round(await at(page));
  const visited = new Set();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const slot = await page.evaluate(
      () => document.activeElement?.closest?.("[data-slot]")?.dataset.slot ?? "(chrome)",
    );
    visited.add(slot);
  }
  const strayed = [...visited].filter((k) => k !== "(chrome)" && k !== `step:${start}`);
  rec("Tab never leaves the card being read", strayed.length === 0, [...visited].join(", ").slice(0, 80));
  rec(
    "so tabbing does not drift the feed",
    Math.round(await at(page)) === start,
    `started at ${start}, now ${(await at(page)).toFixed(0)}`,
  );
  await page.context().close();
}

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  if (ONLY && ONLY !== vp.name) continue;
  await run(browser, vp);
  await cost(browser, vp);
  await entryPoints(browser, vp);
  await endingAndReEntry(browser, vp);
  await endings(browser, vp);
  await autoSnapGuard(browser, vp);
  await resilience(browser, vp);
  await focusOrder(browser, vp);
}
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nfailed:");
  for (const f of failed) console.log(`  · ${f.group}: ${f.name}`);
  process.exit(1);
}
