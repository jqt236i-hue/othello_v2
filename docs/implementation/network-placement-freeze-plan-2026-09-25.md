# ネット対戦の着手時フリーズ 改善計画（2026-09-25）

役割: ネット対戦モードで石を置いたとき（自分の着手・相手の着手の受信）に画面が一時的に固まる症状について、2026-09-25 の読み取り専用調査と実ブラウザ計測で得た原因と、UX・UI・ゲーム体験を一切変えずに実施できる改善候補を、変更境界・同一性の検証方法・期待効果・完了条件・順序つきでまとめた実行計画。正本は [ゲーム仕様](../../01-rulebook.md) と [内部契約](../architecture-contracts.md) §7.2–7.3、§8。ルール、authority の結果、playback イベントの列・順序・`eventId`、再接続と replay、非公開情報の投影、演出の見た目・順序・時間・音、入力方法・入力ロック、Single Visual Writer、起動順と配信契約を変更する仕様書ではない。

状態: **計画（未着手）。** 製品コードの変更・本番デプロイ・長時間訓練は行っていない。§9 の進捗表は空。

前計画 [体験を維持する全面軽量化計画（2026-09-24）](ux-preserving-lightweight-plan-2026-09-24.md) は完了済み。そこで実施した P5（WS フレームの raw-deflate 圧縮、`split-history-v3`、snapshot hash の複製なし計算）と P3（相手手番の commentary metrics 再利用、view-scoped helper、debug 遅延構築）、および同 §2 で否定した候補（クライアント apply 経路の置換、状態クローンの置換、通信 V4 codec）は本計画で再提案しない。

## 1. 選定方針と完了条件

ユーザーが見る・聞く・操作する結果を一切変えずに、着手・受信・決着の各時点でメインスレッドを占有する同期処理を減らす。判断は前計画 §6 の規則を踏襲し、「同じ入力に対して同じ出力（イベント列・画素・順序）が出るか」を先に確認し、そのうえで同一条件のベースラインと交互計測で比較する。

| 受入条件 | 内容 | 検証段階 |
| --- | --- | --- |
| A1 通信の一致 | authority の結果、playback イベント列と順序、`eventId`、`visualSeq`、再接続・replay、投影（§8）が一致 | 各単位 |
| A2 表示の一致 | 決着後の盤面フレーム（model revision と画素）、手札・ステータス・ログの DOM、演出の順序・時間・音が一致。入力ロックの解放時点が同じ | 各単位 |
| A3 性能の改善 | §3 の計測ハーネスで、対象の長タスク（着手・受信・決着）の中央値と p95 が改善し、他の場面で悪化しない（§6） | 各単位・統合 |
| A4 境界の維持 | §7.2 の intake → canonical → timeline → playback → committed frame の順序、§7.3 の writer 所有権、§8.5 の precedence を変えない | 各単位 |
| A5 通常配信 | 実装時は最終ソースを `npm run build:vite` で通常 8000 へ反映し、Worker mirror を整合させ、今回分だけをコミット | 統合 |

対象外: 回線待ちを演出で隠す案、演出の短縮や省略、playback 中のフレームレート方針の変更、Pixi ticker の上限変更、状態の投影方式・hash の意味の変更、本番デプロイ、長時間訓練。

## 2. 調査時点と既存作業

- 調査日: 2026-09-25。作業ツリーには Lv13 開発（`game/ai/cpu-lv13-*.ts`、`docs/cpu-lv13-development-plan.md`、`scripts/*cpu-experiment*`、`package.json`）、制作素材（`assets/Reversi Destiny ～黒白の運命～v1/*.png`、`assets/ラノベ/`、`observer_will_reference/`）と両 asset manifest の差分が別作業として残っている。本計画はそれらに触れない。
- `dist/`・`vite-dist/` は 2026-09-25 04:56–04:57 のビルド（HEAD `2f7fdc9b7` 以降のソースと同時刻）。計測はこの生成物に対して行った。
- 8000 の通常配信サーバー（`serve-with-fallback` → `http-server`、PID 12824）は停止・再起動していない。計測は別ポートの一時サーバーで行い、終了時に片付けた。
- 計測成果物は git 管理外の `artifacts/network-placement-freeze-2026-09-25/` に置いた（§3.1）。

## 3. 再現条件と計測方法

### 3.1 計測ハーネス（調査用、製品コードではない）

`artifacts/network-placement-freeze-2026-09-25/harness/net-freeze-harness.js` を Node から実行する。内容:

