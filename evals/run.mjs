#!/usr/bin/env node
// Return Rate — shelf evals.
//   node evals/run.mjs --api http://127.0.0.1:5902 [--labels evals/labels.json]
// Asks the Worker for every barcode in labels.json and prints expected vs got.
// Exit 0 all right; exit 1 any wrong class (or a lookup that failed); exit 2 empty set.
// An expected class of "unknown" means the Worker must answer 404 (honest "we don't know").

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const api = (opt('--api', process.env.API || '')).replace(/\/$/, '');
const labelsPath = path.resolve(opt('--labels', path.join(HERE, 'labels.json')));

if (!api) { console.error('Usage: node evals/run.mjs --api <worker url>'); process.exit(2); }

const labels = JSON.parse(await fs.readFile(labelsPath, 'utf8'));
const cases = Array.isArray(labels) ? labels : labels.cases;
if (!cases?.length) { console.error('No cases in ' + labelsPath); process.exit(2); }

const EXPECTED_CENTS = { regular: 5, liquor: 10, none: 0, brewer: 0, unknown: null };
let wrong = 0;
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('barcode', 15) + pad('expected', 10) + pad('got', 10) + pad('cents', 7) + 'name');
for (const c of cases) {
  let got = 'error', cents = '', name = '', detail = '';
  try {
    const res = await fetch(`${api}/item/${c.upc}`);
    const body = await res.json().catch(() => ({}));
    if (res.status === 200) { got = body.class; cents = body.refund_cents; name = body.name || ''; }
    else if (res.status === 404) { got = 'unknown'; detail = body.error || ''; }
    else { got = `http ${res.status}`; detail = body.error || ''; }
  } catch (e) { detail = e.message; }
  const ok = got === c.expected && (c.expected === 'unknown' || cents === EXPECTED_CENTS[c.expected]);
  if (!ok) wrong++;
  console.log(`${ok ? '  ' : 'X '}${pad(c.upc, 13)}${pad(c.expected, 10)}${pad(got, 10)}${pad(cents, 7)}${name || c.name || ''}${detail ? '  (' + detail + ')' : ''}`);
}
console.log(`\n${cases.length - wrong}/${cases.length} right${wrong ? `, ${wrong} WRONG` : ''}`);
process.exit(wrong ? 1 : 0);
