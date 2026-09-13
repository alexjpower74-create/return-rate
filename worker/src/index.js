// Return Rate — the Worker. Implements docs/API.md. Rules come from ./rules.js only.
import { classify, DRINKS, MATERIALS } from './rules.js';
import PREFIXES from './prefixes.json';

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

// UPC-E (8 digits) → UPC-A (12 digits), the standard expansion, so a maker prefix can be read off it.
function expandUpcE(u) {
  if (!/^\d{8}$/.test(u)) return null;
  const ns = u[0], d = u.slice(1, 7), chk = u[7];
  if (ns !== '0' && ns !== '1') return null;
  let mid;
  switch (d[5]) {
    case '0': case '1': case '2': mid = d.slice(0, 2) + d[5] + '0000' + d.slice(2, 5); break;
    case '3': mid = d.slice(0, 3) + '00000' + d.slice(3, 5); break;
    case '4': mid = d.slice(0, 4) + '00000' + d[4]; break;
    default: mid = d.slice(0, 5) + '0000' + d[5];
  }
  return ns + mid + chk;
}
// The six-digit maker prefix of a barcode (UPC-A: first six; EAN-13 starting with 0: digits 2-7; UPC-E: after expansion).
function makerPrefix(upc) {
  if (upc.length === 8) { const a = expandUpcE(upc); return a ? a.slice(0, 6) : null; }
  if (upc.length === 12) return upc.slice(0, 6);
  if (upc.length === 13 && upc[0] === '0') return upc.slice(1, 7);
  return null;
}
function makerAnswer(upc, env) {
  const pf = makerPrefix(upc); const m = pf && PREFIXES.prefixes[pf];
  if (!m || m.disabled) return null;
  const r = classify({ drink: m.drink, material: 'aluminum', size_ml: 355 }, env); // any container ≤ 5 L from a drink-only maker is the regular refund
  if (r.class !== 'regular') return null;
  return {
    upc, name: null, brand: m.maker, size_ml: null, accepted: true, verdict: 'Yes, we take this', class: 'regular',
    refund_cents: r.refund_cents, depot_policy: false, material: null,
    why: `Made by ${m.maker} (${m.examples}). Everything they sell is a drink with a deposit, so any of their containers up to 5 litres is ${r.refund_cents}¢.`,
    source: 'maker', note: NOTE, nl_only: 'Refund applies to containers bought in Newfoundland and Labrador.',
  };
}

// ---------- the label photo ----------
// When the barcode alone can't decide, the customer photographs the front label. A vision model reads what MMSB rules on:
// the kind of drink, the container, the size, and the exact label words (Milk, fortified plant-based beverage,
// not a source of protein, Meal Replacement / Formulated Liquid Diet, Return for Refund). The rules engine decides; the
// model never outputs a verdict or a cents figure. Anything unclear → Check the label, never a guess.
const LABEL_PROMPT = `You are reading the FRONT LABEL of a beverage container photographed in Newfoundland, Canada. Report only what you can actually read or see. Reply with ONLY a JSON object:
{"name": "<product name as printed or null>", "brand": "<brand or null>",
 "drink": one of ["soft-drink","water","sparkling-water","juice","vegetable-juice","sports","electrolyte","energy","tea","coffee","kombucha","protein-shake","flavoured-milk-beverage","na-beer","beer","cider","cooler","seltzer","malt-beverage","cocktail","wine","spirits","sake","mead","hard-kombucha","milk","plant-milk","infant-formula","meal-replacement","formulated-liquid-diet","concentrate","distilled-water","unknown"],
 "material": one of ["aluminum","steel","clear-plastic","other-plastic","glass","tetra","gable","pouch","bag-in-box","unknown"],
 "size_ml": <number or null>, "alcohol_pct": <number or null>,
 "says_milk": <true if the label calls the product Milk (e.g. "2% milk", "chocolate milk", "lait"), else false>,
 "says_fortified_plant": <true if the label says fortified soy/almond/oat/plant-based beverage>,
 "says_not_source_of_protein": <true if the label says "not a source of protein">,
 "says_meal_replacement": <true if the label says "Meal Replacement" or "Formulated Liquid Diet" or "infant formula">,
 "says_return_for_refund": <true if the label says "Return for Refund", "Refundable", "Consigné" or similar>,
 "readable": <true if the front label is clearly readable, else false>}
Use "unknown" whenever you are not sure. Do not guess sizes; use the printed volume.`;