- リポジトリ root を静的配信する一時サーバーと、in-process の `dist/scripts/local-match-server.js`（SSE）を起動する。`--server http://127.0.0.1:8799` で `npx wrangler dev --port 8799`（WebSocket、raw-deflate 交渉あり）にも接続できる。
- Playwright Chromium（`--use-gl=angle --use-angle=d3d11`、GPU: NVIDIA RTX 2070、gpuCompositing/webgl とも enabled）で黒席・白席・観戦者の 3 コンテキストを開き、`ui/handlers/match-mode` の `setMode('network')` → `createRoom` / `joinRoom` / `spectateRoom` で同じ部屋に入る。`--mobile --throttle 4` で 390×844 / DPR2 / CPU 4x throttle（`Emulation.setCPUThrottlingRate`）。`--lane classic` で `index.classic.html`（未 minify、関数名が読める）を使う。
- 着手は現在手番の画面で `window.handleCellClick(row, col)` を呼ぶ（実際の盤面入力と同じ入口）。合法手は各画面の `game/move-generator` から選び、local server では authority の snapshot に turn-start 段階を複製した合法手と照合する。
- 各画面に `PerformanceObserver`（`long-animation-frame` と `longtask`）、RAF 間隔、`fetch` の開始・ヘッダ・本文完了、`EventSource` / `WebSocket` の到着時刻、`performance.mark`（`np:click`、`np:fetch-*`、`np:stream-arrive`、`np:version-change`、`np:playback-start`、`np:playback-idle`）を仕込む。playback の開始・終了は `ui/playback-state-manager` の `getPlaybackActive` / `hasPendingVisualPlayback` を RAF で監視する。
- `--trace` で browser 全体の CDP Tracing（`devtools.timeline`、`disabled-by-default-v8.cpu_profiler`、`disabled-by-default-v8.gc`、`blink.user_timing`、`toplevel`）を着手ごとに取り、`trace-analyze.js` が pid ごとに分割してメインスレッドの `RunTask` ≥ 16 ms、区間ごとの busy 時間、GC、CPU プロファイルの帰属を出す。`trace-tree.js` は任意区間の呼び出し木、`trace-callers.js` は特定関数の呼び出し元を集計する。
- fixture は `test/helpers/network-special-stone-performance-fixtures.ts` の `baseline-light` / `late-dense` / `late-special-20`（8×8 密盤面に HYPERACTIVE / DESTROY_DRAGON / TIME_BOMB / PROTECTED / GHOST / LIVING_WILL 計 20 個）を `patchRoomSnapshotForTests` で部屋に差し込む。fixture は黒の turn-start 直前の状態なので、白を先に着手させ、その command 内で authority が黒の turn-start（爆弾、ドラゴン、可動石）を適用して重い playback を全画面に配る。続けて黒が返す。
- `opening` シナリオは新規部屋で 12 手を交互に打ち、手数による変化を見る。

計測器の限界: (1) LoAF の `scripts` 帰属は Vite の minify 名では読めないため、帰属は classic lane の CPU プロファイルで取った（処理は同じソース）。(2) ハーネスの監視ループが当初 `NetworkMatchClient.getState()` を毎フレーム呼び、`getState` が部屋メタデータを毎回 5 回 `structuredClone` するため、着手あたり約 3,400 回のクローンがハーネス由来で計上された（`out/t9-*` / `out/t10-*`）。監視を 6 フレームに 1 回へ修正済み。アプリ自身のクローンは着手あたり 20–35 回（snapshot 大のものは 5 回）で、この誤計上は長タスクの帰属には影響しない（別タスクで走る）。(3) 実機・iOS Safari・実回線・本番 Durable Object は未計測（§8）。(4) カード使用・pending 選択の着手はハーネスで駆動していない。(5) 同じ fixture を CPU 戦（human vs human ローカル）で再生する比較は、fixture を直接注入すると local playback settlement が拒否されて成立しなかったため、既存の `scripts/perf/measure-opponent-action-frame-stall.ts` の序盤シナリオを比較に用いた。

### 3.2 実行した計測と成果物

| ラベル | 条件 | 成果物（`artifacts/network-placement-freeze-2026-09-25/out/`） |
| --- | --- | --- |
| t1 | Vite / desktop / local SSE / late-special-20 ×2 | `t1-vite-desktop.json`、`trace-t1-*.json` |
| t2 | Vite / mobile 4x / local SSE / late-special-20 ×2 | `t2-vite-mobile-x4.json`、`trace-t2-*.json` |
| t3 | classic / mobile 4x / local SSE / late-special-20 ×2（帰属用） | `t3-classic-mobile-x4.json`、`trace-t3-*.json` |
| t4 | Vite / mobile 4x / local SSE / opening 12 手 | `t4-vite-mobile-x4-opening.json` |
| t5 | Vite / desktop / local SSE / opening 12 手 | `t5-vite-desktop-opening.json` |
| t6 | Vite / desktop / wrangler dev WebSocket / opening 8 手 | `t6-vite-desktop-ws-wrangler.json` |
| t7 | Vite / mobile 4x / wrangler dev WebSocket / opening 8 手 | `t7-vite-mobile-x4-ws-wrangler.json` |
| t8 | WS の交渉確認（`frameCompression=deflate-raw`、binary フレーム） | `t8-ws-probe.json` |
| t9 / t10 | clone / JSON 呼び出し回数（t10 は呼び出し元つき） | `t9-vite-desktop-ops.json`、`t10-classic-desktop-callers.json` |
| cpu | `measure-opponent-action-frame-stall` lightweight-mobile 4x quick | `cpu-stall-mobile-x4.json` |

## 4. 計測結果

数値はこの開発機（Windows 11、Chromium 143 headless、RTX 2070）での値。desktop は throttle なし、mobile は 390×844 / DPR2 / CPU 4x。時刻は着手側では `handleCellClick` 呼び出し、受信側では stream 到着を 0 ms とする。

### 4.1 段階ごとの時間（自分の着手）

| 条件 | click→publish 送信開始 | 送信→応答ヘッダ | stream 到着 | playback 開始 | playback 時間 | 決着タスク |
| --- | --- | --- | --- | --- | --- | --- |
| desktop / opening（t5, 12 手） | 3–8 ms | 20–50 ms | 13–35 ms | 22–50 ms | 735 / 1,540 ms | 8–15 ms（長タスクなし） |
| desktop / late-special-20（t1） | 8 ms | 40–90 ms | 50–95 ms | 62–110 ms | 6.8–10.6 s | 26–30 ms |
| desktop / opening WS（t6, wrangler） | 4–7 ms | 30–40 ms | 24–34 ms | 35–47 ms | 1.5 s | 16–21 ms |
| mobile 4x / opening（t4） | 17–33 ms | 70–110 ms | 33–63 ms | 78–130 ms | 0.8–1.7 s | 52–76 ms（初手 81–95） |
| mobile 4x / late-special-20（t2/t3） | 22–47 ms | 80–130 ms | 130 ms | 106–214 ms | 6.9–10.9 s | 109–212 ms |
| mobile 4x / opening WS（t7） | 19–48 ms | 30–100 ms | 42–85 ms | 91–212 ms | 1.5 s | 72–103 ms |

