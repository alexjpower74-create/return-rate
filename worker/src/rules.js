// Return Rate — the pure rules engine. Implements docs/RULES.md exactly; nothing else.
// classify(input) -> { class, refund_cents, why }
// class: regular (5¢) | liquor (10¢) | none (0¢) | brewer (local refillable beer bottle: APCO 5¢, depot_policy) | unknown (never an answer)
// v4 (2026-09-13): only glass or plastic bottles of liquor over 50 mL are 10¢; cans, pouches, bag-in-box, tetra and gable liquor are 5¢ (APCO practice).

export const DRINKS = [
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
  'electrolyte',
  'protein-shake',
  'flavoured-milk-beverage',
  'na-beer',
  'beer',
  'cider',
  'cooler',
  'seltzer',
  'malt-beverage',
  'cocktail',
  'wine',
  'spirits',
  'sake',
  'mead',
  'hard-kombucha',
  'milk',
  'plant-milk',
  'plant-drink-not-protein',
  'infant-formula',
  'meal-replacement',
  'formulated-liquid-diet',
  'concentrate',
  'distilled-water',
  'unknown',
]

export const MATERIALS = [
  'aluminum',
  'steel',
  'clear-plastic',
  'other-plastic',
  'glass',
  'tetra',
  'gable',
  'pouch',
  'bag-in-box',
  'unknown',
]

const NO_REFUND = {
  milk: "Milk has no deposit, so there's no refund.",
  'plant-milk': "Plant milks like oat, soy and almond have no deposit, so there's no refund.",
  'infant-formula': "Infant formula has no deposit, so there's no refund.",
  'meal-replacement': "Meal replacement drinks have no deposit, so there's no refund.",
  'formulated-liquid-diet': "Formulated liquid diets have no deposit, so there's no refund.",
  concentrate: "Concentrates like frozen juice and syrups have no deposit, so there's no refund.",
  'distilled-water': "Distilled water has no deposit, so there's no refund.",
}

const LIQUOR = new Set(['wine', 'spirits', 'sake', 'mead', 'cider', 'cooler', 'seltzer', 'malt-beverage', 'cocktail', 'hard-kombucha'])
const LIQUOR_10 = new Set(['clear-plastic', 'other-plastic', 'glass'])
const LIQUOR_5 = new Set(['aluminum', 'steel', 'pouch', 'bag-in-box', 'tetra', 'gable'])
const REGULAR = new Set([
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
  'electrolyte',
  'protein-shake',
  'flavoured-milk-beverage',
  'na-beer',
  'plant-drink-not-protein',
])

const DRINK_WORDS = {
  'soft-drink': 'Pop',
  water: 'Water',
  'sparkling-water': 'Sparkling water',
  juice: 'Juice',
  'vegetable-juice': 'Vegetable juice',
  sports: 'A sports drink',
  energy: 'An energy drink',
  tea: 'Tea',
  coffee: 'Coffee',
  kombucha: 'Kombucha',
  beer: 'Beer',
  cider: 'Cider',
  cooler: 'A cooler',
  seltzer: 'A hard seltzer',
  'malt-beverage': 'A malt-based cooler',
  cocktail: 'A canned cocktail',
  wine: 'Wine',
  spirits: 'Spirits',
  sake: 'Sake',
  mead: 'Mead',
  'hard-kombucha': 'Hard kombucha',
  electrolyte: 'An electrolyte drink',
  'protein-shake': 'A protein shake, not labelled as milk',
  'flavoured-milk-beverage': 'A milk beverage, not labelled as milk',
  'na-beer': 'Non-alcoholic beer',
  'plant-drink-not-protein': 'A plant drink labelled not a source of protein',
}

const MATERIAL_WORDS = {
  aluminum: 'a can',
  steel: 'a steel can',
  'clear-plastic': 'a plastic bottle',
  'other-plastic': 'a plastic bottle',
  glass: 'a glass bottle',
  tetra: 'a carton',
  gable: 'a carton',
  pouch: 'a pouch',
  'bag-in-box': 'a bag-in-box',
  unknown: 'its container',
}

export function rates(env = {}) {
  const regular = Number(env.RATE_REGULAR_CENTS ?? 5)
  const liquor = Number(env.RATE_LIQUOR_CENTS ?? 10)
  return { regular, liquor }
}

function out(cls, cents, why, depot_policy = false) {
  return { class: cls, refund_cents: cents, why, depot_policy }
}

export function classify(input = {}, env = {}) {
  const { regular: R, liquor: L } = rates(env)
  const drink = DRINKS.includes(input.drink) ? input.drink : 'unknown'
  const material = MATERIALS.includes(input.material) ? input.material : 'unknown'
  const size =
    Number.isFinite(Number(input.size_ml)) && input.size_ml !== null && input.size_ml !== undefined ? Number(input.size_ml) : null
  const refillable = input.refillable === true
  const dw = DRINK_WORDS[drink] || 'This drink'
  const mw = MATERIAL_WORDS[material]

  // 1. Over 5 litres.
  if (size !== null && size > 5000) {
    return out('none', 0, "Containers over 5 litres have no deposit, so there's no refund.")
  }
  // 2. Refillable.
  if (refillable) {
    if (drink === 'beer') {
      // Not part of the MMSB program. APCO's own policy (Alexander, 2026-09-13): taken at 5¢. Some depots don't.
      return out(
        'brewer',
        R,
        `A local brewer's refillable bottle (including Quidi Vidi Iceberg blue) is not part of the MMSB program. APCO Recycling takes it and pays ${R}¢; some other depots don't.`,
        true,
      )
    }
    return out('none', 0, "Refillable containers have no deposit here, so there's no refund.")
  }
  // 3. Not a beverage under the program.
  if (NO_REFUND[drink]) return out('none', 0, NO_REFUND[drink])
  // 4. Unknown drink.
  if (drink === 'unknown') return out('unknown', null, "We don't know what this drink is.")
  // 5. Beer, any container. Non-alcoholic beer is not alcoholic liquor: an ordinary beverage.
  if (drink === 'beer' || drink === 'na-beer') return out('regular', R, `${dw} in ${mw}: ${R}¢.`)
  // 6. Alcoholic liquor other than beer (wine, spirits, sake, mead, ciders, coolers, seltzers, malt coolers, cocktails, hard kombucha).
  //    10¢ only in a glass or plastic bottle over 50 mL; everything else 5¢ (RULES.md, APCO practice).
  if (LIQUOR.has(drink)) {
    if (size !== null && size <= 50) return out('regular', R, `A 50 mL miniature: ${R}¢.`)
    if (LIQUOR_10.has(material)) return out('liquor', L, `${dw} in ${mw}: ${L}¢.`)
    if (LIQUOR_5.has(material)) return out('regular', R, `${dw} in ${mw}: ${R}¢.`)
    return out('unknown', null, "We don't know what this container is made of.")
  }
  // 7. Everything else on the beverage list.
  if (REGULAR.has(drink)) return out('regular', R, `${dw} in ${mw}: ${R}¢.`)
  return out('unknown', null, "We don't know this one.")
}

export default classify
