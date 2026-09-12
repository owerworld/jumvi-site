# JUMVI platform readiness — Phase 2A

Internal working document. **Nothing in `commerce/` is published, submitted or deployed.**
`product-truth.json` is the single source; every platform record below is generated *from* it.

## Structural fact that shapes every row

The physical product is sold on **Amazon US (ASIN B0H16JPQCF)**. `jumvi.co` is a brand and
product-information site: it has **no cart and no checkout**, and its call to action is
"View on Amazon". How each platform treats that differs sharply, and the difference is the whole story:
OpenAI's Stable feed specification **explicitly supports** third-party marketplace offers
via `marketplace_seller`, so JUMVI's shape is supported and needs onboarding. Google
Merchant Center does **not** permit it under current landing-page policy.

## Readiness table

| Platform | Record type | Status | Primary gate | Submit today |
|---|---|---|---|---|
| **OpenAI** — Agentic Commerce product feed | JSONL feed record | Data + seller identity ready | **Current price source / update pipeline**, plus marketplace onboarding | **No** |
| **Google / Gemini** — Merchant Center free listings | Merchant Center product feed | Attribute mapping complete | Landing-page policy: destination must be a checkout on the claimed domain; affiliate/redirect promotion not allowed | **No** |
| **Perplexity** — Merchant Program | XML/CSV product feed | Attribute mapping complete (provisional) | Application + manual review; same off-domain-checkout question | **No** |
| **Claude / web search** | *(none — HTML + JSON-LD)* | **Live since Phase 1** | — | **Already done** |

### OpenAI component status

| Component | Status |
|---|---|
| Product identity / data | **READY** |
| Seller identity | **READY** — `seller_name` = SAY23 LLC |
| Marketplace architecture | **SUPPORTED IN SPEC, ONBOARDING REQUIRED** |
| Main image | **READY**, with format-compatibility follow-up |
| Availability | **CAN USE `unknown`** — automation recommended, not blocking |
| Price | **BLOCKED** until a current verified price pipeline exists |
| Search eligibility | **READY IN PRINCIPLE** |
| Checkout | **Intentionally disabled** |

## OpenAI — Agentic Commerce product feed

Stable specification reviewed 2026-09-12:
<https://developers.openai.com/commerce/specs/feed.md>

Draft record: `commerce/openai-product-draft.json`. Feed format is **JSONL**; the draft is
pretty-printed for review only.

### Required-field status

| Field | Status | Note |
|---|---|---|
| `item_id` | ready | `JUMVI-TOSS-CATCH-001` — stable neutral internal ID |
| `title` | ready | 97 / 150 chars |
| `description` | ready | 358 / 5,000 chars, plain factual text |
| `url` | ready | `https://www.jumvi.co/` — the homepage *is* the product page |
| `brand` | ready | JUMVI |
| `seller_name` | ready | SAY23 LLC — the third-party seller supplying the offer |
| `marketplace_seller` | **unresolved** | Conditionally required for this offer shape; requires OpenAI setup |
| `image_url` | ready | Live production WebP; JPEG derivative staged for compatibility |
| `seller_url` | **unresolved** | Optional. Must be the SAY23 LLC seller page **on Amazon**, not jumvi.co |
| `availability` | ready | `unknown` — explicitly accepted, asserts no stock state |
| `price` | **BLOCKED** | Required **and must be current**. No source exists |

### Marketplace model — supported by the spec

The Stable specification handles third-party marketplace offers directly. Verbatim:

> For a third-party seller, `seller_name` identifies that seller and `marketplace_seller`
> identifies the marketplace where checkout occurs.

`marketplace_seller` is documented as *"Conditionally required for third-party marketplace
offers; requires setup"*, defined as *"Marketplace where checkout occurs. Keep distinct
from the supplying `seller_name`."*

JUMVI's shape — a brand selling as a third-party seller with checkout on Amazon — is
therefore a **supported conceptual shape** in the specification, not an unsupported edge
case. What it needs is feed setup:

| Concept | Value |
|---|---|
| `seller_name` | SAY23 LLC |
| checkout location | Amazon US |
| `marketplace_seller` | `unresolved_pending_openai_feed_setup` |

The exact registered marketplace value is assigned through OpenAI feed onboarding.
Guessing a string such as `Amazon` or `amazon_us` would be inventing an identifier we have
not been given, so nothing is emitted until OpenAI supplies it.

