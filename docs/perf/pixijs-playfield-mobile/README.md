# PixiJS playfield optional physical performance capture

This directory is an optional physical-device diagnostic surface. It does not define the product's minimum supported device and, after the 2026-07-18 operator decision, it is not a Phase 9 Unit A release gate. The automated release evidence is documented in `../pixijs-playfield-automated-precutover.md`.

## Optional entry conditions

When optional physical diagnostics are requested, replace every empty value in `reference-devices.json` with observed values from one physical Android/Chrome device and one physical iPhone/Safari device, then set each `ready` field to `true` before those optional captures.

To collect browser-reported screen, viewport, DPR, orientation, and user-agent values before freezing the manifest, run `npm run match:pixijs-board-performance -- --probe-host 0.0.0.0`, open the printed probe URL on each phone, establish the intended address-bar/orientation state, and use `Copy JSON`. This probe is preparation only and is not performance evidence.

Record all of the following exactly:

- device model;
- OS version and build;
- browser name and full version;
- CSS screen width/height;
- CSS viewport width/height with the address-bar state used for every capture;
- device-pixel ratio;
- refresh-rate setting;
- orientation;
- power mode and battery-saver state.

Do not replace a device after seeing results. A device change requires a reviewed manifest change and all four physical reports to be recaptured.

## Freeze the DOM-default candidate

1. Keep the default board selector on DOM.
2. Run all Phase 9 Unit A automated, browser, network, visual, build, and mirror checks.
3. Run `npm run match:pixijs-board-performance` to capture the standard desktop classic/Vite × DOM/Pixi report. The command refuses a dirty checkout.
4. Commit the tooling, populated reference-device manifest, and generated browser artifacts. Do not include performance results in this candidate commit.
5. Run `npm run match:pixijs-board-performance` again from that clean exact commit and retain `artifacts/pixijs-playfield-performance/desktop-capture.json`.

The desktop capture must report the full candidate SHA and `browserArtifactSha256`. The artifact digest is SHA-256 over UTF-8 stable JSON containing path-sorted `{ path, sha256 }` entries for every file served from `worker-public`; host names and timestamps are excluded.

On Windows, the desktop capture pins headless Chromium to ANGLE D3D11 and records the effective GL renderer, vendor, display type, feature status, GPU devices, and driver versions under `environment.graphics`. The command fails closed if Chromium falls back to SwiftShader or another software renderer; software WebGL is not representative evidence for the production Pixi path.

Any runtime, source, or generated-browser-artifact change after this point invalidates every desktop and physical report.

## Start the read-only LAN host

From the clean candidate commit, run:

```powershell
npm run match:pixijs-board-performance -- --manual-host 0.0.0.0
```

The command prints:

- candidate commit SHA;
- browser artifact SHA-256 and file count;
- SHA-derived capture order;
- exact Vite DOM and Pixi URLs for each reference device.

The browser checks both the metadata endpoint and the artifact digest response header. `Run Suite` remains unavailable if they disagree. This host serves the production Vite artifact read-only; it does not create a network room, restore a seat token, or read a saved match/profile.

## Capture each physical report

For each reference device:

1. Match the manifest orientation, refresh setting, power mode, battery-saver state, and browser address-bar/viewport state.
2. Close other heavy applications and let the device cool at room temperature.
3. Open the first URL printed for that device. Do not choose the backend order manually.
4. Keep the page visible and focused. The page enforces a five-minute cool-down before enabling `Run Suite`.
5. Select `Run Suite` once. Keep the page visible for the complete suite, including the ten-minute expansion/skin stability loop.
6. Select `Export JSON`. Where supported, save/share the generated File using Web Share; otherwise use the downloaded Blob file. The fallback object URL is revoked after the download starts.
7. Close the page, cool the device again, then open the second printed URL and repeat.

Do not use desktop emulation, CPU throttling, Playwright WebKit, or a simulator as physical evidence. A visibility/focus change, context loss, incomplete ten-minute interval, nonstandard sample count, missing raw rAF data, or manual JSON edit invalidates the report.

The generated filename is:

```text
pixijs-playfield-<reference-device-id>-<dom|pixi>-<reportId>.json
```

The `reportId` is the same UUID v4 inside the JSON. Do not rename the file.

## Import and validate

Transfer exactly four files—Android DOM/Pixi and iPhone DOM/Pixi—to a workstation directory. Then run:

```powershell
npm run match:pixijs-mobile-performance:validate -- `
  --reports-dir <import-directory> `
  --desktop-report artifacts/pixijs-playfield-performance/desktop-capture.json
```

After a clean validation pass, write the report-only evidence:

```powershell
npm run match:pixijs-mobile-performance:validate -- `
  --reports-dir <import-directory> `
  --desktop-report artifacts/pixijs-playfield-performance/desktop-capture.json `
  --write
```

The validator independently recomputes nearest-rank p50/p95/p99/max, jank ratio, 50 ms stalls, nominal median, first/last two-minute stability summaries, lifecycle steady-state values, capture order, environment identity, and every performance gate. It hashes each imported raw report and records those hashes in `pixijs-playfield-precutover.json`. Long Animation Frame or Long Task support may be `unsupported`; raw rAF intervals remain mandatory.

`presentationStartLatencyMs` runs from public `PlaybackEngine` dispatch to the first subsequent `requestAnimationFrame` presentation opportunity. Harness setup completes first, then every measured dispatch starts inside a common rAF callback so DOM/Pixi are compared from the same frame-cycle phase; a missed next frame remains visible as start latency. Board-local time begins when `PlaybackEngine` hands the batch to its selected presentation executor and continues through `playBoardVisualPhase` settlement, so planner work, Pixi capability preflight, source-snapshot preparation, and renderer GC remain attributed to the board rather than hidden inside global DOM/HUD time. The optional attribution hook is absent during normal play and does not change `events[]` or executor order.

Commit only the four imported raw reports plus `pixijs-playfield-precutover.json` and `.md` as the Unit A report-only commit. Do not change the default selector in Unit A.

## Invalid evidence and restart rules

- If any candidate/artifact/fixture/event digest differs, discard all reports.
- If any source, runtime, or generated artifact changes, return to candidate freeze and recapture desktop plus all four physical reports.
- If a reference device changes, update and commit the manifest before measurement, then recapture all reports.
- Do not loosen a threshold, remove a raw sample, winsorize data, shorten an animation, or expand Pixi ownership into HUD/card UI to obtain a pass.
- Optional physical results never override an automated gate failure and are not required before Unit B.
