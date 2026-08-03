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

## 6. スマホ配置時負荷のfollow-up

スマホで石を置く瞬間が重いという実機報告を受け、390 × 844、DPR 2、touch有効のChromium contextにCPU slowdownを加えて再調査した。従来のmobile smokeは機能互換確認であり、物理端末の性能証拠ではなかったため、性能reportには `physicalDevice: false` を明記した。

調査で確認した重複処理と対処は次のとおり。

- 手番lockのたびに64セルすべての透明なPixi入力Graphicsとhit areaを再構築していた。セル固有の入力signatureから全体lockを外し、interaction親layerを1回だけ有効・無効にする形へ変更した。通常配置2手の `hintInputSyncCount` は256回から8回へ減った。
- 盤面サイズが変わらない反映でも、一時DOM要素の追加・計測・削除とviewport寸法の再設定を繰り返していた。セルサイズ・frame計測・viewport capをレイアウトrevision単位で再利用し、resize、skin、DPR、盤面形状変更時だけ再計測するようにした。
- 同一ターンのログ更新ごとにターン告知座標を再計測し、石数・直近ログDOMを再生成していた。告知は初回、次RAF、180 ms後、resize / scroll / board ResizeObserverで従来どおり補正し、同一内容のDOM更新だけを省略した。
- スマホ縦画面ではCSSで非表示になるCPU・勇者の台詞吹き出しにも、画像・盤面・吹き出しの同期座標計測が走っていた。表示状態と台詞内容は保持したまま非表示profile中の配置計算だけを止め、回転時は既存のresize処理で再配置するようにした。4倍CPU profile全体で、この吹き出し由来の `getBoundingClientRect` self timeは178.7 msから0 msになった。
- opponent-action harnessにmobile viewport、touch、CPU slowdown、CPU profileを追加した。通常プレイに存在しないdebug console負荷を避けるため、最終測定は `perf=1` と診断契約の事前注入で行った。

4倍CPU slowdownの同一debug条件では、レイアウト計測最適化前後で次の変化を確認した。各scenarioはwarmup 1回後に5回取得した。

| scenario | sync p95 before / after | RAF max before / after | 50 ms以上RAF before / after |
| --- | ---: | ---: | ---: |
| 通常配置 | 62.9 / 58.2 ms | 116.7 / 116.7 ms | 17 / 19 |
| 使用可能カード→配置 | 148.2 / 101.7 ms | 250.0 / 116.7 ms | 34 / 20 |
| 多対象カード→配置 | 151.0 / 65.4 ms | 333.3 / 116.7 ms | 35 / 22 |
| Lv6 Worker配置 | 125.4 / 48.5 ms | 283.4 / 100.0 ms | 25 / 11 |
| 高更新再生 | 204.2 / 49.4 ms | 333.4 / 100.0 ms | 26 / 12 |

CPU profile全体では、`getBoundingClientRect` self timeが3,632.2 msから721.2 msへ約80%減り、GC self timeが723.2 msから384.4 msへ約47%減った。通常配置の最大値は4倍条件で横ばいだが、2回目の測定でRAF p95は16.8 msへ戻っており、最初の33.3 msは再現しなかった。

debugログ無効・2倍CPU slowdownでは、通常配置のsync p95は25.8 ms、RAF最大は50.0 ms、Lv6配置のRAF最大は33.4 msだった。Pixi hardware経路で合法手をtouch操作し、CPU応答後にwriterがidleへ戻ること、canvasが1枚であること、page errorが0件であること、石・合法手・布石・ターン告知・カード領域の表示が維持されることも確認した。

raw reportとprofileはGit管理外の次の場所に保存した。

- `artifacts/opponent-action-frame-stall/mobile-placement-throttle4.json`
- `artifacts/opponent-action-frame-stall/mobile-placement-throttle4.cpuprofile`
- `artifacts/opponent-action-frame-stall/mobile-placement-optimized-safe-throttle4-rep2.json`
- `artifacts/opponent-action-frame-stall/mobile-placement-optimized-safe-throttle4.cpuprofile`
- `artifacts/opponent-action-frame-stall/mobile-placement-normal-log-safe2.json`
- `artifacts/opponent-action-frame-stall/mobile-placement-post-bubble-safe4.cpuprofile`
- `artifacts/opponent-action-frame-stall/mobile-placement-post-bubble-profile-safe4.json`
- `artifacts/mobile-placement-after-pixi.png`

このfollow-upも物理Android / iPhoneのpaint、GPU、thermal throttlingを代替しない。実機reportは `docs/perf/pixijs-playfield-mobile/` の既存手順で追加する。
