# 体験を維持する全面軽量化計画（2026-09-24）

役割: 2026-09-24 の読み取り専用調査で確認した軽量化候補を、順序・変更境界・検証・完了条件つきで実装できる形にまとめた実行計画。対象はカードリバーシの配信・キャッシュ、起動転送、対局中ランタイム、CPU探索とWorker、オンライン対戦の通信・保存。正本は [ゲーム仕様](../../01-rulebook.md) と [内部契約](../architecture-contracts.md) §5.1.1、§5.2、§6、§7.3、§8、§11。ルール、CPUの判断、UX、視覚表現、音、タイミングを変更する仕様書ではない。

状態: **実施中。** 各作業単位の状態は §9 の進捗表と実施記録で更新する。

前計画 [追加軽量化計画（2026-09-08）](ux-preserving-lightweight-plan-2026-09-08.md) は P1 採用・P4 保留のままローカル差分として残っている。本計画はそれを置き換えず、P0 でその差分の扱いを先に確定する。

## 1. 選定方針と完了条件

ユーザーが見る・聞く・操作する結果を一切変えずに、転送量・再訪時のリクエスト数・対局中の同期処理時間・CPU探索の内部時間・通信バイト数・保存サイズを減らす。判断は「同じ入力に対して同じ出力（バイト・画素・イベント列・順序）か」を先に問い、満たさない候補は採用しない。

| 受入条件 | 内容 | 検証段階 |
| --- | --- | --- |
| A1 ゲーム結果の一致 | 同じ状態・候補順・乱数seedでCPUのカード、着手、対象、見送り、探索の `transitions` / `value` / `evaluationCalls` が一致。元状態・乱数状態を変更しない | P4 |
| A2 UX・表示の一致 | 操作方法、合法手、表示内容、画素、演出順序・時間、音、入力ロック、キーボード・touchを維持。画像は画素同一（透明画素下のRGBを除き、必要なら `exact` で同一化） | P1–P3 |
| A3 通信の一致 | authorityの結果、playbackイベント列と順序、eventId、再接続・replay、非公開情報の投影（§8）が一致 | P5 |
| A4 性能の改善 | 各作業単位で定めた対象指標が基準に対して改善し、既存場面の同期処理・RAF・heapに有意な悪化がない（§6） | 各単位・P6 |
| A5 境界の維持 | §5.1.1 の起動順と配信契約、§5.2 のWorker preload、Single Visual Writer、共有盤面形状、Worker失敗経路 | 各単位 |
| A6 通常配信 | 最終ソースを `npm run build:vite` で通常8000へ反映し、生成物・Worker mirrorを整合させ、今回分だけをコミット | P6 |

対象外: UI/CSS/素材の見た目変更、解像度・FPS・演出量・音質の低下（画像の非可逆圧縮・ダウンスケール・MP3再エンコードを含む）、ONNXの有効化、探索の深さ・候補順・打ち切り条件の変更、通信の意味変更、SEの遅延decode、BGMバッファの退避、`#log` の件数制限、本番デプロイ、長時間訓練、制作素材の整理・削除（除外リストへの追加は含む）。

## 2. 調査時点と既存作業

- 調査日: 2026-09-24。本番 `https://card.reversi-0.workers.dev/` は root と同じ `vite-dist/assets/index.vite-D99VH8Zo.js` を配信中。追跡mirror `worker-public/vite-dist` はそれより古い（`index.vite-DFo2DBoI.js` を参照）。
- 開始時点で前計画の差分（`game/ai/cpu-tactical-safety.ts`、`game/cpu-turn-move-phase.ts`、`game/cpu-turn-performance.ts`、`ui/perf-benchmarks.ts`、`scripts/production-parity-gate.ts`、CPU実験ツール、両asset manifest、生成HTML/registry、`worker-public/` 生成物）と未追跡の制作素材がある。前計画 P4 の残件（Worker mirror 失敗、削除済み `worker-public/assets/images/special-stones/crystal_stone.png`、DOM compatibility の boot error）は未解決。
- 完了済みで再実装しない: optional group（gacha/cosmetic/leaderboard/commentary/CPU/ONNX）、Vite専用 `compatibility` / `diagnostics` 遅延group、特殊石の需要時ロード、hero/handの論理画像重複排除、helpの遅延ロード、DOM互換・feature stylesheetの遅延、WOFF2 subset、13背景＋1フレームのlossless WebP、idle ticker停止、手アニメーション層再利用、肖像・font-ready memo、tactical-safety の検索用盤面再利用、通信V2/V3 codec と分割保存（[記録](../perf/2026-07-24-ux-preserving-runtime-optimization-completion.md)、[非CPU最適化計画](non-cpu-runtime-performance-remediation-plan.md)、[ネット内部最適化計画](../network-internal-optimization-plan-2026-09-05.md)）。
- 調査で否定した候補（再検討しない）: Vite/Rolldownの設定変更（minify・target・cssMinify は無効または既に最適）、`console.*` の一括除去（`debug=1` の挙動）、通信V4構造codec（圧縮後の差がほぼゼロ）、PNGの再圧縮（≤3–5%）、Pixiのtree-shaking、クライアントapply経路、状態クローンの置換。

## 3. 今回確認した根拠

数値はいずれも 2026-09-24 の読み取り専用計測（Node v24、この開発機、`dist/` は同日ビルド）またはリポジトリ内artifactによる。ブラウザ・実機の改善率ではない。

### 3.1 配信・キャッシュ

- 本番は全アセットを `Cache-Control: public, max-age=0, must-revalidate`（ETagあり）で返す。hash付き `vite-dist/assets/*` と `?v=` 付きCSSも同様。`worker-public/_headers` は存在せず、[match-worker.ts](../../workers/match-worker.ts) は `env.ASSETS.fetch(request)` を素通しする。§5.1.1 は両者を immutable と定める。[browser-production-delivery-smoke.ts](../../scripts/browser-production-delivery-smoke.ts) はローカルの一時サーバーだけで immutable を模擬している。
- [asset-manifest-runtime.ts](../../ui/bootstrap/asset-manifest-runtime.ts) と [init-network.ts](../../ui/bootstrap/init-network.ts) は `assets/asset-manifest.json`（195,463 B、939エントリ、うち646が `special-cards/*`）を `cache: 'no-store'` で毎起動取得する。
- `worker-public/` には参照元のない素材が約36 MBある: `assets/images/special-cards/characters/theory_incarnation_reference/`（10.8 MB。兄弟の `observer_will_reference/` は [prepare-worker-assets.ts](../../scripts/prepare-worker-assets.ts) で除外済み）、`characters/*_turnaround*.png` と `observer_will_character_only.png`（8.2 MB）、`audio/bgm/manifest-stones/{A, aa, ss, s, A (2)}.mp3`（10.0 MB）、`audio/bgm/Observation Battle.mp3`（`Observation Battle3.mp3` と同一バイト）、`audio/bgm/sacrifice.mp3.bak`、`special-cards/backgrounds/zombie_will_background.png`、`fonts/font-build-manifest.json`、`sound-effect/archive/`、`sound-effect/進化仮.mp3`、`Gacha/generation-record.json`。いずれも本番でHTTP 200。

### 3.2 起動転送

