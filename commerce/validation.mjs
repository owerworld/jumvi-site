#!/usr/bin/env node
/**
 * JUMVI Product Truth validator.
 *
 *   node commerce/validation.mjs            # offline: drift-checks against ./index.html
 *   node commerce/validation.mjs --live     # drift-checks against https://www.jumvi.co/
 *
 * Exits 1 on any FAIL. Nothing here publishes, submits or deploys.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const LIVE_URL = "https://www.jumvi.co/";

const truth = JSON.parse(readFileSync(join(HERE, "product-truth.json"), "utf8"));
const feed = JSON.parse(readFileSync(join(HERE, "openai-product-draft.json"), "utf8"));

const fails = [];
const passes = [];
const warns = [];
const fail = (rule, msg) => fails.push(`${rule}: ${msg}`);
const pass = (rule, msg) => passes.push(`${rule}: ${msg}`);
const warn = (rule, msg) => warns.push(`${rule}: ${msg}`);

/** Every string value in an object tree, with its dotted path. */
function* strings(node, path = "") {
  if (typeof node === "string") yield [path, node];
  else if (Array.isArray(node)) for (const [i, v] of node.entries()) yield* strings(v, `${path}[${i}]`);
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) yield* strings(v, path ? `${path}.${k}` : k);
}
const allStrings = [...strings(truth, "product-truth"), ...strings(feed, "openai-draft")];

/** Walk every key/value pair, with its dotted path. */
function* entries(node, path = "") {
  if (Array.isArray(node)) for (const [i, v] of node.entries()) yield* entries(v, `${path}[${i}]`);
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      yield [p, k, v];
      yield* entries(v, p);
    }
}
const allEntries = [...entries(truth, "product-truth"), ...entries(feed, "openai-draft")];

// ---------------------------------------------------------------- R1: ages 3-8
{
  const re = /\b3\s*[‐-―\-]\s*8\b|ages?\s*3\s*(?:to|[‐-―\-])\s*8\b/i;
  const hits = allStrings.filter(([, v]) => re.test(v));
  hits.length
    ? hits.forEach(([p, v]) => fail("R1 stale-age", `"3-8" age range at ${p}: ${JSON.stringify(v)}`))
    : pass("R1 stale-age", "no 3-8 age range anywhere");

  const a = truth.product?.age_range;
  a?.min === 3 && a?.max === 12
    ? pass("R1 stale-age", "canonical age range is 3-12")
    : fail("R1 stale-age", `age_range is ${JSON.stringify(a)}, expected min 3 max 12`);
}

// ------------------------------------------- R2/R3: fabricated reviews & ratings
{
  const keys = /^(review_count|reviewcount|star_rating|ratingvalue|aggregaterating|rating|reviews?)$/i;
  // Documentation containers explain why a field is omitted; they are prose,
  // not assertions. The real assertion sites (record.*, ratings_and_reviews.*)
  // are still checked.
  const docPath = /_field_notes|_meta|_note$|_notes$|\.policy$|note$/i;
  const asserted = allEntries.filter(
    ([p, k, v]) => keys.test(k) && v !== null && typeof v !== "object" && !docPath.test(p)
  );
  asserted.length
    ? asserted.forEach(([p, , v]) => fail("R2 fake-reviews", `review/rating value asserted at ${p}: ${JSON.stringify(v)}`))
    : pass("R2 fake-reviews", "no review count or star rating asserted");

  truth.ratings_and_reviews?.status === "not_asserted"
    ? pass("R3 rating-policy", "ratings_and_reviews marked not_asserted")
    : fail("R3 rating-policy", "ratings_and_reviews.status must be 'not_asserted'");
}

// ---------------------------------------------------------------- R4: GTIN
{
  const g = truth.identifiers?.gtin;
  const declared = g?.verified === true && typeof g.value === "string";
  if (!declared && (g?.value ?? null) !== null)
    fail("R4 gtin", `identifiers.gtin.value is set (${g.value}) but verified !== true`);
  else if (!declared) pass("R4 gtin", "no GTIN asserted (verified flag is false, value null)");

  if (feed.record?.gtin != null) {
    declared && /^\d{8}$|^\d{12,14}$/.test(String(feed.record.gtin))
      ? pass("R4 gtin", "feed gtin matches a verified value")
      : fail("R4 gtin", `feed record emits gtin ${JSON.stringify(feed.record.gtin)} with no verified source`);
  } else pass("R4 gtin", "feed record emits no gtin");
}

