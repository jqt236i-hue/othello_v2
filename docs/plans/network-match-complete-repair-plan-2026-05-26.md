# ネット対戦 完全修復計画書

作成日: 2026-05-26

## 目的

ネット対戦を、ローカル対戦と同等の演出契約かつサーバー権限に基づく入力契約へ戻す。
個別カードの応急処置ではなく、部屋作成、入力権限、publish、snapshot、playback、debug、Worker/local server の契約を一本化する。

最終的な達成状態は次のとおり。

- 部屋作成/参加が、壊れたローカル deckCode や stale seat 情報で全般停止しない
- ネット対戦では自席だけが操作でき、相手手番/相手手札/相手席操作が UI 入口で止まる
- `DEBUG_HUMAN_VS_HUMAN` がネット対戦の権限判定へ混入しない
- `/api/match/publish` の `OUT_OF_TURN` は、ユーザー操作の通常経路では発生しない
- `/state`、SSE、publish response、reconnect replay のどの同期経路でも playback が欠落しない
- 同一 `stateVersion` の playback が二重再生されない
- 強風、重力/引力、多動、破壊龍、雷、狙撃、ロボット掃除機、赤/紫ハイライトがネット対戦でもローカル対戦相当に表示される
- 多動系の石が一時的にも 2 個に分裂して見えない
- Worker と local server の response shape と authority 判定が一致する

## 現在確認済みの問題

### 1. 部屋作成/参加の 400

現象:

- `/api/match/create` が `400` になる
- 部屋作成全般が壊れたように見える

根本原因:

- UI が壊れた custom `deckCode` を create/join payload に載せていた
- Worker は `DECK_CODE_INVALID` として正しく拒否していた
- UI 側が原因を十分に表示せず、失敗理由が見えなかった

現在の状態:

- 無効な custom `deckCode` は標準デッキへフォールバックする修正済み
- `DECK_CODE_INVALID` の表示改善済み

### 2. ネット対戦だけ演出が省略される

現象:

- 強風などの移動が瞬間移動になる
- 多動系の移動が瞬間移動になる
- 破壊龍など turn-start 特殊石演出が欠落する
- 赤/紫ハイライトが出ない場面がある
- 多動石が分裂したように 2 個見える

根本原因:

- ネット対戦の同期経路が複数あり、playback の保持契約が揃っていなかった
- publish response と SSE は `playbackEvents` を持てるが、`/api/match/state` force sync は最終 snapshot 中心だった
- force sync が先に来た後、同じ `stateVersion` の playback を復旧できないケースがあった
- self shadow 判定が「ローカルで実際に playback を再生したか」ではなく「自分の操作だから再生済みのはず」という仮定に寄っていた
- 多動系の後追い playback で、移動元が空かつ移動先に実石がある状態を UI 側が十分に防御していなかった

現在の状態:

- `/state` からの playback recovery は実装済み
- self shadow 判定を `localPlaybackEmitted` ベースへ修正済み
- 多動系の source-empty move に UI 側 ghost 防御を追加済み

### 3. カード使用が OUT_OF_TURN で失敗する

現象:

- `/api/match/publish` が `409`
- `カード使用に失敗しました (OUT_OF_TURN)`
- ログに `デバッグモード: ON` と `人間vs人間モード: ON` が出る

根本原因:

- ネット対戦に入るだけで `DEBUG_HUMAN_VS_HUMAN` が立つ経路があった
- ネット対戦の debug 有効化でも `DEBUG_HUMAN_VS_HUMAN` が自動で立っていた
- UI は「黒白両方を同一クライアントで操作可能」と誤認し、サーバーは seat token に基づいて正しく `OUT_OF_TURN` で拒否した

現在の状態:

- ネット対戦モード移行時に stale `DEBUG_HUMAN_VS_HUMAN` を落とす修正済み
- ネット対戦 debug ON では HvH を有効化しない修正済み
- ネット対戦中は HvH ボタンを隠し、押されても拒否する防御を追加済み

## 根本原因の整理

最深部の問題は、ネット対戦に関する契約が 1 か所に閉じていないこと。

