// Open Food Facts → the rules engine's input. Shared by the live lookup in index.js and (in spirit) data/build.mjs.
// OFF is a public, volunteer-built database with no key and no per-call charge. We ask it only when a barcode
// is not in D1, classify with rules.js, and remember the answer, so the second customer never waits and the
// vision model is only ever the last resort.

export const CATEGORY_TO_DRINK = [
  ['en:infant-formulas', 'infant-formula'],
  ['en:baby-milks', 'infant-formula'],
  ['en:meal-replacements', 'meal-replacement'],
  ['en:meal-replacement-drinks', 'meal-replacement'],
  ['en:frozen-juice-concentrates', 'concentrate'],
  ['en:juice-concentrates', 'concentrate'],
  ['en:concentrated-fruit-juices', 'concentrate'],
  ['en:squashes', 'concentrate'],
  ['en:syrups', 'concentrate'],
  ['en:distilled-waters', 'distilled-water'],
  ['en:milks', 'milk'],
  ['en:flavoured-milks', 'milk'],
  ['en:chocolate-milks', 'milk'],
  ['en:dairy-drinks', 'milk'],
  ['en:creams', 'milk'],
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
  ['en:non-alcoholic-beers', 'na-beer'],
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
  ['en:beverages', null], // a drink of some kind, type unknown: never enough on its own
]

const MATERIAL_MAP = [
  [/aluminium|aluminum/, 'aluminum'],
  [/\bsteel\b|tin-plate|tinplate/, 'steel'],
  [/tetra|brick|aseptic|carton/, 'tetra'],
  [/gable/, 'gable'],
  [/pouch|sachet/, 'pouch'],
  [/bag-in-box|bag in box/, 'bag-in-box'],
  [/\bpet\b|pete|clear-plastic|plastique-transparent/, 'clear-plastic'],
  [/hdpe|pehd|plastic|plastique/, 'other-plastic'],
  [/glass|verre/, 'glass'],
]

// Not a ready-to-drink beverage, whatever the category tree says.
const REJECT_TAGS = new Set([
  'en:syrups',
  'en:sweeteners',
  'en:teas', // dry tea
  'en:coffees', // ground/beans
  'en:instant-beverages',
  'en:beverage-preparations',
  'en:powdered-drinks',
  'en:drink-mixes',
  'en:dietary-supplements',
  'en:sauces',
  'en:condiments',
  'en:oils',
  'en:vinegars',
])

const LIQUOR = new Set(['wine', 'spirits', 'sake', 'cider', 'cooler'])
const REGULAR_GROUP = new Set([
  'soft-drink',
  'water',
  'sparkling-water',
  'juice',
  'vegetable-juice',
  'sports',
  'energy',
  'tea',
  'coffee',
  'kombucha',
  'na-beer',
])
const NO_ALCOHOL_RE = /alcohol[- ]?free|non[- ]?alcohol|sans alcool|d[ée]salcoolis|dealcohol|\b0[.,]0\s*%/i
const group = (d) => (REGULAR_GROUP.has(d) ? 'regular' : LIQUOR.has(d) ? 'liquor' : d)

export function bestName(p) {
  return (p.product_name_en || p.product_name || p.product_name_fr || '').trim()
}

export function parseSize(p) {
  let v = Number(p.product_quantity),
    u = String(p.product_quantity_unit || '').toLowerCase()
  if (!(v > 0)) {
    const m = String(p.quantity || '')
      .replace(',', '.')
      .match(/(\d+(?:\.\d+)?)\s*(ml|mL|l|L|cl|cL|fl\.? ?oz|oz)\b/i)
    if (!m) return null
    v = Number(m[1])
    u = m[2].toLowerCase()
  }
  if (!(v > 0)) return null
  if (u === 'ml') return Math.round(v)
  if (u === 'l') return Math.round(v * 1000)
  if (u === 'cl') return Math.round(v * 10)
  if (/oz/.test(u)) return Math.round(v * 29.5735)
  return null
}

export function mapDrink(p) {
  const tags = new Set(p.categories_tags || [])
  let drink = null
  const groups = new Set()
  for (const [tag, d] of CATEGORY_TO_DRINK)
    if (tags.has(tag) && d) {
      drink ??= d
      groups.add(group(d))
    }
  const name = bestName(p)
  if (drink === 'water' && /distill/i.test(name)) drink = 'distilled-water'
  if (drink === 'beer' && (NO_ALCOHOL_RE.test(name) || tags.has('en:non-alcoholic-beers'))) drink = 'na-beer'
  return { drink, ambiguous: groups.size > 1 }
}

