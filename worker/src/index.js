// Return Rate — the Worker. Implements docs/API.md. Rules come from ./rules.js only.
import { classify } from './rules.js'
import PREFIXES from './prefixes.json'
import { fetchProduct, candidate } from './off.js'

const NOTE = "The counter's count is the one that pays."
// No staff side, no PIN, no confirming: when the barcode alone can't decide, the app tells the customer
// exactly what to read on the label. These sentences come from docs/RULES.md (MMSB's own label rules).
const _LABEL_TEST =
  "Look on the label for the words Return for Refund. If they're there and you bought it in Newfoundland and Labrador, we take it: 5¢, or 10¢ for wine and spirits in a glass or plastic bottle. If they're not there, there's no refund."
const UNKNOWN = "We don't have this barcode on our list yet. Ask at the counter and they'll tell you."
const LABEL_GUIDE = {
  'label-milk':
    "This one depends on the label: if it says Milk there's no refund; a milk beverage or protein shake has one. Read the front, or ask at the counter.",
  'label-plant':
    "This one depends on the label: a fortified plant beverage has no refund unless it says 'not a source of protein'. Read the front, or ask at the counter.",
  'label-nutrition':
    'This one depends on the label: Meal Replacement, Formulated Liquid Diet and infant formula have no refund. Read the front, or ask at the counter.',
  'label-other': "We know this one but the label decides it. Ask at the counter and they'll tell you.",
}
const HINT =
  'Look for the words Return for Refund on the label: if it says that and it was bought in Newfoundland and Labrador, the depot takes it.'
const BAD_UPC = "That doesn't look like a barcode number."
const TOO_MANY = 'Too many scans in a row, give it a minute.'
// Lookups per hour per address. A depot's whole WiFi shares one address, so the deployed default is generous;
// the tests run wrangler dev with `--var RATE_LIMIT_PER_HOUR:60` so the guard can be proven.
const rateLimit = (env) => Number(env.RATE_LIMIT_PER_HOUR || 600)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}
const err = (msg, status, extra = {}) => json({ error: msg, ...extra }, status)

function validUpc(s) {
  return typeof s === 'string' && /^(\d{8}|\d{12}|\d{13})$/.test(s)
}

async function ipHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'local'
  const salt = env.IP_SALT || 'return-rate'
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + ip))
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

// Build the public item shape. class/refund_cents/why always recomputed from the rules.
function present(row, env) {
  const r = classify({ drink: row.drink, material: row.material, size_ml: row.size_ml, refillable: !!row.refillable }, env)
  if (r.class === 'unknown') return null
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
  }
}

async function health(env) {
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM items').first()
  return json({ ok: true, items: n })
}

// UPC-E (8 digits) → UPC-A (12 digits), the standard expansion, so a maker prefix can be read off it.
function expandUpcE(u) {
  if (!/^\d{8}$/.test(u)) return null
  const ns = u[0],
    d = u.slice(1, 7),
    chk = u[7]
  if (ns !== '0' && ns !== '1') return null
  let mid
  switch (d[5]) {
    case '0':
    case '1':
    case '2':
      mid = d.slice(0, 2) + d[5] + '0000' + d.slice(2, 5)
      break
    case '3':
      mid = d.slice(0, 3) + '00000' + d.slice(3, 5)
      break
    case '4':
      mid = d.slice(0, 4) + '00000' + d[4]
      break
    default:
      mid = d.slice(0, 5) + '0000' + d[5]
  }
  return ns + mid + chk
}
// The six-digit maker prefix of a barcode (UPC-A: first six; EAN-13 starting with 0: digits 2-7; UPC-E: after expansion).
function makerPrefix(upc) {
  if (upc.length === 8) {
    const a = expandUpcE(upc)
    return a ? a.slice(0, 6) : null
  }
  if (upc.length === 12) return upc.slice(0, 6)
  if (upc.length === 13 && upc[0] === '0') return upc.slice(1, 7)
  return null
}
function makerAnswer(upc, env) {
  const pf = makerPrefix(upc)
  const m = pf && PREFIXES.prefixes[pf]
  if (!m || m.disabled) return null
  const r = classify({ drink: m.drink, material: 'aluminum', size_ml: 355 }, env) // any container ≤ 5 L from a drink-only maker is the regular refund
  if (r.class !== 'regular') return null
  return {
    upc,
    name: null,
    brand: m.maker,
    size_ml: null,
    accepted: true,
    verdict: 'Yes, we take this',
    class: 'regular',
    refund_cents: r.refund_cents,
    depot_policy: false,
    material: null,
    why: `Made by ${m.maker} (${m.examples}). Everything they sell is a drink with a deposit, so any of their containers up to 5 litres is ${r.refund_cents}¢.`,
    source: 'maker',
    note: NOTE,
    nl_only: 'Refund applies to containers bought in Newfoundland and Labrador.',
  }
}

function notDrinkAnswer(upc, name, brand, whatItIs, source) {
  const what = String(whatItIs || 'this').trim()
  return {
    upc,
    name,
    brand,
    size_ml: null,
    material: null,
    source,
    accepted: false,
    verdict: "No, we don't take this",
    class: 'none',
    refund_cents: 0,
    depot_policy: false,
    why: `${what.charAt(0).toUpperCase() + what.slice(1)} ${/s$/i.test(what) && !/(ss|us|is)$/i.test(what) ? "aren't" : "isn't"} a drink. The depot only takes containers that held a beverage.`,
    evidence: ['not a beverage container'],
    note: NOTE,
    nl_only: 'Refund applies to containers bought in Newfoundland and Labrador.',
  }
}