- 入力権限: `network mode`、`debug HvH`、`local human mode` が混ざっていた
- 部屋作成: `playerName`、`deckCode`、`roomBoardConfig`、`networkDebugEnabled` の正規化が分散していた
- publish: action builder、baseVersion、operationId、self shadow、retry の責務が複数層に散っていた
- playback: state sync、SSE、publish response、reconnect replay で復旧契約が揃っていなかった
- UI: Single Visual Writer 契約と snapshot force apply の境界が壊れやすかった
- サーバー: Worker と local server が並行実装で、完全に同じ helper だけを使っている状態ではない

## 修復方針

1. サーバー snapshot を唯一の局面正本にする
2. UI は seat/token と server snapshot に従い、推測で権限を広げない
3. playback は `stateVersion` 単位で復旧可能にする
4. 同一 operation / 同一 stateVersion の playback は 1 回だけ再生する
5. debug はネット対戦の権限を広げない。ネット対戦 debug は server-authoritative な補助コマンドだけに限定する
6. Worker/local server/browser の契約を shared helper と contract tests で固定する

## Phase 0: 現状固定と再現条件の保存

目的:

- 既知バグをテストと手順で再現可能にする
- 修正済み箇所の回帰を防ぐ

作業:

- 2 クライアント smoke 手順を `docs/network-worker-deploy.md` または本計画の追補に固定する
- DevTools で保存すべきログを定義する
  - `/api/match/create` response body
  - `/api/match/join` response body
  - `/api/match/publish` response body
  - `[network-debug]` telemetry
  - `stateVersion`
  - `operationId`
  - `seatKey`
- 既存回帰テストを失敗条件単位で確認する

対象テスト:

```powershell
npm run test:jest -- test/ui.match-mode.network-button.test.ts test/ui.debug.network-idempotent.test.ts test/turn-manager.retry.test.ts
npm run test:jest -- test/ui.network-client.reconnect-sync.test.ts test/ui.network-snapshot.hyperactive-source-empty.test.ts
```

完了条件:

- 部屋作成 400、演出欠落、`OUT_OF_TURN`、多動分裂の再現条件が文書とテストで追える
- 失敗時にどの契約が壊れたかをログから判断できる

## Phase 1: ネット対戦入力権限の一本化

目的:

- ネット対戦の入力許可を seat/token ベースへ固定する
- `DEBUG_HUMAN_VS_HUMAN` をネット対戦の入力判断から排除する

変更候補:

- `ui/handlers/match-mode.ts`
- `ui/handlers/debug.ts`
- `game/turn-manager.ts`
- `cards/card-interaction.ts`
- `ui/board-renderer.ts`
- `ui/diff-renderer.ts`
- `utils/owner-helpers.ts`

実装方針:

- `network mode` の操作可否 helper を shared boundary に寄せる
  - 入力: `matchMode`, `seatKey`, `currentPlayer`, `fateWillControllerByTurnOwner`
  - 出力: `canOperateBoard`, `canUseOwnHand`, `canInspectOwnHand`, `canInspectOpponentHand`, `canPass`
- `DEBUG_HUMAN_VS_HUMAN` はローカル debug 専用にする
- ネット対戦 debug は以下だけを許可する
  - server-authoritative debug fill hand
  - cost/usage bypass を伴う場合も server publish 経由
  - 相手 seat の操作権限拡張は禁止
- Board click と hand click の両方で同じ権限 helper を使う

追加テスト:

- 黒 seat で白手番の盤面クリックが `executeMove` に到達しない
- 白 seat で黒手番のカード使用が publish に到達しない
- ネット debug ON でも `DEBUG_HUMAN_VS_HUMAN` が false のまま
- FATE_WILL の controller だけが victim turn を操作できる

検証:

```powershell
npm run test:jest -- test/turn-manager.retry.test.ts test/ui.card-use-source-element.test.ts test/ui.fate-will-ui-controlled-turn.test.ts test/ui.debug.network-idempotent.test.ts
```

完了条件:

- 通常 UI 操作から `OUT_OF_TURN` が発生しない
- `OUT_OF_TURN` は stale tab、不正 payload、競合など異常系テストでのみ発生する

## Phase 2: 部屋作成/参加 contract の共有化

目的:

- create/join payload の正規化を UI 分散実装から shared contract へ寄せる

変更候補:

