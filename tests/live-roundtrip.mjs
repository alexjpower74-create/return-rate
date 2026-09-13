#!/usr/bin/env node
// Live round-trip against the real Worker. Usage:
//   API=https://return-rate.<acct>.workers.dev node tests/live-roundtrip.mjs [--upc <seeded> --class regular --cents 5]
// Exit 1 on any red check, 2 if API is unset. Each check has a negative control: an assertion whose
// negative control also passes is VOID, and VOID counts as red.
const API = (process.env.API || '').replace(/\/$/, '');
if (!API) { console.error('Set API=<worker base url>'); process.exit(2); }
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const SEED = { upc: arg('upc', process.env.SEED_UPC), klass: arg('class', process.env.SEED_CLASS || 'regular'), cents: Number(arg('cents', process.env.SEED_CENTS || 5)) };
const UNKNOWN = arg('unknown', process.env.UNKNOWN_UPC || '0000000000099'); // SYNTHETIC, never seeded
const HONEST = "We don't know this one yet. Show it at the counter and we'll add it.";
const MONEY = "The counter's count is the one that pays.";

let red = 0;
const get = async (path) => { const r = await fetch(API + path, { headers: { accept: 'application/json' } }); let body = null; try { body = await r.json(); } catch {} return { status: r.status, body }; };

// check(name, actual, predicate, control): predicate(actual) must be true AND predicate(control) must be false.
function check(name, actual, predicate, control) {
  const pass = predicate(actual);
  const controlPasses = predicate(control);
  const state = controlPasses ? 'VOID' : pass ? 'ok' : 'RED';
  if (state !== 'ok') red++;
  console.log(`${state.padEnd(4)} ${name}${state === 'RED' ? `\n     got: ${JSON.stringify(actual)}` : ''}${state === 'VOID' ? ' (negative control also passed, this check measures nothing)' : ''}`);
}

const health = await get('/health');
check('health ok:true with an item count', health, (r) => r.status === 200 && r.body?.ok === true && Number.isInteger(r.body.items), { status: 200, body: { ok: false } });
check('health has at least one item (seeded)', health, (r) => r.body?.items > 0, { body: { items: 0 } });

if (SEED.upc) {
  const item = await get(`/item/${SEED.upc}`);
  check(`seeded ${SEED.upc} is 200`, item, (r) => r.status === 200, { status: 404 });
  check(`seeded ${SEED.upc} class is ${SEED.klass}`, item, (r) => r.body?.class === SEED.klass, { body: { class: 'unknown' } });
  check(`seeded ${SEED.upc} refund is ${SEED.cents}¢`, item, (r) => r.body?.refund_cents === SEED.cents, { body: { refund_cents: SEED.cents === 5 ? 10 : 5 } });
  check('seeded item has a plain one-sentence why', item, (r) => typeof r.body?.why === 'string' && /\S/.test(r.body.why) && !/undefined|null|NaN/.test(r.body.why), { body: { why: 'undefined' } });
  check('seeded item carries the counter line', item, (r) => r.body?.note === MONEY, { body: { note: 'Guaranteed payout' } });
  check('never the class "unknown" in a 200', item, (r) => r.status !== 200 || r.body?.class !== 'unknown', { status: 200, body: { class: 'unknown' } });
} else {
  console.log('skip seeded-item checks: pass --upc <seeded barcode> --class <class> --cents <5|10|0>');
}

const unk = await get(`/item/${UNKNOWN}`);
check(`unknown ${UNKNOWN} is 404`, unk, (r) => r.status === 404, { status: 200 });
check('unknown carries the honest sentence', unk, (r) => r.body?.error === HONEST, { body: { error: 'Not found' } });
check('unknown never carries a refund', unk, (r) => r.body?.refund_cents === undefined && r.body?.class === undefined, { body: { refund_cents: 5 } });

const bad = await get('/item/12ab');
check('malformed barcode is 400', bad, (r) => r.status === 400, { status: 404 });
check('malformed error is the plain sentence', bad, (r) => r.body?.error === "That doesn't look like a barcode number.", { body: { error: 'Invalid UPC' } });

const stats = await get('/stats');
check('stats has items, lookups_today, unknown_today, top_unknown[]', stats,
  (r) => r.status === 200 && ['items', 'lookups_today', 'unknown_today'].every((k) => Number.isInteger(r.body?.[k])) && Array.isArray(r.body?.top_unknown),
  { status: 200, body: { items: 1 } });
check('the unknown lookup above was counted', stats, (r) => r.body?.unknown_today >= 1, { body: { unknown_today: 0 } });

// Self-test of the harness itself: LIVE_SELFTEST=1 adds a check whose control also passes; it must show VOID and count red.
if (process.env.LIVE_SELFTEST) check('SELFTEST: a check that cannot fail', health, () => true, {});

console.log(red ? `\n${red} red` : '\nall green');
process.exit(red ? 1 : 0);