- cold boot は 22.4 MB / 70リクエスト（`artifacts/ux-optimization-monitor/standard-suite.json`、`boot.pixi.cold`）。PNG 14.85 MB、JS 4.99 MB、CSS 1.21 MB、WOFF2 0.65 MB。
- `assets/images/board/board-surface-bluegreen-felt-v1.png`（3,250,918 B）が [styles-board.css](../../styles-board.css) の `--board-surface-texture-image` と [texture-manager.ts](../../ui/pixi/texture-manager.ts) の `Assets.load` で2回取得される。`assets/images/cpu/level1.png`（299 KB、[bootstrap.ts](../../ui/bootstrap.ts) の `new Image()`）と手札カード1枚も2回取得。
- 不透明なのにアルファチャネルを持つPNGが6枚: felt 3,250,918→3,062,693、stone-inlay 2,810,199→2,706,594、brushed-lacquer 2,800,148→2,638,813、`card-back-hand-v1` 2,104,476→1,927,301、`card-back-deck-v1` 976,330→898,239、`card/99_究極労働神` 238,785→186,352（PNGのまま、画素同一で再エンコード可）。
- lossless WebP 未適用の起動画像: felt −32.5%、`background/デフォルト25`（アルファあり、[build-background-images.ts](../../scripts/assets/build-background-images.ts) の `opaqueOnly: true` で対象外）−26.7%、`card-back-deck` −35.7%、card-area tables −31〜33%、`charge-counter-wafu` −33.4%、`cpu/level1` −34.6%、`hero` −32.7%。ただし [optimized-ui-images.json](../../assets/images/optimized-ui-images.json) の decode admission（中央値 +2 ms / +10% 以内）で felt と `デフォルト25` は過去に却下されている。
- `vite-dist/index.vite.html` は `rolldown-runtime` / `preload-helper` / `bridge` しか `modulepreload` せず、`lib`（435 KB）・Pixi chunk・`init`・`layout-stage`・`entry-browser` はメインchunk実行後に3段階で直列に発見される（capture上 262→303→1,621 ms）。
- メインchunk（4,474 KB raw / 807 KB brotli）は [startup-modules.ts](../../browser-vite/generated/startup-modules.ts) で `cpu-lv10/11/12/13-search`・`-evaluation`・`-model`・`-scenarios` を startup required として含むが、メインスレッドでは実行されない（[cpu-lv10-turn.ts](../../game/cpu-lv10-turn.ts) は `import type`、Lv13はprofile無し）。`game/battle`・`ui/battle`（`battleEmbed=1` のみ）、`game/debug`・`ui/debug-*`・`ui/perf-benchmarks`（`isDebugSessionEnabled()` 内のみ）も常時読み込み。

### 3.3 対局中ランタイム

- [shared-board-utils.ts](../../shared/shared-board-utils.ts) の `getContextView()` は getter 呼び出しごとに `createBoardView` を呼び、[state-kernel.ts](../../shared/board/state-kernel.ts) はキャッシュヒットでも `preflightBoardSources` と `buildSourceSignature` を実行する。[control-counts.ts](../../shared/board/control-counts.ts) の `countEdgeControl` はセルごとに `isEdgeCell` / `isCornerCell` / `getCellValue` で再検証を踏み、8×8で 2.4–3.2 ms/回。`view.get` 直読との差は約400倍。
- [commentary-context-helpers.ts](../../shared/commentary-context-helpers.ts) の `buildCpuCommentaryMetrics` は Node 2.76 ms（mobile 4x throttle で約11 ms＝観測される `commentary-context` ステージ全体）。CPUターンごとに `turn_start` / `card_targeted` / `pass` / 角取得で1〜3回呼ばれ、同一盤面で再計算される。[cpu-decision-card-context.ts](../../game/cpu-decision-card-context.ts) も同じhelperを使う。
- [cpu-turn-pending-phase.ts](../../game/cpu-turn-pending-phase.ts) の `canonical-commit` 計測は `Promise.resolve(handler())` の同期プレフィックス＝[cpu-policy-pending-targets.ts](../../game/ai/cpu-policy-pending-targets.ts) の対象採点（AI）を測っており、本物のcommitは `await` 後の未帰属Long Taskに出る。前計画 P4 の Lv1 multi-target p95 悪化（97→245 ms）は中央値が同一（約32 ms）で最悪3サンプルのみの差であり、ラベル誤りとtail効果として説明できる。
- [presentation-handler.ts](../../ui/presentation-handler.ts) は debug flag の判定前に `getPlaybackTargetSummary` を構築し、`isPresentationDebugEnabled()` は呼び出しごとに `location.search` へ6つの正規表現を適用する。[turn-manager.ts](../../game/turn-manager.ts) にはドローごとの無条件 `console.log('[DRAW] …')` がある。
- 否定: `applyTurnSafe` の clone / hash は turn あたり 0.3–0.8 ms @4x、`ActionManager` はブラウザ経路で未注入のため no-op、idle中のポーリングなし、card renderer は差分描画、sound engine のbuffer cacheは適切。

### 3.4 CPU探索とWorker

- [cpu-lv12-search.ts](../../game/ai/cpu-lv12-search.ts) と [cpu-lv13-search.ts](../../game/ai/cpu-lv13-search.ts) は `Board.withTopologyMemo` で包むが、[cpu-lv10-search.ts](../../game/ai/cpu-lv10-search.ts) と [cpu-lv11-search.ts](../../game/ai/cpu-lv11-search.ts) は未適用。メモリ上実験: Lv11 中盤 2,463→2,096 ms（−15%）、Lv10 238→212 ms（−11%）、結果同一。
- [turn_pipeline_factory.ts](../../game/turn/turn_pipeline_factory.ts) は `applyTurnSafe` ごとに全状態の `computeStableHash` を計算するが、Lv10–13の探索と `game/battle` は `result.stateHash` を読まない。`deps.computeStateHash` を差し替える実験: Lv11 2,096→1,521 ms（累計−38%）、Lv10 82→53 ms、Lv12 875→752 ms、結果同一。
- Lv10評価器は `prepareBoardForSearch` を使わず局面あたり約140回の再検証を踏む（Lv11/12は使用済み）。
- Workerは初回要求時に生成される（[client.ts](../../browser-vite/cpu-worker/client.ts)）。Lv3–5の初回 `SCORE_CANDIDATES` は48 msでabortしローカル採点にフォールバック、Lv10+ は cold start が 3000/8000 ms のタイムアウトに近づくと緊急フォールバック（最初の合法手）へ落ちる。lv entryは PING を拒否する（[lv10-worker-entry.ts](../../browser-vite/cpu-worker/lv10-worker-entry.ts)）。[browser-onnx-worker-smoke.ts](../../scripts/browser-onnx-worker-smoke.ts) は起動中のCPU Worker生成を禁止している。
- Lv10/11/12のWorkerバンドル（各1.1 MB）は95%同一だが、通常セッションは1本しか取得しない。
- 制約: [production-parity-gate.ts](../../scripts/production-parity-gate.ts) は `dist/game/ai/cpu-lv{11,12}-search.js` と `-evaluation.js` の sha256 を固定し、[run-production-selfplay.ts](../../scripts/run-production-selfplay.ts) は `dist/game`・`dist/shared`・`dist/utils`・`dist/cards` をmanifest化する。決定の同一性は「ノード上限が先に効く」場合に成り立ち、この開発機では全探索が `stopped=complete` だった（Lv11は4.8 s予算中2.8 s）。時間打ち切りが効く遅い端末では、高速化は正規のノード制限結果へ近づける方向にだけ働く。思考時間の下限は判断後に適用される。

### 3.5 通信・保存

- 本番は WebSocket をテキストフレームで送る（[match-worker-websocket-controller.ts](../../workers/match-worker-websocket-controller.ts)、[websocket-stream.ts](../../ui/network/websocket-stream.ts)）。Cloudflare Workers の WS は permessage-deflate 非対応、`text/event-stream` も edge 圧縮対象外。V3 codec後のフレームは gzip で light 6,115→1,834 B、dense 9,312→2,654 B、special-20 30,906→4,201 B。
- [match-worker-broadcast-controller.ts](../../workers/match-worker-broadcast-controller.ts) は黒/白/観戦の完全legacy payload（snapshot と events を各2回含む）を [journal.ts](../../utils/match-authority/journal.ts) 経由で `:history:sseEventBuffer:N` に保存する（[match-room-storage.ts](../../workers/match-room-storage.ts)）。special fixture で 262.7 KB/publish。同じ内容は [presentation-journal.ts](../../utils/match-authority/presentation-journal.ts) の journal entry にもある。
- Room head は毎publish書き換えられ、読み手のいない `authorityLog`（約332 B × 上限64 ≈ 21 KB）と、退避された journal entry の `snapshotAfterByViewer` 複製（14–22 KB）を含む。
- [projection.ts](../../utils/match-authority/projection.ts) の `cloneSnapshotHashSource` は publish ごとに5回のdeep clone＋sorted stringify を行う（約0.1–0.5 ms/publish）。

## 4. 設計と変更の境界

### 4.1 共通