- click→publish 送信開始は同期処理（`handleCellClick` → `executeMove` → `queueBoardPlacementPublish` → `publishSnapshot`）で、desktop 4–8 ms、4x で 17–47 ms。うち約 12 ms（4x）は `beginPlacement` → `setPreviewHints` が `deferRender` なしで `renderBoard()` を同期実行するフレーム構築と Pixi 適用（`ui/network/placement-feedback.ts:102`、`ui/board-visual/input-runtime.ts:51-89`）。
- 送信→応答の待ちは回線と authority の処理時間で、ローカルでは 20–130 ms。この間メインスレッドは空いている（trace の busy は wall より小さい）。
- stream 到着から playback 開始までは同期処理が連続する（§4.3 の「受信タスク」）。

### 4.2 受信側（相手の着手・観戦）

| 条件 | 到着→playback 開始 | 到着タスク（最長） | 決着タスク | 着手あたり LoAF blocking 合計 |
| --- | --- | --- | --- | --- |
| desktop / opening | 10–16 ms | 10–15 ms | 8–14 ms | 0 |
| desktop / late-special-20 | 15–23 ms | 19–21 ms | 26–28 ms | 0–37 ms |
| mobile 4x / opening | 50–78 ms | 48–77 ms（初手 136） | 52–76 ms | 0–74 ms（初手 102–129） |
| mobile 4x / late-special-20 | 75–105 ms | 56–102 ms | 119–212 ms | 75–528 ms |
| mobile 4x / opening WS（wrangler） | 66–184 ms | 62–93 ms（初手 174） | 65–90 ms | 10–95 ms（初手 156–176） |

観戦者は受信側と同じ経路で、両席の着手を受けるため回数が 2 倍になるだけで内訳は同じ（t2: 観戦 loafBlock 399–501 ms / 着手）。

### 4.3 長タスクの内訳（classic lane、mobile 4x、late-special-20、`trace-t3-*`）

受信側の到着タスク 101.7 ms（`artifacts/network-placement-freeze-2026-09-25/out/trace-t3-classic-mobile-x4-late-special-20-0-white-black.json`、`harness/trace-tree.js … task:1`）:

| ms | 経路 |
| --- | --- |
| 54.0 | `handleParsedStreamEvent` → `handleStreamSnapshotPayload`（`ui/network/transport.ts:181`、`ui/network/stream-snapshot.ts:33`） |
| 31.1 | └ `submit` → `applyCanonicalSnapshot` → `applySnapshot`（`ui/network/intake-coordinator.ts:273`、`ui/network/snapshot.ts:853`） |
| 22.0 | 　└ `finalizeSnapshotPresentation` → `refreshUi` → `emitGameStateChange` → `ui.ts:402` の `_runWhenPlaybackIdle(renderBoard + updateStatus)` が**同期実行**（timeline がまだ playback を claim していないため idle 判定） |
| 11.3 | 　　├ `renderBoard` → `_buildBoardVisualFrameForBoardRenderer`（全セルのモデル構築 + `getBoundingClientRect` 3.2）→ `commitEquivalentIdleFrame`（着手前と同じ内容なので 1.1 ms で棄却） |
| 10.7 | 　　└ `updateStatus`（`ui/status-display.ts`）: `updateCpuCharacter` 5.4（`syncDisplayedHandSkin` → hand-skin catalog を manifest から再構築 `getAllItems` → `collectGeneratedItems` → `buildCatalogFromAssetManifest`）、`updateBattleStatusPanel` 5.3 |
| ~5 | 　└ clone・`inspectBoardState`・`freezeOwnedData`・`replaceObjectState` ×2（`ui/network/snapshot-canonical.ts:513`、`ui/network/snapshot.ts:254`, `:954`） |
| 11.6 | └ `applyPayloadSessionState`: `updateRoomSeatsFromPayload` が `seats` 等のキーが**存在するだけ**で `roomStateListener` を呼び（`ui/network/session-seat.ts:251-289`）、listener が `refreshNetworkChatVisibility`・`renderNetworkDeckInfo`・`updateCpuCharacter`（再び catalog 再構築 6.7）を実行（`ui/handlers/match-mode/network-client-listeners.ts:153-171`）。timer listener 1.6 |
| 3.9 | └ `normalizeNetworkSnapshotEnvelope` → `unpackPlaybackEvents`（V3 packed の復元） |
| 2.6 | └ `emitPayloadEffectLogs` |
| 19.1 | microtask: `RenderScheduler.flushNow` → `renderCardUI`（`cards/card-renderer.ts:1836`）: `_syncHandAvailabilityGlowLayer` の `scrollLeft` 読み 7.5（強制レイアウト）、`_drainChargeDeltaPopups` → `_positionChargeDeltaEl` の `getBoundingClientRect` 3.1 |
| 11.8 | microtask: `_syncDisplayedHandSkinForAnimation` → `resolveHandAnimationContext`（hand-skin catalog 再構築 3 回目、6.3） |

受信側の決着タスク 163.2 ms（同 trace、`task:0`、`np:playback-idle` の直前）:

| ms | 経路 |
| --- | --- |
| 78.8 | Pixi backend `commitWork` → `applySceneAndRender`（`ui/pixi/board-backend.ts:1125`, `:1026`）: `scene.applyFrame` 40.2（`prepareStaticVisual` 13.1 に `drawShadowGradient`・`createPixiText`、`syncPlaybackGhosts` 6.8、`removeAndDestroyPixiChildren` 2.1）+ Pixi `render` 34.8（`collectRenderablesWithEffects` 29.0） |
| 17.6 | `advanceActiveSettlement` → `applyCommittedFrame` → `applyCommittedBoardVisualFrame` → **フレーム構築 1 回目** `_buildBoardVisualFrameForBoardRenderer` 11.9（`ui/board-visual/writer-runtime.ts:499-524`） |
| 11.4 | `performLocalWriterSettlement` → `applyReadyFrame` → **Pixi commitWork 2 回目** 8.4（`ui/board-visual/controller.ts:1404` 経由） |
| 11.4 | `flushBoardPresentationEvents` → `settleAutoBoardVisualWriter` → `_buildFinalBoardVisualFrameForWriter` → **フレーム構築 2 回目** 10.4（`getBoundingClientRect` 4.0）（`ui/presentation-handler.ts:1630`、`writer-runtime.ts:139`, `:542`） |
| 9.7 / 9.5 | GC / (program) |
| 8.2 | `renderCardUI`（`scrollLeft` 3.6） |
| 5.8 | `_syncSettledBoardInputForBoardRenderer` → `renderCurrentStoneInfoPanel` |
| 3.1 | `prepareResources` |

着手側のクリックタスク 70.6 ms（`trace-t3-…-0-white-white.json`）: `handleCellClick` 35.4 = `executeMove` 24.6（`queueBoardPlacementPublish` 18.3: `beginPlacementFeedback` → `setPreviewHints` 11.9 のフレーム構築 + Pixi commit、`publishCommand` 4.7）+ `findMoveForCellInState` 1.6、続く microtask 33 ms（hand-skin animation context 等）。着手側の決着タスクは受信側と同じ構成で 151.8 ms。

その他、mobile 4x で観測した長タスク:

- 初回の効果音: `_playStonePlaceSoundSafe` → `SoundEngine.init` → `_ensureAudioContext` の `new AudioContext()` が self 33–45 ms（desktop Vite 34 ms、`sound-engine.ts:191-212`）。ページ生存中 1 回だけ、対局の最初の石で発生する。`unlockAudio` を呼ぶ入口は `ui/` `game/` `browser-vite/` に無い。実プレイではユーザー操作が先行するが、AudioContext の生成自体は最初の効果音まで遅延される（実機未確認）。
- phase 起動の `TimerFire` 50–75 ms: `playPhase` → `flushInitialRuns` → Pixi `render` 25 ms + `startBatch` 22 ms（`compilePixiSourceTrajectoryRenderPlan`、`buildTextureRequests`、`cloneFrameSkin`、`matchMedia` 1.9）。
- RAF の `_tick` 40–52 ms（Pixi render 17–20 + `playMoveTarget` 等）。
- GC: MajorGC 18–43 ms（受信側の 4x で `V8.GC_MARK_COMPACTOR` 42.7 ms、着手あたり合計 8–93 ms、5–17 回）。desktop は合計 6–35 ms。

### 4.4 切り分け

- **回線待ちか処理か**: 送信→応答の区間はメインスレッドが空く（busy ≪ wall）。固まりは到着タスク（56–102 ms）と決着タスク（109–212 ms）の同期処理であり、4x throttle でこれらが 100 ms を超える。desktop では同じ処理が 10–30 ms で、長タスクにならない。
- **自分の着手と相手の着手**: 自分の着手は「クリックタスク + 到着タスク + 決着タスク」、相手の着手は「到着タスク + 決着タスク」。自分の着手側には publish 応答と stream の二重受信があるが、二重適用は `seenByOperationAndVersion` / `appliedVersion` で抑止され、余分な処理は 2 回目の `JSON.parse` と envelope 復元・`normalizePresentationFrame` 程度（合計数 ms）。stream が先に届いた場合だけ `shouldSkipPublishResponseSnapshot` が snapshot 全体の clone 4 回 + `JSON.stringify` 2 回を行う（`ui/network/playback-recovery.ts:112-131`、`:34-59`）。
- **カード・特殊石の有無**: 序盤（8 KB 応答、演出 1–2 phase）でも 4x では到着 48–77 ms・決着 52–76 ms の長タスクが毎手出る。特殊石 20 個の fixture ではどちらも約 2 倍になり、playback 中の phase 起動と GC が加わる。
- **手数依存**: opening 12 手で到着・決着タスクに増加傾向なし（t4）。クライアントに履歴長に比例する処理は無い。authority 側も ring（journal 8 / SSE 8 / log 64）で頭打ち。
- **転送方式**: wrangler dev の WebSocket は `frameCompression=deflate-raw` を交渉し、binary フレーム 2.56–2.78 KB（同じイベントの publish 応答 JSON は 8.0–8.5 KB）で届く（t8）。`DecompressionStream` の復号は非同期でメインスレッドを占有せず、到着タスクの大きさは SSE と同じ（62–93 ms @4x）。
- **CPU 戦との差**: CPU 戦（`measure-opponent-action-frame-stall` lightweight-mobile 4x、序盤）は同期処理の中央値 20–25 ms で、長タスクは Lv6 の探索（113 ms、意図した CPU 思考）を除きほぼ無い。ネット対戦は同じ盤面で到着タスクと決着タスクが毎手加わる。差分は (a) intake 時の同期 `renderBoard`/`updateStatus`/部屋状態 listener、(b) 決着時の committed frame 適用 + local writer 決着 + final frame の 3 段、(c) 着手側の preview hint 描画。
- **authority 側**（読み取り監査、未計測）: `utils/match-publish-controller.ts` の 1 publish は、`stateHashBefore` の再計算（`room.authoritativeStateHash` と同値）、同じ playback events の digest 3 回（`utils/match-authority/presentation-journal.ts:37-43`）、journal・snapshot payload・SSE 再送レコードでの投影 snapshot の deep clone 約 7 回/視点と `freezeOwnedData` の再帰 walk 約 15 回、`match-room-storage.ts:115-192` の保存前の `deepClone(head)` と変更検出用 `JSON.stringify` を含み、SSE 再送レコードの raw-deflate（`CompressionStream`、非同期）と storage transaction、`setAlarm` を await してから HTTP 応答を返す。ローカルでは送信→応答が 20–130 ms なので、クライアントの固まりの主因ではないが、本番の応答時間には効く（§8）。

