# PixiJS playfield performance recheck (2026-10-12)

- Role: 2026-07-18 の移行完了後に Pixi 経路へ入った約 100 件の変更を踏まえた、desktop 性能の再計測記録。移行完了判定（[pixijs-playfield-completion.md](pixijs-playfield-completion.md)）を置き換えるものではない。
- Source commit: `75e6a12b4`（`Kansoku111/ネット`。捕獲石の表示修正、特殊破壊の着弾形、DOM 専用演出の互換層への移動を含む）
- Method: source commit の clean export で `build:vite` と Worker mirror を作り、`node dist/scripts/capture-pixijs-playfield-performance.js`（standard desktop run, quick ではない）を実行した。
- Environment: Windows x64, Chromium 143.0.7499.4, NVIDIA GeForce RTX 2070（ANGLE D3D11, hardware accelerated）, 1366x900, DPR 1。Phase 0 baseline との環境一致チェックは PASS。
- Summary data: [pixijs-playfield-recheck-2026-10-12.json](pixijs-playfield-recheck-2026-10-12.json)。raw capture（17 MB）は `artifacts/pixijs-playfield-performance/desktop-capture-2026-10-12.json`（repo 外データ、Git 管理外）。
- Gate result: **FAIL**（下記 3 種）。Pixi のフレーム時間そのものの退行は見つからなかった。

## Pixi frame results

classic / vite の両 lane で、basic と全 heavy シナリオの Pixi rAF p95 は 16.7〜16.8 ms（60 fps 相当）、jank 0、50 ms 超の stall 0。micro（16x16 full marker）の model / apply / hit-test も 50 ms 未満。

## Failed checks

| Check | Lane | 2026-10-12 | 2026-07-18 readiness | 判断 |
| --- | --- | --- | --- | --- |
| `heavy.destroy-source-8x8.wholeTurnSettlementMs.dom-comparison` | classic / vite | DOM 1084.9 / Pixi 1200.8 ms | DOM 1160.5 / Pixi 1200.3 ms | Pixi は 7 月と同値。DOM fallback 側が短くなったため 5% 許容を外れた。Pixi の退行ではない |
| `heavy.destroy-spawn-8x8.presentationStartLatencyMs.dom-comparison` | classic | DOM 15.5 / Pixi 16.4 ms | DOM 4 / Pixi 16.3 ms（7 月も FAIL） | 1 frame 未満の差。7 月から既知 |
| `stability.pixi-stall50` | classic / vite | 1 / 4 回（10 分、約 36,000 frame、最大 83 ms） | 0 回 | 同じ run の DOM は 37 / 1478 回で、計測中の共有 workstation 負荷の影響が大きい。単発の stall で、連続した詰まりではない |
| `stability.dom-stall50` | classic / vite | 37 / 1478 回 | 1 回（7 月も FAIL） | DOM fallback 側。通常経路ではない |

## Residual risk

- stability の Pixi 単発 stall は、負荷の少ない状態での再計測で 0 に戻るかを確認していない。
- physical Android Chrome、iPhone Safari 実機 GPU、paint/composite、thermal throttling、battery/power mode は引き続き未計測。
- 本計測は desktop 1 台の結果で、Playwright WebKit / Firefox の性能は測っていない。
