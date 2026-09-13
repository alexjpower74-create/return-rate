// Runs against `wrangler dev --port 5902` (API env var overrides). Local D1 must have the migration
// and tests/seed.sql + tests/seed-unclassifiable.sql applied (see worker/README.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API || 'http://localhost:5902';
const PIN = process.env.COUNTER_PIN || '1234';
const NOTE = "The counter's count is the one that pays.";
const UNKNOWN = "We don't know this one yet. Show it at the counter and we'll add it.";
// Each test uses its own fake client IP so the rate guard test can't bleed into the others.
let ipN = 0;
const ip = () => `10.0.${Math.floor(Math.random() * 250)}.${++ipN % 250}`;
async function call(path, opts = {}, clientIp = ip()) {
  const res = await fetch(API + path, { ...opts, headers: { 'CF-Connecting-IP': clientIp, ...(opts.headers || {}) } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('health', async () => {
  const { status, body } = await call('/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.ok(Number.isInteger(body.items) && body.items >= 4, 'seed applied');
});

test('known item: pop can is regular 5¢ with the money line', async () => {
  const { status, body } = await call('/item/0000000000017');
  assert.equal(status, 200);
  assert.equal(body.class, 'regular');
  assert.equal(body.refund_cents, 5);
  assert.equal(body.note, NOTE);
  assert.match(body.why, /5¢/);
  assert.equal(body.material, 'aluminum');
});

test('known item: glass wine is liquor 10¢', async () => {
  const { body } = await call('/item/0000000000024');
  assert.equal(body.class, 'liquor');
  assert.equal(body.refund_cents, 10);
});

test('known item: oat milk is none, 0¢, with a reason', async () => {
  const { body } = await call('/item/0000000000031');
  assert.equal(body.class, 'none');
  assert.equal(body.refund_cents, 0);
  assert.match(body.why, /no refund/i);
  assert.equal(body.note, NOTE);
});

test('known item: refillable local beer is brewer, 5¢ as APCO policy, says some depots do not', async () => {
  const { body } = await call('/item/0000000000048');
  assert.equal(body.class, 'brewer');
  assert.equal(body.refund_cents, 5);
  assert.equal(body.depot_policy, true);
  assert.equal(body.accepted, true);
  assert.match(body.why, /APCO Recycling takes it/);
  assert.match(body.why, /some other depots don't/);
});

test('every answer carries the verdict, accepted flag and the NL-only line; unknown carries Ask at the counter', async () => {
  const { body } = await call('/item/0000000000048');
  assert.equal(body.verdict, 'Yes, we take this');
  assert.match(body.nl_only, /Newfoundland and Labrador/);
  const u = await call('/item/0000000000099');
  assert.equal(u.body.accepted, null);
  assert.equal(u.body.verdict, 'Ask at the counter');
  assert.match(u.body.hint, /Return for Refund/);
});

test('unknown → 404 with the honest sentence and the upc', async () => {
  const { status, body } = await call('/item/0000000000099');
  assert.equal(status, 404);
  assert.equal(body.error, UNKNOWN);
  assert.equal(body.upc, '0000000000099');
});

test('a row the rules cannot classify is never an answer (404, not a class)', async () => {
  const { status, body } = await call('/item/0000000000055');
  assert.equal(status, 404);
  assert.equal(body.error, UNKNOWN);
});

test('malformed UPC → 400', async () => {
  for (const bad of ['abc', '123', '12345678901', '00000000000170', '0000000000017x']) {
    const { status, body } = await call('/item/' + bad);
    assert.equal(status, 400, bad);
    assert.equal(body.error, "That doesn't look like a barcode number.");
  }
});

test('counter add then found; the Worker computes the class, staff never send cents', async () => {
  const upc = '0000000000' + String(100 + Math.floor(Math.random() * 899));
  const before = await call('/item/' + upc);
  assert.equal(before.status, 404);
  const added = await call('/item/' + upc, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'SYNTHETIC cooler 341 mL glass', drink: 'cooler', material: 'glass', size_ml: 341, refund_cents: 99, class: 'none' }),
  });
  assert.equal(added.status, 200);
  assert.equal(added.body.class, 'liquor');
  assert.equal(added.body.refund_cents, 10);
  assert.equal(added.body.source, 'counter');
  const after = await call('/item/' + upc);
  assert.equal(after.status, 200);
  assert.equal(after.body.refund_cents, 10);
  assert.equal(after.body.note, NOTE);
});

test('counter correction overwrites a seeded row', async () => {
  const r = await call('/item/0000000000017', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'SYNTHETIC cola 355 mL can', brand: 'Test', drink: 'soft-drink', material: 'aluminum', size_ml: 355 }),
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.class, 'regular');
});

test('wrong PIN → 401; missing PIN → 401', async () => {
  const wrong = await call('/item/0000000000017', {
    method: 'POST', headers: { Authorization: 'Bearer 0000', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x', drink: 'water', material: 'glass' }),
  });
  assert.equal(wrong.status, 401);
  const none = await call('/item/0000000000017', { method: 'POST', body: '{}' });
  assert.equal(none.status, 401);
});

test('bad class inputs → 400 (unknown drink, unknown material, missing name, wine with unknown material)', async () => {
  const post = (b) => call('/item/0000000000017', {
    method: 'POST', headers: { Authorization: 'Bearer ' + PIN, 'Content-Type': 'application/json' }, body: JSON.stringify(b),
  });
  assert.equal((await post({ name: 'x', drink: 'petrol', material: 'glass' })).status, 400);
  assert.equal((await post({ name: 'x', drink: 'unknown', material: 'glass' })).status, 400);
  assert.equal((await post({ name: 'x', drink: 'water', material: 'unknown' })).status, 400);
  assert.equal((await post({ drink: 'water', material: 'glass' })).status, 400);
  assert.equal((await post({ name: 'x', drink: 'wine', material: 'unknown' })).status, 400);
});

test('rate guard: the 61st lookup in an hour from one IP → 429', async () => {
  const me = '203.0.113.' + (1 + Math.floor(Math.random() * 250));
  let last;
  for (let i = 0; i < 60; i++) {
    last = await call('/item/0000000000017', {}, me);
    assert.equal(last.status, 200, `lookup ${i + 1}`);
  }
  const blocked = await call('/item/0000000000017', {}, me);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'Too many scans in a row, give it a minute.');
  const other = await call('/item/0000000000017', {}, ip());
  assert.equal(other.status, 200, 'another IP is not blocked');
});

test('stats: counts and top unknown', async () => {
  const upc = '0000000000' + String(700 + Math.floor(Math.random() * 99));
  await call('/item/' + upc); await call('/item/' + upc);
  const { status, body } = await call('/stats');
  assert.equal(status, 200);
  assert.ok(body.items >= 4);
  assert.ok(body.lookups_today >= 2);
  assert.ok(body.unknown_today >= 2);
  assert.ok(Array.isArray(body.top_unknown) && body.top_unknown.some((t) => t.upc === upc && t.n >= 2));
});

test('CORS: GET answers are open', async () => {
  const res = await fetch(API + '/health');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
});
