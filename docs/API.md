# Return Rate — API contract (app ↔ Worker)

Base: the Worker (`return-rate`). All JSON. CORS open for GET. Errors: `{ "error": "<plain sentence>" }`.

`GET /health` → `{ ok: true, items: <count> }`

`GET /item/:upc` — `upc` is 8, 12 or 13 digits (UPC-E, UPC-A, EAN-13); anything else → 400 `{ error: "That doesn't look like a barcode number." }`.
- known → 200 `{ upc, accepted: true | false, verdict: "Yes, we take this" | "No, we don't take this", name, brand, size_ml, class: "regular" | "liquor" | "none" | "brewer", refund_cents: 5 | 10 | 0, depot_policy: false | true, material, why: "<one plain sentence from docs/RULES.md>", source, note: "The counter's count is the one that pays." }`
- unknown → 404 `{ accepted: null, verdict: "Ask at the counter", error: "We don't have this barcode on our list yet. Ask at the counter and they'll tell you.", upc, hint }` (after a free Open Food Facts lookup came up empty; a definite OFF answer is a 200 with `source: "openfoodfacts-live"` and is remembered)
- label-dependent (recognised product: milk, plant-based, nutrition) → 404 `{ accepted: null, verdict: "Ask at the counter", error: <what on the label decides it, from docs/RULES.md, then 'or ask at the counter'>, upc, name, hint }`
- every 200 answer also carries `nl_only: "Refund applies to containers bought in Newfoundland and Labrador."`
- too many → 429 `{ error: "Too many scans in a row, give it a minute." }`
Every lookup is logged to `lookups` (found or not) with a hashed IP; nothing personal is stored.

There is no photo or vision step (removed 2026-09-18 at Alexander's order: no AI, no per-call cost). The Worker answers from the list, the maker prefix and Open Food Facts only.
- vision unavailable → 503 with a plain sentence.

`GET /item/:upc` also answers from the maker prefix when the exact barcode is not in the list (`source: "maker"`, `name: null`, `why` names the maker).

`GET /stats` → `{ items, lookups_today, unknown_today, top_unknown: [{ upc, n }] }` (so Alexander can see which barcodes people scan that the list lacks).

Rules the Worker enforces: `class`, `refund_cents` and `why` come from `worker/src/rules.js` (docs/RULES.md) applied to the stored drink + material + size, never from the client or the data file; class `unknown` is never stored or returned as an answer (it is a 404); `brewer` means a local refillable beer bottle (incl. Quidi Vidi Iceberg blue): `refund_cents: 5`, `depot_policy: true`, `why` says APCO takes it at 5¢ and some depots don't.
