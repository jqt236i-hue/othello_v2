# Classic / Vite browser lane comparison (2026-07-13)

- Status: PASS
- Captured at: 2026-07-13T23:21:23.283Z
- Node: v24.12.0
- Timing and transfer values are same-machine observations, not universal performance thresholds.

## Startup comparison

| lane | UI ready (ms) | resources | transfer bytes | decoded bytes | scripts |
| --- | ---: | ---: | ---: | ---: | ---: |
| classic | 913 | 123 | 35361452 | 35324552 | 4 |
| vite | 859 | 127 | 35722954 | 35684854 | 6 |

## Correctness gates

- Required globals and DOM contract: match
- Fixture state digest: `52d06b8d2c4b222134624ac544745a01a89642bd0c5943c405fbd8aef5c8f80d`
- Board screenshot: 352x353, 0 differing pixels
- Classic optional registry at startup: false
- Vite optional registry at startup: false
- Classic ONNX runtime at startup: false
- Vite ONNX runtime at startup: false
- Vite hashed ESM entry: /vite-dist/assets/index.vite-DqnnDAkz.js

## Evaluation

All exact behavior and presentation gates passed.
