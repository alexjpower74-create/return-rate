// Return Rate — the pure rules engine. Implements docs/RULES.md exactly; nothing else.
// classify(input) -> { class, refund_cents, why }
// class: regular (5¢) | liquor (10¢) | none (0¢) | brewer (0¢, ask at the counter) | unknown (never an answer)

export const DRINKS = [
  'soft-drink', 'water', 'sparkling-water', 'juice', 'vegetable-juice', 'sports', 'energy', 'tea',
  'coffee', 'kombucha', 'beer', 'cider', 'cooler', 'wine', 'spirits', 'sake', 'milk', 'plant-milk',
  'plant-drink-not-protein', 'infant-formula', 'meal-replacement', 'formulated-liquid-diet',
  'concentrate', 'distilled-water', 'unknown',
];

export const MATERIALS = [
  'aluminum', 'steel', 'clear-plastic', 'other-plastic', 'glass', 'tetra', 'gable', 'pouch',
  'bag-in-box', 'unknown',
];

const NO_REFUND = {
  'milk': "Milk has no deposit, so there's no refund.",
  'plant-milk': "Plant milks like oat, soy and almond have no deposit, so there's no refund.",
  'infant-formula': "Infant formula has no deposit, so there's no refund.",
  'meal-replacement': "Meal replacement drinks have no deposit, so there's no refund.",
  'formulated-liquid-diet': "Formulated liquid diets have no deposit, so there's no refund.",
  'concentrate': "Concentrates like frozen juice and syrups have no deposit, so there's no refund.",
  'distilled-water': "Distilled water has no deposit, so there's no refund.",
};

const LIQUOR = new Set(['wine', 'spirits', 'sake', 'cider', 'cooler']);
const LIQUOR_10 = new Set(['clear-plastic', 'other-plastic', 'glass', 'tetra', 'gable']);
const LIQUOR_5 = new Set(['aluminum', 'steel', 'pouch', 'bag-in-box']);
const REGULAR = new Set([
  'soft-drink', 'water', 'sparkling-water', 'juice', 'vegetable-juice', 'sports', 'energy', 'tea',
  'coffee', 'kombucha', 'plant-drink-not-protein',
]);

const DRINK_WORDS = {
  'soft-drink': 'Pop', 'water': 'Water', 'sparkling-water': 'Sparkling water', 'juice': 'Juice',
  'vegetable-juice': 'Vegetable juice', 'sports': 'A sports drink', 'energy': 'An energy drink',
  'tea': 'Tea', 'coffee': 'Coffee', 'kombucha': 'Kombucha', 'beer': 'Beer', 'cider': 'Cider',
  'cooler': 'A cooler', 'wine': 'Wine', 'spirits': 'Spirits', 'sake': 'Sake',
  'plant-drink-not-protein': 'A plant drink labelled not a source of protein',
};

const MATERIAL_WORDS = {
  'aluminum': 'a can', 'steel': 'a steel can', 'clear-plastic': 'a plastic bottle',
  'other-plastic': 'a plastic bottle', 'glass': 'a glass bottle', 'tetra': 'a carton',
  'gable': 'a carton', 'pouch': 'a pouch', 'bag-in-box': 'a bag-in-box', 'unknown': 'its container',
};

export function rates(env = {}) {
  const regular = Number(env.RATE_REGULAR_CENTS ?? 5);
  const liquor = Number(env.RATE_LIQUOR_CENTS ?? 10);
  return { regular, liquor };
}

function out(cls, cents, why) {
  return { class: cls, refund_cents: cents, why };
}

export function classify(input = {}, env = {}) {
  const { regular: R, liquor: L } = rates(env);
  const drink = DRINKS.includes(input.drink) ? input.drink : 'unknown';
  const material = MATERIALS.includes(input.material) ? input.material : 'unknown';
  const size = Number.isFinite(Number(input.size_ml)) && input.size_ml !== null && input.size_ml !== undefined
    ? Number(input.size_ml) : null;
  const refillable = input.refillable === true;
  const dw = DRINK_WORDS[drink] || 'This drink';
  const mw = MATERIAL_WORDS[material];

  // 1. Over 5 litres.
  if (size !== null && size > 5000) {
    return out('none', 0, "Containers over 5 litres have no deposit, so there's no refund.");
  }
  // 2. Refillable.
  if (refillable) {
    if (drink === 'beer') {
      return out('brewer', 0, "A local brewer's refillable bottle goes back to the beer store; ask at the counter.");
    }
    return out('none', 0, "Refillable containers have no deposit here, so there's no refund.");
  }
  // 3. Not a beverage under the program.
  if (NO_REFUND[drink]) return out('none', 0, NO_REFUND[drink]);
  // 4. Unknown drink.
  if (drink === 'unknown') return out('unknown', null, "We don't know what this drink is.");
  // 5. Beer, any container.
  if (drink === 'beer') return out('regular', R, `Beer in ${mw}: ${R}¢.`);
  // 6. Wine and spirits (incl. coolers, ciders, sake).
  if (LIQUOR.has(drink)) {
    if (size !== null && size <= 50) return out('regular', R, `A 50 mL miniature: ${R}¢.`);
    if (LIQUOR_10.has(material)) return out('liquor', L, `${dw} in ${mw}: ${L}¢.`);
    if (LIQUOR_5.has(material)) return out('regular', R, `${dw} in ${mw}: ${R}¢.`);
    return out('unknown', null, "We don't know what this container is made of.");
  }
  // 7. Everything else on the beverage list.
  if (REGULAR.has(drink)) return out('regular', R, `${dw} in ${mw}: ${R}¢.`);
  return out('unknown', null, "We don't know this one.");
}

export default classify;
