# Build report — c3 · Product list and rules evals

Branch `rig/c3`. Owns `data/**`, `evals/**`. 2026-09-13.

## What I built

- **`data/build.mjs`** — pulls beverages from Open Food Facts (one request a second, `User-Agent: ReturnRate/0.1 (apcosoftwaretools.ca)`, retries on 429/5xx with backoff, every response cached under `data/cache/`, which is gitignored). Two passes: 47 Canada-tagged categories (pop, water, juice, energy, sports, tea, coffee, kombucha, beer, cider, coolers, wine, spirits, milk, plant milks, formula, meal replacements, juice concentrates), then wine, spirits, cider, cooler and sake world-wide, because liquor barcodes are global and Canada-tagged liquor with packaging data is thin. Maps category → `drink`, packaging → `material`, quantity → `size_ml`, and calls **c1's `worker/src/rules.js` read-only** (`--rules <path>`; default `../worker/src/rules.js`; exits 3 if it cannot load, it never classifies on its own). Writes `data/products.json`. DONE.
- **`data/products.json`** — 1034 rows: 480 regular (5¢), 484 liquor (10¢), 70 none. By drink: spirits 309, wine 142, pop 122, juice 109, energy 94, cider 49, water 45, milk 38, tea 29, sparkling water 28, plant milk 28, beer 17, kombucha 7, vegetable juice 7, coolers 3, meal replacement 3, coffee 2, distilled water 1, sports 1. 534 rows carry North American (0-prefixed) barcodes. Every row has `upc, name, brand, size_ml, drink, material, refillable, class, refund_cents, source: "openfoodfacts", fetched`. c1's `worker/seed.mjs` accepts it: 1034 items, 0 skipped. DONE.
- **`data/README.md`** — what the list is, how it is built, and how the counter adds products by scanning (the everyday way, no files). DONE.
- **`evals/labels.json`** — 44 cases: 40 real barcodes Alexander can check on Sobeys/Dominion/NLC shelves (33 regular, 3 liquor, 4 none) plus 4 SYNTHETIC EAN-13s in the 200 internal-use range that must come back 404. Each real case carries `drink`, `material` and a one-line `why_expected`. DONE.
- **`evals/run.mjs --api <url>`** — asks `GET /item/:upc` for each case, prints expected vs got with cents, exit 1 on any wrong class or wrong cents (or unreachable Worker), exit 2 on an empty set. DONE.
- **`evals/mock-api.mjs`** — a stand-in that serves `products.json` per `docs/API.md`, so the runner can be exercised without wrangler. It is not the Worker (no lookups log, no rate limit, no POST). Used for the negative controls below. DONE.

## What is dropped, and why (this is the honesty rule in practice)

Out of 2652 distinct raw products, the build kept 1034. Drop counts from the final run:

