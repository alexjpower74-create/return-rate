# Build report — c1 · Worker: items, rules, counter edits

Branch `rig/c1`. Everything under `worker/**`. Wrangler 4.131, Node 26.

## Built — DONE
- `worker/src/rules.js`: pure `classify({drink, material, size_ml, refillable, alcohol_pct, label_flags}, env)` → `{class, refund_cents, why}` in the exact decision order of docs/RULES.md. Rates read from `RATE_REGULAR_CENTS` / `RATE_LIQUOR_CENTS` (defaults 5/10). Unknown class carries `refund_cents: null` so it can never be mistaken for 0¢.
- `worker/src/index.js`: `GET /health`, `GET /item/:upc`, `POST /item/:upc` (Bearer COUNTER_PIN), `GET /stats`, CORS open, plain-sentence errors. `class`/`refund_cents`/`why` are recomputed from the stored drink+material+size on every read; a stored row the rules cannot classify is a 404, never an answer. Rate guard 60/hour/IP on a salted SHA-256 of the IP. Every lookup logged.
- `worker/wrangler.toml` (`return-rate`, D1 `DB`, `database_id = "TODO-main-fills"`, rate vars), `worker/migrations/0001_items_lookups.sql` (`items` also stores `drink`, `material`, `refillable`, which the plan's column list omits but the API needs to re-classify; `class` is kept for stats), `worker/.dev.vars` (gitignored, PIN 1234), `worker/seed.mjs` (idempotent upsert SQL; skips unknown-class rows; never overwrites a counter edit), `worker/README.md`.
- Tests: `worker/tests/rules.test.mjs` (54 chart-and-trap cases + env-rate + wording sweep, 58 assertions, `node --test`, no wrangler) and `worker/tests/api.test.mjs` (15 tests against `wrangler dev --port 5902`: health, four known classes, unknown 404, unclassifiable-row 404, malformed 400, counter add then found with staff-sent cents ignored, correction, wrong/missing PIN 401, bad class 400, 61st lookup 429, stats, CORS). Fixtures are labelled SYNTHETIC.

## Verified, and how each check could have failed
| Check | Red if | Made red once? |
|---|---|---|
| rules: 54 cases | any class or cents differs from RULES.md | Yes: default regular rate set to 10 → 29 of 58 red (every 5¢ case). Restored, 58 green. Note: the commit message for 0df7412 says 37; the true count is 29. |
| api: pop can 5¢ | Worker returns a different figure | Yes: `RATE_REGULAR_CENTS = "10"` in wrangler.toml, dev restarted → that one test red, 14 green. Restored, 15 green. |
| api: unclassifiable row never answered | Worker trusts the stored `class` column | Planted a row with stored class `liquor` but material `unknown`; Worker answered 404. |
| api: rate guard | guard counts globally or not at all | Test uses a fresh fake IP per call; the 61st from one IP is 429 and another IP is still 200. |
| api: staff cannot set cents | Worker copies `refund_cents` from the body | POST sends `refund_cents: 99, class: "none"` for a glass cooler; response is liquor/10. |

## Left undone / for other slices
- `database_id` is `TODO-main-fills`; Main fills it, runs the migration remotely, sets `COUNTER_PIN` and optionally `IP_SALT` as secrets.
- **c3**: `data/products.json` rows need `drink` and `material` (the classifier's vocabulary in RULES.md) plus `upc, name, brand, size_ml, source`; `class` in the file is ignored, the seed recomputes it. Rows the rules call unknown are dropped at seed time with a printed list.
- The brief's task line was empty; I built the c1 task as written in PLAN.md. No files outside `worker/**` and this report were touched.
- Open question kept from RULES.md: tetra-pak wine answers 10¢ per the 2025 Guide.
