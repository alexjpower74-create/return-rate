# Build report — c2 · Customer app

Branch `rig/c2`. Owns `app/**`. Date 2026-09-13.

Note: `.rig/BRIEF.md` said "(none stated in the plan)" for my task, but PLAN.md's c2 section states it in full. I built the PLAN.md task.

## What I built — DONE
- `app/index.html`, `styles.css`, `app.js`, `api.js`, `api.mock.js`, `scan.js`. Plain HTML/JS/CSS, no build. White ground, ink `#101418`, depot green `#1f7a3a`, muted `#5b6670`, rule `#d9dee3`, system fonts, 390-first.
- Screens: Start (camera view, "Type the number" always visible, "If we don't know an item, we say so."); Answer (refund is the biggest text: "5¢" / "10¢" / "No refund"; brewer class shows "Ask at the counter", never a cents figure; then name and size, class in words, the Worker's one-sentence why, the fixed money line, "Scan another"); Unknown (the honest sentence, no cents figure anywhere, money line, "Scan another"); Camera-refused (a note in the camera box, the typed field focused, nothing dead); Offline (also covers 429 "too many scans", with "Try again" and "Scan another"); Busy.
- The refund text is never computed in the app. It shows `refund_cents` from the API for `regular`/`liquor` only; `none` → "No refund"; `brewer` → "Ask at the counter"; any other class is not shown as a refund. Class words are the three fixed sentences from PLAN.md; for `none` the Worker's `why` sentence is shown so non-milk exclusions are honest too.
- "The counter's count is the one that pays." is a fixed element on Answer, Unknown and Offline.
- `api.js`: `GET <api-base>/item/:upc` (base from `<meta name="api-base">`, default `http://localhost:5902`; **Main fills the deployed URL**). 8 s timeout, `navigator.onLine` check, maps 200/404/429/400/other to known/unknown/busy/bad/offline.
- `api.mock.js` (`?mock=1`): SYNTHETIC numbers 0000000000017 (5¢ pop, plastic), 0000000000024 (10¢ wine, glass), 0000000000031 (unknown), plus 0000000000048 (milk, no refund), 0000000000055 (brewer), 0000000000062 (pretends offline). Cents mirror docs/RULES.md; none are real products.
- `scan.js`: `BarcodeDetector` (ean_13, upc_a, upc_e, ean_8) when present, else `@zxing/library` UMD over `getUserMedia`. One scan fires once (the reader stops after a hit; the same code within 2.5 s is ignored). `?camera=off` skips the camera (tests only).
- **Deviation:** `@zxing/library` is not on cdnjs (checked 2026-09-13, cdnjs search returns nothing). It is pinned from jsDelivr: `https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js`. If a cdnjs-only rule matters for the deployed CSP, the file can be vendored into `app/` instead; say so and I will.

## Tests — `app/tests/app.spec.js`, DONE
Own config `app/tests/playwright.config.js` (root config and package.json are c4's), own `app/tests/package.json` with Playwright 1.63 installed locally. Run: `cd app/tests && npm install && npm test`. Static server on 5901, chromium + webkit at 390x844, mock API.

19 passed, 1 skipped (the granted-camera positive control runs only on chromium), both engines:
- Each SYNTHETIC number typed with real keyboard events (`page.keyboard.type` + Enter), the right screen appears, the refund text is the largest computed font on the page (every visible element compared), name and class words present, money line present, every visible button hit-tested with `document.elementFromPoint` at its centre.
- Unknown: honest sentence, no "¢" anywhere on the screen, money line, "Scan another" returns to a cleared Start.
- Spaces in a typed number are accepted; a 4-digit number gets a plain-English error and stays on Start.
- Offline (SYNTHETIC): its own screen, money line, buttons hit, way back.
- Camera refused: a fresh context with no camera permission; the note appears and the typed path still answers 5¢. On WebKit the browser raises a real `NotAllowedError`, so the exact "Camera is off" wording is asserted there. **Headless Chromium cannot refuse:** it returns `NotSupportedError: Not supported` whatever the permission state (probed with and without `--use-fake-device-for-media-stream`, `--deny-permission-prompts`), so on chromium the check only proves the fallback is offered. Positive control: chromium launched with `--use-fake-ui-for-media-stream` grants the camera, the note stays hidden and `video.srcObject` is live.

### What would make it red, and did
- Negative control (required by PLAN.md): deleted the `.money` line from the Answer section in `index.html`, ran chromium: 4 failed (all four answer tests, `toHaveText` on the money line), 6 passed. Restored; 19 passed again.
- Found by the tests, not by me: the camera note had `display: grid` which beat the `hidden` attribute, so an empty note was "visible". Fixed with `[hidden] { display: none !important; }`; the granted-camera control was what caught it.
- Refund-largest-font check compares against every visible element, so a bigger heading anywhere would fail it.

Screenshots: `app/tests/shots/` (start, four answers, unknown, offline, camera-refused; chromium and webkit).

## Left undone / needs another slice
- Not verified against the real Worker (c1 is on its own port; I never grade the shared tree). `api.js` follows docs/API.md as written; c4's live round-trip is the check.
- Main: set `<meta name="api-base">` in `app/index.html` to the deployed Worker URL, and confirm CORS on GET.
- Live camera scanning was not exercised on a phone: no real device here. BarcodeDetector path and the ZXing path both run without errors in the granted-camera test (fake device), but no barcode was decoded from a real label. Alexander: open the deployed app on an Android phone (BarcodeDetector) and an iPhone (ZXing) and scan one shelf item.
- Cross-review requested: c4's plain-English sweep over these screens. Words I used that might trip a banned-word list: "barcode", "number", "signal". None of "guaranteed", "you will get", "payout" appear (`grep -ri` over `app/*.html app/*.js` is clean).
