// Return Rate — the Worker. Implements docs/API.md. Rules come from ./rules.js only.
import { classify, DRINKS, MATERIALS } from './rules.js';

const NOTE = "The counter's count is the one that pays.";
// No staff side, no PIN, no confirming: when the barcode alone can't decide, the app tells the customer
// exactly what to read on the label. These sentences come from docs/RULES.md (MMSB's own label rules).
const LABEL_TEST = "Look on the label for the words Return for Refund. If they're there and you bought it in Newfoundland and Labrador, we take it: 5¢, or 10¢ for wine and spirits in a glass or plastic bottle. If they're not there, there's no refund.";
const UNKNOWN = "We don't have this one on our list yet. " + LABEL_TEST;
const LABEL_GUIDE = {
  'label-milk': "Milk products: if the label says Milk (that includes chocolate milk), there's no refund. If it's a milk beverage or a protein shake and the label says Return for Refund, we take it at 5¢.",
  'label-plant': "Plant-based drinks: if the label says fortified soy, almond or oat beverage and it's a source of protein, there's no refund. If the label says 'not a source of protein' and Return for Refund, we take it at 5¢.",
  'label-nutrition': "If the label says Meal Replacement, Formulated Liquid Diet or infant formula, there's no refund. Otherwise look for Return for Refund on the label; if it's there, we take it at 5¢.",
  'label-other': LABEL_TEST,
};
const HINT = 'Look for the words Return for Refund on the label.';
const BAD_UPC = "That doesn't look like a barcode number.";
const TOO_MANY = 'Too many scans in a row, give it a minute.';
// Lookups per hour per address. A depot's whole WiFi shares one address, so the deployed default is generous;
// the tests run wrangler dev with `--var RATE_LIMIT_PER_HOUR:60` so the guard can be proven.
const rateLimit = (env) => Number(env.RATE_LIMIT_PER_HOUR || 600);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (n >= rateLimit(env)) return err(TOO_MANY, 429);

  const row = await env.DB.prepare('SELECT * FROM items WHERE upc = ?').bind(upc).first();
  const item = row ? present(row, env) : null;
  await env.DB.prepare('INSERT INTO lookups (upc, found, ip_hash) VALUES (?, ?, ?)')
    .bind(upc, item ? 1 : 0, hash).run();
  if (!item) {
    // A recognised product whose refund depends on the label (milk vs milk beverage, "not a source of protein",
    // "Meal Replacement") is never guessed: say we know it, and tell them what to read on the label (docs/RULES.md).
    if (row) return err(LABEL_GUIDE[row.drink] || LABEL_GUIDE['label-other'], 404, { upc, name: row.name, accepted: null, verdict: 'Check the label', hint: HINT });
    return err(UNKNOWN, 404, { upc, accepted: null, verdict: 'Check the label', hint: HINT });
  }
  return json(item);
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
        return err('Use GET here.', 405);
      }
      return err('There is nothing at that address.', 404);
    } catch (e) {
      console.error(e);
      return err('Something went wrong on our side. Try again in a minute.', 500);
    }
  },
};
