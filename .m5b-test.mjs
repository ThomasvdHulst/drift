import { chromium } from "playwright";
const S = "/private/tmp/claude-502/-Users-thomasvanderhulst2-Developer-drift/7451c958-8616-406d-b7f9-f93bb8b881c4/scratchpad";
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, acceptDownloads: true });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:3000" });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

// Surprise me → drift until the ~25-stop nudge appears.
await page.goto("http://localhost:3000/drift", { waitUntil: "networkidle" });
await page.waitForSelector("h1.font-serif", { timeout: 20000 });
const advance = page.getByRole("button", { name: "Advance" });
let nudgeSeen = false;
for (let i = 0; i < 32; i++) {
  await advance.click();
  await page.waitForTimeout(1100);
  if (await page.getByText("You've wandered far").count()) { nudgeSeen = true; break; }
}
const stops = (await page.locator("header >> text=/\\d+ stops?/").first().textContent())?.trim();
console.log("nudge appeared:", nudgeSeen, "| at", stops);
if (nudgeSeen) await page.screenshot({ path: `${S}/nudge.png` });

// From the nudge, open the trail.
await page.getByRole("button", { name: "View trail" }).click();
await page.waitForSelector('input[aria-label="Trail name"]', { timeout: 5000 });
await page.getByRole("button", { name: "Save trail" }).click();
await page.waitForTimeout(700);

// Export image → expect a PNG download.
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export image" }).click(),
]);
const fn = download.suggestedFilename();
console.log("export download filename:", fn, "| is png:", fn.endsWith(".png"));

// Copy as text → clipboard holds the formatted trail.
await page.getByRole("button", { name: "Copy as text" }).click();
await page.waitForTimeout(400);
const clip = await page.evaluate(() => navigator.clipboard.readText());
console.log("clipboard starts with thread emoji:", clip.startsWith("🧵"), "| has links:", clip.includes("https://en.wikipedia.org"));

// Stats view on My Trails.
await page.goto("http://localhost:3000/trails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const week = await page.getByText(/This week:/).count();
const weekText = week ? (await page.getByText(/This week:/).first().textContent())?.trim() : "(none)";
console.log("stats view present:", week > 0, "|", JSON.stringify(weekText));

console.log("JS RUNTIME ERRORS:", errors.filter(e=>e.includes("PAGEERROR")).length ? JSON.stringify(errors.filter(e=>e.includes("PAGEERROR"))) : "none");
await browser.close();