## 5. 原因の結論

確定（計測で確認）:

1. 固まりはメインスレッドの同期処理で、回線待ちではない。4x throttle 相当の端末で、相手の着手受信時に 50–100 ms、決着時に 50–210 ms、自分のクリック時に 30–80 ms の長タスクが**毎手**発生する。desktop では同じ処理が長タスクにならない。
2. 到着タスクの半分以上は canonical 適用そのものではなく、その中で同期実行される UI 更新である: `GAME_STATE_CHANGED` による着手前フレームの全構築（結果は等価フレームとして棄却される）、`updateStatus` と部屋状態 listener による `updateCpuCharacter` → hand-skin catalog の manifest からの再構築（1 手で 3 回）、`renderCardUI` の強制レイアウト（`scrollLeft`、`getBoundingClientRect`）。
3. 決着タスクは committed frame の Pixi 適用に加えて、同じ最終盤面のフレーム構築が 2 回、Pixi `commitWork` が 2 回走る（strict network の committed frame、local writer settlement、presentation drain の final frame）。Pixi 側では `applyFrame` の静的描画の再生成（shadow gradient、text）と `collectRenderablesWithEffects` が大きい。
4. 自分の着手では `setPreviewHints` が同期 `renderBoard()` を伴い、クリックの同期処理を約 12 ms（4x）延ばす。
5. 対局の最初の効果音で `new AudioContext()` が 33–45 ms（4x）を同期で消費する。
6. 手数・履歴長・WS の復号・JSON.parse（2 回で 0.3 ms）・snapshot の clone/freeze（合計 5 ms @4x）は主因ではない。

推測（未確認）:

- 実機（Android 中位機、iOS Safari）では 4x throttle より重い可能性がある。Safari は `long-animation-frame` 非対応のため別の計測（`longtask` 非対応も多い）が要る。
- 本番の Durable Object では送信→応答が 100–300 ms 級になり得るが、それは「石が置かれるまでの待ち」であり固まりではない。ただし出力ゲート（storage transaction と `setAlarm` の確定待ち）で応答が遅れる分は §4.4 の authority 側の処理削減で縮む余地がある。
- ping/health の `stateVersion` 競合（保存後・配信前の窓）で `/api/match/state` 再同期が走ると、到着タスクと同じ処理が追加で発生する（コード上の経路、頻度は未観測）。
- カード使用・pending 選択の着手は未計測。同じ intake・決着経路を通るため同じ長タスクが出ると推測する。

## 6. 改善候補

各候補は、同一性の検証を先に行い、満たさなければ採用しない。効果の見込みは §4.3 の classic 4x 計測から積み上げた概算で、Vite 本番ビルドでの実測を完了条件にする。

### C1 決着時の重複フレーム構築と二重 Pixi 適用の解消

- 変更の境界: `ui/board-visual/writer-runtime.ts` の `applyCommittedBoardVisualFrame` / `settleAutoBoardVisualWriter` / `_buildFinalBoardVisualFrameForWriter`、`ui/board-visual/controller.ts` の `settleLocalWriter` → `performLocalWriterSettlement` と `commitEquivalentIdleFrame`、`ui/presentation-handler.ts` の `flushBoardPresentationEvents` と `requestBoardSyncAfterPlaybackClaimRelease`。strict network の committed frame が適用済み（`networkCommittedApplied`）のとき、直後の local writer settlement と drain の final frame は同じ `modelCommitId` / `visualRevision` のフレームになるので、(a) 直前に構築した committed frame を token に紐づけて再利用し、(b) 内容が等価なら backend の `applyFrame` を呼ばず `commitEquivalentIdleFrame` と同じ受理経路（presentation begin/commit のみ）で決着させる。writer の claim / release の順序、`applyCommittedFrame` 成功後にだけ settle する契約（§7.3）、`BoardVisualInvalidationAccumulator` の記録は変えない。
- 同一性の検証: `__boardVisualDebug.getBackendDiagnostics()` / `getVisualFrameDigest()` を `visualSeq` ごとに記録し、決着後の frame digest・model revision が旧新で一致。`match:pixijs-board-playback-check`、`test/ui.board-visual*.test.*`、`test/ui.presentation-handler*.test.*`、`test/ui.network-snapshot.single-writer-baseline.test.ts`、`npm run test:visual`。決着直後のスクリーンショット（Playwright `page.screenshot`）の画素一致。
- 期待効果: 決着タスク −20〜−30 ms（4x、フレーム構築 1 回 10–12 ms + Pixi commit 1 回 8 ms + `getBoundingClientRect` 4 ms）。
- 完了条件: 決着タスクの中央値と p95 が late-special-20 と opening の両方で改善し、`recordFinalFrameBuild` の回数が 1 着手 1 回。
- リスク: `pendingLatest` に別フレームが積まれている場合（playback 中に届いた render 要求）は等価にならないので、その場合だけ従来経路を残す。DOM compatibility backend でも同じ短絡が成立することを `match:pixi-runtime-fallback-check` で確認する。

### C2 intake 時の同期 `renderBoard` の抑止（presentation frames を伴う snapshot）

