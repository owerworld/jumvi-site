# commerce/runtime/

Inputs the feed generator reads at build time. **Git-ignored and never
deployed.** Neither file exists yet; both are produced by work that is not done.

### `amazon-offer.json`
Written by the Amazon offer fetcher designed in `../amazon-offer-source.md`.

```json
{ "asin": "B0H16JPQCF", "marketplace_id": "ATVPDKIKX0DER", "currency": "USD",
  "price": null, "availability": "unknown", "fetched_at": null,
  "source": "sp-api:getPricing" }
```

### `openai-marketplace-setup.json`
Written **by hand** once OpenAI supplies the registered marketplace value during
feed onboarding. `verified_by_openai_onboarding` must only be set true by a human
who has that confirmation in writing.

```json
{ "marketplace_seller": null, "verified_by_openai_onboarding": false }
```

Never put credentials in this directory. The fetcher reads those from the
environment.