- root source を変更し、`index.html`、`index.vite.html`、`public/module-registry*.js`、`vite-dist/`、`worker-public/` は既存スクリプトで生成する（§5.1.1、§11）。
- 新規依存は追加しない。既存の helper・生成器・capability 交渉パターンを使う。
- 各作業単位は単独で契約が成立し、単独で戻せる差分にする。commit は単位ごと。
- 常時計測・debug表示を通常経路へ追加しない。診断は `?perf=1` / `debug=1` の既存gateの内側に置く。

### 4.2 配信（P1）

- `_headers` は root 所有の新規ファイルとし、[prepare-worker-assets.ts](../../scripts/prepare-worker-assets.ts) の `ROOT_FILES` で mirror し、[check-worker-mirror.ts](../../scripts/check-worker-mirror.ts) の対象へ加える。immutable にするのは `/vite-dist/assets/*` と `?v=` 付きの root CSS/JS だけ。`_headers` はパス一致のみで query を見ないため、CSS の版は URL の `?v=` でキャッシュキーが分かれることを [build-vite-entry.ts](../../scripts/build-vite-entry.ts) の生成で確認する。バージョンなしの `assets/**`、`data/**`、`node_modules/onnxruntime-web/**` は revalidate のまま。
- manifest fetch は `cache: 'no-cache'`（ETag 再検証）へ変更し、内容が変わらない限り 304 になることをテストで固定する。生成側の絞り込みは、[generate-asset-manifest.js](../../scripts/generate-asset-manifest.js) の利用者（`ui/bootstrap/*`、Worker、smoke）が要求するキーを先に列挙してから行う。絞り込みで参照が壊れる場合は fetch options の変更だけにとどめる。
- 未使用素材は除外リストへ追加するだけで、root の素材ファイルを削除・移動しない。参照の有無は §3.1 の一覧を再検証する（パターン生成パス `cpu/level${n}.png`、`special-stones/${prefix}-black.png` 等は使用中）。
- アルファ除去は PNG のまま行い、`sharp.removeAlpha()` 相当の再エンコード後に元画像と RGBA 全画素を比較する（アルファ255固定を前提とするので RGB 同一で十分）。生成物は既存の最適化画像パイプライン（[build-optimized-ui-images.ts](../../scripts/assets/build-optimized-ui-images.ts)）に載せられるなら載せ、載せられなければ元ファイルを差し替えた上で asset manifest を再生成する。

### 4.3 起動転送（P2）

- 二重取得は「同じ論理パスを1回だけ取得する」経路の共有で解決する。felt は CSS 変数と Pixi の両方が必要なら、Pixi 側が `<img>`/CSS で既に decode 済みの Blob/ImageBitmap を再利用するか、`Assets.load` の cache へ既存要素から登録する。どちらでも描画結果が同一であることを Pixi playback check で確認する。level1 と手札カードは既存の論理画像重複排除（7月）と同じ helper を使う。
- `modulepreload` は [vite.config.ts](../../vite.config.ts) の `transformIndexHtml` で bundle から算出して注入する。`layout-stage` と `entry-browser` はメインchunkへ結合しない（§5.1.1 の起動順）。preload の失敗は既存の `vite:preloadError` 経路に乗る。
- 死コードの除外は [build-module-registry.ts](../../scripts/build-module-registry.ts) の分類（既存の `policy-onnx-runtime-v2` 除外と同じ機構）または `VITE_ONLY_LAZY_GROUPS`（[build-vite-module-bridge.ts](../../scripts/build-vite-module-bridge.ts)）で行い、classic lane に動的 require が残らないことを registry closure check で確認する。`shared/battle/types` は `cpu-lv10-position` から import されるため battle group から外す。
- lossless WebP は既存の [lossless-webp-pipeline.ts](../../scripts/assets/lossless-webp-pipeline.ts) と admission policy を**そのまま**使い、画像ごとに decode 計測を通す。却下された画像は PNG のまま残す。閾値・baseline を書き換えない。CSS `url()` 参照の画像は、[optimized-image-codec.ts](../../ui/assets/optimized-image-codec.ts) と同じ WebP優先/PNG fallback をCSS側で実現できる場合だけ対象にする（`image-set()` 等。fallback の描画が同一であること）。
- フォントの `unicode-range` 分割は、起動時に描画される codepoint 集合を計測し、Pixi canvas text が `document.fonts` の読み込み完了を待って描画していることを確認できた場合だけ実施する。確認できなければ非採用として記録する。

### 4.4 対局中ランタイム（P3）

- [control-counts.ts](../../shared/board/control-counts.ts)、[commentary-context-helpers.ts](../../shared/commentary-context-helpers.ts) の `countCornerRiskCells` 等は、helper 冒頭で一度 view を解決して `view.get` / `view.isPlayable` / `view.topology` を使う。既存の dense-array / search-context 分岐と同じ形にし、公開 interface・戻り値・走査順を変えない。共有 getter を identity だけでキャッシュしない（前計画 §4.1 の理由）。
- `card_targeted` の commentary は、同一ターンで既に準備した metrics を渡す。盤面が変わる可能性がある経路（pending 中の状態変化）では再計算を維持する。
- 計測ステージの是正: pending の同期プレフィックスを `pending-target-choice` と改名し、`runCpuPendingSelectionViaPipeline` の周りに `canonical-commit` を置く。[cpu-turn-performance.ts](../../game/cpu-turn-performance.ts) と [perf-benchmarks.ts](../../ui/perf-benchmarks.ts) の stage 一覧と schema version を更新する（前計画で v2 に上げた差分と衝突しないよう P0 で確定した状態を基準にする）。
- debug 引数の遅延構築と flag の memo は挙動同一。`[DRAW]` の `console.log` は除去または既存 debug gate へ移す。

### 4.5 CPU探索とWorker（P4）

- `searchLv10` / `searchLv11` を `Board.withTopologyMemo` で包む。memo は幾何のみを再利用する契約（[topology.ts](../../shared/board/topology.ts)）。
- 探索用の pipeline は `computeStateHash: () => null` を注入する。`applyLv10Action` 等が `stateHash` を読まないことを型と grep で再確認し、`HASH_UNAVAILABLE` 拒否経路が探索状態で発生しないことをテストで固定する。
- Lv10評価器の盤面読みは `prepareBoardForSearch` の context に統一する。前計画 P1 と同じ局所適用で、公開 interface・候補順・上限・乱数を変えない。
- Worker warm-up は CPU対局開始時（対局開始 handler）に対象レベルの Worker を生成し、PING 分岐を lv entry に追加する。起動中には生成しない。Worker 失敗経路とフォールバックは変えない。
- Worker バンドルの共有は、module worker 化が `importScripts` の ORT loader と衝突するため、単一の advisor entry（`LV1x_ADVISE` で dispatch、Worker インスタンスはレベルごとに分離）で行うか、非採用とする。P4 の他項目とは独立に判断する。
- parity: `dist/game/ai/cpu-lv{11,12}-search.js` 等の hash が変わるため、変更確定後に [production-parity-gate.ts](../../scripts/production-parity-gate.ts) の証拠と production selfplay manifest を既存手順で再生成する。再生成は「決定同一の証拠を得た後」に限り、hash 更新のために証拠を弱めない。

### 4.6 通信・保存（P5）

- WS フレーム圧縮は capability 交渉で opt-in する（`presentationEnvelopeVersion` と同じ query パラメータ → hibernation `Attachment` に保存）。サーバーは per-viewer 投影とエンコードの後、キャッシュ済みバイト列を `CompressionStream('gzip')` で圧縮し binary フレームで送る。クライアントは `binaryType='arraybuffer'`、`DecompressionStream` で復号したテキストを既存の `receive()` へ渡す。1イベント1フレーム、順序、eventId、`lastEventId`、replay を維持。`DecompressionStream` 非対応クライアントは交渉しないので従来経路のまま。復号は非同期になるため、同一ソケット内の処理順を直列化する。
- SSE 再送バッファは V2 compact 形式で保存し（S1）、replay 時に `resolveNetworkPresentationEnvelope` で復元してから既存の per-stream compaction を通す。journal からの再構築（S2）は S1 の効果測定後に判断する。storage FORMAT version を上げ、`split-history-v1` の読み込みを残す。
- `authorityLog` は entry ごとの key（既存 `FIELDS` パターン）でリング化し、退避 journal entry の複製は key を残す参照へ置き換える。読み手は同じ構造を再構築する。
- hash source は exclusion-aware な stableStringify に置き換え、fixture に対する hash 文字列の golden test を先に追加する。V2/V3 の `snapshotAfterRef` とクライアントの `projectedSnapshotHash` が依存するため、1バイトも変わらないことを条件にする。

