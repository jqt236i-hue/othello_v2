# PixiJS playfield automated pre-cutover runbook

Phase 9 Unit Aのrelease evidenceは、physical device inputや共有workstationの長時間stall 0を要求せず、同一のclean DOM-default candidate commitから自動取得する。

## Evidence policy

- blocking readinessはhardware-accelerated desktop Chromiumだけを使う。
- classic/Vite × DOM/Pixiを別reloadし、public `PlaybackEngine`経路と同一fixture/event digestを使う。
- readinessは短時間raw captureで、Pixiのmodel build/backend同期apply、排他的mount、context、viewport materialization、texture/object/backing lifecycleをfail-closed検証する。raw rAFとDOM/Pixi比率は診断値として保存する。
- 各run 10分、合計約40分のstrict soakは専用計測環境向けoptional diagnosticsである。既存thresholdを緩めずPASS/FAILを保存するが、共有PCのstallだけでUnit Aをfailにしない。
- Chromium/Firefox/WebKitのmobile viewportは機能互換性だけを検証し、実Android/iPhone性能の代替とは呼ばない。
- actual mobile paint/composite、Safari実機GPU、thermal throttlingは未検証のresidual riskとしてreportへ残す。

## Candidate freeze

1. DOM defaultのまま、Phase 9 Unit Aのfocused/browser/network/visual/build/mirror checksを完了する。
2. tooling、正本、生成済みbrowser artifactをcommitし、working treeがcleanであることを確認する。
3. runtime/source/generated artifactを変更した場合は以後のreadiness/cross-platform captureを破棄し、新candidateからやり直す。optional soakはstale candidateとして保持できるが現candidateの証拠へ流用しない。

## Capture and validation

```powershell
npm run match:pixijs-precutover-readiness:capture
npm run match:pixijs-precutover-cross-platform
npm run match:pixijs-precutover-performance:validate -- --write
```

blocking captureは`artifacts/pixijs-playfield-performance/desktop-readiness.json`へ書かれる。validator v3はcandidate SHA、artifact digest、GPU acceleration、4 raw readiness report、summary、Pixi同期measure、排他的mount、lifecycle、cross-platform 12 probeを再検証し、`docs/perf/pixijs-playfield-precutover.json`と`.md`を書き出す。

専用環境でstrict soakを追加取得する場合だけ次を実行する。

```powershell
npm run match:pixijs-board-performance
```

結果は`artifacts/pixijs-playfield-performance/desktop-capture.json`へ書かれる。validatorは存在するsoakをoptional欄で従来どおり厳格に再検証し、PASS/FAIL/stale candidateを記録する。soakの失敗を成功へ変換したり、成功sampleだけを選別したりしない。

Unit Aのreport-only commitにはpre-cutover JSON/Markdownだけを含め、default selectorを変更しない。blocking readinessとcross-platformが`PASS`を示した後だけUnit Bへ進む。

## Optional physical diagnostics

`docs/perf/pixijs-playfield-mobile/`のprobe、reference manifest、LAN host、raw import toolingは任意の補強診断として保持する。physical reportがなくてもUnit Aをfailにしない。physical resultが存在してもautomated gateの失敗を上書きしない。
