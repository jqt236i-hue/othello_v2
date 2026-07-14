# Browser runtime modernization completion (2026-07-14)

- Status: PASS
- Scope: phases 0–11 in `docs/implementation/browser-runtime-modernization-plan.md`
- Player-visible rules, CPU decisions, animation order, and card behavior: unchanged
- Player-visible additions: accessible loading/retry status for lazily loaded optional controls and a mobile quick-control clearance fix
- Default entry: registry-free Vite/ESM; `index.classic.html` remains the explicit rollback entry

## Delivered boundaries

1. A repeatable classic baseline records boot, CPU action/score, presentation, and visual digests.
2. All bundled fonts ship as WOFF2. Runtime-corpus subsets load first and exact full WOFF2 faces remain as arbitrary-glyph fallback.
3. A production Vite/ESM entry boots through the checked compatibility adapter and is compared automatically with classic.
4. Gacha, cosmetic, leaderboard, commentary, CPU, and ONNX optional groups load independently with dedupe and retry.
5. CPU base candidate scoring has one versioned, deterministic, headless authority shared by local and Worker execution.
6. Vite ONNX inference runs in a lazy Dedicated Worker. Vector construction, result interpretation, tactical refinement, and move authority remain on their existing owners.
7. On the Vite lane, eligible Lv3–5 normal-placement candidate scoring uses the same Worker, with epoch/turn/state/digest validation and exact local fallback.
8. Additional image conversion remains limited to objectively smaller, opaque, lossless background assets.
9. Optimized backgrounds are decoded before selection, so normal delivery fetches WebP only and requests the original PNG only after optimized decode failure.
10. The default document is built from 611 startup modules into Vite-owned hashed chunks and does not request `public/runtime.js` or `public/module-registry*.js`; the classic document retains those artifacts for rollback.
11. Cross-engine, mobile-touch, production CSP/MIME/cache, asset-delivery, optional-retry, and post-start Worker-failure gates cover the final delivery path.

Vite owns the shipped default module code and chunk graph. A generated interop bridge preserves existing string-ID/CommonJS export semantics during source migration, but it stores import accessors rather than module source or runtime-evaluated factories. This completion therefore means registry-free delivery, not that every source file has already been rewritten as idiomatic native ESM.

## Asset result

| Asset set | Before | Optimized | Saved |
| --- | ---: | ---: | ---: |
| 12 full WOFF2 faces vs runtime subsets | 20,045,160 B | 2,106,448 B | 17,938,712 B |
| 13 selected opaque PNG backgrounds vs lossless WebP | 28,468,134 B | 21,980,076 B | 6,488,058 B |
| Aggregate optimized-variant transfer delta | — | — | 24,426,770 B |

- The aggregate delta compares each optimized variant with its retained original. It is not a deployed-artifact-size reduction or one startup-session transfer measurement: full WOFF2/PNG fallbacks remain, and all 12 font faces plus 13 backgrounds are not fetched together during normal startup.
- The default Shippori Mincho 400/700/800 subsets total 652,532 B; their full faces total 9,511,624 B.
- Initial font requests contain only those three default subset faces. Full faces are fetched only when a supported glyph absent from the subset is requested.
- The fallback probe `丈` loads exactly one matching full face; an unsupported emoji does not cause a full Japanese font download.
- WebP outputs decode to byte-identical RGBA. PNG fallback and stored skin IDs remain unchanged.
- No AVIF variant was accepted or shipped; the committed deterministic conversion gate currently emits lossless WebP only.

## Exact behavior gates

- CPU score digest: `af20344345f7eacb3b2783f4f8132637bcde64e3fff3f8cca686d4cb0feb85a0`
- CPU action digests:
  - `b590bf6f03e0930995b30bf9b9ef8b311ebd19f2b69499f729cd320c761486bd`
  - `b590bf6f03e0930995b30bf9b9ef8b311ebd19f2b69499f729cd320c761486bd`
  - `9060ad138a36a15b3b4e8fc904f8c0b1591ed32d33bceca279d7511de7a53139`
  - `393c7b8bb7c831399f5614224c506545c97e1d246209ac4b55386f17f66edf40`
- Classic/Vite ONNX output digest: `71ad4edd249fb18f7eb57eeaa1e98caef44e1e72dbed47af44396f9403a31a15`
- Classic/Vite ONNX selected move: row 4, column 5
- Classic/Vite fixture digest: `52d06b8d2c4b222134624ac544745a01a89642bd0c5943c405fbd8aef5c8f80d`
- Tracked visual baseline SHA-256: `66e848b37b311e1d37ebcc340653a2c80a0458ad6d37439d635deb16e4050b75`
- Classic/Vite comparison screenshot: 0 differing pixels
- Full visual regression: 0 differing pixels (threshold 4,000)

Timing values remain same-machine observations rather than acceptance thresholds. Three alternating cold runs produced median UI readiness of 1,813 ms for Classic and 1,999 ms for Vite; median DOMContentLoaded was 1,423 ms versus 553 ms and median load was 1,569 ms versus 776 ms. Median initial transfer was 35,394,467 B versus 31,447,320 B, a reduction of 3,947,147 B. All three runs passed the exact state and visual gates; the raw samples and resource lists are stored in `docs/perf/2026-07-14-browser-lane-comparison.json`.