## 5. 実行フェーズ

### P0 前提整理・基準取得・計測是正

前提: root 指示と本書を読み、`git status --short` で別作業の差分を分類する。

1. 前計画の残差分（tactical-safety P1、perf stage v2、CPU実験ツール）の扱いを確定する。P1 は前計画の A1/A3/A4 の証拠が揃っているため、本計画の P0 で `npm run typecheck` と関連 suite を通してから**先に単独コミット**する（生成物・manifest は含めない）。asset manifest・生成HTML・`worker-public/` の差分は別作業のものとして保護する。
2. 別作業の未解決事項を確認して記録する: 削除済み `worker-public/assets/images/special-stones/crystal_stone.png`、未追跡素材、DOM compatibility の boot error（`DOM compatibility stone visuals failed to prepare`）。これらは P6 の mirror・DOM 互換確認を gate する。所有者の整理が必要なら、具体的な衝突を示して確認する。
3. 計測ステージの是正（§4.4）を先に入れ、以後の opponent-action 計測はこの schema で取る。
4. 基準を取得する（同一 profile・fixture digest・成果物 hash を記録）:
   - boot: `node dist/scripts/perf/capture-ux-optimization-monitor.js --profile standard`（転送量・リクエスト数・board ready）。
   - opponent-action: `node dist/scripts/perf/measure-opponent-action-frame-stall.js --profile lightweight-desktop` と `--profile lightweight-mobile --mobile --cpu-throttle 4`（warmup 5・各20）。
   - CPU探索: Lv10/11/12 の固定 fixture・seed で `transitions` / `value` / `evaluationCalls` / `elapsedMs` を Node で記録する専用スクリプトを `scripts/perf/` に追加する（production clock と node-only clock の両方）。
   - 通信・保存: `npm run perf:network-storage` と `scripts/perf/measure-network-storage.ts` の fixture で publish あたりの保存バイト・フレームバイト・gzip 後バイトを記録する。
   - heap: 同じ操作列・warmup・回収条件で desktop の heap 推移を記録する（前計画で未実施）。
5. 8000 の所有プロセスを確認し、既存の正常なサーバーを再利用する。

完了: 前計画差分のコミット、別作業の残件一覧、是正済み計測 schema、各領域の基準値と条件が揃う。

### P1 配信・キャッシュ・未使用素材

| 単位 | 変更 | 検証 | 完了条件 |
| --- | --- | --- | --- |
| P1-a `_headers` | root `_headers` 新規、`prepare-worker-assets.ts` の `ROOT_FILES`、mirror check、`browser-production-delivery-smoke.ts` を本番と同じ規則で読む | `npm run worker:prepare`、`npm run check:worker-mirror`、`npm run match:production-delivery-smoke:vite`、`npx wrangler dev` で `curl -I` により hash付きJS・`?v=`CSS が immutable、HTML と `assets/**` が revalidate | 上記 header が確認でき、smoke が pass |
| P1-b manifest fetch | `cache: 'no-cache'`、必要なら manifest の runtime 絞り込み | `test/ui.bootstrap.asset-manifest.test.ts` の更新、`npm run match:asset-delivery-smoke:vite`、2回目起動で manifest が 304 | 内容同一で再検証のみになる |
| P1-c 未使用素材の除外 | `prepare-worker-assets.ts` の除外リストへ §3.1 の一覧を追加 | `node scripts/check-asset-file-case.js`、`npm run worker:prepare`、除外前後の `worker-public` ファイル一覧差分が一覧と一致、`match:asset-delivery-smoke:vite` と `match:optional-feature-smoke:vite` で resource error 0 | 約36 MB が mirror から消え、参照エラーなし |
| P1-d 不透明PNGのアルファ除去 | 6ファイルを画素同一で再エンコード、manifest 再生成 | 再エンコード前後の RGB 全画素比較スクリプト（scratch可、結果を記録）、`npm run assets:optimized:check`、`npm run test:visual`（既存 baseline に対して差分0） | −761 KB、画素同一、visual 差分なし |

### P2 起動転送

| 単位 | 変更 | 検証 | 完了条件 |
| --- | --- | --- | --- |
| P2-a 二重取得の解消 | felt / level1 / 手札カードを1回取得にする（§4.3） | `npm run match:pixijs-board-playback-check`、`npm run match:pixi-runtime-fallback-check`、boot capture で同一 URL の重複 request 0、`test/ui.pixi-*` の該当 suite | 転送 −3.5 MB 以上（harness）、描画同一 |
| P2-b `modulepreload` 注入 | `vite.config.ts` の `transformIndexHtml` | `npm run build:vite`、`vite-dist/index.vite.html` の link 検証テスト、boot capture の chunk 開始時刻が直列3段から並列へ、`match:cross-platform-smoke:vite`、`match:pixi-runtime-fallback-check`（preload 失敗経路） | board ready 中央値が悪化せず、遅延段が消える |
| P2-c 死コード除外・遅延group | Lv10–13 探索群、battle、debug/perf を registry で除外または Vite専用 lazy group へ | `npm run check:vite-modules`、`npm run check:vite-entry`、`npm run check:dependency-boundaries`、`test/browser-vite.optional-payload-loader.test.ts`、`battleEmbed=1` と `debug=1` の実ブラウザ起動、`match:ui-control-smoke:classic` | メインchunk brotli −30 KB 以上、classic/Vite とも起動 |
| P2-d lossless WebP 追加 | 起動画像を既存パイプラインで admission にかける | `npm run assets:ui-images:build` / `:check`、admission 結果の記録、`npm run test:visual` | admission を通った画像だけ採用。却下は記録 |
| P2-e フォント分割（条件付き） | §4.3 の条件を満たす場合のみ | `npm run assets:fonts:build` / `:check`、Pixi text の描画タイミング確認、`match:cross-platform-smoke:vite` | 条件を満たさなければ非採用として記録 |

### P3 対局中ランタイム

| 単位 | 変更 | 検証 | 完了条件 |
| --- | --- | --- | --- |
| P3-a view-scoped helper | `control-counts.ts`、`commentary-context-helpers.ts`、必要なら `shared-board-utils.ts` の該当 helper | `test/shared.board-control-counts.test.ts`、`test/shared.commentary-context-helpers.test.ts`、`test/cpu-decision.board-utils.test.ts`、`test/shared.board-search-state.test.ts`、CPU判断の既存 suite（card-context を含む）、旧新で `countEdgeControl` / metrics の全 fixture 一致 | Node で `countEdgeControl` が 0.1 ms 未満、mobile `commentary-context` 中央値 −50% 以上、A1 |
| P3-b commentary metrics の再利用 | `card_targeted` へ準備済み metrics を渡す | commentary の既存 suite、CPUターンで metrics 計算回数を diagnostics で確認 | 同一盤面での再計算 0 |
| P3-c debug 遅延構築・`[DRAW]` 除去 | `presentation-handler.ts`、`move-executor.ts` の debug 引数、`turn-manager.ts` | 関連 suite、`debug=1` で従来の console 出力が出る | 通常経路の console 出力 0 |

### P4 CPU探索とWorker