- 変更の境界: `ui/network/intake-coordinator.ts` の `buildNetworkIntakeApplyOptions`（`skipBoardUpdate: true` を既に渡している）から `ui/network/snapshot.ts` の `finalizeSnapshotPresentation` → `refreshUi` へ「frames が enqueue される」ことを伝え、`emitGameStateChange` の代わりに `ui.ts:402` の deferred 経路（`_deferUiSyncUntilPlaybackIdle` と同じ `renderBoard: true` の遅延）を使う。`updateStatus` と `requestCardUiSync` は現状どおり即時に呼ぶ（手番表示・手札の更新タイミングを変えないため）。frames が無い snapshot（再同期、pass、結果）は従来どおり同期 `renderBoard`。
- 同一性の検証: 到着直後のフレームは `commitEquivalentIdleFrame` で棄却されている（§4.3）ので、抑止しても表示は変わらない。`test/ui.network-snapshot*.test.*`、`test/ui.network-client.apply-coordinator.test.ts`、`npm run test:network:parity`、決着後 frame digest の一致、`updateStatus` の DOM（`#status` 等）の更新時刻が旧新で同じ着手フェーズにあること。
- 期待効果: 到着タスク −11 ms（4x）。
- 完了条件: 到着タスクの中央値 −10 ms 以上、frames 無し snapshot の描画が従来どおり同期。
- リスク: `_hasPendingPlaybackOrPresentation()` が false のまま遅延キューに積まれた `renderBoard` は playback 完了時に flush される。timeline の drain が何らかの理由で始まらない場合に備え、`drainPresentationTimeline` が frames を dispatch できなかったとき（`recoverPresentationContinuity` 経路）は即時 `renderBoard` に戻す。

### C3 部屋状態 listener と `updateCpuCharacter` の重複実行の解消

- 変更の境界: (a) `ui/network/session-seat.ts:251` `updateRoomSeatsFromPayload` で、正規化後の `roomSeats` / `seatNames` / `seatHandSkins` / `roomDeck` / `roomBoardConfig` / debug / auto の各値を前回と比較し、変化があるときだけ `emitRoomStateChanged()` を呼ぶ（listener の引数の内容は変えない）。(b) `ui/status-display.ts:1196` `updateCpuCharacter` → `syncDisplayedHandSkin` → `resolveHandAnimationContext` が毎回 `getAllItems` → `collectGeneratedItems` → `buildCatalogFromAssetManifest` で catalog を再構築している点を、hand-skin catalog module 内で manifest の同一性（参照または `files` 配列長 + version）を key にした memo にする。catalog の内容・順序・返り値の形は変えない。(c) 同一 tick 内の 3 回目（`_syncDisplayedHandSkinForAnimation`）は (b) で解消される。
- 同一性の検証: `test/ui.hand-skin-*.test.ts`、`test/ui.status-display.*.test.ts`、`test/ui.network-client*.test.*` の listener 系、部屋状態 listener が呼ばれるべき変化（入室、退室、hand skin 変更、deck 変更、debug/auto 切替）で従来どおり呼ばれる回帰テストを追加。`#cpuCharacterImg` / `#hero-label` / deck 表示 / chat 表示の DOM が各着手で旧新一致。
- 期待効果: 到着タスク −15〜−20 ms（4x: listener 9.4 + catalog 再構築 3 回 ≈ 10）。
- 完了条件: 着手あたりの `buildCatalogFromAssetManifest` 呼び出し 0 回（初回 memo 後）、`roomStateListener` の呼び出しが変化時のみ。
- リスク: manifest がカスタムスキン登録（§7.5.1）で更新される経路は memo を無効化する必要がある。listener 抑止は `hasTwoPlayers` などの派生値が変わる条件を比較対象に含める。

### C4 `renderCardUI` の強制レイアウト削減

- 変更の境界: `cards/card-renderer.ts` の `_buildHandGlowScrollKey`（`scrollLeft` / `scrollTop`）と `_positionChargeDeltaEl`（`getBoundingClientRect`）を、同一 `renderCardUI` 呼び出し内で 1 回だけ読む（レイアウト読み取りをまとめ、書き込みの後に読まない）。glow layer の位置計算と charge delta popup の位置は同じ値で計算する。
- 同一性の検証: `test/ui.card-renderer-*.test.ts`、`test/ui.hand*.test.*`、glow / popup の最終座標が旧新で同一（style の値を比較）。
- 期待効果: 到着 −5〜−8 ms、決着 −3 ms（4x）。
- 完了条件: `renderCardUI` 1 回あたりの強制レイアウト回数が 1 以下（trace の `Layout` / `UpdateLayoutTree` 子イベントで確認）。
- リスク: 手札スクロール中にレイアウトが変わる場面で座標がずれないよう、既存の `handGlowLayoutCacheByContainer` の dirty 判定を残す。

### C5 自分の着手時の preview hint 描画の軽量化

- 変更の境界: `ui/board-visual/input-runtime.ts:110` `setBoardPresentationPreviewHints` → `_requestBoardInputOverlayRenderForBoardRenderer` → `renderBoard()` は現状、overlay（hint）だけの変化でも `_buildBoardVisualFrameForBoardRenderer` の全モデル構築を行う。`ui/board-visual/frame-runtime.ts` / `ui/board-visual/model-builder.ts` で、盤面 model の入力（`peekRenderSnapshot` の参照、`modelCommitId`、topology、appearance）が前回と同一なら model を再利用し、overlay/hint 部分だけを compose し直す。hint の表示タイミング（クリック直後の同期描画）は変えない。
- 同一性の検証: hint を含むフレームの `visualRevision` と画素の一致、`test/ui.board-visual*.test.*`、`test/ui.board-input*.test.*`、`match:ui-control-smoke:classic`。
- 期待効果: クリック同期処理 −8〜−10 ms（4x）。
- 完了条件: クリック→publish 送信開始の中央値が 4x で 20 ms 未満。
- リスク: model の再利用条件を厳密にしないと古い盤面を描く。`render-state-source` の pair 選択（§7.3）は変えず、model のキャッシュ key に snapshot の identity を含める。効果が小さければ非採用。