- `ui/handlers/match-mode.ts`
- `ui/network/session-lifecycle.ts`
- `shared/deck-codec.ts`
- `utils/match-authority.ts`
- `workers/match-worker.ts`
- `scripts/local-match-server.ts`

実装方針:

- `buildMatchEntryPayload()` のような shared helper を作る
- `playerName`, `deckCode`, `roomBoardConfig`, `selectedHandSkinId`, `networkDebugEnabled` を同じ入口で正規化する
- deckCode invalid は `invalid fallback` と `hard reject` を明確に分ける
  - UI ローカル保存由来の invalid は標準デッキ fallback
  - API 直叩きの malformed deckCode は server reject
- Worker と local server の create/join response shape を contract test で一致させる

追加テスト:

- invalid custom deckCode で create/join が標準デッキ fallback
- API 直叩き malformed deckCode は `DECK_CODE_INVALID`
- playerName 空は `PLAYER_NAME_REQUIRED`
- Worker/local server の response keys が一致

検証:

```powershell
npm run test:jest -- test/ui.match-mode.network-button.test.ts test/ui.network-session-lifecycle.test.ts test/local-match-server.room-deck.test.ts test/workers.match-room-deck.test.ts
npm run test:network:parity
```

完了条件:

- 部屋作成/参加の request/response 契約が UI、local server、Worker で一致する
- 失敗理由が UI に出る

## Phase 3: publish pipeline の権限と冪等性を固定

目的:

- publish は常に server authority へ command を送り、クライアント final state を authority として扱わない

変更候補:

- `ui/network-client.ts`
- `ui/network/publish-request.ts`
- `ui/network/publish-tracker.ts`
- `ui/network/action-bridge.ts`
- `game/card-effects/selection-flow-network-handoff.ts`
- `game/card-effects/selection-flow-pending-execution.ts`
- `game/turn/turn_pipeline.ts`

実装方針:

- publish payload builder を 1 か所へ寄せる
- `seatKey`, `playerKey`, `actor`, `operationId`, `baseVersion`, `turnIndex` の意味を固定する
- pending selection は UI/network signal bridge 経由だけで publish する
- `localPlaybackEmitted` を operation tracking に保存する
- retry は同一 `operationId` のみ許可し、異なる operation と混線させない
- `OUT_OF_TURN`, `VERSION_MISMATCH`, `STALE_BASE_VERSION` の handling を明確化する

追加テスト:

- 自 seat と異なる `playerKey` は publish 前に止まる
- version conflict retry は同一 operation だけ再送する
- pending selection の server playback が local 未再生時に再生される
- local 再生済み operation は二重再生しない

検証:

```powershell
npm run test:jest -- test/ui.network-client.publish-base-version.test.ts test/ui.network-client.action-bridge-next-snapshot.test.ts test/game.pending-selection-flow.test.ts test/game.network-turn-handoff.test.ts
npm run test:network:parity
```

完了条件:

- publish の権限・版・冪等性が operation 単位で追える
- self shadow が「自分の操作」ではなく「ローカルで実再生済み」に基づく

## Phase 4: playback recovery 契約の完全化

目的:

- snapshot 経由でも playback を復旧できるようにする
- 同一 `stateVersion` の playback を二重再生しない

変更候補:

- `utils/match-authority.ts`
- `utils/match-authority-types.ts`
- `workers/match-worker.ts`
- `scripts/local-match-server.ts`
- `ui/network/session-lifecycle.ts`
- `ui/network/snapshot.ts`
- `ui/network/apply-coordinator.ts`
- `ui/network-client.ts`

実装方針:

- room に `playbackHistoryByVersion` 相当を持たせる
- `broadcastSnapshot()` または snapshot 準備時に以下を保存する
  - `stateVersion`
  - `operationId`
  - `playbackEvents`
  - `effectLogs`
  - `playbackDiagnostics`
- `/api/match/state` でも現在 stateVersion の playback を返せるようにする
- `syncLatestState()` は recovered playback を `applySnapshotThroughCoordinator()` に渡す
- force sync 済みの同一 stateVersion でも、未再生 playback があれば playback-only recovery を許可する
- `state_sync_snapshot_applied` telemetry に `playbackEventCount` と `usedRecoveredPlayback` を入れる

