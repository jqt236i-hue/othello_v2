# Browser runtime modernization completion (2026-07-14)

- Status: PASS
- Scope: phases 0–8 in `docs/implementation/browser-runtime-modernization-plan.md`
- Player-visible rules, timing contracts, text, and card behavior: unchanged
- Default entry: classic remains available; the Vite lane is additive and rollbackable

## Delivered boundaries

1. A repeatable classic baseline records boot, CPU action/score, presentation, and visual digests.
2. All bundled fonts ship as WOFF2. Runtime-corpus subsets load first and exact full WOFF2 faces remain as arbitrary-glyph fallback.
3. A production Vite/ESM entry boots through the checked compatibility adapter and is compared automatically with classic.
4. Gacha, cosmetic, leaderboard, commentary, CPU, and ONNX optional groups load independently with dedupe and retry.
5. CPU base candidate scoring has one versioned, deterministic, headless authority shared by local and Worker execution.
6. Vite ONNX inference runs in a lazy Dedicated Worker. Vector construction, result interpretation, tactical refinement, and move authority remain on their existing owners.
7. On the Vite lane, eligible Lv3–5 normal-placement candidate scoring uses the same Worker, with epoch/turn/state/digest validation and exact local fallback.
8. Additional image conversion remains limited to objectively smaller, opaque, lossless background assets.

The Vite lane still loads the canonical registry through a compatibility adapter. This program intentionally establishes a measured parallel ESM lane and feature-level dynamic imports; it does not claim that every canonical CommonJS-style module has already become a native ESM module.

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

Timing values remain same-machine observations rather than acceptance thresholds. The final no-write classic boot sample reported network-mode readiness at 875 ms; repeated Classic/Vite comparisons passed all exact gates despite normal run-to-run timing variation.

## Final verification

| Check | Result |
| --- | --- |
| `npm run checkall` | PASS |
| `npm run test:network:parity` | PASS — 34 suites, 522 tests |
| Modernization-focused Jest bundle | PASS — 32 suites, 197 tests |
| Font/background focused Jest bundle | PASS — 5 suites, 52 tests |
| Classic and Vite UI-control smoke | PASS — six controls each, no page/console/resource errors |
| Optional feature browser smoke | PASS — six isolated groups plus failure/retry |
| ONNX/candidate Worker browser smoke | PASS — shared Worker, exact output, exact fallback |
| Post-disable ONNX fallback component tests | PASS — terminal Worker client, executor detach, one-time main-thread ORT activation |
| Classic and Vite CPU auto-response E2E | PASS |
| Classic and Vite font subset/full fallback E2E | PASS |
| Boot performance and no-write baseline capture | PASS |
| Classic/Vite comparison | PASS |
| `npm run test:visual` | PASS — 0 differing pixels |
| Asset deterministic check | PASS — 12 font pairs and 13 backgrounds |
| Worker mirror | PASS — 878 files |

## Retry notes

- The first post-disable fallback test waited on a real JSDOM script element because its injected loader reached feature adapters but not the explicit ORT fallback. Routing the same dependency into both paths removed the wait; all four focused suites then passed (27 tests).
- One ONNX Worker smoke run launched beside two other Chromium suites exceeded the 48 ms cold candidate-scoring budget and correctly used the exact local scorer. The isolated rerun exercised Worker scoring and passed with the same candidate/ONNX digests.
- The first Vite font E2E wait used the wrong Playwright `waitForFunction` argument position. Correcting the harness signature made Classic and Vite pass.
- The first CPU auto-response two-lane attempts treated hidden settings `<option>` elements as visible controls. The fixture now sets the hidden configuration through its DOM event contract; both lanes pass.
- A temporary per-turn Worker-request assertion was removed because Worker scoring eligibility intentionally depends on the resulting policy path and filtered candidate count. Worker transport and actual CPU move-phase injection remain covered by the dedicated browser smoke and focused move-phase tests.
- Earlier focused retries corrected a stale public-API expected list and a smoke fixture missing the new CPU-scoring injection capability; no production behavior was weakened to make a test pass.

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

## Residual compatibility posture

- Classic remains the default rollback lane.
- The exact local scorer remains available whenever Dedicated Worker creation is unavailable. If main-thread ORT/WASM is permitted, ONNX uses the in-thread path; if the page policy blocks that runtime too, the existing CPU policy/table/heuristic fallback remains.
- Full WOFF2 and original PNG assets remain available as runtime fallback.
- CPU authority, move application, network publication, presentation ordering, and replay state remain outside the Worker.