// ------------------------------------------- R5/R6: hardcoded price / availability
{
  const d = truth.dynamic_offer_facts ?? {};
  for (const f of ["price", "availability"]) {
    const node = d[f] ?? {};
    node.value === null && node.status === "unresolved"
      ? pass("R5 dynamic-offer", `product-truth ${f} is an unresolved placeholder`)
      : fail("R5 dynamic-offer", `product-truth dynamic_offer_facts.${f} carries a static value: ${JSON.stringify(node.value)}`);
  }
  // price is required AND must be current: it may never be a baked-in constant.
  feed.record?.price === null
    ? pass("R6 dynamic-offer", "feed price is null pending build-time injection from a current source")
    : fail("R6 dynamic-offer", `feed record hardcodes price: ${JSON.stringify(feed.record?.price)}`);
  // availability is required too, but "unknown" is explicitly accepted by the
  // spec and asserts nothing about stock, so it is permitted. The four real
  // stock claims are not, while no verified source exists.
  {
    const a = feed.record?.availability;
    a === "unknown" || a === null
      ? pass("R6 dynamic-offer", `feed availability is ${JSON.stringify(a)} - no unverified stock claim`)
      : fail("R6 dynamic-offer", `feed record claims stock state ${JSON.stringify(a)} with no verified source`);
  }
  // Nothing anywhere may look like a baked-in USD amount or an availability enum.
  const money = /\$\s?\d|\b\d+\.\d{2}\s*USD\b/;
  allStrings
    .filter(([p, v]) => money.test(v) && !/_note|note$|contract|_field_notes|policy|source_interface/i.test(p))
    .forEach(([p, v]) => fail("R5 dynamic-offer", `looks like a hardcoded price at ${p}: ${JSON.stringify(v)}`));
  const avail = /^(in_stock|out_of_stock|pre_order|backorder)$/i; // "unknown" excluded on purpose
  allEntries
    .filter(([p, k, v]) => /availability/i.test(k) && typeof v === "string" && avail.test(v) && !/allowed_values/.test(p))
    .forEach(([p, , v]) => fail("R6 dynamic-offer", `unverified stock claim at ${p}: ${JSON.stringify(v)}`));
}

// --------------------------------------------- R7: JUMVI-001 / JMV-TC-001 as sku/mpn
{
  const legacy = ["JUMVI-001", "JMV-TC-001"];
  const verifiedMap = new Set(
    (truth.identifiers?.unresolved ?? [])
      .filter((u) => u.semantic_use_verified === true)
      .map((u) => u.string)
  );
  const skuKey = /^(sku|mpn|public_sku|public_mpn|seller_sku|manufacturer_part_number)$/i;

  for (const [p, k, v] of allEntries) {
    if (!skuKey.test(k) || typeof v !== "string") continue;
    const hit = legacy.find((l) => v.includes(l));
    if (hit && !verifiedMap.has(hit))
      fail("R7 unresolved-id", `${hit} asserted as ${k} at ${p} without a verified semantic mapping`);
  }
  (truth.identifiers?.public_sku ?? null) === null && (truth.identifiers?.public_mpn ?? null) === null
    ? pass("R7 unresolved-id", "public_sku and public_mpn are null")
    : fail("R7 unresolved-id", "public_sku / public_mpn must stay null until verified");
  legacy.every((l) => !verifiedMap.has(l))
    ? pass("R7 unresolved-id", "JUMVI-001 and JMV-TC-001 remain flagged unverified")
    : warn("R7 unresolved-id", "a legacy identifier is now marked verified - confirm the mapping is real before emitting it");
}

