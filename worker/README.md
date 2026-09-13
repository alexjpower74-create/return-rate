# Return Rate — Worker

Implements `docs/API.md`. The refund rules live in `src/rules.js` and follow `docs/RULES.md` line by line.

## Run locally
```
cd worker
npx wrangler d1 migrations apply return-rate --local
node seed.mjs tests/fixtures.json tests/seed.sql
npx wrangler d1 execute return-rate --local --file=tests/seed.sql
npx wrangler d1 execute return-rate --local --file=tests/seed-unclassifiable.sql
npx wrangler dev --port 5902 --var RATE_LIMIT_PER_HOUR:60   # the deployed limit is 600/hour/address (a depot WiFi is one address); 60 lets the guard test fire
```

## Test
```
node --test tests/rules.test.mjs      # pure rules, no wrangler
node --test tests/api.test.mjs        # against localhost:5902 (API= to point elsewhere)
```

## Seed the real list
```
node seed.mjs ../data/products.json seed.sql     # rows need upc, name, drink, material, size_ml; unknown rows are skipped
npx wrangler d1 execute return-rate --remote --file=seed.sql
```
Counter edits (`source = 'counter'`) are never overwritten by a re-seed.
