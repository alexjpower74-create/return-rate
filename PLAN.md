# Return Rate — build contract

One plan file. It is the contract, at the repo root, and every agent reads the same copy.

## The brief (Alexander, 2026-09-13)
**Return Rate: point your phone at a container's barcode and find out whether the Green Depot takes it.** The headline is ACCEPTED / NOT ACCEPTED / ASK AT THE COUNTER; the refund (5¢ or 10¢) is the second line, smaller. One item, one answer, from the MMSB rules, no guessing at bags. Built for customers of APCO Recycling (Grand Falls-Windsor, NL), reached through the QR sheet already on the depot counter; a portfolio showpiece (browser barcode scanning, a rules engine with tests, a crowd-built product list that never invents a refund).

**The rules live in `docs/RULES.md`** (researched from the regulation, the MMSB Distributor Guide chart and the MMSB/NLC FAQs; every line cited). Read it before writing a line of code. The short version: the refund depends on the drink AND the container. 10¢ only for wine and spirits (incl. coolers, ciders, sake) in GLASS or PET bottles over 50 mL; every other refundable container is 5¢ (all cans including canned wine and cocktails, all beer, pouches, bag-in-box, tetra and carton wine, all non-alcoholic drinks up to 5 L). The headline the customer sees is ACCEPTED / NOT ACCEPTED / ASK; cents come second. Not refundable: milk, fortified plant milks (unless labelled 'not a source of protein'), infant formula, meal replacements and formulated liquid diets, concentrates, distilled water, over 5 L, out-of-province purchases, and local brewers' REFILLABLE beer bottles and Quidi Vidi Iceberg blue bottles are outside MMSB, but APCO takes them at 5¢ (depot policy; the app says some depots don't). Caps off, labels on, don't crush. The app shows the REFUND, never the deposit.

**The honesty rule.** The app only states a refund when it knows what the item is (from the product list or a category the customer confirmed). Unknown barcode → "We don't know this one yet. Show it at the counter and we'll add it." with the counter's count always the one that pays. Never a made-up class.

**Design.** White ground, ink `#101418`, one accent: depot green `#1f7a3a`; muted `#5b6670`; rule `#d9dee3`. System fonts. Phone-first at 390. The refund ("5¢" / "10¢" / "No refund") is the biggest thing on the answer screen. No emoji icons. Plain English.

**Stack.** Static app in `app/` (plain HTML/JS/CSS, no build). Scanning: the browser `BarcodeDetector` API when present (Chrome/Android), else `@zxing/library` UMD from cdnjs (pinned version) over `getUserMedia`; a "Type the number" fallback always visible. Worker + D1 in `worker/`: `GET /item/:upc` (known → class, refund cents, name, material, the one-sentence why, source; unknown or needs-counter → 404 with the honest message and, for needs-counter, the product name so the customer sees we recognised it), `POST /item/:upc` (counter staff add or correct an item: name, class; PIN-gated), `GET /stats`. Seed data: c3 builds `data/products.json` from Open Food Facts (public, no key: `https://world.openfoodfacts.org/api/v2/product/<upc>.json` and category search) for the ~300 most common Canadian beverages, mapped to classes by category rules, each row carrying its `source`; anything ambiguous is left OUT (better unknown than wrong). Contract `docs/API.md`. Ports: c1 `wrangler dev --port 5902`; c2 static 5901; c3 talks to 5902; QA 5909. Main creates D1, seeds, deploys, sets the counter PIN.

## Rules
- You own the files under your id and nothing else; `rig guard` enforces it. Commit only your own paths. Verify → commit → report (`docs/build-report-<id>.md`).
- Never grade the shared tree. No visible Chrome; `pwshot` for screenshots into your own slice's `shots/` folder. Chromium + WebKit.
- A check that cannot fail measured nothing: say what would make it red, make it red once, record it.
- No invented refunds. Test barcodes are labelled SYNTHETIC. The refund line is never called a payout or a guarantee; "the counter's count is the one that pays" appears on every answer screen.

## Agents