| 単位 | 変更 | 検証 | 完了条件 |
| --- | --- | --- | --- |
| P4-a `withTopologyMemo` | `cpu-lv10-search.ts`、`cpu-lv11-search.ts` | `test/game.cpu-lv10-search.test.ts`、`test/cpu.lv11-search.test.ts`、P0 の探索比較スクリプトで結果同一 | Lv11 −10% 以上、A1 |
| P4-b 探索の `stateHash` 省略 | 探索用 pipeline に `computeStateHash: () => null` | 上記＋`test/cpu.lv12-search.test.ts`、`test/selfplay.production-match.test.ts`、`HASH_UNAVAILABLE` 非発生の回帰テスト | Lv10/11/12 とも結果同一、Lv11 −20% 以上 |
| P4-c Lv10評価器の検索用盤面 | `cpu-lv10-search.ts` の評価器 | Lv10 の旧新評価値 bit-exact 比較（`verify-production-optimization.ts` と同型の Lv10 版を追加） | 評価値同一、Lv10 −10% 以上 |
| P4-d Worker warm-up | CPU対局開始時の生成と PING 分岐 | `test/cpu-turn-move-phase.worker-scoring.test.ts`、`npm run match:onnx-worker-smoke:vite`（起動中の Worker 生成なしを維持）、初回CPUターンで abort/フォールバックが起きないことを diagnostics で確認 | 初回ターンの cold start が対局開始側へ移る、失敗経路不変 |
| P4-e Worker バンドル共有（条件付き） | 単一 advisor entry | `npm run build:vite`、Lv10/11/12 の実ブラウザ着手、`test/browser-vite.*cpu-worker*` | 非採用なら根拠を記録 |
| P4-f parity 再生成 | 証拠取得後に gate と manifest を更新 | `node dist/scripts/production-parity-gate.js`、`npm run perf:production:verify`、`npm run selfplay:production` の既存最小プロファイル | gate pass |

### P5 通信・保存

| 単位 | 変更 | 検証 | 完了条件 |
| --- | --- | --- | --- |
| P5-a WS フレーム圧縮 | capability 交渉、サーバー圧縮、クライアント復号 | `test/workers.match-websocket.test.ts`、`test/ui.network-websocket-stream.test.ts`、`test/workers.match-worker-stream-controller.test.ts`、`test/workers.match-stream-sse.test.ts`、`test/ui.network-stream-session.test.ts`、`npm run test:network:parity`、`npm run match:server` ＋ `npm run match:check` での2クライアント実対局、非対応クライアント模擬 | フレーム −70% 以上、イベント列・順序・replay 同一 |
| P5-b SSE バッファの compact 保存 | S1、FORMAT version | `test/workers.match-room-storage.test.ts`、`test/workers.match-storage-serialization.test.ts`、`test/workers.match-worker.publish-persistence.test.ts`、`test/workers.match-worker-broadcast-controller.test.ts`、`test/shared.network-presentation-envelope.test.ts`、旧 FORMAT の読み込みテスト、`npm run perf:network-storage` | 保存 −100 KB/publish 以上（special fixture） |
| P5-c head の `authorityLog` リング化・複製解消 | `journal.ts`、`presentation-journal.ts`、`match-room-storage.ts` | `test/workers.match-presentation-journal.test.ts`、`test/utils.match-authority.presentation-journal.test.ts`、`test/local-match-server.presentation-journal.test.ts`、`npm run test:match:parity` | head 書き込み −30 KB/publish 以上 |
| P5-d hash source の stringify | exclusion-aware stableStringify、golden test | `test/match-publish-controller.authority.test.ts`、`test/network.authority-path-hardening.test.ts`、`test/shared.playback-digest.test.ts`、golden hash 一致 | hash 文字列が全 fixture で同一 |

### P6 統合検証・配信・コミット

1. 最終ソースで `npm run typecheck`、`npm test`（`pretest` の checkall を含む）を実行する。
2. P0 と同条件で boot / opponent-action / CPU探索 / 通信保存 / heap を再取得し、§6 で判定する。
3. `npm run build:vite`、`npm run worker:prepare`、`npm run check:worker-mirror`。P0 の別作業残件（削除済み特殊石、未追跡素材）が mirror を止める場合は、その部分だけ所有者の判断を待ち、未完了として明示する。
4. 実ブラウザ確認: `http://127.0.0.1:8000/?boardRenderer=pixi&debug=1` で通常対局（着手・反転・CPU応答）、Lv10/11/12 の着手、`?boardRenderer=dom&debug=1`（P0 の boot error が解消済みの場合）、`battleEmbed=1`、オンライン対戦のローカル2クライアント。URL、lane、backend、操作と結果を記録する。
5. 8000 の HTTP 200、所有プロセス、継続起動の根拠を確認する。
6. `git diff --check`、`git status --short`。単位ごとのコミットが済んでいることを確認し、残る差分は本記録と生成物だけにする。本番デプロイは行わない。

完了: A1–A6、各単位の実測、実ブラウザ証拠、コミット一覧、未検証・未完了の範囲、別作業の残りを §9 に記録する。

## 6. 測定と採用の判断規則

- **同一性が先**: 画素・hash・イベント列・探索結果の一致を確認できない単位は、性能が良くても採用しない。
- **改善**: 各単位の完了条件に示した指標を、同一 profile・fixture digest・環境で baseline と比較する。転送量は encoded bytes とリクエスト数、同期処理は中央値と p95、探索は `elapsedMs` の中央値（結果同一が前提）。
- **悪化の検出**: 既存場面で同期処理 p95 が `max(2 ms, 基準の5%)` を超えて遅くなる、RAF p95 が1描画周期以上悪化する、アプリ起因の 50 ms 以上 stall が新たに出る、入力が余分に1フレーム待つ、board ready 中央値が悪化する場合は再調査し、解消できなければ非採用。
- **メモリ**: 同じ操作列・warmup・回収条件で retained heap が `max(1 MiB, 基準の5%)` を超えて再現性を持って増える場合は解消する。未測定の単位でメモリ削減を主張しない。
- **tail の扱い**: n=20 の p95 は2番目に悪い値であり、中央値が一致し最悪数サンプルだけ異なる場合は tail 効果として扱い、同条件で再ペア計測してから判定する（前計画 P4 の教訓）。
- **環境差と成果物識別**: browser/GPU、hardware acceleration、viewport/DPR、CPU throttle、warm/cold、ビルド設定を一致させ、baseline/candidate の成果物 hash を各々記録する。別訓練・別検査と同時に走らせない。
- **効果不足**: 有効な測定で改善しない単位は採用せず、根拠を記録して次の単位へ進む。数値のために UX・CPU・通信の意味を変えない。

## 7. 検証コマンドと前提

定義は [package.json](../../package.json) で確認済み。`npm test` は `pretest` で全 check を伴うため、単位内の検証は限定 Jest を使う。

```powershell
npm run test:jest -- --runTestsByPath <対象テスト>
npm run typecheck
npm run build:vite
npm run worker:prepare
npm run check:worker-mirror
npm run check:vite-modules
npm run check:vite-entry
npm run check:dependency-boundaries
npm run assets:optimized:check
npm run test:visual
npm run match:pixijs-board-playback-check
npm run match:pixi-runtime-fallback-check
npm run match:cross-platform-smoke:vite
npm run match:asset-delivery-smoke:vite
npm run match:production-delivery-smoke:vite
npm run match:optional-feature-smoke:vite
npm run match:onnx-worker-smoke:vite
npm run match:ui-control-smoke:classic
npm run test:network:parity
npm run test:match:parity
npm run perf:network-storage
node dist/scripts/perf/capture-ux-optimization-monitor.js --profile standard
node dist/scripts/perf/measure-opponent-action-frame-stall.js --profile lightweight-mobile --mobile --cpu-throttle 4
git diff --check
git status --short
```

`test:visual` は baseline 画像がないと新規作成するため、P0 で既存 baseline の有無と対象 revision を確認する。`VISUAL_UPDATE_BASELINE` は有効にしない。mirror の2コマンドはブラウザビルドを含むので、5174 で `vite-dist/` を配信中なら root の配信制約を先に解決する。

## 8. 裁量、設計へ戻す条件、順序

ローカル命名、既存パターンに沿う関数分割、fixture 追加、受入条件を満たす局所修正は実装担当の裁量。公開契約、新依存、盤面の投影・検証方式、非同期境界、CPU判断、通信の意味、表示やタイミングの意味を変える案は、そのまま実装せず設計を見直す。ユーザー確認は、素材の削除・移動、別作業の差分の上書き、本番デプロイ、mirror 残件の所有者判断が必要な場合に限る。

同じ失敗に対する修正で新しい証拠が得られなくなったら、差分、期待/実際、試した修正、必要な判断を §9 へ記録し、その単位と依存だけを保留して独立単位を続ける。

推奨順序: P0 → P1（a, b, c, d）→ P3-a → P2-a → P2-b → P4（a, b, c, f）→ P3-b, c → P2-c, d → P4-d → P5（a, b, c, d）→ P2-e, P4-e（条件付き）→ P6。P1 と P3-a は互いに独立で並行可。P4-f は P4-a〜c の確定後に一度だけ行う。