### C6 AudioContext の事前生成

- 変更の境界: `sound-engine.ts` の `_ensureAudioContext` を、対局開始（部屋の対局成立時、または最初のユーザー操作 `pointerdown`）に一度呼ぶ。効果音・BGM の再生タイミング・音量・`init()` の resume 挙動は変えない。生成だけを playback の外へ動かす。
- 同一性の検証: 最初の効果音の再生時刻（`playEffectByKey` の呼び出し順）が同じ、`test/sound-engine.*.test.ts`、実ブラウザで対局の最初の石で音が鳴る。autoplay policy 上、ユーザー操作の後に生成すること。
- 期待効果: 対局の最初の着手の決着/playback 内の長タスク −33〜−45 ms（4x、1 回だけ）。
- 完了条件: 最初の着手の playback 中に `_ensureAudioContext` self time が 1 ms 未満。
- リスク: 実プレイでは既にユーザー操作で AudioContext が生成されている可能性がある（ハーネスは操作なしで JS 呼び出し）。実ブラウザで最初の着手の trace を取り、`new AudioContext()` が playback 中に出るかを先に確認し、出なければ非採用。

### C7 Pixi committed frame 適用の静的描画再利用（調査から）

- 変更の境界: `ui/pixi/board-scene.ts` `applyFrame` の `prepareStaticVisual`（`drawShadowGradient`、`createPixiText`）が決着時に再実行され、`collectRenderablesWithEffects` が 29 ms（4x）かかる。§7.3.4 の契約（静的描画は署名が変わらない限り再生成しない）に照らし、playback ghost から retained stone への昇格で署名が変わっている箇所（`syncPlaybackGhosts` → `prepareStaticVisual` 再実行）と、effect 付きコンテナ（mask を持つ layer）の数を確認する。まず `getDiagnostics()` で決着時の再生成数と表示オブジェクト数を計測し、再利用可能なら署名の比較を修正する。
- 同一性の検証: 決着後の画素一致（`test:visual`、スクリーンショット）、`match:pixijs-board-playback-check`、`test/ui.pixi*.test.*`。
- 期待効果: 決着タスク −15〜−30 ms（4x）。未計測のため見込みは幅がある。
- 完了条件: 決着時の `prepareStaticVisual` 実行数が変化セルの数以下。
- リスク: 描画順序・アルファ・シャドウの見た目に影響しやすい。画素一致を厳密に取れない場合は非採用。

### C8 authority 側の重複処理の削減（応答時間）

- 変更の境界: `utils/match-publish-controller.ts:291` の `stateHashBefore` を `room.authoritativeStateHash` から取る（値は同一）。`workers/match-worker.ts:1099-1103` で 3 視点に渡す同じ playback events の `resolvePlaybackDigest` を 1 回にする（digest 文字列は同一）。`utils/match-authority/journal.ts:63-93` の SSE 再送レコードは wire payload の複製なので、`freezeOwnedData` 済みの視点 payload を参照共有できるか（レコードが独立に凍結されている契約 §8.4 を満たす形で）を設計で確認する。`workers/match-room-storage.ts:125-131` の変更検出用 `JSON.stringify` と `freezeOwnedData(deepClone(initialSnapshotByViewer))` は、書き込み時にだけ行う。前計画 P5 の圧縮・保存形式・hash 計算は変えない。
- 同一性の検証: `npm run test:network:parity`、`npm run test:match:parity`、`test/workers.match-worker.publish-persistence.test.ts`、`test/workers.match-room-storage.test.ts`、wire バイト列（publish 応答・WS フレーム・SSE）の旧新一致、`npm run perf:network-storage` の書き込みバイト数が不変。
- 期待効果: 1 publish の authority CPU −20〜−40%（Node 計測見込み）。クライアントの固まりには直接効かず、送信→応答の待ちが縮む。
- 完了条件: `scripts/perf/measure-network-storage.ts` と publish 1 回の Node ベンチで中央値が改善、応答・フレーム・保存のバイト同一。
- リスク: Durable Object の出力ゲート挙動は本番でしか確認できない（§8）。

### C9 小さな同期処理（telemetry / debug gate）

- 変更の境界: `ui/presentation-handler.ts:63` `emitPresentationDebugConsole` が debug flag オフ時にも `NetworkMatchClient.getState()`（部屋メタデータを 5 回 `structuredClone`）を呼ぶ点を、`networkDebugEnabled` だけを返す軽い accessor（既存の `state.networkDebugEnabled`）に置き換える。`ui/network-client.ts:1894` `recordNetworkTelemetry` の details clone は debug オフ時も行われるが着手あたり 20 回程度で数 ms 未満のため対象外（記録の内容は変えない）。
- 同一性の検証: `debug=1` と `networkDebugEnabled` で従来の console 出力が出る（前計画 P3-c と同じ確認）。
- 期待効果: 着手あたり −1〜−3 ms（4x）。
- 完了条件: 通常経路で `getState()` が playback 中に呼ばれない。

### C10 計測器の追加（採用判断の前提）

