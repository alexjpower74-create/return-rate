# Return Rate — Worker

Implements `docs/API.md`. The refund rules live in `src/rules.js` and follow `docs/RULES.md` line by line.

## Run locally
```
cd worker
npx wrangler d1 migrations apply return-rate --local
node seed.mjs tests/fixtures.json tests/seed.sql
npx wrangler d1 execute return-rate --local --file=tests/seed.sql
npx wrangler d1 execute return-rate --local --file=tests/seed-unclassifiable.sql
npx wrangler dev --port 5902          # reads COUNTER_PIN from .dev.vars (1234 locally)
```

## Test
```
node --test tests/rules.test.mjs      # pure rules, no wrangler
node --test tests/api.test.mjs        # against localhost:5902 (API= to point elsewhere, COUNTER_PIN= for the pin)
```

## Seed the real list
```
node seed.mjs ../data/products.json seed.sql     # rows need upc, name, drink, material, size_ml; unknown rows are skipped
npx wrangler d1 execute return-rate --remote --file=seed.sql
```
Counter edits (`source = 'counter'`) are never overwritten by a re-seed.
