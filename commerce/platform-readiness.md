# JUMVI platform readiness — Phase 2A

Internal working document. **Nothing in `commerce/` is published, submitted or deployed.**
`product-truth.json` is the single source; every platform record below is generated *from* it.

## Structural fact that shapes every row

The physical product is sold on **Amazon US (ASIN B0H16JPQCF)**. `jumvi.co` is a brand and
product-information site: it has **no cart and no checkout**, and its call to action is
"View on Amazon". Every commerce platform below assumes the merchant both lists *and*
transacts. That mismatch — not data quality — is the real gate on Phase 2B.

## Readiness table

| Platform | Record type | Data ready | Blocked by | Can submit today |
|---|---|---|---|---|
| **OpenAI** — Agentic Commerce product feed | JSONL feed record | 7 of 9 required fields | `image_url` is WebP (spec needs JPEG/PNG); `price` + `availability` unresolved; marketplace position undocumented | **No** |
| **Google / Gemini** — Merchant Center free listings | Merchant Center product feed | Attribute mapping complete | Landing-page policy: destination must be a checkout on the claimed domain; affiliate/redirect promotion not allowed | **No** |
| **Perplexity** — Merchant Program | XML/CSV product feed | Attribute mapping complete | Application + manual review; same off-site-checkout question; programme details only confirmable with Perplexity | **No** |
| **Claude / web search** | *(none — HTML + JSON-LD)* | **Live since Phase 1** | — | **Already done** |

---

## OpenAI — Agentic Commerce product feed

Spec reviewed 2026-09-12: <https://developers.openai.com/commerce/specs/feed/>

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
| `seller_name` | ready | SAY23 LLC |
| `image_url` | **blocked** | Spec requires a direct JPEG/PNG link; current assets are WebP |
| `availability` | **unresolved by design** | Live Amazon offer fact |
| `price` | **unresolved by design** | Live Amazon offer fact |

### Marketplace position — read this before adding any column

The published feed specification defines **no `marketplace_seller` field**, and the
consolidated commerce documentation contains **no marketplace, third-party-seller,
multi-seller or reseller support**. Its seller fields are written for a single merchant
that both lists and fulfils. Verified against the feed spec and `llms-full.txt` on
2026-09-12.

So there is no correct column to add for "listed by SAY23 LLC, transacted on Amazon".
Inventing one would fabricate support the spec does not document. **No marketplace field
is emitted.** This must be settled directly with OpenAI during merchant onboarding.

Question to put to them: *does the programme accept a discovery-only feed from a brand
whose checkout is on a third-party marketplace, and if so how should the marketplace and
the seller of record be represented?*

### Eligibility flags

- `is_eligible_search: true` — a **request** for discovery eligibility. The spec documents
  it as defaulting to true and makes **no promise** of display, ranking or inclusion.
  Submitting a feed does not guarantee a product is ever shown.
- `is_eligible_checkout: false` — checkout is on Amazon. Setting this true requires a
  completed OpenAI checkout integration this project does not have.

### Omitted recommended fields

`gtin` (none verified), `review_count` and `star_rating` (no first-party review corpus;
Amazon's review data is Amazon's and is not republished).

---

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
`product-truth.json` declares the contract only:

```
amazon_offer_source
  input   { asin, marketplace }
  output  { price: "<amount> <CURRENCY>", availability: <enum>, retrieved_at: <ISO 8601> }
  on failure  do not emit the record — never substitute a cached or estimated value
```

Candidate implementations: Amazon Product Advertising API 5.0 (`GetItems` →
`Offers.Listings.Price` / `Offers.Listings.Availability`), or Selling Partner API Product
Pricing for the seller's own listing. **Not implemented.** Any generator must fail closed.

---

## Open items requiring human verification

| # | Item | Why it is blocking |
|---|---|---|
| 1 | Printed retail box "30+ Missions" claim | Recorded on the brand owner's statement; not confirmed against artwork or a box photograph |
| 2 | GTIN / UPC | None found. Required before any feed can carry a product identifier |
| 3 | `JUMVI-001` / `JMV-TC-001` intended semantic use | Until recorded, neither may be mapped to public `sku` or `mpn` |
| 4 | JPEG/PNG product image derivative | OpenAI spec rejects WebP for `image_url` |
| 5 | Amazon offer source credentials and access | Needed before any feed can carry price or availability |
| 6 | Terms of service page for `jumvi.co` | Listed as required for checkout eligibility; not required for search-only |
| 7 | Whether direct checkout on `jumvi.co` is ever intended | Decides whether Google Merchant Center is reachable at all |
| 8 | SAY23 LLC business address and verified social profiles | Would strengthen the Organization entity; currently unasserted |
