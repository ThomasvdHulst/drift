// Measure the Art Institute's public-domain collection by art form and period,
// so `src/lib/realms/artic.forms.ts` can carry REAL counts instead of guesses.
//
// Why bake the numbers instead of asking at runtime: the homepage must never
// offer a slice that turns out to be empty (AIC holds no 17th-century
// photographs and no 19th-century coins), and a per-visit aggregation call just
// to render tiles would be a needless upstream hit on a shared Vercel IP.
//
// One-shot + hand-run — not part of build, dev or test:
//     node scripts/probe-artic-forms.mjs
// It prints a table plus a paste-ready `COUNTS` literal. Re-run it if AIC's
// catalogue shifts and the tiles start to look wrong.

const API = "https://api.artic.edu/api/v1/artworks/search";
const UA =
  process.env.ARTIC_USER_AGENT ||
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";

// Must match ARTIC_FORMS[].aicType / ARTIC_ERAS in src/lib/realms/artic.forms.ts.
const FORMS = [
  ["painting", "Painting"],
  ["print", "Print"],
  ["drawing", "Drawing and Watercolor"],
  ["photograph", "Photograph"],
  ["sculpture", "Sculpture"],
  ["textile", "Textile"],
  ["ceramics", "Ceramics"],
  ["vessel", "Vessel"],
  ["metalwork", "Metalwork"],
  ["coin", "Coin"],
];

const ERAS = [
  ["pre-1500", -4000, 1499],
  ["1500s", 1500, 1599],
  ["1600s", 1600, 1699],
  ["1700s", 1700, 1799],
  ["1800-1849", 1800, 1849],
  ["1850-1899", 1850, 1899],
  ["1900-1929", 1900, 1929],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Public-domain + has-an-image, the same gate `isUsableArtwork` applies. */
function baseQuery() {
  return {
    "query[bool][must][0][term][is_public_domain]": "true",
    "query[bool][must][1][exists][field]": "image_id",
  };
}

async function total(extra) {
  const params = new URLSearchParams({ ...baseQuery(), ...extra, limit: "0" });
  const res = await fetch(`${API}?${params}`, {
    headers: { "AIC-User-Agent": UA, "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  return json?.pagination?.total ?? 0;
}

const formClause = (aicType) => ({
  "query[bool][must][2][match_phrase][artwork_type_title]": aicType,
});

const eraClause = (from, to) => ({
  "query[bool][must][3][range][date_start][gte]": String(from),
  "query[bool][must][4][range][date_start][lte]": String(to),
});

async function main() {
  const counts = {};
  const totals = {};

  for (const [formId, aicType] of FORMS) {
    totals[formId] = await total(formClause(aicType));
    await sleep(250); // the same courtesy spacing the server adapter's gate uses
    counts[formId] = {};
    for (const [eraId, from, to] of ERAS) {
      counts[formId][eraId] = await total({
        ...formClause(aicType),
        ...eraClause(from, to),
      });
      await sleep(250);
    }
  }

  const pad = (s, n) => String(s).padStart(n);
  console.log("\nPublic-domain works WITH an image, by form and period:\n");
  console.log(
    "form".padEnd(22) + ERAS.map(([id]) => pad(id, 11)).join("") + pad("TOTAL", 11),
  );
  for (const [formId] of FORMS) {
    console.log(
      formId.padEnd(22) +
        ERAS.map(([id]) => pad(counts[formId][id], 11)).join("") +
        pad(totals[formId], 11),
    );
  }

  console.log("\n\n--- paste into src/lib/realms/artic.forms.ts ---\n");
  console.log("const COUNTS: Record<string, Record<string, number>> = {");
  for (const [formId] of FORMS) {
    const row = ERAS.map(([id]) => `"${id}": ${counts[formId][id]}`).join(", ");
    console.log(`  ${formId}: { ${row} },`);
  }
  console.log("};");
  console.log("\n// totals:", JSON.stringify(totals));
}

main().catch((err) => {
  console.error("probe failed:", err.message);
  process.exit(1);
});
