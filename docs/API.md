# Return Rate — API contract (app ↔ Worker)

Base: the Worker (`return-rate`). All JSON. CORS open for GET. Errors: `{ "error": "<plain sentence>" }`.

`GET /health` → `{ ok: true, items: <count> }`

`GET /item/:upc` — `upc` is 8, 12 or 13 digits (UPC-E, UPC-A, EAN-13); anything else → 400 `{ error: "That doesn't look like a barcode number." }`.
- known → 200 `{ upc, name, brand, size_ml, class: "regular" | "liquor" | "none" | "brewer", refund_cents: 5 | 10 | 0, material, why: "<one plain sentence from docs/RULES.md>", source, note: "The counter's count is the one that pays." }`
- unknown → 404 `{ error: "We don't know this one yet. Show it at the counter and we'll add it.", upc }`
- too many → 429 `{ error: "Too many scans in a row, give it a minute." }`
Every lookup is logged to `lookups` (found or not) with a hashed IP; nothing personal is stored.

`POST /item/:upc` — `Authorization: Bearer <COUNTER_PIN>`; body `{ name, brand?, size_ml?, drink, material }` (the Worker classifies; staff never type a cents figure) → 200 the item as above (`source: "counter"`). Wrong PIN → 401. Bad class → 400.

`GET /stats` → `{ items, lookups_today, unknown_today, top_unknown: [{ upc, n }] }` (so the counter knows what to add next).

Rules the Worker enforces: `class`, `refund_cents` and `why` come from `worker/src/rules.js` (docs/RULES.md) applied to the stored drink + material + size, never from the client or the data file; class `unknown` is never stored or returned as an answer (it is a 404); `brewer` means a local refillable beer bottle: `refund_cents: 0`, `why` says to ask at the counter.