追加テスト:

- force sync が先に来た後、同じ stateVersion の SSE playback が 1 回だけ復旧される
- `/state` だけで終わっても playback が復旧される
- stale snapshot では二重再生しない
- viewer 別の秘匿情報が playback recovery に混入しない

検証:

```powershell
npm run test:jest -- test/ui.network-client.reconnect-sync.test.ts test/workers.match-stream-sse.test.ts test/utils.match-authority.publish-response.test.ts test/local-match-server.publish-contract.test.ts
npm run test:network:parity
```

完了条件:

- publish response、SSE、`/state`、reconnect replay の全経路で playback 欠落がない
- 同一 playback が二重再生されない

## Phase 5: UI playback と Single Visual Writer の防御強化

目的:

- snapshot force apply と playback が競合しても DOM 表示を壊さない

変更候補:

- `ui/animation-engine.ts`
- `ui/playback-state-manager.ts`
- `ui/board-renderer.ts`
- `ui/diff-renderer.ts`
- `ui/animation-utils.ts`

実装方針:

- 移動元が空で移動先に実石がある move playback は、実 DOM 石ではなく playback ghost を動かす
- playback 中は移動先の実石を hidden にし、終了後に 1 個だけ visible に戻す
- source cell に石を復元しない
- board renderer / diff renderer は playback 中の board write を抑止する
- stale playback lock は検知して abort/sync できるが、通常 play 中に force render しない

追加テスト:

- 多動/継承多動/究極多動/極悪多動魔で cell 内 `.disc` が 2 個残らない
- ghost は overlay 上だけに存在する
- source cell は空のまま
- playback 中の board render skip が維持される

検証:

```powershell
npm run test:jest -- test/ui.network-snapshot.hyperactive-source-empty.test.ts test/ui.animation-engine.move-variants.test.ts
```

完了条件:

- 多動分裂表示が再現しない
- Single Visual Writer 契約が破られない

## Phase 6: ハイライトと代表カード演出の parity 固定

目的:

- ネット対戦でローカル対戦と同じ主要演出を出す

対象:

- 強風
- 重力/浮力/超引力
- テレポート/マステレポート
- 多動系、究極多動神、継承多動、逃亡石、極悪多動魔
- 破壊龍
- 雷
- 狙撃
- ロボット掃除機
- 赤ハイライト
- 紫ハイライト
- 移動先/付与先ハイライト

実装方針:

- playback event に `highlightTone` または cause/reason から復元可能な情報を残す
- highlight は snapshot apply ではなく playback と同じ presentation queue で扱う
- local run と network publish の event sequence を比較する contract test を作る

追加テスト:

- `test/network.playback-event-assembly.contract.test.ts`
- 強風/テレポートの赤ハイライト
- visible special stone 付与の紫ハイライト
- turn-start 特殊石演出の playbackEvents

検証:

```powershell
npm run test:jest -- test/network.playback-event-assembly.contract.test.ts test/ui.animation-engine.guard-timer.test.ts
npm run test:network:parity
```

完了条件:

- 代表カードで local と network の event sequence が同等
- snapshot 経由、SSE 経由、publish response 経由で同じハイライトが出る

## Phase 7: Worker/local server parity の固定

目的:

- 本番 Worker とローカル検証環境の契約 drift を防ぐ

変更候補:

- `workers/match-worker.ts`
- `scripts/local-match-server.ts`
- `utils/match-authority.ts`
- `utils/match-authority-contract.ts`
- `utils/match-authority-types.ts`

実装方針:

- Worker/local server が同じ authority helper で create/join/state/publish を処理する範囲を増やす
- response shape contract test を追加する
- playback recovery、viewer projection、seat token validation を shared helper に寄せる
- `worker-public/` は直接編集せず、必ず `npm run worker:prepare` で同期する

検証:

```powershell
npm run test:jest -- test/local-match-server.publish-contract.test.ts test/workers.match-publish-idempotency.test.ts test/workers.match-stream-sse.test.ts test/utils.match-authority.publish-response.test.ts
npm run test:network:parity
npm run worker:prepare
```

完了条件:

- Worker と local server の publish/state/create/join 契約が一致する
- worker mirror が root source から再生成されている

