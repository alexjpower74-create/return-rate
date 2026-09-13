#!/usr/bin/env node
// Return Rate — build data/products.json from Open Food Facts.
//
//   node data/build.mjs            fetch (cached) + classify + write products.json
//   node data/build.mjs --fetch    fetch only (fills data/cache/)
//   node data/build.mjs --offline  never hit the network; use the cache as-is
//   node data/build.mjs --rules p  path to rules.js (default ../worker/src/rules.js)
//
// Honesty rule: a product is written ONLY when its drink, container and size are
// known well enough that docs/RULES.md gives one answer. Everything ambiguous is
// dropped, and the reason is counted in the summary. Better unknown than wrong.
//
// The classifier is c1's worker/src/rules.js, imported read-only. Nothing in this
// file decides a refund.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, 'cache');
const OUT = path.join(HERE, 'products.json');
const UA = 'ReturnRate/0.1 (apcosoftwaretools.ca)';
const BASE = 'https://world.openfoodfacts.org/api/v2';
const FIELDS = 'code,product_name,product_name_en,product_name_fr,brands,quantity,product_quantity,product_quantity_unit,categories_tags,packaging_tags,packaging_materials_tags,packaging_shapes_tags,packagings,unique_scans_n,labels_tags,alcohol_100g,nutriments,countries_tags';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const RULES_PATH = args.includes('--rules') ? path.resolve(opt('--rules')) : path.resolve(HERE, '../worker/src/rules.js');
const PAGES = Number(opt('--pages', 3));

// Open Food Facts category → the classifier's `drink` (docs/RULES.md).
// Order matters: the first entry whose tag the product carries wins, so the
// exclusions (milk, formula, meal replacement, concentrate) sit above the
// broad drink categories that OFF also tags them with.
const CATEGORY_TO_DRINK = [
  ['en:infant-formulas', 'infant-formula'],
  ['en:baby-milks', 'infant-formula'],
  ['en:meal-replacements', 'meal-replacement'],
  ['en:meal-replacement-drinks', 'meal-replacement'],
  ['en:frozen-juice-concentrates', 'concentrate'],
  ['en:juice-concentrates', 'concentrate'],
  ['en:concentrated-fruit-juices', 'concentrate'],
  ['en:squashes', 'concentrate'],
  ['en:distilled-waters', 'distilled-water'],
  ['en:milks', 'milk'],
  ['en:flavoured-milks', 'milk'],
  ['en:chocolate-milks', 'milk'],
  ['en:dairy-drinks', 'milk'],
  ['en:plant-based-milks', 'plant-milk'],
  ['en:plant-based-milk-alternatives', 'plant-milk'],
  ['en:oat-milks', 'plant-milk'],
  ['en:almond-milks', 'plant-milk'],
  ['en:soy-milks', 'plant-milk'],
  ['en:soy-drinks', 'plant-milk'],
  ['en:kombuchas', 'kombucha'],
  ['en:spirits', 'spirits'],
  ['en:eaux-de-vie', 'spirits'],
  ['en:vodkas', 'spirits'],
  ['en:whiskies', 'spirits'],
  ['en:rums', 'spirits'],
  ['en:gins', 'spirits'],
  ['en:liqueurs', 'spirits'],
  ['en:sakes', 'sake'],
  ['en:ciders', 'cider'],
  ['en:hard-ciders', 'cider'],
  ['en:coolers', 'cooler'],
  ['en:hard-seltzers', 'cooler'],
  ['en:premixed-alcoholic-beverages', 'cooler'],
  ['en:ready-to-drink-cocktails', 'cooler'],
  ['en:alcoholic-cocktails', 'cooler'],
  ['en:wines', 'wine'],
  ['en:sparkling-wines', 'wine'],
  ['en:beers', 'beer'],
  ['en:energy-drinks', 'energy'],
  ['en:sports-drinks', 'sports'],
  ['en:isotonic-drinks', 'sports'],
  ['en:iced-teas', 'tea'],
  ['en:tea-based-beverages', 'tea'],
  ['en:ready-to-drink-teas', 'tea'],
  ['en:iced-coffees', 'coffee'],
  ['en:coffee-drinks', 'coffee'],
  ['en:ready-to-drink-coffees', 'coffee'],
  ['en:vegetable-juices', 'vegetable-juice'],
  ['en:tomato-juices', 'vegetable-juice'],
  ['en:fruit-juices', 'juice'],
  ['en:fruit-based-beverages', 'juice'],
  ['en:juices-and-nectars', 'juice'],
  ['en:nectars', 'juice'],
  ['en:fruit-drinks', 'juice'],
  ['en:lemonades', 'juice'],
  ['en:sparkling-waters', 'sparkling-water'],
  ['en:carbonated-waters', 'sparkling-water'],
  ['en:flavored-waters', 'water'],
  ['en:flavoured-waters', 'water'],
  ['en:mineral-waters', 'water'],
  ['en:spring-waters', 'water'],
  ['en:waters', 'water'],
  ['en:sodas', 'soft-drink'],
  ['en:colas', 'soft-drink'],
  ['en:tonics', 'soft-drink'],
  ['en:carbonated-drinks', 'soft-drink'],
  ['en:soft-drinks', 'soft-drink'],
];