### The one true dynamic blocker: price

`price` is **required and must be current**. That combination is what blocks submission —
not a missing value, but a missing *pipeline*. A manually entered figure satisfies the
schema for a day and is wrong thereafter, which is worse than not submitting.
`amazon_offer_source` in `product-truth.json` declares the contract; it is not implemented.

`availability` is a different case. It is required, but `unknown` is an explicitly accepted
value and makes no stock claim, so the absence of an automated stock source is **not** a
discovery blocker. The draft uses `unknown`. Automating it to a real `in_stock` /
`out_of_stock` value remains highly desirable for buyer experience and is expected to help
ranking — it is an upgrade, not a gate.

### Image format

The spec defines `image_url` as *"Main product image, showing this variant. Use a direct
image URL, such as a JPEG or PNG."* JPEG and PNG are given as **examples**; the spec does
not state that WebP is rejected.

The record uses the live production WebP full-set shot —
`https://www.jumvi.co/assets/v5-contents.webp`, 1400×1200, the best existing canonical
product image for a feed (4 paddles, 4 balls, mesh bag and printed box on white). A
high-quality JPEG derivative is staged at `commerce/assets/jumvi-feed-main.jpg` as a
**defensive compatibility optimisation**, with future public path
`assets/jumvi-feed-main.jpg`. Not deployed. The validator warns about format; it never
fails on it.

### Search versus checkout — separate tracks

The current objective is **search / product discovery only**.

- `is_eligible_search: true` — a **request** for discovery eligibility. The spec documents
  it as defaulting to true and makes **no promise** of display, ranking or inclusion.
- `is_eligible_checkout: false` — deliberate. ChatGPT checkout is a separate track with its
  own requirements.
- `seller_tos` is absent (jumvi.co has a privacy policy but no terms page). It is
  conditionally required for **checkout** eligibility and is **not a discovery blocker**.

### Omitted recommended fields

`gtin` (none verified), `review_count` and `star_rating` (no first-party review corpus;
Amazon's review data is Amazon's and is not republished).

## Google / Gemini — Merchant Center free listings

Merchant Center free listings can surface products across Google surfaces including Gemini,
so the upside is real. The blocker is policy, not data.

