import { chromium } from '@playwright/test'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const S = path.dirname(fileURLToPath(import.meta.url))
const ROOTS = [S, path.join(S, '..', '..', 'app')]
const srv = http
  .createServer((q, r) => {
    const f = ROOTS.map((r) => path.join(r, q.url.split('?')[0])).find((p) => fs.existsSync(p))
    if (!f) {
      r.statusCode = 404
      return r.end()
    }
    r.setHeader('content-type', f.endsWith('.js') ? 'text/javascript' : 'text/html')
    r.end(fs.readFileSync(f))
  })
  .listen(5991)
const br = await chromium.launch()
const res = {}
for (const which of ['old', 'new']) {
  const pg = await br.newPage()
  await pg.goto('http://127.0.0.1:5991/bench.html')
  await pg.addScriptTag({ url: which === 'new' ? '/scan.js' : '/scan.old.js' })
  res[which] = await pg.evaluate(() => window.runBench())
  await pg.close()
}
await br.close()
srv.close()
console.log('case'.padEnd(32), 'old'.padEnd(8), 'new'.padEnd(8), 'ms old/new')
let to = 0,
  tn = 0,
  tt = 0
res.old.forEach((o, i) => {
  const n = res.new[i]
  to += o.ok
  tn += n.ok
  tt += o.tot
  console.log(o.name.padEnd(32), `${o.ok}/${o.tot}`.padEnd(8), `${n.ok}/${n.tot}`.padEnd(8), `${o.ms}/${n.ms}`)
})
console.log('TOTAL'.padEnd(32), `${to}/${tt}`.padEnd(8), `${tn}/${tt}`)
if (tn <= to) {
  console.log('NOT BETTER')
  process.exit(1)
}
