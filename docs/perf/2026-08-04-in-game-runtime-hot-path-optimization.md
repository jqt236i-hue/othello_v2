# 対局中ランタイム・ホットパス最適化 実測結果

- 計測日時 (UTC): 2026-08-03T19:30:42.968Z
- candidate commit: `f3dff04725bcfb5a3ae0d6fc2e9140b92b346a7a`
- trajectory baseline commit: `ab8513f6562db0ebf8f5ed45849ef371612f7cd1`
- Node.js: v24.12.0
- CPU: AMD Ryzen 7 9700X 8-Core Processor
- warmup / samples / batch cycles: 30 / 120 / 4

## 合否

| gate | baseline | candidate | reduction | result |
| --- | ---: | ---: | ---: | --- |
| R1 dynamic descriptor / 60 ticks / 8 targets | 26,160 | 0 | 100% | PASS |
| R1 steady tick JS p95 / batch | 10.8795 ms | 0.1334 ms | 98.774% | PASS |
| N1 accepted snapshot deep inspection | 2 | 1 | 50% | PASS |
| N1 accepted snapshot JS p95 / 32-intake batch | 21.4063 ms | 13.587 ms | 36.528% | PASS |

## N2 late-special-20 wire bytes

| viewer | legacy | V2 | reduction | semantic | result |
| --- | ---: | ---: | ---: | --- | --- |
| black | 90,409 | 45,754 | 49.392% | equal | PASS |
| white | 90,427 | 45,763 | 49.392% | equal | PASS |
| spectator | 90,453 | 45,776 | 49.393% | equal | PASS |

## 注記

- R1 baselineは最適化直前revisionのruntimeと同じくlightning pathだけを開始時にprepareし、各tickのclip・descriptor生成を測定した。candidateは8 planを事前compileした後のscalar-only tickを測定した。
- R1 descriptorはline/circle/polygon/spriteの動的descriptor object数であり、V8 heap byte推定ではない。candidateのtickは固定shape scalar stateだけを書き換える。
- N1は16x16・256占有セル・64 markerのauthoritative seat projection。legacy相当のdeep inspect→clone→deep inspectと、cheap envelope gate→clone→deep inspectを同一processで交互に実行し、timer/GCノイズを避けるため複数intakeを1 sampleにまとめた。
- N2はactual late-special-20 headless turn resultとviewer別authority projectionからlive publish envelopeを構築した。journal/frameのfull self-contained形は保持し、wire copyだけをcompactした。

総合結果: **PASS**