## Phase 8: 2 クライアント手動 smoke

目的:

- 自動テストだけでは拾いにくい実ブラウザ上の接続、操作、演出、DOM 表示を確認する

手順:

1. Chrome 通常プロファイルで公開 URL を開く
2. Chrome guest/profile または別ブラウザで同じ URL を開く
3. 片方で部屋作成、もう片方で参加
4. 黒 seat で通常手を打つ
5. 白 seat に手番が移ることを確認する
6. 黒側で白手番の盤面クリックを試し、publish が出ないことを確認する
7. 白側でカード使用を行い、`OUT_OF_TURN` が出ないことを確認する
8. debug 許可 room を作成し、debug ON でも HvH ログが出ないことを確認する
9. 強風/多動/破壊龍/雷/狙撃/ロボット掃除機の代表演出を確認する
10. 再読み込み、SSE 切断、再接続後に playback 欠落や二重再生がないことを確認する

記録するもの:

- roomId
- 両 seat の console log
- failed network request
- `/api/match/publish` response
- `stateVersion`
- `operationId`
- 異常時スクリーンショット

完了条件:

- 通常操作で `OUT_OF_TURN` が出ない
- 相手手番中の操作が UI 入口で止まる
- 代表演出がネット対戦で再生される
- reload/reconnect 後も盤面と演出が破綻しない

## Phase 9: 最終検証とデプロイ

必須コマンド:

```powershell
npm run typecheck
npm run build:ts
npm run test:network:parity
npm run test:jest -- test/ui.match-mode.network-button.test.ts test/ui.debug.network-idempotent.test.ts test/turn-manager.retry.test.ts test/ui.card-use-source-element.test.ts test/ui.network-client.reconnect-sync.test.ts test/ui.network-snapshot.hyperactive-source-empty.test.ts test/workers.match-stream-sse.test.ts test/workers.match-publish-idempotency.test.ts
npm run worker:prepare
```

公開反映時:

```powershell
npm run worker:deploy
```

必要に応じて:

```powershell
npm run checkall
```

完了条件:

- 上記コマンドが成功する
- 公開 Worker の URL で部屋作成が成功する
- 公開アセットに最新 `public/module-registry.js` が配信されている
- 2 クライアント smoke が成功する

## 完全解決の判定基準

以下をすべて満たした時点で完全解決とする。

- `/api/match/create` と `/api/match/join` が入力不整合で全般停止しない
- create/join の失敗理由が UI で診断できる
- ネット対戦中に `DEBUG_HUMAN_VS_HUMAN` が自動で立たない
- ネット対戦中の debug は自席の server-authoritative 補助だけに限定される
- 自席ではない手番の盤面クリック/カード使用が publish 前に止まる
- FATE_WILL など例外的な操作権限も server snapshot と seat に基づいて判定される
- `/state`、SSE、publish response、reconnect replay の全経路で playback が復旧できる
- 同一 `stateVersion` の playback は 1 回だけ再生される
- 代表カードの local/network playback event sequence が同等
- 赤/紫ハイライトが経路差なく表示される
- 多動系の分裂表示が自動テストと手動 smoke で再現しない
- Worker/local server の contract tests が通る
- `worker-public/` は `npm run worker:prepare` で同期されている
- 公開 Worker で 2 クライアント smoke が成功している

## 優先順位

最優先:

1. 2 クライアント smoke で現在の公開版の残バグを確認する
2. 入力権限 helper の一本化
3. create/join contract の共有化
4. playback recovery の代表カード parity を増やす

次点:

1. Worker/local server の response shape 共通化
2. highlight 専用 contract test
3. debug room の権限境界テスト拡充

後回しにしてよいもの:

- UI 文言の微調整
- debug 操作パネルの見た目整理
- telemetry 表示 UI の追加

## 実装時の注意

- `01-rulebook.md` がプレイヤー可視仕様の正本
- `docs/architecture-contracts.md` が内部構造の正本
- root source を編集し、`worker-public/` は直接編集しない
- `game/`、`shared/`、CPU logic に DOM/window/timer/network 依存を入れない
- playback 中に第二の board writer を作らない
- broad catch や silent fallback で失敗を隠さない
- ネット対戦では client preview state を authority として扱わない
