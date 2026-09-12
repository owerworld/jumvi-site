# OpenAI Product Discovery — onboarding pack

Internal. This is what we would hand OpenAI if asked. **Nothing has been
submitted, no account created, no contact made.**

Objective: **search / product discovery only.** ChatGPT checkout is explicitly
out of scope.

All OpenAI facts re-checked live on **2026-09-12**. Confidence values:
**official** (stated in OpenAI's own docs) · **inferred** (reasoned from official
text, not stated) · **unknown** (not documented).

## Evidence register

| # | Question | Finding | Source | Evidence | Confidence |
|---|---|---|---|---|---|
| 1 | Merchant application path | Apply at `https://chatgpt.com/merchants` | *Get started* — <https://developers.openai.com/commerce/guides/get-started.md> | "Onboarding product feeds in ChatGPT is currently available to approved partners. To apply for access, fill out this form [here](https://chatgpt.com/merchants)" | **official** |
| 2 | Self-service or approval-based? | **Approval-based.** Not self-serve | same as #1 | "currently available to **approved partners**" | **official** |
| 3 | Feed delivery options | File upload **and** an API | *Get started* | "provide the entire feed once a day via file upload, and then send updates throughout the day via the API" | **official** |
| 4 | File-upload transport | **SFTP** | *File upload overview* — <https://developers.openai.com/commerce/specs/file-upload/overview> | "Push feeds to OpenAI via SFTP." | **official** |
| 5 | Accepted formats | OpenAI format: JSONL, CSV, TSV. Google-compatible: tab-delimited `.txt`/`.tsv`, comma-delimited `.csv`. Gzip supported | *Feed spec* — <https://developers.openai.com/commerce/specs/feed.md> | "Upload a UTF-8, tab-delimited `.txt` or `.tsv` file, or a comma-delimited `.csv`"; "Gzip-compressed … files are supported" | **official** |
| 6 | Update expectations | Full snapshot at least daily; intraday upserts via API | *File upload overview* | "at least daily"; "For file upload, overwrite the same file or shard set with your latest snapshot on a regular cadence. For the API, upsert products through the API." | **official** |
| 7 | Shard limits | ≤ ~500k items per shard, files under ~500 MB | *File upload overview* | "Up to 500k items per shard is recommended; target shard files under ~500MB" | **official** |
| 8 | US-market scope | The standard upload targets the US | *Feed spec*, markets | "The standard OpenAI-format upload currently targets the US"; "Use additional markets only after OpenAI confirms the integration and its allowed countries and currencies" | **official** |
| 9 | Search eligibility | Default **on**; `is_eligible_search` is Optional | *Feed spec*, OpenAI flags | "`true` enables search eligibility; `false` disables it and checkout eligibility. Omitted or empty: `true`" | **official** |
| 10 | Is display guaranteed? | **No** | *Feed spec*, OpenAI flags | "**Eligibility does not guarantee display.**" | **official** |
| 11 | Checkout eligibility | Opt-in, and gated on search being true plus checkout being enabled for the integration | *Feed spec* | "`true` opts in only when search eligibility is also `true` and checkout is enabled for the integration" | **official** |
| 12 | Checkout-only requirements | `seller_privacy_policy` and `seller_tos` | *Feed spec*, requirement column | both listed "Conditionally required for checkout" | **official** |
| 13 | Required fields (all feeds) | `item_id`, `title`, `description`, `url`, `brand`, `seller_name`, `image_url`, `availability`, `price` | *Feed spec* | requirement column | **official** |
| 14 | Marketplace support | Supported as a first-class case | *Feed spec*, **Merchant info** | "For a third-party seller, `seller_name` identifies that seller and `marketplace_seller` identifies the marketplace where checkout occurs." | **official** |
| 15 | `marketplace_seller` setup | Requires an integration configured to carry it | *Feed spec*, `marketplace_seller` row + **Additional supported data** | "Conditionally required for third-party marketplace offers; **requires setup**"; "These optional fields require an integration configured to carry them. Confirm support during onboarding before relying on them; **adding these columns alone to a standard OpenAI-format upload does not enable them.**" | **official** |
| 16 | How is the value assigned? | **Not documented.** The example shows a human-readable marketplace name, but the registered value for an integration is not derivable | *Feed spec* | "Do not assume registration supplies other row fields." | **unknown** |
| 17 | Is Amazon named? | **No.** "Amazon" appears nowhere in the feed specification | *Feed spec*, full-document scan | absence verified | **official** (absence) |
| 18 | Is this checkout model accepted for discovery? | Not addressed | — | no statement found | **unknown** |
| 19 | `seller_url` semantics | The seller's page **on the marketplace** | *Feed spec* | "Seller's storefront or profile page. For a marketplace offer, use the specific seller's page." | **official** |
| 20 | `mpn` / `sku` | `mpn` exists as Optional; `sku` is only a legacy alias for `item_id` | *Feed spec* | "Manufacturer-assigned part number…"; "Send only one name per value: `item_id` wins over `id` and `sku`"; "do not invent a value to replace a missing GTIN" | **official** |
| 21 | Fees / commissions | Not documented in the commerce feed docs | *Get started*, *Key concepts*, *Feed spec* | no fee statements found | **unknown** |
| 22 | Merchant responsibility | Compliance sits with the merchant | *Get started* | "Merchants are responsible for ensuring their products and content do not violate these restrictions or any applicable law." | **official** |
| 23 | Application form contents | Could not be read — `https://chatgpt.com/merchants` returns **HTTP 403** to automated fetch | — | a human must open it in a browser | **unknown** |

