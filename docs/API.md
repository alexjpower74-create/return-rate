# Return Rate — API contract (app ↔ Worker)

Base: the Worker (`return-rate`). All JSON. CORS open for GET. Errors: `{ "error": "<plain sentence>" }`.

`GET /health` → `{ ok: true, items: <count> }`

`GET /item/:upc` — `upc` is 8, 12 or 13 digits (UPC-E, UPC-A, EAN-13); anything else → 400 `{ error: "That doesn't look like a barcode number." }`.
- known → 200 `{ upc, accepted: true | false, verdict: "Yes, we take this" | "No, we don't take this", name, brand, size_ml, class: "regular" | "liquor" | "none" | "brewer", refund_cents: 5 | 10 | 0, depot_policy: false | true, material, why: "<one plain sentence from docs/RULES.md>", source, note: "The counter's count is the one that pays." }`
- unknown → 404 `{ accepted: null, verdict: "Check the label", error: "We don't have this one on our list yet. Look on the label for the words Return for Refund. If they're there and you bought it in Newfoundland and Labrador, we take it: 5¢, or 10¢ for wine and spirits in a glass or plastic bottle. If they're not there, there's no refund.", upc, hint }`
- label-dependent (recognised product: milk, plant-based, nutrition) → 404 `{ accepted: null, verdict: "Check the label", error: <the label test for that kind of product, from docs/RULES.md>, upc, name, hint }`
- every 200 answer also carries `nl_only: "Refund applies to containers bought in Newfoundland and Labrador."`
- too many → 429 `{ error: "Too many scans in a row, give it a minute." }`
Every lookup is logged to `lookups` (found or not) with a hashed IP; nothing personal is stored.

`POST /label` — multipart `photo` (image, ≤ 8 MB) and optional `upc`. A vision model reads the front label; the rules engine decides.
- readable and decided → 200, the same shape as a known item plus `source: "label"` and `evidence: ["the label says Return for Refund", …]`; `why` ends with "From the label: …".
- not readable / not decided → 404 `{ accepted: null, verdict: "Check the label", error: "We couldn't read enough of the label. <label test>", evidence, hint }`.
- vision unavailable → 503 with a plain sentence.

`GET /item/:upc` also answers from the maker prefix when the exact barcode is not in the list (`source: "maker"`, `name: null`, `why` names the maker); a 404 carries `label_photo: true` so the app offers the photo step.

`GET /stats` → `{ items, lookups_today, unknown_today, top_unknown: [{ upc, n }] }` (so Alexander can see which barcodes people scan that the list lacks).

Rules the Worker enforces: `class`, `refund_cents` and `why` come from `worker/src/rules.js` (docs/RULES.md) applied to the stored drink + material + size, never from the client or the data file; class `unknown` is never stored or returned as an answer (it is a 404); `brewer` means a local refillable beer bottle (incl. Quidi Vidi Iceberg blue): `refund_cents: 5`, `depot_policy: true`, `why` says APCO takes it at 5¢ and some depots don't.
