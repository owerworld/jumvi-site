#!/usr/bin/env node
/**
 * OpenAI product feed generator — INTERNAL, FAIL-CLOSED.
 *
 *   node commerce/generate-openai-feed.mjs          # report gate status
 *   node commerce/generate-openai-feed.mjs --emit   # write the feed, if permitted
 *
 * It cannot produce a submittable row today: marketplace_seller is unresolved
 * and no price source exists. Both gates fail closed. That is the design — the
 * blockers are encoded so a future contributor cannot quietly bypass them.
 *
 * Contacts nothing. Uploads nothing. Output goes to commerce/generated/, which
 * /.vercelignore keeps out of every deployment and .gitignore keeps out of git.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNTIME = join(HERE, "runtime");
const OUT_DIR = join(HERE, "generated");
const OUT_FILE = join(OUT_DIR, "openai-products.jsonl");

/** Contract constants. A mismatch is a failure, never a conversion task. */
export const EXPECTED_ASIN = "B0H16JPQCF";
export const EXPECTED_MARKETPLACE = "ATVPDKIKX0DER";
export const EXPECTED_CURRENCY = "USD";
export const PRICE_MAX_AGE_MINUTES = 60;
/** Seller-owned sources only. Affiliate APIs and scrapers can never qualify. */
export const APPROVED_SOURCES = new Set([
  "sp-api:getPricing",
  "sp-api:getListingsItem",
  "sp-api:getInventorySummaries",
]);
export const ALLOWED_AVAILABILITY = new Set([
  "in_stock", "out_of_stock", "pre_order", "backorder", "unknown",
]);

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const loadTruth = () => readJson(join(HERE, "product-truth.json"));
export const loadDraft = () => readJson(join(HERE, "openai-product-draft.json"));
export const loadOffer = () =>
  existsSync(join(RUNTIME, "amazon-offer.json")) ? readJson(join(RUNTIME, "amazon-offer.json")) : null;
export const loadSetup = () =>
  existsSync(join(RUNTIME, "openai-marketplace-setup.json"))
    ? readJson(join(RUNTIME, "openai-marketplace-setup.json"))
    : null;

/**
 * Upstream Product Truth invariants. If these drift, nothing downstream is
 * trustworthy, so the generator refuses rather than emitting from bad input.
 */
export function truthBlockers(truth) {
  const out = [];
  const add = (reason) => out.push({ gate: "product_truth", reason });

  if (truth.identifiers?.asin?.value !== EXPECTED_ASIN)
    add(`Product Truth ASIN is ${JSON.stringify(truth.identifiers?.asin?.value)}, expected ${EXPECTED_ASIN}.`);
  if (truth.identifiers?.asin?.verified !== true) add("Product Truth ASIN is not marked verified.");
  if (truth.marketplace?.marketplace_id !== EXPECTED_MARKETPLACE)
    add(`Product Truth marketplace_id is ${JSON.stringify(truth.marketplace?.marketplace_id)}, expected ${EXPECTED_MARKETPLACE}.`);
  if ((truth.identifiers?.public_sku ?? null) !== null || (truth.identifiers?.public_mpn ?? null) !== null)
    add("public_sku / public_mpn must stay null until a verified semantic mapping exists.");
  if ((truth.identifiers?.gtin?.value ?? null) !== null && truth.identifiers?.gtin?.verified !== true)
    add("An unverified GTIN is present in Product Truth.");
  if (truth.dynamic_offer_facts?.price?.value != null)
    add("Product Truth carries a static price. Price must come from a fresh runtime snapshot.");
  const age = truth.product?.age_range;
  if (age?.min !== 3 || age?.max !== 12) add(`Age range is ${JSON.stringify(age)}, expected 3-12.`);
  const box = truth.packaging_claims?.printed_retail_box?.mission_claim_text ?? "";
  if (/36/.test(box)) add(`Printed box claim states 36 (${JSON.stringify(box)}). The box is "30+ Missions".`);

  return out;
}