export function mapMaterial(p) {
  const hay = [
    ...(p.packaging_materials_tags || []),
    ...(p.packagings || []).filter((k) => k.food_contact !== 0).map((k) => `${k.material || ''} ${k.shape || ''}`),
    ...(p.packaging_tags || []),
  ]
    .join(' ')
    .toLowerCase()
  const shapes = (p.packaging_shapes_tags || []).join(' ')
  const found = new Set()
  for (const [re, mat] of MATERIAL_MAP) if (re.test(hay)) found.add(mat)
  if (!found.size && /drink-can|\bcan\b|canette/.test(hay + ' ' + shapes) && !/glass|plastic|pet\b/.test(hay)) found.add('aluminum')
  if (found.has('aluminum') && found.has('steel')) found.delete('steel')
  if (found.size === 2 && found.has('other-plastic')) found.delete('other-plastic')
  if (found.size === 2 && found.has('clear-plastic') && (found.has('glass') || found.has('tetra') || found.has('aluminum')))
    found.delete('clear-plastic')
  if (found.size !== 1) return null
  return [...found][0]
}

// One OFF product → { ok, row?, reasons[] }. `row` is ready for the items table.
// Material is required only where the refund depends on it (liquor 10¢ vs 5¢, beer bottles); for a pop, a water,
// a juice or a milk the refund is the same in every container, so an unstated material does not block the answer.
export function candidate(p) {
  const code = String(p.code || '')
  const name = bestName(p)
  const { drink, ambiguous } = mapDrink(p)
  const tags = new Set(p.categories_tags || [])
  const size_ml = parseSize(p)
  const material = mapMaterial(p)
  const reasons = []
  if (!/^\d{8}$|^\d{12}$|^\d{13}$/.test(code)) reasons.push('barcode not 8/12/13 digits')
  if (!name) reasons.push('no name')
  if (!drink) reasons.push('category not mapped')
  if (ambiguous) reasons.push('categories disagree on what the drink is')
  if ([...tags].some((t) => REJECT_TAGS.has(t))) reasons.push('not a ready-to-drink beverage')
  const needsMaterial = LIQUOR.has(drink) || drink === 'beer'
  if (needsMaterial && !material) reasons.push('container unknown')
  if (drink === 'beer' && material === 'glass') reasons.push('beer bottle: refillable or not is not in the data')
  const labels = (p.labels_tags || []).join(' ')
  const alcohol = Number(p.nutriments?.alcohol ?? p.alcohol_100g ?? 0)
  if (LIQUOR.has(drink) && (NO_ALCOHOL_RE.test(name) || /en:no-alcohol/.test(labels)))
    reasons.push('alcohol-free version of an alcoholic drink')
  if ((drink === 'cider' || drink === 'cooler') && !(tags.has('en:alcoholic-beverages') && alcohol > 0))
    reasons.push('cider/cooler without a stated alcohol content')
  const multipack =
    /\b\d+\s*[x×]\s*\d/i.test(`${p.quantity || ''} ${name}`) ||
    /\b\d+\s*(pack|pk|cans|bottles)\b/i.test(name) ||
    (p.packagings || []).some((k) => Number(k.number_of_units) > 1 && /bottle|can|carton|brick|pouch|box|vial|jug/.test(k.shape || ''))
  if (multipack) reasons.push('multipack or case')
  if ((material === 'aluminum' || material === 'steel') && size_ml > 1000) reasons.push('can over 1 L: a case')
  if (LIQUOR.has(drink) && /plastic/.test(material || '') && size_ml > 1500) reasons.push('wine in plastic over 1.5 L: probably bag-in-box')
  if (size_ml > 5000 && drink !== 'water') reasons.push('over 5 L and not a water jug')
  if (drink === 'plant-milk' && /not-a-source-of-protein/.test(labels)) reasons.push('plant drink labelled not-a-source-of-protein')
  return {
    ok: reasons.length === 0,
    reasons,
    row: {
      upc: code,
      name,
      brand: (p.brands || '').split(',')[0].trim() || null,
      size_ml,
      drink: drink || 'unknown',
      material: material || 'unknown',
      refillable: 0,
      source: 'openfoodfacts-live',
    },
  }
}

const FIELDS =
  'code,product_name,product_name_en,product_name_fr,brands,quantity,product_quantity,product_quantity_unit,categories_tags,packaging_tags,packaging_materials_tags,packaging_shapes_tags,packagings,labels_tags,alcohol_100g,nutriments'
const UA = 'ReturnRate/1.0 (Newfoundland Green Depot refund checker; apcosoftwaretools.ca)'

// Fetch one product. Resolves the OFF product object, null when OFF has never heard of it, or throws on
// network trouble / timeout. Cloudflare caches the answer for a day so a popular unknown costs one call.
export async function fetchProduct(upc, env) {
  const base = env?.OFF_BASE || 'https://world.openfoodfacts.org'
  const url = `${base}/api/v2/product/${upc}.json?fields=${FIELDS}`
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), Number(env?.OFF_TIMEOUT_MS || 2500))
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctl.signal,
      cf: { cacheTtl: 86400, cacheEverything: true },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`off ${res.status}`)
    const body = await res.json()
    if (!body || body.status === 0 || !body.product) return null
    return body.product
  } finally {
    clearTimeout(t)
  }
}