### c1 — Worker: items, rules, counter edits
Owns:
- worker/**

Report: docs/build-report-c1.md

Task: implement `docs/API.md` in `worker/src/index.js`; `worker/wrangler.toml` name `return-rate`, D1 binding `DB` (`database_name return-rate`, `database_id = "TODO-main-fills"`), vars `RATE_REGULAR_CENTS=5`, `RATE_LIQUOR_CENTS=10`; migrations for `items(upc PK, name, brand, size_ml, class, source, added, edited_by)` and `lookups(id, upc, found, created, ip_hash)`. `worker/src/rules.js` is the pure rules engine exactly as `docs/RULES.md` specifies (`classify({drink, material, size_ml, refillable, alcohol_pct, label_flags})` → `{class: regular|liquor|none|brewer|unknown, refund_cents, why}`), unit-tested with `node --test` (no wrangler) on 40+ cases, one per row of the RULES chart plus the traps: 750 mL pop 5¢; 200 mL vodka glass 10¢; 50 mL rum miniature 5¢; wine in a can 5¢; canned cocktail 5¢; glass cooler 10¢; cider in glass 10¢; bag-in-box wine 5¢; tetra wine 10¢; juice box 5¢; oat milk none; oat drink labelled not-a-source-of-protein 5¢; Ensure none; frozen juice concentrate none; distilled water none; 6 L water jug none; refillable Molson bottle brewer (5¢ at APCO, depot_policy true, wording says some depots don't); Quidi Vidi Iceberg blue bottle brewer; Twisted Tea in glass 10¢; White Claw can 5¢; non-alcoholic beer in glass 5¢; Milk2Go protein shake 5¢; Nesquik flavoured milk beverage 5¢; chocolate milk labelled Milk none; Pedialyte 5¢; imported beer bottle 5¢; domestic beer can 5¢; wine with unknown material unknown; unknown drink unknown. Refund cents computed in the Worker from the class. Rate guard 60 lookups/hour/IP. `POST /item/:upc` needs `Authorization: Bearer <COUNTER_PIN>` (secret; `.dev.vars` for local). Seed loader: `worker/seed.mjs` reads `data/products.json` and writes the D1 insert SQL (idempotent). Tests `worker/tests/api.test.mjs` against `wrangler dev --port 5902`: health, known item, unknown 404 with the honest message, counter add then found, wrong PIN 401, malformed UPC 400, rate guard 429, stats. Negative control: swap the rates (regular 10) and show the cents test go red; restore.

### c2 — Customer app
Owns:
- app/**

Report: docs/build-report-c2.md

Task: `app/index.html` + `app.js` + `styles.css` + `scan.js` + `api.js` + `api.mock.js` (`?mock=1`, seeded with three SYNTHETIC barcodes: a 5¢ item, a 10¢ item, an unknown). Screens: Start ("Point the camera at the barcode" with the live camera view, a "Type the number" field always visible, the never-invent sentence "If we don't know an item, we say so."); Answer (the biggest thing is the verdict: "Yes, we take this" in depot green, "No, we don't take this" in ink, or "Ask at the counter" in amber; then the refund line "5¢" / "10¢" / "No refund" smaller; then the product name and size, then the class in words ("Pop, water, juice or beer" / "Wine or spirits" / "Milk and plant milks have no refund"), then the fixed line "The counter's count is the one that pays.", then "Scan another"); Unknown ("We don't know this one yet. Show it at the counter and we'll add it." + "Scan another"); Camera-refused (the typed fallback, no dead end); Offline. Scanning: `BarcodeDetector` if available else ZXing UMD from cdnjs, decoding EAN-13/UPC-A/UPC-E; debounce so one scan fires once. Playwright `app/tests/` (chromium + webkit, 390x844) against the mock with REAL input: type each SYNTHETIC number, see the right screen, the verdict text is the largest font on the page (compare computed font sizes) and the cents line is smaller than it, the money line is on every answer, hit-test every button, the camera-refused path (deny permission via context options). Negative control: remove the money line in the mock render and show the test go red; restore. Screenshots to `app/tests/shots/`.

### c3 — Product list and rules evals
Owns:
- data/**
- evals/**

Report: docs/build-report-c3.md

Task: `data/build.mjs` pulls candidate beverages from Open Food Facts (be polite: 1 request/second, cache raw JSON under `data/cache/`, User-Agent "ReturnRate/0.1 (apcosoftwaretools.ca)"), keeps only rows with a barcode, a name, a category and a size, maps each product to the classifier's inputs (drink, material from packaging fields, size) and calls c1's `worker/src/rules.js` read-only (if a rule looks wrong, say so in your report, don't fork it; `docs/RULES.md` is the authority), drops `unknown`, writes `data/products.json` (`upc, name, brand, size_ml, class, source: "openfoodfacts", fetched`). Target 300+ rows covering pop, water, juice, energy, beer, coolers, wine, spirits. **Obey RULES.md 'What a barcode can and cannot decide'**: dairy, plant-based, nutrition/supplement, infant, electrolyte, soup and anything with unknown material or size are NOT auto-classified; write them to `data/needs-counter.json` (upc, name, why) so the counter can confirm them, and the Worker answers 'ask at the counter' for them. Every auto row carries `auto: true`; a counter-confirmed row later outranks it. `evals/labels.json`: 40 barcodes Alexander can check on real shelves, with the expected class; `evals/run.mjs --api <url>` asks the Worker for each and prints expected vs got, exit 1 on any wrong class, exit 2 if the set is empty. Negative control: flip one expected label and show the run go red; restore. `data/README.md` tells Alexander how to add depot products by scanning at the counter.

### c4 — QA harness, whole-suite runner, live round-trip
Owns:
- app/tests/qa/**
- playwright.config.js
- package.json
- docs/QA.md
- tests/live-roundtrip.mjs

Report: docs/build-report-c4.md

Task: root `package.json` + `playwright.config.js` running every spec in the repo on chromium + webkit at 390x844 and 1280x800, static server on 5909; `app/tests/qa/journey.spec.js`: the whole flow with real input (type a number → answer → scan another → unknown → camera refused), hit-tested; `app/tests/qa/plain-english.spec.js`: banned developer words on every screen, AND the money words "guaranteed", "you will get", "payout" must NOT appear, AND "the counter's count is the one that pays" MUST appear on every answer; `tests/live-roundtrip.mjs` against the real Worker (`API=`): health, a seeded UPC returns the right class and cents, an unknown UPC is 404 with the honest sentence, malformed UPC 400, stats. Negative control: plant "You will get 10¢" on a throwaway page and show the sweep go red; restore. `docs/QA.md`.

## Main (Onyx, not a slice)
Owns PLAN.md, docs/API.md. Creates D1 `return-rate`, fills ids, sets `COUNTER_PIN`, seeds from `data/products.json`, deploys Worker + app (static-assets Worker `return-rate-app`), runs c3's evals and c4's round-trip against the real thing, adds the QR to the depot sheet, writes the README.