async function readLabel(photo, env) {
  if (!env.OPENAI_API_KEY) throw new Error('no vision key');
  const bytes = new Uint8Array(await photo.arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const dataUrl = `data:${photo.type || 'image/jpeg'};base64,${btoa(bin)}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-5.4-mini', max_completion_tokens: 400, messages: [{ role: 'user', content: [{ type: 'text', text: LABEL_PROMPT }, { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }] }] }),
  });
  if (!res.ok) throw new Error('vision ' + res.status);
  const j = await res.json(); const text = j.choices?.[0]?.message?.content || '';
  const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('no json');
  return JSON.parse(m[0]);
}

const LABEL_CHECK = "We couldn't read enough of the label. " + LABEL_TEST;

async function postLabel(request, env) {
  const hash = await ipHash(request, env);
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM lookups WHERE ip_hash = ? AND created > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')").bind(hash).first();
  if (n >= rateLimit(env)) return err(TOO_MANY, 429);
  let form; try { form = await request.formData(); } catch { return err('Please send a photo of the label.', 400); }
  const photo = form.get('photo');
  if (!photo || typeof photo === 'string' || !photo.size) return err('Please send a photo of the label.', 400);
  if (photo.size > 8 * 1024 * 1024) return err('That photo is too big. Please send one under 8 MB.', 413);
  const upc = String(form.get('upc') || '').replace(/\D/g, '');
  let read;
  try { read = await readLabel(photo, env); } catch (e) { console.error('label read failed', e && e.message); return err("We couldn't read the label just now. Try again in better light, or " + LABEL_TEST.charAt(0).toLowerCase() + LABEL_TEST.slice(1), 503); }
  await env.DB.prepare('INSERT INTO lookups (upc, found, ip_hash) VALUES (?, ?, ?)').bind(upc || 'label', 0, hash).run();

  // Map what the label says to the rules' inputs. The label words outrank the model's category guess.
  let drink = DRINKS.includes(read.drink) ? read.drink : 'unknown';
  const evidence = [];
  if (read.says_meal_replacement) { drink = 'meal-replacement'; evidence.push('the label says Meal Replacement, Formulated Liquid Diet or infant formula'); }
  else if (read.says_milk) { drink = 'milk'; evidence.push('the label calls it Milk'); }
  else if (read.says_fortified_plant && read.says_not_source_of_protein) { drink = 'plant-drink-not-protein'; evidence.push('the label says fortified plant-based beverage and not a source of protein'); }
  else if (read.says_fortified_plant) { drink = 'plant-milk'; evidence.push('the label says fortified plant-based beverage'); }
  else if (drink === 'milk') { drink = 'flavoured-milk-beverage'; evidence.push('it looks like a milk drink but the label does not call it Milk'); }
  else if (drink === 'plant-milk') { drink = 'unknown'; }
  if (read.says_return_for_refund) evidence.push('the label says Return for Refund');
  const material = MATERIALS.includes(read.material) ? read.material : 'unknown';
  const size_ml = Number.isFinite(Number(read.size_ml)) && read.size_ml ? Number(read.size_ml) : null;
  const r = classify({ drink, material, size_ml, refillable: false, alcohol_pct: read.alcohol_pct }, env);
  const base = { upc: upc || null, name: read.name || null, brand: read.brand || null, size_ml, material, source: 'label', note: NOTE, nl_only: 'Refund applies to containers bought in Newfoundland and Labrador.', evidence };
  if (!read.readable || r.class === 'unknown') {
    // A Return for Refund label with a readable non-alcoholic drink but unknown material is still a sure 5¢.
    if (read.readable && read.says_return_for_refund && drink !== 'unknown' && !['wine','spirits','sake','mead','cider','cooler','seltzer','malt-beverage','cocktail','hard-kombucha'].includes(drink) && (size_ml === null || size_ml <= 5000)) {
      const rr = classify({ drink, material: 'aluminum', size_ml: size_ml || 355 }, env);
      if (rr.class === 'regular') return json({ ...base, accepted: true, verdict: 'Yes, we take this', class: 'regular', refund_cents: rr.refund_cents, depot_policy: false, why: 'The label says Return for Refund and it is a drink, not milk or a nutrition product: ' + rr.refund_cents + '¢.' });
    }
    return err(LABEL_CHECK, 404, { ...base, accepted: null, verdict: 'Check the label', hint: HINT });
  }
  return json({ ...base, accepted: r.class !== 'none', verdict: r.class !== 'none' ? 'Yes, we take this' : "No, we don't take this", class: r.class, refund_cents: r.refund_cents, depot_policy: r.depot_policy === true, why: r.why + (evidence.length ? ' From the label: ' + evidence.join('; ') + '.' : '') });
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
    if (row) return err(LABEL_GUIDE[row.drink] || LABEL_GUIDE['label-other'], 404, { upc, name: row.name, accepted: null, verdict: 'Check the label', hint: HINT, label_photo: true });
    const maker = makerAnswer(upc, env);
    if (maker) return json(maker);
    return err(UNKNOWN, 404, { upc, accepted: null, verdict: 'Check the label', hint: HINT, label_photo: true });
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
      if (path === '/label' && m === 'POST') return await postLabel(request, env);
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
