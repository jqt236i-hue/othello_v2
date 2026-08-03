# 対局中ランタイム最適化 ブラウザ性能検証

- 実施日: 2026-08-04 (JST)
- candidate commit: `0274e7e65d8f1ca2e79fffec5cbad0343051db81`
- browser artifact SHA-256: `c3eb10e4d5638a3113fa82b176ed32b2675c9a203038fb4d6879c56d8414b42a`
- raw artifact: `artifacts/pixijs-playfield-performance/in-game-hot-path-2026-08-04-standard.json`
- 判定: heavy scenarioは合格。標準長時間測定のclassic laneだけ環境干渉を検出し、同条件の単独再測定で合格

## 1. 環境

| 項目 | 値 |
| --- | --- |
| OS / runtime | Windows x64 / Node.js v24.12.0 |
| browser | Chromium 143.0.7499.4 |
| viewport / DPR | 1366 × 900 / 1 |
| GPU | NVIDIA GeForce RTX 2070 |
| renderer | ANGLE D3D11、hardware acceleration有効 |

raw artifactは容量が大きいためGit管理外の `artifacts/` に置く。artifactにはcandidate commit、配信物のhash、fixture / event digest、各raw RAF interval、lane別comparisonが含まれる。

## 2. Quick capture

`node dist/scripts/capture-pixijs-playfield-performance.js --quick --allow-dirty --output artifacts/pixijs-playfield-performance/in-game-hot-path-2026-08-04.json` を実行した。

- 全heavy Pixi scenarioのRAF p95は16.7 ms、最大16.8 msだった。
- 各heavy Pixi scenarioの50 ms以上stallは0件だった。
- quick全体判定のfalseはDOM側の1 sampleしかないpresentation-start比率判定であり、Pixiのheavy frame / stall gateではない。

## 3. 標準4 lane capture

`node dist/scripts/capture-pixijs-playfield-performance.js --allow-dirty --output artifacts/pixijs-playfield-performance/in-game-hot-path-2026-08-04-standard.json` でclassic / Vite × Pixi / DOMを各約10分測定した。

| lane | heavy / identity / settlement | 10分 stabilityの50 ms以上stall | 結果 |
| --- | --- | ---: | --- |
| classic Pixi | 全項目PASS | 1 / 36,009 RAF interval | stabilityのみFAIL |
| classic DOM | 全項目PASS | 2 / 35,792 RAF interval | stabilityのみFAIL |
| Vite Pixi | 全項目PASS | 0 | PASS |
| Vite DOM | 全項目PASS | 0 | PASS |

classicの3 interval以外は、cross-lane identity、browser environment、全scenarioのRAF p95 / max、presentation start、whole-turn settlementを含めて合格した。classic測定中には同じ端末で文書検索・検査処理を並行しており、Vite測定中には並行処理を止めていた。このため、classicのstability失敗を製品起因とも成功とも決めつけず、同一artifact・同一commitの単独再測定を行った。

## 4. Classic lane単独再測定

標準harnessと同じfixture、500 ms sampling、10分durationを使い、classic Pixiとclassic DOMを他のローカル処理を走らせず順番に測定した。

| backend | duration | RAF interval | p95 first / last 2 min | max | 50 ms以上stall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pixi | 600.3706 s | 36,016 | 16.7 / 16.7 ms | 16.8 ms | 0 |
| DOM | 600.1981 s | 35,824 | 16.8 / 16.8 ms | 33.4 ms | 0 |

合計71,840 intervalで50 ms以上stallは再現しなかった。したがって、標準captureのclassic 3件は、同一マシン上で同時実行した検査・文書処理による測定環境干渉と判断する。初回標準capture自体はFAILのまま保存し、単独再測定で上書きしていない。

## 5. 結論と範囲

対象のPixi heavy scenarioではRAF p95 16.7～16.8 ms、最大16.8 ms、50 ms以上stall 0件を確認した。長時間stabilityも、干渉を除いたclassic単独再測定と標準Vite測定の両方で50 ms以上stall 0件だった。

これはWindows / Chromium / RTX 2070の1環境における結果である。Chrome / Firefox / WebKit × desktop / mobile × Pixi / DOMの12 smokeは別途通過しているが、mobileは実機performance測定ではなくemulationである。