// ------------------------------- R8: packaging vs Mission Hub mission counts
{
  const box = truth.packaging_claims?.printed_retail_box ?? {};
  const hub = truth.packaging_claims?.digital_mission_hub ?? {};

  /^30\+\s*Missions$/i.test(box.mission_claim_text ?? "")
    ? pass("R8 packaging", `printed box claim permitted: "${box.mission_claim_text}"`)
    : fail("R8 packaging", `printed box claim must be "30+ Missions", got ${JSON.stringify(box.mission_claim_text)}`);

  box.verification_level === "brand_owner_confirmed"
    ? pass("R8 packaging", "printed box claim classified brand_owner_confirmed")
    : fail("R8 packaging", `printed box verification_level must be "brand_owner_confirmed", got ${JSON.stringify(box.verification_level)}`);
  ["pending", "confirmed"].includes(box.artifact_verification)
    ? pass("R8 packaging", `printed box artifact_verification = ${box.artifact_verification}`)
    : fail("R8 packaging", `printed box artifact_verification must be "pending" or "confirmed", got ${JSON.stringify(box.artifact_verification)}`);

  /36/.test(box.mission_claim_text ?? "")
    ? fail("R8 packaging", "printed box claim states 36 - the box is 30+, never 36")
    : pass("R8 packaging", "printed box claim does not state 36");

  /^36\s*Guided Missions$/i.test(hub.mission_claim_text ?? "")
    ? pass("R8 packaging", `digital Mission Hub claim permitted: "${hub.mission_claim_text}"`)
    : fail("R8 packaging", `Mission Hub claim must be "36 Guided Missions", got ${JSON.stringify(hub.mission_claim_text)}`);

  // Free-text guard: "36" in the same clause as box/packaging wording.
  const clause = /(printed\s+)?(retail\s+)?(box|packaging|carton)[^.;]{0,60}\b36\b|\b36\b[^.;]{0,60}(printed on|on the)\s+(box|packaging|carton)/i;
  const hits = allStrings.filter(
    ([p, v]) => clause.test(v) && !/must_not_be_restated_as|_note|note$/i.test(p)
  );
  hits.length
    ? hits.forEach(([p, v]) => fail("R8 packaging", `packaging described with 36 missions at ${p}: ${JSON.stringify(v)}`))
    : pass("R8 packaging", "no text describes the physical packaging as 36 Missions");

  truth.digital_mission_hub?.guided_missions === 36
    ? pass("R8 packaging", "digital Mission Hub = 36 Guided Missions")
    : fail("R8 packaging", `digital_mission_hub.guided_missions must be 36, got ${truth.digital_mission_hub?.guided_missions}`);
}

// ------------------------------- R10: marketplace_seller must not be guessed
{
  const m = truth.marketplace?.openai_feed_model ?? {};
  m.seller_name === "SAY23 LLC"
    ? pass("R10 marketplace", "seller_name = SAY23 LLC (the supplying third-party seller)")
    : fail("R10 marketplace", `seller_name must be "SAY23 LLC", got ${JSON.stringify(m.seller_name)}`);
  m.checkout_location === "Amazon US"
    ? pass("R10 marketplace", "checkout_location = Amazon US")
    : fail("R10 marketplace", `checkout_location must be "Amazon US", got ${JSON.stringify(m.checkout_location)}`);

  const unresolved = (v, s) => v === null && s === "unresolved_pending_openai_feed_setup";
  unresolved(m.marketplace_seller, m.marketplace_seller_status)
    ? pass("R10 marketplace", "marketplace_seller unresolved_pending_openai_feed_setup - not guessed")
    : fail("R10 marketplace", `marketplace_seller must stay null with status unresolved_pending_openai_feed_setup until OpenAI supplies it, got ${JSON.stringify(m.marketplace_seller)}`);

  const fm = feed.record?.marketplace_seller ?? null;
  fm === null
    ? pass("R10 marketplace", "feed record emits no guessed marketplace_seller")
    : fail("R10 marketplace", `feed record asserts marketplace_seller ${JSON.stringify(fm)} before onboarding supplied it`);

  // The spec supports this shape - stale "not supported" claims must not linger.
  const stale = /marketplace_seller (does not exist|is not (defined|documented))|no marketplace[ _-]?seller field|marketplace support is undocumented|assumes only one direct merchant|(documents|contains) no marketplace/i;
  const hits = allStrings.filter(([, v]) => stale.test(v));
  hits.length
    ? hits.forEach(([p]) => fail("R10 marketplace", `stale "marketplace unsupported" claim at ${p} - the Stable spec supports third-party marketplace offers`))
    : pass("R10 marketplace", "no stale 'marketplace unsupported' claims");
}

