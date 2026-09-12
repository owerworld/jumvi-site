# Amazon offer source — design for ASIN B0H16JPQCF

Design only. **Not implemented. No credentials exist in this repository and none
will.** Scope: one ASIN, `B0H16JPQCF`, in Amazon US (`ATVPDKIKX0DER`).

Price is the one field that is both **required** by the OpenAI feed spec and
**must be current**. That combination is the blocker — a missing pipeline, not a
missing number.

Amazon documentation checked **2026-09-12**. Throughout, **OFFICIAL** marks what
Amazon documents; **OURS** marks our operational recommendation.

## Primary — SP-API Product Pricing API v0, `getPricing`

**OFFICIAL** — operation description:

> "Returns pricing information for a seller's offer listings based on seller SKU or ASIN."

That is exactly the semantic we need: *our own* offer, not a competitive or
featured offer, and it works from the ASIN we have already verified without
requiring a seller SKU.

| Parameter | Value | Notes |
|---|---|---|
| `MarketplaceId` | `ATVPDKIKX0DER` | **OFFICIAL** required. "Specifies the marketplace for which prices are returned" |
| `ItemType` | `Asin` | **OFFICIAL** required. Accepts `Asin` or `Sku` |
| `Asins` | `B0H16JPQCF` | **OFFICIAL** optional, up to 20 values |
| `ItemCondition` | `New` | **OFFICIAL** optional — New, Used, Collectible, Refurbished, Club |
| `OfferType` | *(omit)* | **OFFICIAL** optional, defaults to B2C, which is what we want |

**Endpoint** — North America region: `https://sellingpartnerapi-na.amazon.com`.

**Authorisation** — **OFFICIAL**: SP-API access requires a registered application
and a Login with Amazon (LWA) authorisation grant from the selling partner.
SAY23 LLC's own seller account is the selling partner, so self-authorisation is
sufficient; no third-party developer relationship is needed. The application
needs the **Pricing** role; the **Product Listing** role is additionally required
only for the enrichment route below. Role assignment is **unknown** in detail
from the pages checked and must be confirmed in Seller Central at registration
time.

**Response path** — the operation returns a `Price` payload per item containing
the seller's offer `ListingPrice` (amount plus currency code), alongside
`Shipping` and `Points` where applicable. The generator must read the amount and
the currency code together and must never assume USD from the marketplace alone
(see currency validation below).

**Rate limit** — **OFFICIAL**: "0.5 requests per second" with a burst of 1, with
the documented caveat that "Selling partners whose business demands require
higher throughput may see higher rate and burst values than those shown here."
Usage plans are dynamic.

**Refresh** — **OURS**: every **30–60 minutes**. One ASIN at hourly cadence uses
roughly 0.0006% of the documented 0.5 rps budget, so throttling is a non-issue
and there is ample headroom if the catalogue grows. Amazon documents **no**
required refresh frequency for feed synchronisation; this figure is ours.

**Max accepted staleness** — **OURS**: **60 minutes**. Past that the snapshot is
treated as *absent*, never as a fallback. OpenAI documents no staleness
threshold; it requires only that price be present and current.

## Optional enrichment — SP-API Listings Items, `getListingsItem`

`GET /listings/2021-08-01/items/{sellerId}/{sku}` with
`includedData=summaries,offers,fulfillmentAvailability`.

**Precondition: a VERIFIED seller SKU, which is not on file.** Until then this
route cannot be called at all — it is keyed by SKU, not ASIN. Requires the
**Product Listing** role. Documented at 5 requests/second, burst 10.

Value once unlocked: richer listing attributes and offer data in one call. It is
**not** required to unblock price, and adopting it is not a reason to delay.

## Optional real availability — SP-API FBA Inventory, `getInventorySummaries`