## 9. 進捗記録

| 単位 | 状態 | 実測・確認・残件 |
| --- | --- | --- |
| 計画時調査 | 完了 | 読み取り専用調査。製品コード変更なし。本番へは header 確認の HEAD/curl のみ |
| P0 | 完了 | 前計画分 `fccf0882d`、計測是正 `c3d159bf1`、基準取得。詳細は §9.1 |
| P1-a〜d | 採用・完了 | a `e947e2efb`、b `d71980476`、c `1dde2a0a9`、d `548ecacb8`。詳細は §9.1 |
| P2-a〜e | 実施中 | a・b は非採用（a: 本番相当の配信で重複要求0、b: cold board-idle 中央値悪化）。§9.1 |
| P3-a〜c | 採用・完了 | a `0517e4bb7`、b `932333905`、c `e9236db64`。§9.1 |
| P4-a〜f | 実施中 | a `ff5cf8c1e`、b `efe0dda76`、c `41847e233` 採用。f は gate 再生成が既存証拠の失効で保留。§9.1 |
| P5-a〜d | 採用・完了 | a `702d637c2`、b `fa0b21710`（S1 を raw-deflate JSON 保存へ修正、S2 不要）、c `af4df6104`、d `a6744b08a`＋`74ef6dea0`。§9.1 |
| P6 | 未着手 | |

### 9.1 実施記録

#### P0（2026-09-25）

- 前計画の残差分のうち tactical-safety P1、`tactical-safety` stage（sample v2 / report v3）、Node/ブラウザ計測器 `scripts/perf/measure-cpu-tactical-safety.ts`、前計画の記録を `npm run typecheck` と関連5 suite / 35 tests 通過後に `fccf0882d` として単独コミットした。生成物・manifest は含めていない。
- 開始時に「CPU実験ツール」として列挙されていた `scripts/{audit-cpu-experiment,cpu-experiment-protocol,run-cpu-experiment,production-parity-gate}.ts` と `package.json` の `selfplay:compare:lv13`・`data/cpu-lv13/` 除外は、全ハンクが未追跡の Lv13 開発（`docs/cpu-lv13-development-plan.md`、`game/ai/cpu-lv13-*.ts`、`data/cpu-lv13/`）に属するため、前計画分とは分けて別作業として保護した（コミットしていない）。
- 別作業の残件: (1) `worker-public/assets/images/special-stones/crystal_stone.png` の削除は `354f21ba2`（2026-09-12）で追跡・manifest とも解消済み。(2) 未追跡の制作素材（`assets/Reversi Destiny ～黒白の運命～v1/*.png`、`observer_will_reference/` 追加分、`assets/ラノベ/`）と、それを含む両 asset manifest・font-build-manifest の差分は別作業のまま保護。(3) Lv13 開発の未追跡ソース・データと `browser-vite/generated/startup-modules.ts` の Lv13 行。(4) DOM compatibility の boot error は P6 の実ブラウザ確認で再判定する。
- 既存の失敗（今回の変更と無関係）: `test/cpu.decision.refactor.test.ts` の「all catalog card types have explicit Lv6 plan pressure profile」（`REINCARNATION_WILL` が未登録）と `test/cpu.decision.public-api.test.ts`（`cpuSelectReincarnationWithPolicy` が固定一覧にない）。どちらも HEAD の時点で存在する輪廻の意志の追加に起因する。
- 計測是正（`c3d159bf1`）: pending の同期プレフィックス（方策の対象採点）を `pending-target-choice` に改名し、`runCpuPendingSelectionViaPipeline` 内の `runTurnWithAdapter` と状態書き込みを `canonical-commit` で計測する。方策の await を越えるため、pending phase が handler の生存期間だけ player ごとの scope を `cpu-turn-performance` に登録し、pipeline が commit 時に読む。Lv10+ の advised 経路は scope を引数で渡す。sample schema v3 / report schema v4。multi-target desktop で `pending-target-choice` 3.7 ms と `canonical-commit` 0.7 ms が分離して記録されることを確認した。
- 計測器の追加（P0 のコミットに含む）: `scripts/perf/measure-cpu-search.ts`（Lv10/11/12 × 9 fixture、node/production clock、結果 digest は `elapsedMs` 以外の全戻り値の stable JSON）、`measure-opponent-action-frame-stall.ts` の `--heap`（各シナリオの warmup 後・capture 後に `HeapProfiler.collectGarbage` ×2 → `Runtime.getHeapUsage`）、`measure-network-storage.ts` の出力先引数・キー種別内訳・V3 フレーム gzip 後バイト。

基準値（成果物は `artifacts/lightweight-2026-09-24/p0/`、Node v24.12.0、この開発機、RTX 2070/D3D11、同じ HEAD `c3d159bf1` のビルド）:

| 領域 | 条件 | 基準 |
| --- | --- | --- |
| boot（standard ×3） | `worker-public` artifact `f50d615d…`、1366×900/DPR1 | Vite cold: 23.60 / 23.97 / 23.95 MB、74–75 req、board-idle 1,213 / 1,450 / 1,418 ms（中央値 1,418）。warm board-idle 中央値 711 ms。重複取得: `cpu/level1.png`、felt、`o-stone/{black,white}.png`、手札カード1枚 |
| opponent-action desktop | profile `lightweight-desktop`、artifact `01cbf8f8…`、fixture `f2d4a4e2…`、warmup 5・各20 | 同期 中央値/p95（ms）: Lv1空 7.2/11.8、Lv1カード 7.8/10.3、multi-target 7.9/9.8、Lv6 22.5/30.0、Pixi高頻度 6.4/8.5。`commentary-context` 中央値 2.0–3.8 |
| opponent-action mobile | profile `lightweight-mobile`、390×844/DPR2、CPU×4、同 artifact・fixture | 同期 中央値/p95: 31.6/39.0、36.3/41.9、36.5/44.4、106.1/126.9、27.9/30.2。`commentary-context` 中央値 9.5 / 11.4 / 16.6 / 8.7 / 9.1 |
| heap desktop | 上記 desktop と同じ操作列、各点で GC×2 | ready 16.52 MiB → 最終 28.47 MiB（シナリオ順に単調増加） |
| CPU探索 | fixture `6a919ce7…`、warmup 1・各5、baseline `dist` を `p0/baseline-root` に固定 | node clock は全27行で決定的・入力不変。中央値 Lv10 0.06–1.64 s、Lv11 0.08–3.33 s、Lv12 0.23–3.55 s。production clock は Lv10 の2行が `time_budget`、Lv12 chance-continuation が非決定的のため、同一性判定は node clock で行う |
| 通信・保存 | `measure-network-storage` 3 fixture | publish あたり書き込み: light 83,407 B、dense 125,624 B、special-20 452,179 B（うち SSE バッファ 265,714、journal 131,411、head 55,054）。V3 フレーム 6,123 / 9,314 / 31,203 B、gzip 後 1,838 / 2,658 / 4,265 B |

#### P1 配信・キャッシュ・未使用素材（2026-09-25）

- **P1-a（採用、`e947e2efb`）**: root `_headers` を新設し `ROOT_FILES` で mirror。immutable は `/vite-dist/assets/*` と、生成 HTML から `path?v=<内容 sha256 由来の版>` でだけ参照される CSS 24件・classic の `public/runtime.js`・`public/module-registry.js`・`entry-browser.js` に限定した。`_headers` はクエリを見ないため、起動版（registry の版）で版付けされる `styles-feature-gacha.css`・`styles-leaderboard.css`、版なしの `ui/layout-stage.js`、optional registry、HTML、`assets/**`、`data/**` は既定の revalidate のまま。splat の途中一致は資料上不明なためファイルを列挙した。Cloudflare 資料では `_headers` は Worker コードが生成した応答には効かないが、`run_worker_first` なしのこの構成では実在ファイルは Worker を通らずに配信される。`scripts/static-asset-headers.ts` で `_headers` を読み、`browser-production-delivery-smoke` は本番と同じ規則で応答する。`test/scripts.static-asset-headers.test.ts` が「immutable な各ファイルは生成 HTML の全参照が内容版と一致する」ことを固定する。
  - 検証: `worker:prepare`・`check:worker-mirror` 成功（P0 時点で残っていた mirror 失敗は解消済み）。`npx wrangler dev` で 28 規則が読まれ、`curl -I` で hash 付き JS・`styles-base.css?v=…` が `public, max-age=31536000, immutable`、`/`・`assets/asset-manifest.json`・`assets/images/cpu/level1.png`・`styles-feature-gacha.css`・`ui/layout-stage.js` が `public, max-age=0, must-revalidate`、`/_headers` は 404。`match:production-delivery-smoke:vite` pass（revalidate 11 / immutable 89 応答）。
  - 実測（wrangler dev、headless Chromium、同一コンテキストで2回訪問）: 2回目の訪問のサーバー要求 `_headers` なし 143（うち 304 が 142）→ あり 95（304 が 94）。再訪時の再検証往復 −48。
