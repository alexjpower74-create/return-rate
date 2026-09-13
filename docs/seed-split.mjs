// Main's gate between the product list and the database (docs/RULES.md, "What a barcode can and cannot decide").
// node docs/seed-split.mjs data/products.json  →  data/seed-rows.json (auto-safe) + data/needs-counter.json
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2] || 'data/products.json';
const rows = JSON.parse(readFileSync(src, 'utf8'));
const LABEL_DEPENDENT = new Set(['milk', 'plant-milk', 'plant-drink-not-protein', 'infant-formula', 'meal-replacement', 'formulated-liquid-diet', 'protein-shake', 'flavoured-milk-beverage', 'electrolyte', 'coffee']);
const auto = [], counter = [];
for (const r of rows) {
  let why = null;
  if (LABEL_DEPENDENT.has(r.drink)) why = 'the label decides (milk, plant, nutrition, coffee-with-milk): confirm at the counter';
  else if (!r.material || r.material === 'unknown') why = 'container material not known';
  else if (!Number.isFinite(Number(r.size_ml))) why = 'size not known';
  else if (Number(r.size_ml) > 4000) why = 'near or over the 5 L line: confirm at the counter';
  else if (r.refillable) why = 'refillable: confirm at the counter';
  if (why) counter.push({ upc: r.upc, name: r.name, brand: r.brand, drink: r.drink, material: r.material, size_ml: r.size_ml, why });
  else auto.push({ ...r, auto: true });
}
writeFileSync('data/seed-rows.json', JSON.stringify(auto, null, 1) + '\n');
writeFileSync('data/needs-counter.json', JSON.stringify(counter, null, 1) + '\n');
console.log(`${rows.length} rows → ${auto.length} auto-safe, ${counter.length} need the counter`);
