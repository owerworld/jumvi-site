#!/usr/bin/env node
/**
 * Phase 2B validator — onboarding pack, price-source design, and the
 * fail-closed behaviour of the feed generator.
 *
 *   node commerce/phase2b-validation.mjs
 *
 * Phase 2A invariants (ages, ratings, GTIN, packaging, drift, ...) stay in
 * commerce/validation.mjs. Run both. Exits 1 on any FAIL.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const truth = JSON.parse(readFileSync(join(HERE, "product-truth.json"), "utf8"));
const draft = JSON.parse(readFileSync(join(HERE, "openai-product-draft.json"), "utf8"));
const pack = readFileSync(join(HERE, "openai-onboarding-pack.md"), "utf8");
const offerDoc = readFileSync(join(HERE, "amazon-offer-source.md"), "utf8");
const gen = await import("./generate-openai-feed.mjs");

const fails = [], passes = [], warns = [];
const fail = (r, m) => fails.push(`${r}: ${m}`);
const pass = (r, m) => passes.push(`${r}: ${m}`);
const warn = (r, m) => warns.push(`${r}: ${m}`);

/** Nth cell (1-based) of the markdown table row whose first cell matches `re`. */
function tableCell(md, re, n = 2) {
  for (const line of md.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length >= n && re.test(cells[0])) return cells[n - 1];
  }
  return null;
}

const NOW = new Date();
/** A snapshot that satisfies every gate. Mutated per case below. */
const validOffer = () => ({
  asin: "B0H16JPQCF", marketplace_id: "ATVPDKIKX0DER", currency: "USD",
  price: 29.99, availability: "unknown",
  fetched_at: new Date(NOW.getTime() - 5 * 60000).toISOString(), source: "sp-api:getPricing",
});
const validSetup = () => ({ marketplace_seller: "Amazon", verified_by_openai_onboarding: true });
const gatesFor = (o, s, t = truth) => gen.blockers(t, o, s, NOW);
const has = (gs, gate, re) => gs.some((g) => g.gate === gate && (!re || re.test(g.reason)));

// ---------------------------------------- P1: pack agrees with Product Truth
{
  const must = [
    ["legal entity", truth.company.legal_name],
    ["brand", truth.brand.name],
    ["ASIN", truth.identifiers.asin.value],
    ["marketplace id", truth.marketplace.marketplace_id],
    ["website", truth.product.url],
    ["seller_name", truth.marketplace.openai_feed_model.seller_name],
    ["checkout location", truth.marketplace.openai_feed_model.checkout_location],
    ["privacy policy", truth.company.privacy_policy_url],
    ["box claim", truth.packaging_claims.printed_retail_box.mission_claim_text],
    ["hub claim", truth.packaging_claims.digital_mission_hub.mission_claim_text],
  ];
  for (const [label, value] of must)
    pack.includes(String(value))
      ? pass("P1 pack-agreement", `pack states ${label}: ${JSON.stringify(value)}`)
      : fail("P1 pack-agreement", `pack omits or contradicts Product Truth ${label} (${JSON.stringify(value)})`);

  /ages?\D{0,4}3\s*[‐-―-]\s*12|3\s*[‐-―-]\s*12/.test(pack) || /3-12/.test(pack)
    ? pass("P1 pack-agreement", "pack carries no contradicting age range")
    : warn("P1 pack-agreement", "pack does not restate the 3-12 age range");

  {
    // Read the VALUE CELL, not the whole row - the rationale cell legitimately
    // mentions the other value and would satisfy a row-wide scan.
    const searchVal = tableCell(pack, /is_eligible_search/);
    const checkoutVal = tableCell(pack, /is_eligible_checkout/);
    searchVal === "`true`"
      ? pass("P1 pack-agreement", "eligibility table value for is_eligible_search is `true`")
      : fail("P1 pack-agreement", `is_eligible_search value cell must be \`true\`, got ${JSON.stringify(searchVal)}`);
    checkoutVal === "`false`"
      ? pass("P1 pack-agreement", "eligibility table value for is_eligible_checkout is `false`")
      : fail("P1 pack-agreement", `is_eligible_checkout value cell must be \`false\`, got ${JSON.stringify(checkoutVal)}`);
    // Nothing anywhere may assert checkout eligibility while it is disabled.
    const asserts = pack.split("\n").filter((l) => /is_eligible_checkout[^\n]{0,30}\btrue\b/i.test(l));
    asserts.length
      ? asserts.forEach((l) => fail("P1 pack-agreement", `pack asserts checkout eligibility: ${l.trim().slice(0, 80)}`))
      : pass("P1 pack-agreement", "pack never asserts is_eligible_checkout true");
  }

  pack.includes("Eligibility does not guarantee display")
    ? pass("P1 pack-agreement", "pack records that eligibility does not guarantee display")
    : fail("P1 pack-agreement", "pack must record the official 'Eligibility does not guarantee display' caveat");

  // Check the Company table cells themselves. A "Not supplied" heading elsewhere
  // in the document must not satisfy this.
  for (const [label, re] of [["business address", /business address/i], ["social profiles", /social profiles/i]]) {
    const cell = tableCell(pack, re);
    /not supplied/i.test(cell ?? "")
      ? pass("P1 pack-agreement", `${label} marked not supplied`)
      : fail("P1 pack-agreement", `${label} must be marked "not supplied" rather than invented, got ${JSON.stringify(cell)}`);
  }

  // Every material OpenAI fact needs a confidence rating.
  ["official", "unknown"].every((c) => new RegExp(`\\*\\*${c}\\*\\*`, "i").test(pack))
    ? pass("P1 pack-agreement", "evidence register carries confidence ratings")
    : fail("P1 pack-agreement", "evidence register must rate facts official / inferred / unknown");
}