- `scripts/perf/measure-network-placement-freeze.ts` として §3.1 のハーネスを製品リポジトリの計測器にする: 3 画面（黒・白・観戦）、SSE local server と `--server` の WS、desktop / mobile 4x、`opening` と fixture、LoAF + user-timing marks + browser-wide trace、pid 分割、区間 busy、長タスク帰属、schema 化した JSON と Markdown 出力、成果物 hash と fixture digest の記録。`getState` を毎フレーム呼ばない。`--count-ops` で `structuredClone` / `JSON.*` の回数と呼び出し元。可能ならカード使用・pending 選択の着手（`publishSnapshot` に `use_card` と選択の command を流す）を追加する。
- 完了条件: baseline と candidate を交互に 20 回ずつ取り、到着・決着・クリックの各長タスクの中央値と p95 を出力できる。`npm run typecheck`、`test/scripts.*` に schema テスト。

## 7. 実行順序と採用・非採用の判定規則

推奨順序: C10（計測器）→ 基準取得（desktop / mobile 4x、opening と late-special-20、SSE と WS）→ C3 → C2 → C1 → C4 → C9 → C6（実ブラウザ確認で出た場合のみ）→ C5（効果が閾値以上の場合のみ）→ C7（調査の後に採用判断）→ C8 → 統合検証・配信・コミット。C3 / C2 / C4 / C9 は互いに独立で、C1 は C2 の後に測る（決着時の render 要求数が変わるため）。

判定規則（前計画 §6 を踏襲）:

- 同一性が先: イベント列・`visualSeq`・frame digest・画素・DOM の一致を確認できない単位は採用しない。
- 改善: 対象の長タスク（到着・決着・クリック）の中央値と p95 を、同じ fixture digest・生成物 hash・環境で baseline と比較する。n=20 の p95 は 2 番目に悪い値なので、中央値が一致し最悪数サンプルだけ異なる場合は tail として扱い、交互に再ペア計測してから判定する。
- 悪化の検出: 既存場面（CPU 戦の `measure-opponent-action-frame-stall`、boot、playback 中の RAF p95）で同期処理 p95 が `max(2 ms, 基準の 5%)` を超えて遅くなる、RAF p95 が 1 描画周期以上悪化する、アプリ起因の 50 ms 以上 stall が新たに出る、入力が余分に 1 フレーム待つ場合は再調査し、解消できなければ非採用。
- メモリ: 同じ操作列で retained heap が `max(1 MiB, 基準の 5%)` を超えて増える場合は解消する。
- 効果不足: 有効な測定で改善しない単位は採用せず、根拠を §9 に残す。数値のために UX・通信の意味を変えない。

## 8. 本番・実回線でしか確認できない項目と確認方法

| 項目 | 確認方法 |
| --- | --- |
| 実回線での送信→応答・stream 到着の分布（Cloudflare Durable Object、出力ゲート） | 本番 URL に対して C10 の計測器を `--server https://card.reversi-0.workers.dev` で実行（別部屋、2 画面 + 観戦）。`fetch-headers` と `stream-arrive` の分布を取る。デプロイは伴わない |
| 実機での長タスク（Android 中位機、iOS Safari） | Chrome for Android は remote debugging + 同じ trace 手順。Safari は LoAF 非対応のため、`performance.now` の RAF 間隔と `np:*` marks、Web Inspector の Timeline で到着・決着の同期時間を取る |
| 最初の効果音の `new AudioContext()` が実操作でも playback 中に出るか（C6 の前提） | 実ブラウザで対局開始から最初の着手までを trace し、`_ensureAudioContext` の位置を確認 |
| ping/health の `stateVersion` 競合による `/api/match/state` 再同期の頻度 | 本番で `networkDebugEnabled` の telemetry `heartbeat_resync_requested` / `state_sync_snapshot_applied` の件数を対局単位で集計 |
| Durable Object の保存・`setAlarm` の確定待ちが応答に占める割合（C8 の効果） | Worker 側で publish の段階時刻を `authorityLog`（内部診断）に記録し、本番 1 部屋で読む。公開 payload は広げない |
| WS 圧縮フレームの復号が低速端末で到着タスクを延ばすか | 実機で `np:stream-arrive` → `np:version-change` の busy/wall を比較（wrangler dev では差なし） |

## 9. 進捗記録

| 単位 | 状態 | 実測・確認・残件 |
| --- | --- | --- |
| 計画時調査 | 完了 | 読み取り専用調査 + ローカル計測。製品コード変更なし。本番アクセスなし。8000 の配信サーバーは無操作 |
| C1–C10 | 未着手 | — |

### 9.1 検証コマンド（実装時）

定義は [package.json](../../package.json) を参照する。

```powershell
npm run typecheck
npm run test:jest -- --runTestsByPath <対象テスト>
npm run test:network:parity
npm run test:match:parity
npm run test:visual
npm run match:pixijs-board-playback-check
npm run match:pixi-runtime-fallback-check
npm run match:ui-control-smoke:classic
npm run perf:network-storage
node dist/scripts/perf/measure-opponent-action-frame-stall.js --profile lightweight-mobile --mobile --cpu-throttle 4
node artifacts/network-placement-freeze-2026-09-25/harness/net-freeze-harness.js --scenario late-special-20 --iterations 3 --trace --mobile --throttle 4
node artifacts/network-placement-freeze-2026-09-25/harness/net-freeze-harness.js --scenario opening --opening-moves 12 --mobile --throttle 4 --server http://127.0.0.1:8799
npm run build:vite
npm run worker:prepare
npm run check:worker-mirror
git diff --check
git status --short
```

`npx wrangler dev --port 8799` は `worker-public` を配信し `workers/match-worker.mjs` → `dist/workers/match-worker.js` を使う。計測前に `dist/` が最終ソースのビルドであることを確認する。5174 で `vite-dist/` を配信中なら root の配信制約（LOCAL DEV SERVER）を先に解決する。