- **P1-b（採用、`d71980476`）**: `assets/asset-manifest.json` の取得を `cache: 'no-cache'` に変更。wrangler dev で2回目の起動は `304 Not Modified`（本文 0 B、初回 195,463 B）。manifest はガチャ・コスメ・手スキンのカタログがファイル一覧から素材を探索するため、絞り込みは行わず fetch オプションの変更だけにした（§4.2 の条件）。
- **P1-c（採用、`1dde2a0a9`）**: 除外リストに §3.1 の一覧を追加。root の素材は削除・移動していない。mirror から消えたのは 26 ファイル・35,940,776 B で一覧と一致。`check-asset-file-case` は追跡中の mirror ファイル削除を反映して pass、`match:asset-delivery-smoke:vite`・`browser-optional-feature-smoke` とも ok / resourceErrors 0。静的参照・パターン生成パス・manifest 走査（ガチャは `assets/images/Gacha` の画像拡張子のみ）のいずれも除外対象を選ばない。前計画で「隣の配信対象」の例として置かれていた `observer_will_character_only.png` はソース履歴上参照がなく、テストの例を実際に使う `observer_will.png` に置き換えた。asset manifest は root 生成を複写するため除外ファイルの行が残る（既存の `observer_will_reference/` と同じ状態で、消費側は選ばない）。
- **P1-d（採用、`548ecacb8`）**: 6枚を RGB PNG に再エンコードし、元の `sRGB`/`gAMA`/`pHYs` チャンクをバイト単位で移植した。全画素アルファ 255 を確認後、sharp・Pillow・Chromium（canvas `getImageData`）の3復号器で RGB/RGBA 全画素一致、Pixi 盤面キャプチャ（`tests/visual-regression`、392×392）は旧新 RGBA 完全一致、既存 baseline との差分 0 画素。−760,819 B（felt −188,196、stone-inlay −103,576、brushed-lacquer −161,306、card-back-hand −177,196、card-back-deck −78,112、99_究極労働神 −52,433）。felt の WebP は既存 policy のまま `rejected` で、再生成した候補 WebP の `outputSha256` は置換前と同一。
  - 既存の問題（今回の変更と無関係）: `assets:fonts:check` が `subset coverage mismatch for shippori-mincho-400: missing=1` で失敗する。HEAD のカード文言（`cards/catalog.ts` 等）に全角「１」（U+FF11）が入り、subset が再生成されていないため。フォント再生成は本計画の範囲外として残す。

#### P2-a 二重取得（非採用）

- boot capture の重複（felt、`cpu/level1.png`、`o-stone/{black,white}.png`、手札カード1枚）は、capture 用サーバーが `Cache-Control: no-store` を返すために起きていた。本番相当のヘッダ（wrangler dev、`max-age=0, must-revalidate` + ETag）で同じ起動を行うと、初回訪問で各 URL の要求は1回だけで、重複・304 とも 0 件だった（`artifacts/lightweight-2026-09-24/p1/wrangler-dev-noheaders.log`）。実配信で減る転送・要求がないため、取得経路の共有（Pixi の読み込み方式の変更を伴う）は行わない。harness 上の −3.5 MB は計測環境由来であり改善として扱わない。

#### P3-a view-scoped helper（採用、`0517e4bb7`）

- `countCornerControl` / `countEdgeControl`（`shared/board/control-counts.ts`）と commentary の `countCornerRiskCells` は、game/card-state の盤面なら helper 冒頭で view を一度解決し、`view.coordinates` の順に同じ所属・角（`computeCornerKeySetForCoordinates`、既存の角判定と同一アルゴリズム）・所有者の規則を適用する。検索用 context と dense 配列は従来の経路。公開 interface・戻り値・走査順は不変で、共有 getter を identity でキャッシュしない（helper 呼び出しごとに解決）。同一参照の盤面をその場で書き換えた後の再読込もテストで固定した。
- 同一性: `scripts/perf/compare-board-view-helpers.ts` で P0 の baseline `dist` と比較し、8×8×24、穴＋拡張、角の穴、circle 10×10、6×9 の 28 fixture × 両手番で件数と commentary metrics が完全一致。CPU 判断・commentary の既存 26 suite は既知の2件以外すべて通過。
- Node: `countEdgeControl` 1.44 → 0.026 ms（中央値、0.1 ms 未満）、`buildCpuCommentaryMetrics` 1.56 → 0.097 ms。
- ブラウザ（P3-a だけを外したビルドとの交互の再ペア、同一 fixture `f2d4a4e2…`、全シナリオで結果 digest 同一）: mobile `commentary-context` 中央値 9.5→1.8 / 11.1→2.0 / 16.0→2.4 / 8.7→1.6 / 8.5→1.7 ms（−79〜85%）。mobile 同期 中央値/p95 は 30.2/39.7→22.3/23.9、34.1/39.6→17.7/25.5、36.7/43.4→18.8/25.7、105.6/125.0→98.2/105.1、26.5/27.7→19.9/21.6 ms。desktop も全シナリオで中央値・p95 とも非悪化（Lv6 22.0/27.9→22.6/25.4）。heap 最終値 28.46→28.54 MiB（+0.08、閾値 1 MiB 未満）。
- 最初の対 P0 比較で desktop Lv6 の p95（30.0→45.0、変更対象外の `tactical-safety` stage の最悪2サンプル）と mobile Pixi 高頻度の p95（30.2→35.2、`presentation-handoff` の最悪2サンプル）が悪化したが、中央値は同じか改善していたため §6 の tail 規則に従い同条件で再ペア計測し、上記のとおり解消した。

#### P2-b `modulepreload` 注入（非採用）

- `vite.config.ts` の `transformIndexHtml`（`order: 'post'`）で、entry chunk の動的 import（`layout-stage`、`entry-browser`、Pixi `init`・`lib`）とその静的依存 24 chunk に `modulepreload` を注入する案を実装・計測した。Pixi runtime は DOM 指定時も常に読み込まれるため余分な転送はなく、Pixi が実行時に選ぶ renderer chunk は対象外にした。
- 同じ HEAD から注入なし/ありの `worker-public` を作り、standard boot capture を交互に計8回ずつ取得した（`artifacts/lightweight-2026-09-24/p2/p2b-{base,cand}-{1..8}.json`）。chunk の取得開始は `entry-browser` で中央値 200 → 9 ms に前倒しされ、warm の board-idle 中央値は 680.5 → 576 ms だったが、**cold の board-idle 中央値は 1,384.5 → 1,530 ms に悪化**し、交互の後半5組ではすべて注入ありが遅かった（1,468/1,534、1,357/1,526、1,370/1,582、1,399/1,567、1,417/1,554）。転送量・要求数は同等。
- §6 の「board ready 中央値が悪化」に該当するため非採用とし、差分は撤回した。ローカル配信では往復がほぼ 0 のため前倒しの利得が出ず、先行取得した Pixi ライブラリ等の解析がメイン chunk の実行と競合したと考えられる（原因の切り分けはしていない）。実回線での効果は未計測。

#### P3-b / P3-c（採用、`932333905` / `e9236db64`）