## Final verification

| Check | Result |
| --- | --- |
| `npm run checkall` | PASS |
| `npm run test:network:parity` | PASS — 34 suites, 522 tests |
| Modernization-focused Jest selection | PASS — 37 suites, 197 tests |
| Classic and Vite UI-control smoke | PASS — six controls each, no page/console/resource errors |
| Optional feature browser smoke | PASS — six isolated groups plus forced first-failure/distinct-request retry |
| Asset delivery browser smoke | PASS — WOFF2 only, no registry, WebP-only success path, single-PNG fallback path |
| ONNX/candidate Worker browser smoke | PASS — shared Worker, exact output, exact fallback |
| Post-disable ONNX fallback component tests | PASS — terminal Worker client, executor detach, one-time main-thread ORT activation |
| Classic and Vite CPU auto-response E2E | PASS |
| Classic and Vite font subset/full fallback E2E | PASS |
| Classic/Vite repeated cold comparison | PASS — three runs per lane, exact state digest, 0 differing pixels each run |
| Cross-platform browser smoke | PASS — Chromium, Firefox, WebKit, Chromium Pixel 7/touch |
| Production delivery smoke | PASS — CSP, MIME, cache headers, Dedicated Worker, ONNX model and WASM |
| Mobile quick-control touch | PASS — target center unobscured and real touchscreen tap accepted |
| `npm run test:visual` | PASS — 0 differing pixels |
| Asset deterministic check | PASS — 12 font pairs and 13 backgrounds |
| Worker mirror | PASS — 881 files |

## Retry notes

- The first post-disable fallback test waited on a real JSDOM script element because its injected loader reached feature adapters but not the explicit ORT fallback. Routing the same dependency into both paths removed the wait; all four focused suites then passed (27 tests).
- One ONNX Worker smoke run launched beside two other Chromium suites exceeded the 48 ms cold candidate-scoring budget and correctly used the exact local scorer. The isolated rerun exercised Worker scoring and passed with the same candidate/ONNX digests.
- The first Vite font E2E wait used the wrong Playwright `waitForFunction` argument position. Correcting the harness signature made Classic and Vite pass.
- The first CPU auto-response two-lane attempts treated hidden settings `<option>` elements as visible controls. The fixture now sets the hidden configuration through its DOM event contract; both lanes pass.
- A temporary per-turn Worker-request assertion was removed because Worker scoring eligibility intentionally depends on the resulting policy path and filtered candidate count. Worker transport and actual CPU move-phase injection remain covered by the dedicated browser smoke and focused move-phase tests.
- Earlier focused retries corrected a stale public-API expected list and a smoke fixture missing the new CPU-scoring injection capability; no production behavior was weakened to make a test pass.
- The first default-Vite boot exposed two stale compatibility lookups (`CardExpansion` and a timer module); the source lookups were corrected and the standalone build, both UI-control lanes, and all browser smokes then passed.
- The first production-delivery probe classified a document fallback as a valid module response. The probe now validates content type and response body; CSP/MIME/cache/Worker/WASM delivery passes without fallback responses.
- The first Pixel 7 touch run found the quick-control tray overlapping its target. Increasing the mobile clearance and using an actual touchscreen tap removed the overlap and passed the geometry assertion.
- A final Vite build launched concurrently with an asset scan saw a transient generated-module scan race. The isolated build and both later deterministic builds (`worker:prepare` and `checkall`) passed.
- The aggregate `npm run test:jest` command remained CPU-active beyond 20 minutes in this environment and was stopped without a reported assertion failure. The task-owned focused selection (197 tests), complete network parity suite (522 tests), dependency-boundary test in `checkall`, and browser/visual gates all completed successfully.

## Commit sequence

- `af1850f4a` — design and implementation plan
- `20a198b72` — baseline
- `48326b789` — full WOFF2 and first large backgrounds
- `546ad9a37` — Vite comparison lane
- `0936ece62` — optional feature groups
- `227b11e00` — pure CPU scoring boundary
- `527d61b69`, `73a43f9dd` — ONNX Worker and hardened fallback/cancellation
- `f70c85f8d` — candidate scoring in the shared Worker
- `f0ab11733` — subset fonts and additional safe background WebP
- Final residual fixes, registry-free default cutover, delivery evidence, and mirror sync — this document's enclosing commit

## Residual compatibility posture

- Vite is the default delivery lane. Classic remains available at `index.classic.html` for explicit rollback and is verified by the same UI-control smoke.
- The exact local scorer remains available whenever Dedicated Worker creation is unavailable. If main-thread ORT/WASM is permitted, ONNX uses the in-thread path; if the page policy blocks that runtime too, the existing CPU policy/table/heuristic fallback remains.
- Full WOFF2 and original PNG assets remain available as runtime fallback.
- CPU authority, move application, network publication, presentation ordering, and replay state remain outside the Worker.
- The primary Vite startup chunk is 3,502.02 kB (876.30 kB gzip), so the build retains Vite's over-500-kB advisory. Six optional groups are already split; further startup splitting can be measured as a later optimization without changing this completed compatibility cutover.
