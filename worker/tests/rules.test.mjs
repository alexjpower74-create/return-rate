import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/rules.js';

// One case per row of the docs/RULES.md chart, then the traps from PLAN.md.
const cases = [
  // Guide s.5 chart, row by row
  ['can, pop',                    { drink: 'soft-drink', material: 'aluminum', size_ml: 355 }, 'regular', 5],
  ['can, beer',                   { drink: 'beer', material: 'aluminum', size_ml: 473 }, 'regular', 5],
  ['can, wine',                   { drink: 'wine', material: 'aluminum', size_ml: 250 }, 'regular', 5],
  ['can, cooler',                 { drink: 'cooler', material: 'aluminum', size_ml: 355 }, 'regular', 5],
  ['can, cider',                  { drink: 'cider', material: 'aluminum', size_ml: 473 }, 'regular', 5],
  ['steel, juice',                { drink: 'juice', material: 'steel', size_ml: 300 }, 'regular', 5],
  ['steel, beer',                 { drink: 'beer', material: 'steel', size_ml: 500 }, 'regular', 5],
  ['clear plastic, water',        { drink: 'water', material: 'clear-plastic', size_ml: 500 }, 'regular', 5],
  ['clear plastic, 50 mL vodka',  { drink: 'spirits', material: 'clear-plastic', size_ml: 50 }, 'regular', 5],
  ['clear plastic, vodka 375',    { drink: 'spirits', material: 'clear-plastic', size_ml: 375 }, 'liquor', 10],
  ['other plastic, sports',       { drink: 'sports', material: 'other-plastic', size_ml: 710 }, 'regular', 5],
  ['other plastic, 50 mL rum',    { drink: 'spirits', material: 'other-plastic', size_ml: 50 }, 'regular', 5],
  ['other plastic, wine',         { drink: 'wine', material: 'other-plastic', size_ml: 750 }, 'liquor', 10],
  ['glass, pop',                  { drink: 'soft-drink', material: 'glass', size_ml: 355 }, 'regular', 5],
  ['glass, imported beer',        { drink: 'beer', material: 'glass', size_ml: 330 }, 'regular', 5],
  ['glass, 50 mL whisky',         { drink: 'spirits', material: 'glass', size_ml: 50 }, 'regular', 5],
  ['glass, wine',                 { drink: 'wine', material: 'glass', size_ml: 750 }, 'liquor', 10],
  ['glass, cooler',               { drink: 'cooler', material: 'glass', size_ml: 341 }, 'liquor', 10],
  ['glass, cider',                { drink: 'cider', material: 'glass', size_ml: 500 }, 'liquor', 10],
  ['tetra, juice box',            { drink: 'juice', material: 'tetra', size_ml: 200 }, 'regular', 5],
  ['gable, orange juice',         { drink: 'juice', material: 'gable', size_ml: 1890 }, 'regular', 5],
  ['tetra, wine',                 { drink: 'wine', material: 'tetra', size_ml: 1000 }, 'liquor', 10],
  ['gable, wine',                 { drink: 'wine', material: 'gable', size_ml: 1000 }, 'liquor', 10],
  ['pouch, juice',                { drink: 'juice', material: 'pouch', size_ml: 200 }, 'regular', 5],
  ['pouch, cocktail',             { drink: 'cooler', material: 'pouch', size_ml: 300 }, 'regular', 5],
  ['bag-in-box, wine',            { drink: 'wine', material: 'bag-in-box', size_ml: 4000 }, 'regular', 5],
  // The traps from PLAN.md
  ['750 mL pop',                  { drink: 'soft-drink', material: 'clear-plastic', size_ml: 750 }, 'regular', 5],
  ['200 mL vodka glass',          { drink: 'spirits', material: 'glass', size_ml: 200 }, 'liquor', 10],
  ['50 mL rum miniature',         { drink: 'spirits', material: 'glass', size_ml: 50 }, 'regular', 5],
  ['wine in a can',               { drink: 'wine', material: 'aluminum', size_ml: 355 }, 'regular', 5],
  ['canned cocktail',             { drink: 'cooler', material: 'aluminum', size_ml: 355 }, 'regular', 5],
  ['glass cooler',                { drink: 'cooler', material: 'glass', size_ml: 341 }, 'liquor', 10],
  ['cider in glass',              { drink: 'cider', material: 'glass', size_ml: 330 }, 'liquor', 10],
  ['bag-in-box wine',             { drink: 'wine', material: 'bag-in-box', size_ml: 3000 }, 'regular', 5],
  ['tetra wine',                  { drink: 'wine', material: 'tetra', size_ml: 500 }, 'liquor', 10],
  ['juice box',                   { drink: 'juice', material: 'tetra', size_ml: 200 }, 'regular', 5],
  ['oat milk',                    { drink: 'plant-milk', material: 'gable', size_ml: 1890 }, 'none', 0],
  ['oat drink, not a source of protein', { drink: 'plant-drink-not-protein', material: 'gable', size_ml: 946 }, 'regular', 5],
  ['Ensure',                      { drink: 'meal-replacement', material: 'other-plastic', size_ml: 235 }, 'none', 0],
  ['frozen juice concentrate',    { drink: 'concentrate', material: 'other-plastic', size_ml: 295 }, 'none', 0],
  ['distilled water',             { drink: 'distilled-water', material: 'other-plastic', size_ml: 4000 }, 'none', 0],
  ['6 L water jug',               { drink: 'water', material: 'other-plastic', size_ml: 6000 }, 'none', 0],
  ['refillable Quidi Vidi bottle', { drink: 'beer', material: 'glass', size_ml: 341, refillable: true }, 'brewer', 0],
  ['imported beer bottle',        { drink: 'beer', material: 'glass', size_ml: 330 }, 'regular', 5],
  ['domestic beer can',           { drink: 'beer', material: 'aluminum', size_ml: 355 }, 'regular', 5],
  ['sake in glass',               { drink: 'sake', material: 'glass', size_ml: 720 }, 'liquor', 10],
  ['milk',                        { drink: 'milk', material: 'gable', size_ml: 2000 }, 'none', 0],
  ['infant formula',              { drink: 'infant-formula', material: 'steel', size_ml: 946 }, 'none', 0],
  ['formulated liquid diet',      { drink: 'formulated-liquid-diet', material: 'tetra', size_ml: 250 }, 'none', 0],
  ['kombucha glass',              { drink: 'kombucha', material: 'glass', size_ml: 414 }, 'regular', 5],
  ['refillable non-beer',         { drink: 'water', material: 'other-plastic', size_ml: 4000, refillable: true }, 'none', 0],
  ['wine, unknown material',      { drink: 'wine', material: 'unknown', size_ml: 750 }, 'unknown', null],
  ['unknown drink',               { drink: 'unknown', material: 'glass', size_ml: 750 }, 'unknown', null],
  ['garbage drink value',         { drink: 'petrol', material: 'glass', size_ml: 750 }, 'unknown', null],
  ['empty input',                 {}, 'unknown', null],
];

for (const [name, input, cls, cents] of cases) {
  test(`${name} → ${cls} ${cents === null ? '' : cents + '¢'}`, () => {
    const r = classify(input);
    assert.equal(r.class, cls, `class for ${name}`);
    assert.equal(r.refund_cents, cents, `cents for ${name}`);
    assert.equal(typeof r.why, 'string');
    assert.ok(r.why.length > 10, 'why is a sentence');
  });
}

test('at least 40 cases', () => assert.ok(cases.length >= 40, `only ${cases.length}`));

test('rates come from env: regular 10 would make the pop case red', () => {
  const r = classify({ drink: 'soft-drink', material: 'aluminum', size_ml: 355 }, { RATE_REGULAR_CENTS: '10' });
  assert.equal(r.refund_cents, 10);
  const l = classify({ drink: 'wine', material: 'glass', size_ml: 750 }, { RATE_LIQUOR_CENTS: '20' });
  assert.equal(l.refund_cents, 20);
});

test('why never mentions a deposit figure (refund only) and never says payout/guaranteed', () => {
  for (const [, input] of cases) {
    const { why } = classify(input);
    assert.doesNotMatch(why, /8¢|20¢|deposit of|payout|guarantee|you will get/i, why);
  }
});