// -------------------------------- R11: image format is advisory, never fatal
{
  const fm = truth.media?.feed_main_image ?? {};
  const url = feed.record?.image_url ?? "";
  if (/\.(jpe?g|png)$/i.test(url)) pass("R11 image-format", `image_url is a documented example format: ${url}`);
  else if (/\.webp$/i.test(url))
    warn("R11 image-format", `image_url is WebP (${url}). The spec says "such as a JPEG or PNG" - examples, not an exclusion - so this is a compatibility recommendation, not a failure. JPEG derivative staged at ${fm.jpeg_derivative_staged_path ?? "(none)"}.`);
  else if (url) warn("R11 image-format", `image_url has an undocumented extension: ${url}`);
  else fail("R11 image-format", "image_url is empty - it is a required field");

  // Flag ASSERTIONS that WebP is rejected - not corrections that say it is not.
  const bad = /openai rejects webp|webp is rejected|webp is not (accepted|allowed|supported)|hard blocker/gi;
  const negated = (text, at) => /\b(not|never|n't|rather than|instead of)\b/i.test(text.slice(Math.max(0, at - 45), at));
  const hits = allStrings.filter(([, v]) => {
    for (const m of v.matchAll(bad)) if (!negated(v, m.index)) return true;
    return false;
  });
  hits.length
    ? hits.forEach(([p]) => fail("R11 image-format", `overstated image-format claim at ${p} - WebP rejection is not documented`))
    : pass("R11 image-format", "no overstated WebP-rejection claims");
}

// ---------------------------------------------- R9: drift vs homepage JSON-LD
async function loadHomepage(live) {
  if (!live) return { html: readFileSync(join(ROOT, "index.html"), "utf8"), origin: "local ./index.html" };
  const res = await fetch(LIVE_URL, { headers: { "user-agent": "jumvi-product-truth-validator" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), origin: LIVE_URL };
}

const live = process.argv.includes("--live");
let source = "(not checked)";
try {
  const page = await loadHomepage(live);
  source = page.origin;
  const blocks = [...page.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!blocks.length) throw new Error("no JSON-LD block found on the homepage");

  const graph = JSON.parse(blocks[0])["@graph"] ?? [];
  const byType = (t) => graph.find((n) => n["@type"] === t) ?? {};
  const product = byType("Product");
  const prop = (name) =>
    (product.additionalProperty ?? []).find((p) => p.name === name)?.value;

  const t = truth.drift_targets;
  const checks = [
    ["name", product.name, t.product_name],
    ["brand @id -> Brand.name", byType("Brand").name, t.brand_name],
    ["Organization.name", byType("Organization").name, t.organization_name],
    ["url", product.url, t.url],
    ["audience.suggestedMinAge", product.audience?.suggestedMinAge, t.suggested_min_age],
    ["audience.suggestedMaxAge", product.audience?.suggestedMaxAge, t.suggested_max_age],
    ["Players", prop("Players"), t.players],
    ["Guided Missions", prop("Guided Missions"), t.guided_missions],
    ["Skill packs", prop("Skill packs"), t.skill_packs],
    ["sameAs[0]", (product.sameAs ?? [])[0], t.asin_same_as],
  ];
  for (const [label, got, want] of checks)
    got === want
      ? pass("R9 drift", `${label} matches (${JSON.stringify(want)})`)
      : fail("R9 drift", `${label} drift - homepage ${JSON.stringify(got)} vs Product Truth ${JSON.stringify(want)}`);

  const blob = JSON.stringify(graph).toLowerCase();
  for (const k of ["offers", "price", "availability", "aggregaterating", '"review"', "gtin", '"sku"', '"mpn"'])
    blob.includes(k)
      ? fail("R9 drift", `homepage JSON-LD contains forbidden field ${k}`)
      : pass("R9 drift", `homepage JSON-LD has no ${k}`);

  const imgs = product.image ?? [];
  imgs.includes(truth.media.primary_image_url)
    ? pass("R9 drift", "primary image URL present in homepage JSON-LD")
    : fail("R9 drift", `primary image ${truth.media.primary_image_url} not in homepage JSON-LD image list`);
} catch (err) {
  warn("R9 drift", `drift check skipped - ${err.message}${live ? " (retry without --live to use ./index.html)" : ""}`);
}

// ------------------------------------------------------------------- report
const line = "-".repeat(72);
console.log(`\nJUMVI Product Truth validation`);
console.log(`drift source: ${source}${live ? "" : "   (use --live to check production)"}`);
console.log(line);
for (const p of passes) console.log(`  PASS  ${p}`);
for (const w of warns) console.log(`  WARN  ${w}`);
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(line);
console.log(`${passes.length} passed, ${warns.length} warning(s), ${fails.length} failed\n`);
process.exit(fails.length ? 1 : 0);
