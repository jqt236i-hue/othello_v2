# PixiJS playfield final cutover evidence

- Result: **PASS**
- Unit A report commit: `79d694155fbc4838ab024e9c2bfc48e477e272a2`
- Deployed Unit B commit: `f2fd541ad4b63d57872e8c0f7f5258dadffe6dba`
- Production URL: <https://card.reversi-0.workers.dev>
- Browser artifact SHA-256: `2ca0ed925229ef1e8da186054900e85b13f6ff89af87e571e27f18b97e0cbc43`
- Worker version: `e2acc82d-f533-40cb-87f3-57ce4fabd2de` (686)
- Deployment: `b505ed26-03fe-4953-b09e-885c9f3fd874`, 100% traffic
- Deployed at: 2026-07-18T14:56:15.262554Z
- Recorded at: 2026-07-18T15:07:41.293Z

## Production smoke

| Check | Result | Evidence |
| --- | --- | --- |
| boot | PASS | Vite/Pixi, canvas 1, DOM cell 0, HTTP 200 |
| local move / CPU move | PASS | C4-equivalent input, turn 0 to 2, Pixi remained exclusive |
| network authority / reconnect | PASS | create, join, authenticated rejoin, SSE, publish, state projection, leave |
| network match completion | PASS | 60 moves, 3 passes, game over, post-completion rejoin |
| major special effects | PASS | destroy hybrid, theory incarnation, manifest ending, expansion, shrink |
| skin switch | PASS | `bluegreen-felt` to `emerald-stone`, one Pixi canvas retained |
| mobile-width scroll | PASS | action bar, quick controls, and hand horizontal scroll reached their maxima |
| forced DOM fallback | PASS | exact debug query mounted 64 DOM cells and no canvas; local/CPU move completed |
| normal DOM query | PASS | `boardRenderer=dom` without `debug=1` stayed on Pixi |
| supported browser bundle | PASS | Chromium, Firefox, WebKit each booted Vite/Pixi with canvas 1 / DOM cell 0 |
| deployed artifact identity | PASS | index, Vite entry bundle, module registry, and board texture matched local SHA-256 |

The first Firefox pass logged image-truncated messages. A focused retry fetched the complete 3,250,918-byte texture, decoded it as 1254x1254, rendered it, and reported texture failure count 0 and context-recovery loss count 0. Existing Firefox subset-font and renderer-probe warnings were observed but did not affect the active board context.

The first special-effect page logged two URL-less 404 messages. A repeat of theory-incarnation and manifest-ending with non-2xx response capture reported no HTTP or console errors. Both observations are retained in the JSON report rather than discarded.

## Residual risk

- The optional 4x10-minute strict soak remains historical-candidate-fail; it is not a blocking shared-workstation gate.
- Physical Android Chrome and iPhone Safari paint/composite, actual iPhone GPU behavior, thermal throttling, and battery/power-mode behavior remain unmeasured.
- Playwright WebKit is functional compatibility evidence, not physical Safari performance evidence.

This report changes no player-visible behavior, `events[]` ordering, network authority, or Single Visual Writer ownership. Phase 9 is complete only as the ordered Unit A evidence, Unit B default/deployment, and this Unit C report-only commit.