Google requires the product's landing page to be on the domain claimed in the Merchant
Center account, and **not** to redirect shoppers to another site
([landing page requirements](https://support.google.com/merchants/answer/4752265),
[free listings policies](https://support.google.com/merchants/answer/12073010)).
Shopping also prohibits promoting affiliate or pay-per-click links to products outside a
CSS programme.

`jumvi.co` sends every buyer to Amazon. Submitting a Merchant Center feed today would
present `jumvi.co` as a direct ecommerce checkout site, which it is not. **We are not
creating or configuring that feed.** The attribute mapping below is prepared so it is ready
the moment the situation legitimately changes.

| Merchant Center attribute | Product Truth source |
|---|---|
| `id` | `internal_item_id` |
| `title` | generated from `product.name` + contents + age range |
| `description` | `canonical_description` |
| `link` | **blocked** — must be a purchasable page on the claimed domain |
| `image_link` | `media.primary_image_url` (JPEG/PNG derivative required) |
| `additional_image_link` | `media.additional_image_urls` |
| `availability` | `dynamic_offer_facts.availability` — resolve at build time |
| `price` | `dynamic_offer_facts.price` — resolve at build time |
| `brand` | `brand.name` |
| `gtin` | **omit** — none verified |
| `mpn` | **omit** — unresolved, see `identifiers.unresolved` |
| `identifier_exists` | `no` — only legitimate while gtin and mpn are genuinely absent |
| `condition` | `product.condition` = `new` |
| `age_group` | `kids` |
| `product_highlight` | contents, players, mission counts |

Legitimate routes to unblock, in rough order of effort: add real direct checkout on
`jumvi.co`; or join a CSS programme where the affiliate restriction differs; or accept
that Google product surfaces are out of scope and rely on organic Search + the Phase 1
structured data, which already works.

---

## Perplexity — Merchant Program

Prepare the mapping; **assume nothing about acceptance.** Applications go through manual
review and the programme has been expanding in stages.

| Perplexity feed field | Product Truth source |
|---|---|
| `id` | `internal_item_id` |
| `title` | generated |
| `description` | `canonical_description` |
| `link` | `product.url` — off-site checkout question applies, confirm during application |
| `image_link` | `media.primary_image_url` |
| `price` | `dynamic_offer_facts.price` — resolve at build time |
| `availability` | `dynamic_offer_facts.availability` — resolve at build time |
| `gtin` / `mpn` | **omit** — none verified |
| `brand` | `brand.name` |

Field list and eligibility notes above come from **secondary sources** (agency and vendor
write-ups), not from Perplexity's own published merchant documentation. Treat as
provisional and confirm against Perplexity directly before building anything.

---

## Claude / web search

**No proprietary feed is required.** The discovery foundation is the canonical HTML,
the JSON-LD graph and crawler access shipped in Phase 1 and live now:

- `Product` + `Brand` + `Organization` + `WebSite` JSON-LD on the homepage
- canonical `https://www.jumvi.co/`, `index, follow, max-image-preview:large`
- `robots.txt` allows `OAI-SearchBot`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`,
  `Googlebot-Image` and `Bingbot-Image`, each in its own group ahead of the wildcard
- model-training crawlers (GPTBot, ClaudeBot, anthropic-ai, Google-Extended and 21 others)
  remain blocked

`node commerce/validation.mjs --live` continuously checks the Product Truth against what is
actually published, so this foundation cannot silently drift.

---

## Dynamic offer facts — the interface, not the values

`price` and `availability` are live Amazon facts and are **never** stored statically.
They are **not equally blocking**: `price` is required *and must be current*, while
`availability` can honestly be `unknown`. `product-truth.json` declares the contract only:

```
amazon_offer_source
  input   { asin, marketplace }
  output  { price: "<amount> <CURRENCY>", availability: <enum>, retrieved_at: <ISO 8601> }
  on failure  do not emit the record — never substitute a cached or estimated value
```

### Source hierarchy — seller-owned only

| Tier | Route | Purpose | Precondition |
|---|---|---|---|
| **PRIMARY** | SP-API **Product Pricing API v0 — `getPricing`**, `ItemType=Asin`, ASIN `B0H16JPQCF`, marketplace `ATVPDKIKX0DER` | Current seller offer price | SP-API authorisation |
| Optional enrichment | SP-API **Listings Items v2021-08-01 — `getListingsItem`** | Richer listing attributes | **Verified seller SKU**, not on file |
| Optional availability | SP-API **FBA Inventory — `getInventorySummaries`** | Replace `unknown` with real stock | Not blocking |

`getPricing` is the primary because Amazon documents it as returning *"pricing information for a
seller's offer listings based on seller SKU or ASIN"* — a seller-owned operational source that
works from the ASIN we have already verified, with no seller SKU required to start.
Documented rate limit: 0.5 requests/second, burst 1 (usage plans are dynamic).

**Rejected:**

| Route | Why |
|---|---|
| **PA-API 5.0** | **Deprecated** by Amazon in favour of the Creators API. Also affiliate/publisher tooling returning general marketplace offers, not our own seller offer |
| Creators API | Affiliate-oriented successor; wrong relationship for our own price |
| Scraping Amazon HTML | Against Amazon's terms, fragile, indefensible data |

**Not implemented.** Any generator must fail closed.

Build price first — it is the only required-and-must-be-current field with no source.

---

## Open items requiring human verification

| # | Item | Severity |
|---|---|---|
| 1 | **Current price source** — SP-API authorisation for `getPricing`, plus an update pipeline | **True blocker** for OpenAI submission |
| 2 | **OpenAI feed onboarding** to obtain the registered `marketplace_seller` value | **True blocker** for this offer shape |
| 3 | Printed retail box "30+ Missions" artwork confirmation | Recorded `brand_owner_confirmed`, `artifact_verification: pending` |
| 4 | GTIN / UPC | Optional — recommended field only, omitted safely |
| 5 | `JUMVI-001` / `JMV-TC-001` intended semantic use | Not blocking — the spec has no sku/mpn field |
| 6 | Deploy `assets/jumvi-feed-main.jpg` | Compatibility follow-up, not a blocker |
| 7 | Automated availability source | Desirable upgrade from `unknown`, not a blocker |
| 8 | Terms of service page for `jumvi.co` | Checkout-only; not a discovery blocker |
| 9 | Whether direct checkout on `jumvi.co` is ever intended | Decides whether Google Merchant Center is reachable |
| 10 | SAY23 LLC business address and verified social profiles | Would strengthen the Organization entity |