// What we ask Open Food Facts for. Canada-tagged products, sorted by scans so
// the common shelf items come first. Every category above is covered, plus the
// exclusions so the list can say "no refund" for milk and formula.
const SEARCH_CATEGORIES = [
  'sodas', 'colas', 'carbonated-drinks', 'soft-drinks',
  'waters', 'sparkling-waters', 'flavoured-waters', 'spring-waters', 'mineral-waters', 'distilled-waters',
  'fruit-juices', 'juices-and-nectars', 'fruit-drinks', 'lemonades', 'vegetable-juices', 'tomato-juices',
  'energy-drinks', 'sports-drinks', 'iced-teas', 'tea-based-beverages', 'iced-coffees', 'coffee-drinks', 'kombuchas',
  'beers', 'ciders', 'coolers', 'hard-seltzers', 'premixed-alcoholic-beverages', 'wines', 'sparkling-wines',
  'spirits', 'vodkas', 'whiskies', 'rums', 'gins', 'liqueurs',
  'milks', 'flavoured-milks', 'chocolate-milks', 'plant-based-milks', 'oat-milks', 'almond-milks', 'soy-milks',
  'infant-formulas', 'baby-milks', 'meal-replacements', 'meal-replacement-drinks',
  'frozen-juice-concentrates', 'juice-concentrates',
];

// Tagged with any of these, the product is not a ready-to-serve drink in a sealed
// container (syrups, sweeteners, dry tea, powders), or the data cannot tell us
// which drink it is. Dropped before classifying.
const REJECT_TAGS = new Set([
  'en:maple-syrups', 'en:simple-syrups', 'en:flavoured-syrups', 'en:agave-syrups', 'en:sweeteners',
  'en:molasses', 'en:honeys', 'en:dietary-supplements', 'en:beverage-preparations', 'en:powdered-drinks',
  'en:hot-beverages', 'en:teas', 'en:coffees', 'en:evaporated-milks', 'en:condensed-milks', 'en:milk-powders',
  'en:cooking-wines', 'en:vinegars',
]);
// Words that mean an alcohol-free version of an alcoholic drink; the refund is then the
// non-alcoholic one, which the data cannot confirm, so these are dropped.
const NO_ALCOHOL_RE = /alcohol[- ]?free|non[- ]?alcohol|sans alcool|d[ée]salcoolis|dealcohol|\b0[.,]0\s*%/i;

// Second pass for the liquor shelf: wine and spirits carry the same barcode world-wide
// and Open Food Facts has few Canada-tagged entries with packaging, so these categories
// are also searched without the country filter.
const WORLD_CATEGORIES = ['wines', 'sparkling-wines', 'spirits', 'vodkas', 'whiskies', 'rums', 'gins', 'liqueurs', 'ciders', 'hard-seltzers', 'coolers', 'sakes'];

