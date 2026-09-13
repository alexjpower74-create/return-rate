// Throwaway stand-in for the Worker so tests/live-roundtrip.mjs can be proven red and green
// before the real Worker exists. LIE=cents makes the seeded item answer 10¢ (negative control).
// Barcodes here are SYNTHETIC. Not the Worker; docs/API.md is the contract, c1 implements it.
import { createServer } from 'node:http';
const port = Number(process.argv[2] || 5910);
const LIE = process.env.LIE || '';
const SEED = { upc: '0000000000017', name: 'Test Pop', brand: 'Synthetic', size_ml: 591, class: 'regular', refund_cents: 5, material: 'clear-plastic', why: 'Pop in a plastic bottle: 5¢.', source: 'openfoodfacts', note: "The counter's count is the one that pays." };
let unknownToday = 0, lookups = 0;
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
createServer((req, res) => {
  const [, a, b] = req.url.split('?')[0].split('/');
  if (a === 'health') return json(res, 200, { ok: true, items: 1 });
  if (a === 'stats') return json(res, 200, { items: 1, lookups_today: lookups, unknown_today: unknownToday, top_unknown: [] });
  if (a === 'item') {
    if (!/^(\d{8}|\d{12}|\d{13})$/.test(b || '')) return json(res, 400, { error: "That doesn't look like a barcode number." });
    lookups++;
    if (b === SEED.upc) return json(res, 200, { ...SEED, refund_cents: LIE === 'cents' ? 10 : SEED.refund_cents });
    unknownToday++;
    return json(res, 404, { error: "We don't know this one yet. Show it at the counter and we'll add it.", upc: b });
  }
  json(res, 404, { error: 'not found' });
}).listen(port, () => console.log(`mock api on ${port}${LIE ? ` (LIE=${LIE})` : ''}`));