// The live Open Food Facts step. Resolves an items row (already inserted) or null. Never throws: any trouble
// with OFF means "not on our list", which is the honest answer we had before.
async function lookupOff(upc, env) {
  let product
  try {
    product = await fetchProduct(upc.length === 12 ? '0' + upc : upc, env) // OFF files UPC-A as 13 digits
  } catch (_e) {
    return null
  }
  if (!product) return null
  const c = candidate(product)
  if (!c.row.name) return null
  // OFF knows it and it is plainly not a drink (spread, sauce, snack, shampoo): answer no without a photo.
  const tags = product.categories_tags || []
  const drinkTree = tags.some((t) =>
    /beverage|drink|milk|water|juice|soda|beer|wine|spirit|cider|kombucha|coffee|tea|dair|formula|lait|boisson/i.test(t),
  )
  if (!c.row.drink || c.row.drink === 'unknown') {
    if (tags.length && !drinkTree)
      return {
        notDrink: true,
        name: c.row.name,
        brand: c.row.brand,
        what: tags[tags.length - 1].replace(/^[a-z]{2}:/, '').replace(/-/g, ' '),
      }
    return null
  }
  const r = classify({ drink: c.row.drink, material: c.row.material, size_ml: c.row.size_ml, refillable: false }, env)
  // Keep it when the rules give a definite answer, or when we at least know the drink (so the label guide can name it).
  if (r.class === 'unknown' && !c.row.drink) return null
  if (c.reasons.some((x) => /not a ready-to-drink|multipack|case|bag-in-box|over 5 L/.test(x)) && r.class !== 'none') return null
  if (r.class === 'unknown' && c.row.drink === 'unknown') return null
  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO items (upc, name, brand, size_ml, drink, material, refillable, class, source) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
    )
      .bind(c.row.upc, c.row.name, c.row.brand, c.row.size_ml, c.row.drink, c.row.material, r.class, c.row.source)
      .run()
  } catch (_e) {}
  return { ...c.row, class: r.class }
}

async function getItem(request, env, upc) {
  if (!validUpc(upc)) return err(BAD_UPC, 400)
  const hash = await ipHash(request, env)
  const { n } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM lookups WHERE ip_hash = ? AND created > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')",
  )
    .bind(hash)
    .first()
  if (n >= rateLimit(env)) return err(TOO_MANY, 429)

  // A phone reports a North American barcode as 12 digits (UPC-A); Open Food Facts and half our list write the same
  // code as 13 digits with a leading 0 (EAN-13). Both spellings are one product, so both are looked up.
  const twin = upc.length === 12 ? '0' + upc : upc.length === 13 && upc[0] === '0' ? upc.slice(1) : upc
  let row = await env.DB.prepare('SELECT * FROM items WHERE upc IN (?, ?) ORDER BY upc = ? DESC').bind(upc, twin, upc).first()
  // Not on our list: ask Open Food Facts (free, no key) before ever asking for a photo. A definite answer is
  // remembered in D1 so the next customer gets it straight from the list; a product OFF knows but the rules
  // can't settle (wine with no stated bottle, milk beverage) is remembered too, so we can name it and say what to read.
  if (!row && env.OFF_LOOKUP !== '0') row = await lookupOff(upc, env)
  if (row?.notDrink) {
    await env.DB.prepare('INSERT INTO lookups (upc, found, ip_hash) VALUES (?, 1, ?)').bind(upc, hash).run()
    return json(notDrinkAnswer(upc, row.name, row.brand, row.what, 'openfoodfacts-live'))
  }
  const item = row ? present(row, env) : null
  await env.DB.prepare('INSERT INTO lookups (upc, found, ip_hash) VALUES (?, ?, ?)')
    .bind(upc, item ? 1 : 0, hash)
    .run()
  if (!item) {
    // A recognised product whose refund depends on the label (milk vs milk beverage, "not a source of protein",
    // "Meal Replacement") is never guessed: say we know it, and tell them what to read on the label (docs/RULES.md).
    if (row)
      return err(LABEL_GUIDE[row.drink] || LABEL_GUIDE['label-other'], 404, {
        upc,
        name: row.name,
        accepted: null,
        verdict: 'Ask at the counter',
        hint: HINT,
      })
    const maker = makerAnswer(upc, env)
    if (maker) return json(maker)
    return err(UNKNOWN, 404, { upc, accepted: null, verdict: 'Ask at the counter', hint: HINT })
  }
  return json(item)
}

async function stats(env) {
  const day = "created >= strftime('%Y-%m-%dT00:00:00Z','now')"
  const [{ n: items }, { n: lookups_today }, { n: unknown_today }, top] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM items').first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM lookups WHERE ${day}`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM lookups WHERE found = 0 AND ${day}`).first(),
    env.DB.prepare('SELECT upc, COUNT(*) AS n FROM lookups WHERE found = 0 GROUP BY upc ORDER BY n DESC, upc LIMIT 10').all(),
  ])
  return json({ items, lookups_today, unknown_today, top_unknown: top.results })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const m = request.method
    try {
      if (m === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
      if (path === '/health' && m === 'GET') return await health(env)
      if (path === '/stats' && m === 'GET') return await stats(env)
      const item = path.match(/^\/item\/([^/]*)$/)
      if (item) {
        const upc = decodeURIComponent(item[1])
        if (m === 'GET') return await getItem(request, env, upc)
        return err('Use GET here.', 405)
      }
      return err('There is nothing at that address.', 404)
    } catch (e) {
      console.error(e)
      return err('Something went wrong on our side. Try again in a minute.', 500)
    }
  },
}
