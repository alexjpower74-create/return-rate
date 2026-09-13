// Return Rate — the Worker. Implements docs/API.md. Rules come from ./rules.js only.
import { classify, DRINKS, MATERIALS } from './rules.js';

const NOTE = "The counter's count is the one that pays.";
const UNKNOWN = "We don't know this one yet. Show it at the counter and we'll add it.";
const NEEDS_COUNTER = "We know this one but the refund depends on the label. Show it at the counter.";
const HINT = 'Look for the words Return for Refund on the label.';
const BAD_UPC = "That doesn't look like a barcode number.";
const TOO_MANY = 'Too many scans in a row, give it a minute.';
const RATE_LIMIT = 60; // lookups per hour per IP

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}
const err = (msg, status, extra = {}) => json({ error: msg, ...extra }, status);

function validUpc(s) {
  return typeof s === 'string' && /^(\d{8}|\d{12}|\d{13})$/.test(s);
}

async function ipHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'local';
  const salt = env.IP_SALT || 'return-rate';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + ip));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Build the public item shape. class/refund_cents/why always recomputed from the rules.
function present(row, env) {
  const r = classify(
    { drink: row.drink, material: row.material, size_ml: row.size_ml, refillable: !!row.refillable },
    env,
  );
  if (r.class === 'unknown') return null;
  return {
    upc: row.upc,
    name: row.name,
    brand: row.brand ?? null,
    size_ml: row.size_ml ?? null,
    accepted: r.class !== 'none',
    verdict: r.class !== 'none' ? 'Yes, we take this' : "No, we don't take this",
    class: r.class,
    refund_cents: r.refund_cents,
    depot_policy: r.depot_policy === true,
    material: row.material,
    why: r.why,
    source: row.source,
    note: NOTE,
    nl_only: 'Refund applies to containers bought in Newfoundland and Labrador.',
  };
}

async function health(env) {
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM items').first();
  return json({ ok: true, items: n });
}

async function getItem(request, env, upc) {
  if (!validUpc(upc)) return err(BAD_UPC, 400);
  const hash = await ipHash(request, env);
  const { n } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM lookups WHERE ip_hash = ? AND created > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')",
  ).bind(hash).first();
  if (n >= RATE_LIMIT) return err(TOO_MANY, 429);

  const row = await env.DB.prepare('SELECT * FROM items WHERE upc = ?').bind(upc).first();
  const item = row ? present(row, env) : null;
  await env.DB.prepare('INSERT INTO lookups (upc, found, ip_hash) VALUES (?, ?, ?)')
    .bind(upc, item ? 1 : 0, hash).run();
  if (!item) {
    // A recognised product whose refund depends on the label (milk vs milk beverage, "not a source of protein",
    // "Meal Replacement") is never guessed: say we know it, and send them to the counter (docs/RULES.md).
    if (row) return err(NEEDS_COUNTER, 404, { upc, name: row.name, accepted: null, verdict: 'Ask at the counter', hint: HINT });
    return err(UNKNOWN, 404, { upc, accepted: null, verdict: 'Ask at the counter', hint: HINT });
  }
  return json(item);
}

async function postItem(request, env, upc) {
  const auth = request.headers.get('Authorization') || '';
  const pin = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!env.COUNTER_PIN || pin !== env.COUNTER_PIN) return err('That PIN is not right.', 401);
  if (!validUpc(upc)) return err(BAD_UPC, 400);

  let body;
  try { body = await request.json(); } catch { return err('Send the item as JSON.', 400); }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return err('The item needs a name.', 400);
  if (!DRINKS.includes(body.drink) || body.drink === 'unknown') return err('Pick what the drink is from the list.', 400);
  if (!MATERIALS.includes(body.material) || body.material === 'unknown') return err('Pick what the container is made of from the list.', 400);
  const size_ml = body.size_ml == null ? null : Number(body.size_ml);
  if (size_ml !== null && !(Number.isInteger(size_ml) && size_ml > 0)) return err('Size must be a whole number of millilitres.', 400);
  const brand = typeof body.brand === 'string' && body.brand.trim() ? body.brand.trim() : null;
  const refillable = body.refillable === true ? 1 : 0;

  const r = classify({ drink: body.drink, material: body.material, size_ml, refillable: !!refillable }, env);
  if (r.class === 'unknown') return err("We can't tell the refund from that; check the drink and the container.", 400);

  await env.DB.prepare(
    `INSERT INTO items (upc, name, brand, size_ml, drink, material, refillable, class, source, edited_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'counter', 'counter')
     ON CONFLICT(upc) DO UPDATE SET name=excluded.name, brand=excluded.brand, size_ml=excluded.size_ml,
       drink=excluded.drink, material=excluded.material, refillable=excluded.refillable, class=excluded.class,
       source='counter', edited_by='counter'`,
  ).bind(upc, name, brand, size_ml, body.drink, body.material, refillable, r.class).run();
  const row = await env.DB.prepare('SELECT * FROM items WHERE upc = ?').bind(upc).first();
  return json(present(row, env));
}

async function stats(env) {
  const day = "created >= strftime('%Y-%m-%dT00:00:00Z','now')";
  const [{ n: items }, { n: lookups_today }, { n: unknown_today }, top] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM items').first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM lookups WHERE ${day}`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM lookups WHERE found = 0 AND ${day}`).first(),
    env.DB.prepare(
      'SELECT upc, COUNT(*) AS n FROM lookups WHERE found = 0 GROUP BY upc ORDER BY n DESC, upc LIMIT 10',
    ).all(),
  ]);
  return json({ items, lookups_today, unknown_today, top_unknown: top.results });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const m = request.method;
    try {
      if (m === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (path === '/health' && m === 'GET') return await health(env);
      if (path === '/stats' && m === 'GET') return await stats(env);
      const item = path.match(/^\/item\/([^/]*)$/);
      if (item) {
        const upc = decodeURIComponent(item[1]);
        if (m === 'GET') return await getItem(request, env, upc);
        if (m === 'POST') return await postItem(request, env, upc);
        return err('Use GET or POST here.', 405);
      }
      return err('There is nothing at that address.', 404);
    } catch (e) {
      console.error(e);
      return err('Something went wrong on our side. Try again in a minute.', 500);
    }
  },
};