// ------------------------------------------- P2: no guessed marketplace_seller
{
  const m = truth.marketplace?.openai_feed_model ?? {};
  m.marketplace_seller == null && m.marketplace_seller_status === "unresolved_pending_openai_feed_setup"
    ? pass("P2 marketplace-seller", "Product Truth marketplace_seller unresolved, not guessed")
    : fail("P2 marketplace-seller", `marketplace_seller must stay null pending onboarding, got ${JSON.stringify(m.marketplace_seller)}`);
  (draft.record?.marketplace_seller ?? null) === null
    ? pass("P2 marketplace-seller", "feed draft emits no guessed marketplace_seller")
    : fail("P2 marketplace-seller", `feed draft asserts marketplace_seller ${JSON.stringify(draft.record.marketplace_seller)}`);
  !existsSync(join(HERE, "runtime", "openai-marketplace-setup.json"))
    ? pass("P2 marketplace-seller", "no committed marketplace setup file")
    : warn("P2 marketplace-seller", "a marketplace setup file exists locally - it is git-ignored, do not commit it");
}

// ------------------------------------- P3: no static price, no fabricated stock
{
  truth.dynamic_offer_facts?.price?.value === null
    ? pass("P3 no-static-price", "Product Truth price is an unresolved placeholder")
    : fail("P3 no-static-price", `Product Truth carries a static price: ${JSON.stringify(truth.dynamic_offer_facts?.price?.value)}`);
  (draft.record?.price ?? null) === null
    ? pass("P3 no-static-price", "feed draft price is null pending build-time injection")
    : fail("P3 no-static-price", `feed draft hardcodes price: ${JSON.stringify(draft.record.price)}`);

  const a = draft.record?.availability;
  a === "unknown" || a === null
    ? pass("P3 no-static-price", `feed draft availability is ${JSON.stringify(a)} - no unverified stock claim`)
    : fail("P3 no-static-price", `feed draft claims stock state ${JSON.stringify(a)} with no verified source`);

  const money = /\$\s?\d|\b\d+\.\d{2}\s*USD\b/;
  for (const [label, text] of [["onboarding pack", pack], ["offer-source design", offerDoc]]) {
    const lines = text.split("\n").filter((l) => money.test(l) && !/e\.g\.|example|placeholder|`/i.test(l));
    lines.length
      ? lines.forEach((l) => fail("P3 no-static-price", `${label} contains a price-shaped value: ${l.trim().slice(0, 80)}`))
      : pass("P3 no-static-price", `${label} contains no hardcoded price`);
  }
}

// ----------------------------------------------- P4: no credentials or secrets
{
  const files = ["product-truth.json", "openai-product-draft.json", "platform-readiness.md",
                 "openai-onboarding-pack.md", "amazon-offer-source.md",
                 "generate-openai-feed.mjs", "phase2b-validation.mjs", "validation.mjs",
                 "runtime/README.md"].filter((f) => existsSync(join(HERE, f)));
  const secrets = [
    [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
    [/\bASIA[0-9A-Z]{16}\b/, "AWS temporary key id"],
    [/\bAtzr\|[A-Za-z0-9_-]{20,}/, "Amazon LWA refresh token"],
    [/\bamzn1\.application-oa2-client\.[a-f0-9]{16,}/, "Amazon LWA client id"],
    [/\bamzn1\.oa2-cs\.v1\.[a-f0-9]{16,}/, "Amazon LWA client secret"],
    [/\bsk-[A-Za-z0-9]{24,}\b/, "OpenAI-style secret key"],
    [/(secret|token|password|client_secret)\s*[:=]\s*["'][A-Za-z0-9/+_-]{16,}["']/i, "inline secret assignment"],
  ];
  let found = false;
  for (const f of files) {
    const text = readFileSync(join(HERE, f), "utf8");
    for (const [re, label] of secrets)
      if (re.test(text)) { fail("P4 no-secrets", `${label} shape in commerce/${f}`); found = true; }
  }
  if (!found) pass("P4 no-secrets", `no credential-shaped strings across ${files.length} commerce files`);
  /never\s*\*{0,2}\s*in this\s*\n?repository|never.{0,40}in this repository/i.test(offerDoc)
    ? pass("P4 no-secrets", "offer-source design states credentials never live in the repo")
    : fail("P4 no-secrets", "amazon-offer-source.md must state credentials never live in the repository");
}

// ------------------------------- P5: PA-API 5 never returns as an active source
{
  const src = truth.dynamic_offer_facts?.source_interfaces?.amazon_offer_source ?? {};
  src.primary?.route === "sp-api:getPricing"
    ? pass("P5 price-source", "primary route is sp-api:getPricing")
    : fail("P5 price-source", `primary route must be sp-api:getPricing, got ${JSON.stringify(src.primary?.route)}`);

  const paapi = /PA-API|Product Advertising API|Creators API/i;
  for (const [label, text] of [["onboarding pack", pack], ["offer-source design", offerDoc]]) {
    const bad = text.split("\n").filter((l) => paapi.test(l) && !/reject|deprecat|must not|successor|Why/i.test(l));
    bad.length
      ? bad.forEach((l) => fail("P5 price-source", `${label} references PA-API/Creators outside a rejection context: ${l.trim().slice(0, 80)}`))
      : pass("P5 price-source", `${label} mentions PA-API/Creators only as rejected`);
  }
  /getPricing/.test(offerDoc) && /PRIMARY|Primary/.test(offerDoc)
    ? pass("P5 price-source", "offer-source design names getPricing as primary")
    : fail("P5 price-source", "offer-source design must name getPricing as the primary route");
  offerDoc.split("\n").some((l) => /scrap/i.test(l) && /reject|against .{0,20}terms|must not|do not/i.test(l))
    ? pass("P5 price-source", "HTML scraping rejected on an explicit rejection line")
    : fail("P5 price-source", "offer-source design must reject scraping explicitly - a passing mention elsewhere is not enough");
}

// -------------------------------------------------- P6: seller_url stays honest
{
  const su = draft.record?.seller_url ?? null;
  if (su === null) pass("P6 seller-url", "seller_url null pending a verified Amazon seller page");
  else if (/jumvi\.co/i.test(su))
    fail("P6 seller-url", `seller_url is ${JSON.stringify(su)} - the brand site is not the SAY23 LLC page on Amazon`);
  else if (/amazon\./i.test(su)) pass("P6 seller-url", `seller_url points at an Amazon seller page: ${su}`);
  else warn("P6 seller-url", `seller_url is ${JSON.stringify(su)} - confirm it is the seller's marketplace page`);

  draft.record?.url === truth.product.url
    ? pass("P6 seller-url", "product url remains the canonical jumvi.co homepage")
    : fail("P6 seller-url", `feed url drifted: ${JSON.stringify(draft.record?.url)}`);
}

// --------------------------------------- P7: generator fail-closed behaviour
{
  const cases = [
    ["no inputs at all", null, null, (g) => has(g, "marketplace_seller") && has(g, "price")],
    ["unresolved marketplace_seller", validOffer(), { marketplace_seller: null, verified_by_openai_onboarding: false },
      (g) => has(g, "marketplace_seller")],
    ["marketplace_seller set but not verified", validOffer(), { marketplace_seller: "Amazon", verified_by_openai_onboarding: false },
      (g) => has(g, "marketplace_seller", /verified_by_openai_onboarding/)],
    ["missing price", { ...validOffer(), price: null }, validSetup(), (g) => has(g, "price", /no price/i)],
    ["zero price", { ...validOffer(), price: 0 }, validSetup(), (g) => has(g, "price", /greater than zero/i)],
    ["negative price", { ...validOffer(), price: -5 }, validSetup(), (g) => has(g, "price", /greater than zero/i)],
    ["stale price", { ...validOffer(), fetched_at: new Date(NOW.getTime() - 61 * 60000).toISOString() }, validSetup(),
      (g) => has(g, "price", /stale|old/i)],
    ["no timestamp", { ...validOffer(), fetched_at: null }, validSetup(), (g) => has(g, "price", /freshness/i)],
    ["wrong ASIN", { ...validOffer(), asin: "B0XXXXXXXX" }, validSetup(), (g) => has(g, "price", /ASIN/)],
    ["wrong marketplace", { ...validOffer(), marketplace_id: "A1PA6795UKMFR9" }, validSetup(), (g) => has(g, "price", /marketplace_id/)],
    ["wrong currency", { ...validOffer(), currency: "EUR" }, validSetup(), (g) => has(g, "price", /currency/i)],
    ["unapproved source", { ...validOffer(), source: "paapi5:GetItems" }, validSetup(), (g) => has(g, "price", /approved seller-owned/i)],
    ["scraper source", { ...validOffer(), source: "scrape:amazon-html" }, validSetup(), (g) => has(g, "price", /approved seller-owned/i)],
    ["bad availability value", { ...validOffer(), availability: "maybe" }, validSetup(), (g) => has(g, "price", /availability/i)],
  ];
  for (const [label, offer, setup, expect] of cases) {
    const g = gatesFor(offer, setup);
    expect(g)
      ? pass("P7 generator-gates", `refuses: ${label}`)
      : fail("P7 generator-gates", `generator did NOT refuse: ${label} (gates: ${JSON.stringify(g.map((x) => x.gate))})`);
  }

  // Upstream Product Truth failures must also stop emission.
  const truthCases = [
    ["Product Truth ASIN drift", { ...structuredClone(truth), identifiers: { ...truth.identifiers, asin: { ...truth.identifiers.asin, value: "B0XXXXXXXX" } } }],
    ["static price in Product Truth", (() => { const t = structuredClone(truth); t.dynamic_offer_facts.price.value = "29.99 USD"; return t; })()],
    ["box claim says 36", (() => { const t = structuredClone(truth); t.packaging_claims.printed_retail_box.mission_claim_text = "36 Missions"; return t; })()],
    ["ages 3-8", (() => { const t = structuredClone(truth); t.product.age_range = { min: 3, max: 8, unit: "years" }; return t; })()],
    ["legacy id promoted to public_sku", (() => { const t = structuredClone(truth); t.identifiers.public_sku = "JUMVI-001"; return t; })()],
  ];
  for (const [label, t] of truthCases)
    has(gatesFor(validOffer(), validSetup(), t), "product_truth")
      ? pass("P7 generator-gates", `refuses on upstream failure: ${label}`)
      : fail("P7 generator-gates", `generator did NOT refuse upstream failure: ${label}`);

  // The positive case: a fully valid synthetic fixture must be accepted.
  const clear = gatesFor(validOffer(), validSetup());
  if (clear.length === 0) {
    pass("P7 generator-gates", "accepts a synthetic fresh valid fixture (0 blockers)");
    const row = gen.buildRow(truth, draft, validOffer(), validSetup());
    row.price === "29.99 USD"
      ? pass("P7 generator-gates", `fixture row price formatted correctly: ${row.price}`)
      : fail("P7 generator-gates", `fixture row price malformed: ${JSON.stringify(row.price)}`);
    row.availability === "unknown"
      ? pass("P7 generator-gates", "fixture row keeps availability 'unknown'")
      : fail("P7 generator-gates", `fixture row availability: ${JSON.stringify(row.availability)}`);
    row.is_eligible_checkout === false && row.is_eligible_search === true
      ? pass("P7 generator-gates", "fixture row is search-eligible, checkout-disabled")
      : fail("P7 generator-gates", "fixture row eligibility flags are wrong");
    row.marketplace_seller === "Amazon"
      ? pass("P7 generator-gates", "fixture row carries the onboarding-supplied marketplace_seller")
      : fail("P7 generator-gates", `fixture row marketplace_seller: ${JSON.stringify(row.marketplace_seller)}`);
  } else {
    fail("P7 generator-gates", `valid fixture was rejected: ${JSON.stringify(clear)}`);
  }
}

// ------------------------- P8: runtime/generated isolation, no site file changed
{
  const vi = existsSync(join(ROOT, ".vercelignore")) ? readFileSync(join(ROOT, ".vercelignore"), "utf8") : "";
  /^commerce\/?$/m.test(vi)
    ? pass("P8 isolation", ".vercelignore excludes commerce/ (covers runtime/ and generated/)")
    : fail("P8 isolation", ".vercelignore must exclude commerce/ so runtime and generated files never deploy");

  for (const dir of ["runtime", "generated"]) {
    const gi = join(HERE, dir, ".gitignore");
    existsSync(gi) && /^\*$/m.test(readFileSync(gi, "utf8"))
      ? pass("P8 isolation", `commerce/${dir}/.gitignore ignores its contents`)
      : fail("P8 isolation", `commerce/${dir}/.gitignore must ignore its contents`);
  }
  !existsSync(join(HERE, "generated", "openai-products.jsonl"))
    ? pass("P8 isolation", "no generated feed in the working tree")
    : warn("P8 isolation", "a generated feed exists locally - git-ignored and never deployed, but do not commit it");

  const SITE = ["index.html", "robots.txt", "sitemap.xml", "vercel.json", "privacy.html",
                "site.webmanifest", "404.html"];
  try {
    const base = execFileSync("git", ["merge-base", "HEAD", "origin/main"], { cwd: ROOT, encoding: "utf8" }).trim();
    const changed = execFileSync("git", ["diff", "--name-only", base, "--", ...SITE, "assets"],
      { cwd: ROOT, encoding: "utf8" }).trim();
    changed
      ? fail("P8 isolation", `production site files modified: ${changed.split("\n").join(", ")}`)
      : pass("P8 isolation", "no production site file modified since origin/main");
  } catch (e) {
    warn("P8 isolation", `could not check site files against git: ${e.message}`);
  }
}

// ------------------------------------------------------------------- report
const line = "-".repeat(72);
console.log("\nJUMVI Phase 2B validation");
console.log(line);
for (const p of passes) console.log(`  PASS  ${p}`);
for (const w of warns) console.log(`  WARN  ${w}`);
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(line);
console.log(`${passes.length} passed, ${warns.length} warning(s), ${fails.length} failed\n`);
process.exit(fails.length ? 1 : 0);