- P3-b: turn start 時点で既に存在した対象選択は、await もカード段階も挟まずに pending phase へ到達するため、`runCpuTurn` は解析 identity が current のときだけ invocation の turn-start commentary snapshot を pending phase に渡し、`card_targeted` はメモ済み metrics を読む。他の経路（カード使用直後の pending 等）は従来どおり再計算する。単体試験で、同一 invocation 内の `card_targeted` で metrics の構築が1回だけであることを固定した。
- P3-c: `[DRAW]` は debug session のときだけ同じ文言で出力、presentation debug の summary は出力時だけ構築（thunk）、debug flag の判定はクエリ文字列ごとに memo。`move-executor.ts` の debug 引数は軽いオブジェクトリテラルだけで重い構築がないため変更していない。実ブラウザ（`http://127.0.0.1:8000/?boardRenderer=pixi`、Vite/Pixi）で着手→Lv12 応答を行い、通常モードでは `[DRAW]`・`[presentation-debug]` とも 0 件、`debug=1` では `[DRAW] Card drawn for black! handBefore=0, handAfter=1` と `[presentation-debug] …` が従来どおり出ることを確認した。
- 回帰（P3-a の候補ビルドとの比較、同一 fixture、全シナリオで結果 digest 同一）: mobile 同期 p95 の差は最大 +1.9 ms（閾値 2 ms 以内）、multi-target の `commentary-context` 中央値 2.4→1.8 ms、desktop は全シナリオ非悪化、heap 最終値 28.54→28.51 MiB。

#### P4 CPU探索（a・b・c 採用、f 保留）

node clock、同一 fixture `6a919ce7…`、warmup 1・各5、直前の単位の `dist` を基準に固定して比較。全単位で 27 行（Lv10/11/12 × 9 fixture）の結果 digest が基準・P0 とも一致し、入力は不変。

| 単位 | 変更 | Lv10 合計 | Lv11 合計 | Lv12 合計 |
| --- | --- | ---: | ---: | ---: |
| P4-a `ff5cf8c1e` | `searchLv10`/`searchLv11` を `Board.withTopologyMemo` で包む | 6.55→5.89 s（−10.1%） | 12.01→10.09 s（−16.0%） | 18.06→18.37 s（+1.7%、未変更・ノイズ幅） |
| P4-b `efe0dda76` | `applyLv10Action` を `computeStateHash: () => null` の pipeline で適用 | 5.89→5.37 s（−8.7%） | 10.09→8.88 s（−12.0%、P4 前から累計 −26.1%） | 18.37→16.05 s（−12.6%） |
| P4-c `41847e233` | Lv10 評価器を `prepareBoardForSearch` の盤面で読む | 5.37→3.16 s（−41.2%） | — | — |

- P4-b: `applyLv10Action` は次状態だけを返し `stateHash` を外へ出さない。探索・battle・engine とも `stateHash` を読まないことを grep で確認し、`test/cpu.lv10-transition-pipeline.test.ts` で「共有 pipeline と同じ遷移」「到達状態の hash 計算が隠れた拒否経路にならない（`HASH_UNAVAILABLE` は現行ソースで投げる箇所がなく、hash 失敗は reject に分類される）」を固定した。P4-b の完了条件「Lv11 −20%」は計画時の数値が累計だったため累計で判定した（単独 −12.0%）。
- P4-c: `scripts/perf/verify-lv10-evaluation.ts`（`verify-production-optimization` の Lv10 版）で 558 局面×両手番の評価値が `Object.is` で一致。
- P4-f（保留）: `perf:production:verify` 相当（P0 baseline と現行の Lv11 評価器、6,086 局面・12,172 比較）は全一致、production selfplay の最小対局（Lv12 対 Lv11、256 遷移上限、12 手で `maxDecisions` による想定どおりの停止）は正常に動作した。ただし `production-parity-gate` は a04 の既存証拠（`data/cpu-lv11/browser-parity-v2/trace.json.gz`、`card-browser-v3`）で「Browser full-game initialization or terminal evidence is invalid」となり、**P0 の baseline dist でも同じく失敗する**（全局トレース取得後のルール変更で初期局面が一致しない）。gate の runtime hash には作業ツリーの `package.json`（Lv13 作業の差分あり）も含まれる。再生成には新しい全局ブラウザトレースと全カードのブラウザ証拠が必要で、Lv12/13 実験の所有者判断に委ねる。Lv13 作業は固定コピー（`data/cpu-lv13/baseline-start/repo`）を使うため今回の dist 変更の影響を受けない。

#### P5 通信・保存（採用）

- **P5-a `702d637c2`**: `frameCompression=deflate-raw` を query で交渉し hibernation `Attachment` に保存。Worker は各イベント（同じ SSE 封筒テキスト、1イベント1フレーム）を raw-deflate の binary フレームで送り、fanout 内で同じバイト列の圧縮結果を共有、ソケットごとに送信順を直列化する。health 応答は text のまま。クライアントは `binaryType='arraybuffer'`、復号を到着順の Promise 列で直列化して既存の `receive()` へ渡す。`DecompressionStream` 非対応や未知形式は交渉しない（text のまま）。計画の gzip ではなく raw-deflate にしたのはヘッダ/トレーラ 18 B/フレームを省くためで、対応ブラウザは同じ（`DecompressionStream` 導入時から3形式とも対応）。
  - 実フレーム（SSE 封筒込み、fixture）: light 6,159→1,844 B（−70.1%）、dense 9,350→2,664 B（−71.5%）、special-20 31,239→4,272 B（−86.3%）。
  - Worker 実 E2E（`npx wrangler dev`、同じ黒席に圧縮あり/なしの WS を同時接続、白席は圧縮あり、4手 publish 後に `lastEventId` で再接続）: `X-Match-Stream-Transport: websocket`、圧縮側は全イベントが binary、非圧縮側は text。接続時刻由来の `serverTime`・`remainingMs` を除きイベント本文・eventId・順序が一致し、再接続 replay も一致、白席へ黒の秘密情報は出ない。この序盤区間のイベント合計は 39,546→12,792 B（−67.7%、小さいフレームが多い区間）。非対応クライアントの模擬は単体試験で確認。
- **P5-b `fa0b21710`（S1 を修正して採用、S2 不要）**: V2/V3 compact の往復は、V2/V3 購読者へは再圧縮後に元と同じバイト列になるが、version を送らない SSE 購読者（`match:check` など）へは top-level の `playbackEvents` が欠けた payload を再送してしまう（`artifacts/lightweight-2026-09-24/p5` の往復試験）。そこで保存層（`split-history-v2`）で SSE 再送レコードを raw-deflate した JSON として保存し、読み込み時に `JSON.parse` で戻す方式にした。レコードは wire payload なので、出力される JSON はすべてバイト同一（`-0` 等の JSON で表せない値は元々 wire に出ない）。v1 は読み込み可能。special-20 の再送バッファ書き込み 265,714 → 18,898 B/publish（−246.8 KB）。~195 KB の JSON の圧縮＋展開は Node で中央値 1.17 ms。S1 で目標を満たしたため S2（journal からの再構築）は行わない。
- **P5-c `af4df6104`**: `split-history-v3`。`authorityLog` の要素を追記時に凍結し履歴と同じ要素ごとのキーのリングに、`initialSnapshotByViewer` を別キーにして内容が変わった時だけ書き、journal の base snapshot は退避元 journal エントリのキー参照にした。無いフィールドは無いまま、v1/v2 の root も読み込み可能。publish controller と同じく毎回 `authorityLog` を追記する harness（`artifacts/lightweight-2026-09-24/p5/publish-writes.js`）で、root の書き込みは special-20 75,486 → 13,744 B（＋ログ1件 319 B、−61.4 KB/publish）。P5-b と合わせた 1 publish の総書き込みは light 103,788→28,272、dense 145,749→42,558、special-20 472,624→164,378 B。
- **P5-d `a6744b08a`（golden 先行）＋`74ef6dea0`**: fixture 3種の authoritative/各視点 projected と境界形状の計23件の hash 文字列を旧実装で固定してから、clone を使わない stableStringify 等価の走査に置き換えた。構造化クローンがそのまま保たない値（関数・symbol・プレーンでないオブジェクト）を含む snapshot は従来の clone 経路を使う。23件すべて同一、4 hash/fixture が 0.32/0.36/0.46 → 0.19/0.21/0.29 ms。
- `test:network:parity`・`test:match:parity` は、既存の失敗1件（`network.playback-event-assembly.contract` の「deferred pending selection registry entries stay covered by playback parity fixtures」: 輪廻の意志 `REINCARNATION_WILL` の playback parity fixture が `bfd7ee626` 以降未追加）を除き通過。
