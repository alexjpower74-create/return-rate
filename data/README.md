# The product list

`products.json` is the seed list the Worker loads into D1. One row per barcode:

```
upc, name, brand, size_ml, drink, material, class, refund_cents, source, fetched
```

`class` and `refund_cents` are written by the rules engine in `worker/src/rules.js`
(the code version of `docs/RULES.md`). Nothing in this folder decides a refund on its own.
The Worker re-classifies from `drink`, `material` and `size_ml` when it answers, so the
stored class is a convenience for reading the file, never the source of truth.

## Where the rows come from

`build.mjs` asks Open Food Facts (a public, volunteer-built food database) for beverages
sold in Canada, category by category, one request per second, and caches every answer
under `cache/` so a rebuild costs nothing. A product is kept only when all of these are true:

- the barcode is 8, 12 or 13 digits;
- it has a name, a size in millilitres, and a category we can map to one drink type;
- its container material is stated and unambiguous;
- for ciders and coolers, the alcohol content is stated (Open Food Facts files sparkling
  apple juice under "ciders" too);
- it is not a beer in a glass bottle (the data does not say whether the bottle is a local
  brewer's refillable, and that changes the answer);
- the rules engine returns a definite class, never `unknown`.

Everything else is dropped and counted in the build summary. Unknown is an honest answer;
a wrong refund is not.

## Rebuilding

```
node data/build.mjs                       # fetch (cached), classify, write products.json
node data/build.mjs --offline             # cache only, no network
node data/build.mjs --rules ../c1/worker/src/rules.js   # point at another copy of the engine
```

## Adding a product at the counter (the everyday way)

You do not need this folder to add a product. When a customer scans something the app
doesn't know, the answer screen says "We don't know this one yet. Show it at the counter
and we'll add it." Then, at the counter:

1. Open the app and pick **Add a product** (staff only, it asks for the counter PIN).
2. Scan the barcode, or type the number under it.
3. Type the name as it reads on the label.
4. Pick what the drink is (pop, water, juice, beer, wine, spirits, milk, ...) and what the
   container is made of (can, plastic bottle, glass bottle, carton, pouch, bag-in-box).
   Enter the size in mL if it isn't obvious.
5. Save. The Worker works out the refund from the rules; you never type a cents figure.

The next customer to scan it gets the answer. Corrections work the same way: save the same
barcode again with the right details.

`GET /stats` on the Worker lists the barcodes customers scanned most that we didn't know,
so the counter knows what to add first.

## Adding many products at once

If you have a list, add rows to `products.json` with `drink`, `material` and `size_ml`
filled in and `source` set to `"counter"`, then re-seed the database (see the README at the
repo root). Leave `class` and `refund_cents` out; the seed step fills them from the rules.
If you don't know the drink type or the material, leave the product out.