/** Every reason the feed may not be emitted. Empty array = clear to emit. */
export function blockers(truth, offer, setup, now = new Date()) {
  const out = [...truthBlockers(truth)];
  const add = (gate, reason) => out.push({ gate, reason });

  // --- Gate: marketplace_seller must come from OpenAI onboarding ------------
  if (!setup) {
    add("marketplace_seller", "No commerce/runtime/openai-marketplace-setup.json. The registered value is supplied by OpenAI during feed setup.");
  } else {
    if (setup.marketplace_seller == null || String(setup.marketplace_seller).trim() === "")
      add("marketplace_seller", "marketplace_seller is null. The spec marks it conditionally required for third-party marketplace offers and says it 'requires setup'; adding the column alone does not enable it.");
    if (setup.verified_by_openai_onboarding !== true)
      add("marketplace_seller", "verified_by_openai_onboarding is not true. Only a human with written confirmation from OpenAI may set this.");
  }

  // --- Gate: a current, valid price ----------------------------------------
  if (!offer) {
    add("price", "No commerce/runtime/amazon-offer.json. price is required by the spec and must be current.");
  } else {
    if (offer.asin !== EXPECTED_ASIN)
      add("price", `Offer ASIN is ${JSON.stringify(offer.asin)}, expected ${EXPECTED_ASIN}.`);
    if (offer.marketplace_id !== EXPECTED_MARKETPLACE)
      add("price", `Offer marketplace_id is ${JSON.stringify(offer.marketplace_id)}, expected ${EXPECTED_MARKETPLACE}.`);
    if (offer.currency !== EXPECTED_CURRENCY)
      add("price", `Offer currency is ${JSON.stringify(offer.currency)}, expected ${EXPECTED_CURRENCY}. A mismatch is a failure, not a conversion.`);
    if (!APPROVED_SOURCES.has(offer.source))
      add("price", `Offer source ${JSON.stringify(offer.source)} is not an approved seller-owned source.`);

    const price = Number(offer.price);
    if (offer.price == null || offer.price === "") add("price", "Offer carries no price.");
    else if (!Number.isFinite(price)) add("price", `Offer price ${JSON.stringify(offer.price)} is not numeric.`);
    else if (price <= 0) add("price", `Offer price ${price} must be greater than zero.`);

    if (!offer.fetched_at) {
      add("price", "Offer has no fetched_at timestamp; freshness cannot be proven.");
    } else {
      const ageMin = (now - new Date(offer.fetched_at)) / 60000;
      if (!Number.isFinite(ageMin)) add("price", `Offer fetched_at ${JSON.stringify(offer.fetched_at)} is not a valid timestamp.`);
      else if (ageMin > PRICE_MAX_AGE_MINUTES)
        add("price", `Offer is ${Math.round(ageMin)} min old, past the ${PRICE_MAX_AGE_MINUTES} min threshold. A stale price is never reused.`);
    }

    if (offer.availability != null && !ALLOWED_AVAILABILITY.has(offer.availability))
      add("price", `Offer availability ${JSON.stringify(offer.availability)} is not an allowed value.`);
  }

  return out;
}

/** Build the row. Only ever reached once every gate has cleared. */
export function buildRow(truth, draft, offer, setup) {
  const r = draft.record ?? {};
  return {
    item_id: truth.internal_item_id,
    title: r.title,
    description: r.description,
    url: truth.product.url,
    brand: truth.brand.name,
    seller_name: truth.marketplace.openai_feed_model.seller_name,
    marketplace_seller: setup.marketplace_seller,
    image_url: truth.media.feed_main_image.production_webp_candidate,
    // "unknown" is explicitly accepted by the spec and asserts nothing about stock.
    availability: ALLOWED_AVAILABILITY.has(offer.availability) ? offer.availability : "unknown",
    price: `${Number(offer.price).toFixed(2)} ${EXPECTED_CURRENCY}`,
    condition: truth.product.condition,
    product_category: r.product_category,
    seller_privacy_policy: truth.company.privacy_policy_url,
    is_eligible_search: true,
    is_eligible_checkout: false,
  };
}

/** How to clear each gate. Printed only for gates that actually fired. */
const HELP = {
  product_truth: "correct commerce/product-truth.json",
  marketplace_seller: "OpenAI onboarding (commerce/openai-onboarding-pack.md)",
  price: "write a fresh commerce/runtime/amazon-offer.json (commerce/amazon-offer-source.md)",
};

function main() {
  const emit = process.argv.includes("--emit");
  const truth = loadTruth();
  const draft = loadDraft();
  const offer = loadOffer();
  const setup = loadSetup();
  const gates = blockers(truth, offer, setup);

  console.log("\nOpenAI feed generator — fail-closed");
  console.log(`  product truth   : ${truth.internal_item_id}`);
  console.log(`  offer snapshot  : ${offer ? offer.fetched_at ?? "(no timestamp)" : "(none)"}`);
  console.log(`  marketplace set : ${setup ? JSON.stringify(setup.marketplace_seller) : "(none)"}`);
  console.log(`  output target   : ${OUT_FILE}`);
  console.log("-".repeat(72));

  if (gates.length) {
    console.log(`  REFUSING TO EMIT — ${gates.length} blocker(s):\n`);
    for (const g of gates) console.log(`    [${g.gate}] ${g.reason}\n`);
    // Guidance is derived from the gates that actually fired, so a resolved
    // blocker stops being advertised as outstanding work.
    const open = [...new Set(gates.map((g) => g.gate))].filter((g) => HELP[g]);
    if (open.length) {
      console.log("  This is correct behaviour, not a bug. Resolve the gates first:");
      const pad = Math.max(...open.map((g) => g.length));
      for (const g of open) console.log(`    - ${g.padEnd(pad)} -> ${HELP[g]}`);
      console.log();
    }
    process.exit(emit ? 1 : 0);
  }

  const row = buildRow(truth, draft, offer, setup);
  if (!emit) {
    console.log("  All gates clear. Re-run with --emit to write the feed.\n");
    console.log(JSON.stringify(row, null, 2));
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(row) + "\n", "utf8");
  console.log(`  Wrote 1 row to ${OUT_FILE}`);
  console.log("  NOT uploaded. Delivery is SFTP and remains a separate, manual step.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
