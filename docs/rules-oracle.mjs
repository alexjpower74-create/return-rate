// Main's oracle runner: node docs/rules-oracle.mjs [path/to/rules.js]
// Loads docs/rules-oracle.json and calls classify() on every row. Exit 1 on any miss.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const rulesPath = resolve(process.argv[2] || 'worker/src/rules.js');
const { classify } = await import(rulesPath);
const { cases } = JSON.parse(readFileSync(new URL('./rules-oracle.json', import.meta.url)));
const accepted = (r) => (r.class === 'unknown' ? null : r.class !== 'none');
let bad = 0;
for (const c of cases) {
  let r; try { r = classify(c.in); } catch (e) { r = { class: 'THREW', refund_cents: null, why: e.message }; }
  const gotA = accepted(r), gotC = r.class === 'unknown' ? null : r.refund_cents;
  const okA = gotA === c.accepted, okC = gotC === c.cents, okP = c.depot_policy ? r.depot_policy === true : true;
  if (!(okA && okC && okP)) { bad++; console.log(`MISS  ${c.name}\n      want accepted=${c.accepted} cents=${c.cents}${c.depot_policy ? ' depot_policy' : ''}\n      got  accepted=${gotA} cents=${gotC} class=${r.class} why="${r.why}"`); }
}
console.log(`\n${cases.length - bad}/${cases.length} oracle rows pass against ${rulesPath}`);
process.exit(bad ? 1 : 0);
