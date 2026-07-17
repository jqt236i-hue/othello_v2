# PixiJS playfield automated pre-cutover runbook

Phase 9 Unit Aのrelease evidenceは、physical device inputを要求せず、同一のclean DOM-default candidate commitから自動取得する。

## Evidence policy

- performance判定はhardware-accelerated desktop Chromiumだけを使う。
- classic/Vite × DOM/Pixiを別reloadし、public `PlaybackEngine`経路と同一fixture/event digestを使う。
- 各runの`stability.expansion-skin`は10分で、合計約40分かかる。
- Chromium/Firefox/WebKitのmobile viewportは機能互換性だけを検証し、実Android/iPhone性能の代替とは呼ばない。
- actual mobile paint/composite、Safari実機GPU、thermal throttlingは未検証のresidual riskとしてreportへ残す。

## Candidate freeze

1. DOM defaultのまま、Phase 9 Unit Aのfocused/browser/network/visual/build/mirror checksを完了する。
2. tooling、正本、生成済みbrowser artifactをcommitし、working treeがcleanであることを確認する。
3. runtime/source/generated artifactを変更した場合は以後のcaptureを破棄し、新candidateからやり直す。

## Capture and validation

```powershell
npm run match:pixijs-board-performance
npm run match:pixijs-precutover-performance:validate -- --write
```

captureは`artifacts/pixijs-playfield-performance/desktop-capture.json`へ書かれる。validatorはcandidate SHA、artifact digest、GPU acceleration、4 raw report、raw rAF、summary、10分stability、lifecycleを再検証し、`docs/perf/pixijs-playfield-precutover.json`と`.md`を書き出す。

Unit Aのreport-only commitにはpre-cutover JSON/Markdownだけを含め、default selectorを変更しない。両reportが`PASS`を示した後だけUnit Bへ進む。

## Optional physical diagnostics

`docs/perf/pixijs-playfield-mobile/`のprobe、reference manifest、LAN host、raw import toolingは任意の補強診断として保持する。physical reportがなくてもUnit Aをfailにしない。physical resultが存在してもautomated gateの失敗を上書きしない。