| reason | rows |
|---|---|
| container material not stated or ambiguous | 1857 |
| no size in mL | 1123 |
| multipack or case (`6 x 355 ml`, `24 pack`, more than one bottle/can in the packaging list) | 92 |
| syrup, sweetener, dry tea, powder: not a ready-to-drink sealed beverage | 78 |
| no name | 44 |
| categories disagree on the drink (e.g. tagged both milk and coffee, or plant milk and juice) | 33 |
| cider or cooler without a stated alcohol content (OFF files sweet apple cider and mixers under "ciders") | 29 |
| can over 1 L (a case, not a container) | 25 |
| alcohol-free wine/spirits/cider (the refund would be the non-alcoholic one, which the data cannot confirm) | 24 |
| beer in glass (the data cannot say whether it is a local brewer's refillable) | 15 |
| over 5 L and not a water jug (a case) | 11 |
| category not mapped | 6 |
| barcode not 8/12/13 digits | 3 |
| wine in "plastic" over 1.5 L (almost certainly bag-in-box, which pays 5¢ not 10¢) | 0 in final run (rule kept) |

Things I caught by reading the output rather than trusting the counts, each now a rule in `build.mjs`:
- Open Food Facts puts `en:plant-based-beverages` above **pop and lemonade** in its taxonomy. Fanta was coming out as "plant milk, no refund". That tag is no longer used; only the explicit plant-milk categories are.
- PC "Alcohol-Free Sauvignon Blanc" was classified 10¢ wine. Now dropped by name/label.
- PC "Fresh-Pressed Sweet Apple Cider" 3 L is tagged alcoholic on OFF and came out 10¢. Ciders and coolers now need a stated alcohol content.
- PC "Distilled Water" 4 L is tagged plain water on OFF and came out 5¢. Name says distilled → `distilled-water` → no refund.
- Coca-Cola 32-pack (11.36 L) came out "over 5 litres, no refund"; Moosehead 8-pack came out as a 2.8 L can. Multipack rules.
- Maple syrup and pancake syrup were "concentrates, no refund". Correct in fact, but not a drink; dropped.
- Crown Royal was dropped as a multipack because its packaging list has two paper *labels*. Unit counting now only looks at bottle/can/carton shapes.

## Verification, and what would have made each check red

1. **Build produces a definite class for every row.** Red if any row had `class: unknown` or a duplicate `upc`. Checked with a script over `products.json`: 1034 unique, none unknown. Red once: before the `plant-based-beverages` fix, Fanta/Calypso rows were wrong (seen in output, fixed).
2. **c1's seed accepts the file.** `node ../c1/worker/seed.mjs data/products.json data/cache/seed.sql` → 1034 items, 0 skipped. Red would be any skipped row (missing drink/material or unknown class).
3. **Eval runner green against the mock:** `44/44 right`, exit 0 (`evals/last-run.txt`).
4. **Negative control A, flipped label:** set Coca-Cola's expected to `liquor` in a temp copy → `X 06782900 liquor regular 5`, `43/44 right, 1 WRONG`, exit 1. Restored (the temp copy was deleted; `labels.json` untouched).
5. **Negative control B, a Worker that "knows" a synthetic barcode:** served a copy of the list with `2000000000015` added → `X 2000000000015 unknown regular 5`, exit 1. My first attempt at this control used a barcode with a wrong check digit and stayed green, which is exactly why the control exists; redone with the right one.
6. **Empty set** → "No cases", exit 2. **No Worker on the port** → 0/44, exit 1.
7. Nothing here was graded against the shared tree or a live Worker; see below.

## Not done / needs another slice

- **Run against the real Worker.** I did not run wrangler (no `node_modules` in c1's tree, and it is not my slice). Main (or QA) should run `node evals/run.mjs --api http://127.0.0.1:5902` after seeding, and again against the deployed URL. The 4 SYNTHETIC cases double as the "unknown is 404" check.
- **UPC-E barcodes (ask for c1/c2).** 8-digit codes in the list (`06782900` Coke, `06224017` Canada Dry, `06541539` 7 Up, `07478341` Perrier, `05490733` Dr Pepper) are Open Food Facts' UPC-E form. Phone scanners (BarcodeDetector, ZXing) usually return UPC-E as those same 8 digits, but some return the expanded 12-digit UPC-A (`06782900` → `067829000005`). If the app or Worker normalises, it should try both forms before answering 404. Not my files; flagging.
- **World-wide liquor pass** brings in French supermarket wine and cider (Carrefour, Marque Repère, U). Classified correctly per RULES (glass cider 10¢, glass wine 10¢) but unlikely on NL shelves. Harmless in D1; say if you want `WORLD_CATEGORIES` trimmed to a Canada+NLC-realistic set.
- **Sake: 0, sports drinks: 1, coffee: 2, coolers: 3.** OFF's Canadian coverage with packaging data is thin there. Gatorade/Powerade/Bacardi Breezer etc. will come in through the counter's "add a product" flow; `GET /stats` lists what to add first.
- **Rule question for RULES.md (not a fork, just an observation):** de-alcoholized beer (Compliments 0.5%, in the list as `beer` → 5¢) is right either way since beer and pop are both 5¢. Alcohol-free wine is dropped rather than mapped to 5¢ because RULES.md has no line for it; if the depot pays 5¢ on it as a soft drink, add that line and I'll map it.
- `data/cache/` is gitignored (about 130 JSON files, ~40 MB); a rebuild re-fetches at one request a second (about 20 minutes with OFF's current 503 rate). Pass `--offline` when the cache is present.

## Cross-review asked for

c1: does `worker/seed.mjs` want `refillable` as boolean `false` (what I write) or absent? It handles both today.
c4: `evals/run.mjs` exit codes (0/1/2) and the `--api` flag are stable; `tests/live-roundtrip.mjs` can call it.
