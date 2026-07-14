# Classic rollback / Vite default browser lane comparison (2026-07-14)

- Status: PASS
- Captured at: 2026-07-14T07:13:07.245Z
- Node: v24.12.0
- Cold runs per lane: 3
- Timing and transfer values are medians from fresh browser processes on the same machine, not universal performance thresholds.

## Startup comparison

| lane | median UI ready (ms) | ready samples (ms) | median resources | median transfer bytes | median decoded bytes | scripts |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| classic | 1813 | 1968, 1813, 1786 | 123 | 35394467 | 35357567 | 4 |
| vite | 1999 | 1999, 2152, 1927 | 127 | 31447320 | 31408920 | 5 |

## Correctness gates

- Required globals and DOM contract: match
- Fixture state digest: `52d06b8d2c4b222134624ac544745a01a89642bd0c5943c405fbd8aef5c8f80d`
- Board screenshot: 352x353, 0 differing pixels
- Classic optional registry at startup: false
- Vite optional registry at startup: false
- Vite compatibility registry at startup: false
- Vite optional payload at startup: false
- Classic ONNX runtime at startup: false
- Vite ONNX runtime at startup: false
- Vite hashed ESM entry: /vite-dist/assets/index.vite-BvTk0iLw.js

## Evaluation

All exact behavior and presentation gates passed.