// Open Food Facts packaging → the classifier's `material`.
const MATERIAL_MAP = [
  [/aluminium|aluminum/, 'aluminum'],
  [/\bsteel\b|tin-plate|tinplate/, 'steel'],
  [/tetra|brick|aseptic|carton/, 'tetra'],
  [/gable/, 'gable'],
  [/pouch|sachet/, 'pouch'],
  [/bag-in-box|bag-in-a-box/, 'bag-in-box'],
  [/\bglass\b/, 'glass'],
  [/\bpet\b|pet-1|pete|polyethylene-terephthalate|clear-plastic/, 'clear-plastic'],
  [/hdpe|pe-hd|pp-5|polypropylene|ldpe|pvc|plastic/, 'other-plastic'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;
async function politeFetch(url, attempt = 0) {
  const wait = lastRequest + 1000 - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  let res;
  try { res = await fetch(url, { headers: { 'User-Agent': UA } }); }
  catch (e) { if (attempt < 5) { await sleep(5000 * (attempt + 1)); return politeFetch(url, attempt + 1); } throw e; }
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    process.stderr.write(`  ${res.status}, backing off\n`);
    await sleep(10000 * (attempt + 1));
    return politeFetch(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function cached(name, url) {
  const file = path.join(CACHE, name);
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  if (flag('--offline')) return null;
  const json = await politeFetch(url);
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, JSON.stringify(json));
  return json;
}

async function fetchAll() {
  const products = new Map();
  for (const cat of SEARCH_CATEGORIES) {
    for (let page = 1; page <= PAGES; page++) {
      const url = `${BASE}/search?categories_tags_en=${cat}&countries_tags_en=canada&fields=${FIELDS}&sort_by=unique_scans_n&page_size=100&page=${page}`;
      const json = await cached(`search-${cat}-p${page}.json`, url);
      if (!json) break;
      for (const p of json.products || []) if (p.code) products.set(p.code, p);
      process.stderr.write(`  ${cat} p${page}: ${json.products?.length ?? 0} (total distinct ${products.size})\n`);
      if (!json.products?.length || json.page_count <= page) break;
    }
  }
  for (const cat of WORLD_CATEGORIES) {
    for (let page = 1; page <= 2; page++) {
      const url = `${BASE}/search?categories_tags_en=${cat}&fields=${FIELDS}&sort_by=unique_scans_n&page_size=100&page=${page}`;
      const json = await cached(`world-${cat}-p${page}.json`, url);
      if (!json) break;
      for (const p of json.products || []) if (p.code && !products.has(p.code)) products.set(p.code, p);
      process.stderr.write(`  world ${cat} p${page}: ${json.products?.length ?? 0} (total distinct ${products.size})\n`);
      if (!json.products?.length || json.page_count <= page) break;
    }
  }
  return [...products.values()];
}

// --- mapping ---------------------------------------------------------------

function parseSize(p) {
  let v = Number(p.product_quantity), u = String(p.product_quantity_unit || '').toLowerCase();
  if (!(v > 0)) {
    const m = String(p.quantity || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(ml|mL|l|L|cl|cL|fl\.? ?oz|oz)\b/i);
    if (!m) return null;
    v = Number(m[1]); u = m[2].toLowerCase();
  }
  if (!(v > 0)) return null;
  if (u === 'ml') return Math.round(v);
  if (u === 'l') return Math.round(v * 1000);
  if (u === 'cl') return Math.round(v * 10);
  if (/oz/.test(u)) return Math.round(v * 29.5735);
  return null; // grams and unknown units: we don't guess a volume
}

const LIQUOR = new Set(['wine', 'spirits', 'sake', 'cider', 'cooler']);
const REGULAR_GROUP = new Set(['soft-drink', 'water', 'sparkling-water', 'juice', 'vegetable-juice', 'sports', 'energy', 'tea', 'coffee', 'kombucha']);
const group = (d) => (REGULAR_GROUP.has(d) ? 'regular' : LIQUOR.has(d) ? 'liquor' : d);

// First matching category wins; but if the product also carries a category from a
// different refund group (milk AND coffee, plant milk AND juice) the data is
// contradicting itself and the product is ambiguous.
function mapDrink(p) {
  const tags = new Set(p.categories_tags || []);
  let drink = null; const groups = new Set();
  for (const [tag, d] of CATEGORY_TO_DRINK) if (tags.has(tag)) { drink ??= d; groups.add(group(d)); }
  // Open Food Facts rarely tags distilled water as such; the name says it.
  if (drink === 'water' && /distill/i.test(bestName(p))) drink = 'distilled-water';
  return { drink, ambiguous: groups.size > 1 };
}

function mapMaterial(p) {
  const hay = [
    ...(p.packaging_materials_tags || []),
    ...(p.packagings || []).filter((k) => k.food_contact !== 0).map((k) => `${k.material || ''} ${k.shape || ''}`),
    ...(p.packaging_tags || []),
  ].join(' ').toLowerCase();
  const shapes = (p.packaging_shapes_tags || []).join(' ');
  const found = new Set();
  for (const [re, mat] of MATERIAL_MAP) if (re.test(hay)) found.add(mat);
  // A drink can whose metal is unspecified is an aluminum-or-steel can: both are 5¢
  // for every drink, and the classifier treats them alike, so "aluminum" is safe.
  if (!found.size && /drink-can|\bcan\b|canette/.test(hay + ' ' + shapes) && !/glass|plastic|pet\b/.test(hay)) found.add('aluminum');
  if (found.has('aluminum') && found.has('steel')) found.delete('steel');
  // Cap/lid materials often appear alongside the body: plastic + glass is a glass bottle,
  // plastic + tetra is a carton, plastic + aluminum is a can with a plastic ring.
  if (found.size === 2 && found.has('other-plastic')) found.delete('other-plastic');
  if (found.size === 2 && found.has('clear-plastic') && (found.has('glass') || found.has('tetra') || found.has('aluminum'))) found.delete('clear-plastic');
  if (found.size !== 1) return null;
  return [...found][0];
}

function bestName(p) {
  return (p.product_name_en || p.product_name || p.product_name_fr || '').trim();
}

function toCandidate(p) {
  const name = bestName(p);
  const { drink, ambiguous } = mapDrink(p);
  const tags = new Set(p.categories_tags || []);
  const size_ml = parseSize(p);
  const material = mapMaterial(p);
  const code = String(p.code);
  const labels = (p.labels_tags || []).join(' ');
  const reasons = [];
  if (!/^\d{8}$|^\d{12}$|^\d{13}$/.test(code)) reasons.push('barcode not 8/12/13 digits');
  if (!name) reasons.push('no name');
  if (!drink) reasons.push('category not mapped');
  if (ambiguous) reasons.push('categories disagree on what the drink is');
  if ([...tags].some((t) => REJECT_TAGS.has(t))) reasons.push('not a ready-to-drink beverage (syrup, sweetener, dry tea, powder)');
  if (!size_ml) reasons.push('no size');
  // Materials matter for liquor (10¢ vs 5¢) and beer bottles (refillable question);
  // for everything else the refund is the same in every container, but the app
  // shows the material, so we still require it.
  if (!material) reasons.push('container unknown');
  if (drink === 'beer' && material === 'glass') reasons.push('beer bottle: refillable or not is not in the data');
  if (drink === 'beer' && material && !/aluminum|steel|glass/.test(material)) reasons.push('beer in an unusual container');
  const noAlcohol = /en:no-alcohol/.test(labels) || [...tags].some((t) => /non-alcoholic/.test(t)) || NO_ALCOHOL_RE.test(name);
  if (LIQUOR.has(drink) && noAlcohol) reasons.push('alcohol-free version of an alcoholic drink');
  const alcohol = Number(p.nutriments?.alcohol ?? p.alcohol_100g ?? 0);
  if ((drink === 'cider' || drink === 'cooler') && !(tags.has('en:alcoholic-beverages') && alcohol > 0)) {
    // "cider" / "cooler" categories on OFF include sweet apple cider, sparkling juice and
    // mixers, and the alcoholic tag is sometimes wrong; require a stated alcohol content.
    reasons.push('cider/cooler without a stated alcohol content');
  }
  // One barcode, one container. Cases and multipacks are dropped: the depot counts containers.
  const multipack = /\b\d+\s*[x×]\s*\d/i.test(`${p.quantity || ''} ${name}`) || /\b\d+\s*(pack|pk|cans|bottles)\b/i.test(name)
    || (p.packagings || []).some((k) => Number(k.number_of_units) > 1);
  if (multipack) reasons.push('multipack or case');
  if ((material === 'aluminum' || material === 'steel') && size_ml > 1000) reasons.push('can over 1 L: a case, not a container');
  if (LIQUOR.has(drink) && /plastic/.test(material || '') && size_ml > 1500) reasons.push('wine in "plastic" over 1.5 L: probably a bag-in-box, which pays differently');
  if (size_ml > 5000 && drink !== 'water') reasons.push('over 5 L and not a water jug: probably a case');
  if (drink === 'plant-milk' && /not-a-source-of-protein/.test(labels)) reasons.push('plant drink labelled not-a-source-of-protein: needs a human look');
  return { code, name, brand: (p.brands || '').split(',')[0].trim(), size_ml, drink, material, refillable: false, alcohol_pct: p.alcohol_100g ?? p.nutriments?.alcohol ?? null, label_flags: [], reasons, scans: p.unique_scans_n || 0 };
}

// --- main --------------------------------------------------------------------

async function main() {
  process.stderr.write('Fetching from Open Food Facts (1 request/second, cached under data/cache/)\n');
  const raw = await fetchAll();
  process.stderr.write(`Raw products: ${raw.length}\n`);
  if (flag('--fetch')) return;

  let classify;
  try {
    ({ classify } = await import(pathToFileURL(RULES_PATH).href));
  } catch (e) {
    console.error(`Cannot load the rules engine at ${RULES_PATH}: ${e.message}`);
    console.error('This build never classifies on its own. Bring c1\'s worker/src/rules.js into the tree, or pass --rules <path>.');
    process.exit(3);
  }

  const dropped = {};
  const drop = (why) => { dropped[why] = (dropped[why] || 0) + 1; };
  const rows = [];
  const fetched = new Date().toISOString().slice(0, 10);
  for (const p of raw) {
    const c = toCandidate(p);
    if (c.reasons.length) { c.reasons.forEach(drop); continue; }
    const r = classify({ drink: c.drink, material: c.material, size_ml: c.size_ml, refillable: c.refillable, alcohol_pct: c.alcohol_pct, label_flags: c.label_flags });
    if (!r || !['regular', 'liquor', 'none', 'brewer'].includes(r.class)) { drop(`classifier said ${r?.class ?? 'nothing'}`); continue; }
    rows.push({ upc: c.code, name: c.name, brand: c.brand, size_ml: c.size_ml, drink: c.drink, material: c.material, refillable: false, class: r.class, refund_cents: r.refund_cents, source: 'openfoodfacts', fetched, scans: c.scans });
  }
  rows.sort((a, b) => b.scans - a.scans || a.upc.localeCompare(b.upc));
  for (const r of rows) delete r.scans;
  await fs.writeFile(OUT, JSON.stringify(rows, null, 1) + '\n');

  const byClass = {}, byDrink = {};
  for (const r of rows) { byClass[r.class] = (byClass[r.class] || 0) + 1; byDrink[r.drink] = (byDrink[r.drink] || 0) + 1; }
  console.log(`Wrote ${rows.length} rows to ${path.relative(process.cwd(), OUT)}`);
  console.log('By class:', byClass);
  console.log('By drink:', byDrink);
  console.log('Dropped (reason: count):', dropped);
  if (rows.length < 300) { console.error(`Only ${rows.length} rows; target is 300+.`); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exit(1); });
