// Photo evals: every image in evals/labels/ through POST /label, judged by evals/labels/expected.json.
// node evals/labels-run.mjs --api <worker url> [--provider workers-ai|openai]   exit 1 on any miss
import { readFileSync } from 'node:fs'
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : []))
    .filter(Boolean),
)
const API = (args.api || '').replace(/\/$/, '')
if (!API) {
  console.error('need --api')
  process.exit(2)
}
const expected = JSON.parse(readFileSync(new URL('./labels/expected.json', import.meta.url)))
let miss = 0,
  n = 0
for (const [file, want] of Object.entries(expected)) {
  n++
  const fd = new FormData()
  fd.append('photo', new Blob([readFileSync(new URL('./labels/' + file, import.meta.url))], { type: 'image/jpeg' }), file)
  const t0 = Date.now()
  const res = await fetch(API + '/label' + (args.provider ? '?provider=' + args.provider : ''), { method: 'POST', body: fd })
  const body = await res.json().catch(() => ({}))
  const got = (body.verdict || '?').startsWith('Yes') ? 'Yes' : (body.verdict || '?').startsWith('No') ? 'No' : '?'
  const ok = got === want
  if (!ok) miss++
  console.log(
    `${ok ? 'ok  ' : 'MISS'} ${String(Date.now() - t0).padStart(5)}ms ${file.padEnd(40)} want=${want} got=${got}  ${(body.why || body.error || '').slice(0, 70)}`,
  )
}
console.log(`\n${n - miss}/${n} photos right${miss ? `, ${miss} WRONG` : ''}`)
process.exit(miss ? 1 : 0)