## Company

| Field | Value |
|---|---|
| Legal entity | SAY23 LLC |
| Brand | JUMVI |
| Website | <https://www.jumvi.co/> |
| Seller role | Third-party marketplace seller |
| Marketplace | Amazon US |
| Amazon marketplace ID | `ATVPDKIKX0DER` |
| Checkout occurs on | Amazon.com |
| Direct checkout on jumvi.co | **false** — no cart, no checkout |
| Amazon ASIN | `B0H16JPQCF` |
| Product count | 1 primary ASIN |
| Contact email | support@jumvi.co *(already published on the live site)* |
| Business address | **not supplied** — none verified, not fabricated |
| Social profiles | **not supplied** — none verified, not fabricated |

## Product model

**JUMVI Toss & Catch** — children's toss-and-catch activity set.

| Attribute | Value |
|---|---|
| Ages | 3–12 |
| Players | 2–4 |
| Condition | New |
| Contents | 4 hand-strap EVA paddles · 4 sticky balls · mesh carry bag · printed retail box · QR Mission Card |
| Digital Mission Hub | 36 Guided Missions across 6 skill packs |
| Hub access | QR Mission Card opens it in a mobile browser |
| App download | Not required |
| Signup | Not required |

**Packaging claim distinction — do not normalise.** The printed retail box states
**"30+ Missions"** (brand-owner confirmed; artwork verification pending). The
digital Mission Hub contains **36 Guided Missions** (verified). Two separate
surfaces. No JUMVI material states that the physical box says 36.

## Not supplied in the feed, and why

| Field | Why absent |
|---|---|
| `gtin` | None verified. The spec validates the check digit and instructs "do not invent a value to replace a missing GTIN" |
| `mpn` | Exists in the spec as Optional, but no manufacturer part number is verified. `JMV-TC-001` is unresolved and not emitted |
| SKU | Not a distinct product-identifier field — `sku` is only a legacy alias for `item_id`. `JUMVI-001` is unresolved and not emitted |
| `review_count`, `star_rating` | No first-party review corpus. Amazon's review data belongs to Amazon |
| `shipping_price`, `accepts_returns`, `return_deadline_in_days` | Fulfilment and returns are governed by Amazon; we will not restate their terms as our own |
| `dimensions`, `weight` | No verified measurements on file |
| Certifications | None verified |

## Feed profile we intend to deliver

| | |
|---|---|
| Format | OpenAI format, **JSONL** |
| Transport | **SFTP** for the daily snapshot; API for intraday upserts if provisioned |
| Cadence | Full snapshot at least daily |
| Rows | 1 |
| Market | US only |
| Currency | USD |

## Eligibility position

| Field | Value | Rationale |
|---|---|---|
| `seller_name` | `SAY23 LLC` | The seller supplying the offer |
| `marketplace_seller` | **unresolved** | Requires OpenAI feed setup; never guessed |
| `seller_url` | **unresolved** | Must be the SAY23 LLC seller page on Amazon, not jumvi.co |
| `is_eligible_search` | `true` | Discovery is the objective. Note the spec default is already `true`, and "Eligibility does not guarantee display" |
| `is_eligible_checkout` | `false` | Deliberate — checkout is on Amazon |
| `seller_privacy_policy` | <https://www.jumvi.co/privacy> | Available |
| `seller_tos` | **not published** | Checkout-only requirement; not a discovery blocker |

## The unresolved question for OpenAI

Ask verbatim. **Not answered here** — the documentation does not resolve it.

> We are SAY23 LLC, the third-party seller of JUMVI products on Amazon US. Checkout occurs on Amazon.com. For a Product Feed third-party marketplace offer, what exact registered value should we use for marketplace_seller, and what feed/account setup is required for Amazon marketplace offers? Does the current merchant discovery program accept this Amazon.com checkout model for search/product discovery when is_eligible_checkout is false?

Supporting context if asked: single ASIN, US market, USD, discovery only, no
checkout enablement requested, privacy policy published, terms of service not yet
published because it is a checkout-only requirement.

Worth asking in the same thread: **are there fees, commissions or costs** for
discovery-only feed participation? Not documented anywhere we could find
(evidence row 21).

## Claim-safety statement

This pack and any feed generated from it contain **no**: fake reviews, fake
ratings, unsupported certification claims, stale or hardcoded price, hardcoded
stock, guessed GTIN, guessed public SKU/MPN, claim of direct checkout on
jumvi.co, packaging claim that the box says 36 missions, or unsupported
superlatives ("best", "#1", "top-rated", "award-winning").

The printed retail box states **"30+ Missions"** (brand-owner confirmed, artwork
verification pending). The digital Mission Hub contains **36 Guided Missions**
(verified). Two separate surfaces; never normalised.

Enforced mechanically by `commerce/phase2b-validation.mjs`.