**OFFICIAL**: "Returns a list of inventory summaries. The summaries returned
depend on the presence or absence of the startDateTime, sellerSkus and sellerSku
parameters." Required parameters: `granularityType` (currently only
`Marketplace`), `granularityId`, and `marketplaceIds` (maximum 1). Optional:
`details`, `sellerSkus` (up to 50), `startDateTime`, `sellerSku`, `nextToken`.
Documented rate limit: 2 requests/second, burst 2.

This would replace `availability: "unknown"` with a verified `in_stock` /
`out_of_stock`. **Non-blocking** — OpenAI explicitly accepts `unknown`, and an
honest `unknown` beats an unverified stock claim. Note this route is also
SKU-oriented, so it benefits from the same seller-SKU verification as the
enrichment route.

## Rejected routes

| Route | Why |
|---|---|
| **PA-API 5.0** | **Deprecated.** Amazon: "The Amazon Product Advertising API 5.0 (PA-API 5) has been deprecated and is being replaced by the Creators API" ([source](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation), checked 2026-09-12). Separately, it is affiliate/publisher tooling returning general marketplace offers rather than our own seller offer — the wrong semantic relationship for stating our own price, even where the number coincides |
| **Creators API** | Affiliate-oriented successor to PA-API 5. **Must not** be the primary source for our own seller-price synchronisation, for the same relationship reason |
| Seller Central Reports (SP-API Reports) | Workable but higher latency and more moving parts than a direct `getPricing`. Keep as plan B only |
| Manual Seller Central export | Not automatable; guarantees staleness. Rejected |
| **Scraping the Amazon product page** | Against Amazon's terms, fragile, and produces data we cannot stand behind. Rejected outright |

## Runtime interface

Written by the (unimplemented) fetcher to `commerce/runtime/amazon-offer.json`:

```json
{
  "asin": "B0H16JPQCF",
  "marketplace_id": "ATVPDKIKX0DER",
  "currency": "USD",
  "price": null,
  "availability": "unknown",
  "fetched_at": null,
  "source": "sp-api:getPricing"
}
```

| Field | Contract |
|---|---|
| `asin` | Must equal `B0H16JPQCF` |
| `marketplace_id` | Must equal `ATVPDKIKX0DER` |
| `currency` | Must be `USD`; read from the response, never assumed |
| `price` | Numeric major units, strictly `> 0`. Rendered as `"<amount> USD"` for the feed |
| `availability` | One of `in_stock`, `out_of_stock`, `pre_order`, `backorder`, `unknown` |
| `fetched_at` | ISO 8601 UTC timestamp of the successful observation |
| `source` | An approved seller-owned source identifier |

Approved `source` values: `sp-api:getPricing`, `sp-api:getListingsItem`,
`sp-api:getInventorySummaries`. Anything else is rejected — that is what stops
an affiliate API or a scraper being wired in later.

## Failure behaviour — non-negotiable

1. **Price fetch fails → do not emit or update the row.** A missing row is
   correct; a row with a wrong price is not.
2. **Never reuse a stale price.** Past 60 minutes the snapshot is absent, not a
   fallback.
3. **Never substitute an estimated, cached, remembered or hand-typed price.**
4. **Validate currency and marketplace on every read.** A `getPricing` response
   in an unexpected currency or marketplace is a failure, not a conversion task.
5. **`availability` may remain `unknown`** and is never upgraded without a
   verified observation.
6. **Timestamp everything.** Every successful observation records `fetched_at`
   and `source`, so any published price traces to a specific API response at a
   specific time.
7. **Fail loudly.** A failed refresh is an alert, not a silent no-op — silence is
   how a stale price survives.

## Credential handling

Credentials live in the execution environment only — **never** in this
repository, in any generated file, or in any committed example. No LWA client
secret, no refresh token, no AWS credentials. The future fetcher reads
`SPAPI_CLIENT_ID`, `SPAPI_CLIENT_SECRET`, `SPAPI_REFRESH_TOKEN` and
`SPAPI_SELLER_ID` from the environment and fails closed if any is absent.
`commerce/phase2b-validation.mjs` fails the build if a credential-shaped string
appears anywhere in `commerce/`.
