# ネット対戦 publish 経路リファクタリング計画 2026-05-31

## 1. 目的

ネット対戦の publish 経路を、挙動を変えずに小さく分割し、今回発生した「カード効果は通ったが、演出・同期・pending 処理が崩れる」系の再発リスクを下げる。

この計画は機能追加やルール変更ではない。目的は責務分離、テストしやすさ、原因追跡しやすさの改善であり、`NetworkMatchClient.publishSnapshot()`、Worker API、snapshot / playback / authority の外部契約は維持する。

## 2. 対象

優先対象:

- `ui/network-client.ts` の `publishSnapshot`
- `ui/network/publish-request.ts`
- `ui/network/publish-tracker.ts`
- `ui/network/publish-rejection.ts`
- `ui/network/apply-coordinator.ts`

次点対象:

- `workers/match-worker.ts` の `handlePublish`
- 追加候補: `workers/match-worker-publish-controller.ts`

関連するが、この計画で先に大きく割らないもの:

- `utils/match-authority.ts`
- `ui/network/snapshot.ts`
- `ui/handlers/match-mode.ts`

## 3. 守る契約

- Worker / local server / browser runtime の publish 結果を変えない。
- `snapshot` は canonical state、`playbackEvents` は presentation replay data として扱う。
- `events[]` / `playbackEvents` の順序を変えない。
- publish response と SSE stream の競合解決は `stateVersion` / `operationId` / publish tracker で行う。
- pending selection の確定 publish は、authoritative pending instance に結び付ける。
- UI busy flag、playback lock、shadow playback、force sync recovery は presentation settlement であり、authority ではない。
- `game/` と `shared/` に DOM、sound、timer、network client 依存を入れない。
- `worker-public/` は source として編集せず、必要時 `npm run worker:prepare` で同期する。
- 公開 API、レスポンス shape、status code、rejectedReason、serialization format は変えない。

## 4. 現状の構造問題

### 4.1 `ui/network-client.ts` の `publishSnapshot`

`publishSnapshot` は現在、1つの関数で以下を扱っている。

- seat / player 不一致チェック
- `operationId` 作成
- command payload 作成
- publish tracker 登録
- version conflict retry
- rejected snapshot 適用判断
- publish response snapshot 適用
- playback shadow / recovery 判定
- telemetry / effect log / cleanup

周辺にはすでに `ui/network/publish-request.ts`、`publish-tracker.ts`、`publish-rejection.ts`、`apply-coordinator.ts` があるため、次の自然な分割先は `ui/network/publish-flow.ts` である。

### 4.2 `workers/match-worker.ts` の `handlePublish`

`handlePublish` は現在、以下を同じメソッド内で扱っている。

- room / seat / token / player の権限チェック
- `operationId` 必須チェック
- idempotent replay
- baseVersion 検証
- out-of-turn 判定
- command publish / rematch / debug action の分岐
- `applyCommandPublishToSnapshot`
- commit、stateVersion 更新、hash 更新
- turn timer 更新
- response payload 作成
- SSE broadcast
- authority log

Worker 側はすでに `match-worker-*-controller.ts` 分割があるため、`workers/match-worker-publish-controller.ts` へ段階的に移す。

## 5. 実行方針

一度に大きく移動しない。各 phase は「テストで現状固定 → 小さく抽出 → focused test → network parity」の順で進める。

原則:

- public API を変えない。
- import path を既存利用者から見て変えない。
- まず client publish flow、次に Worker publish flow。
- `match-authority.ts` の広域分割は最後に回す。
- refactor 中にバグらしきものを見つけても、挙動変更が必要なら別タスク化する。

## 6. Phase 0: baseline 固定

目的:

- 現在の修正済み挙動をリファクタリング前の基準として固定する。

作業:

- `git status --short` を確認し、既存差分を分類する。
- 生成物、mirror、検証 artifact、手作業差分を分ける。
- `publishSnapshot` と `handlePublish` の関連テストを通す。

最低検証:

```powershell
npm run typecheck
npm run build:ts
npm run test:network:parity
```

追加で可能なら実行:

```powershell
npm run match:check
npm run test:jest -- test/e2e/network_special_cards.e2e.test.ts
```

完了条件:

- baseline の pass / fail が記録されている。
- fail がある場合は、今回の refactor 前からの既存失敗かどうか分類されている。

リスク:

- 現在の作業ツリーに生成/ミラー系差分と `artifacts/` が残っている場合、refactor 差分と混ざる。

## 7. Phase 1: client publish flow の characterization

目的:

- `publishSnapshot` の現行挙動を、抽出前にテストで固定する。

対象ファイル:

- `test/ui.network-client.publish-base-version.test.ts`
- `test/ui.network-client.action-bridge-next-snapshot.test.ts`
- `test/ui.network-client.apply-coordinator.test.ts`
- `test/ui.network-client.sound-dedupe.test.ts`
- 必要なら新規 `test/ui.network-client.publish-flow.test.ts`

固定する挙動:

- seat mismatch は local で拒否される。
- inactive / missing seat token は publish されない。
- command payload が作れない場合は `COMMAND_REQUIRED`。
- publish tracker は queued → inflight → acknowledged / settled の順に進む。
- `VERSION_AHEAD` / `VERSION_BEHIND` / `VERSION_GAP` / `VERSION_MISMATCH` の retry 条件。
- rejected snapshot を apply する条件と skip する条件。
- publish response snapshot を self snapshot より優先する条件。
- shadow playback と normal playback の分岐。
- effect logs と telemetry が失われない。

検証:

```powershell
npm run test:jest -- test/ui.network-client.publish-base-version.test.ts test/ui.network-client.action-bridge-next-snapshot.test.ts test/ui.network-client.apply-coordinator.test.ts test/ui.network-client.sound-dedupe.test.ts
```

完了条件:

- production code を変えずに characterization が pass している。

## 8. Phase 2: `ui/network/publish-flow.ts` 追加

目的:

- `publishSnapshot` の orchestration を controller 化し、`ui/network-client.ts` を互換 shell に戻す。

新規ファイル:

- `ui/network/publish-flow.ts`

変更ファイル:

- `ui/network-client.ts`
- 必要なら `test/ui.network-client.publish-flow.test.ts`
- 必要なら `index.html` / module registry は生成手順で同期

抽出する責務:

- publish 前 local validation
- operation context 作成
- request builder 呼び出し
- tracker 登録
- publish chain 実行
- rejection handling
- version conflict retry
- response snapshot apply
- cleanup

`network-client.ts` に残す責務:

- public API `publishSnapshot(meta)`
- controller の lazy resolve
- existing globals / DI bridge の互換
- state object の保持

想定 API:

```ts
createNetworkPublishFlowController({
  getState,
  isActive,
  normalizePlayerKey,
  createOperationId,
  buildPublishCommandPayload,
  getCurrentPublishTurnIndex,
  publishRequestWithRetry,
  syncLatestStateWithRetry,
  applyPayloadSessionState,
  applySnapshotThroughCoordinator,
  resolveRejectedPublishSnapshotHandling,
  shouldRetryVersionConflictPublish,
  buildVersionConflictRetryPayload,
  createTrackedPublish,
  markTrackedPublishInFlight,
  markTrackedPublishResponse,
  settleTrackedPublish,
  pruneTrackedPublishes,
  telemetry,
  emitStatus,
  emitPayloadEffectLogs,
  playbackRecovery
})
```

検証:

```powershell
npm run test:jest -- test/ui.network-client.publish-base-version.test.ts test/ui.network-client.action-bridge-next-snapshot.test.ts test/ui.network-client.apply-coordinator.test.ts test/ui.network-client.sound-dedupe.test.ts
npm run typecheck
```

完了条件:

- `NetworkMatchClient.publishSnapshot()` の戻り値、拒否理由、telemetry、playback apply 結果が変わらない。
- `ui/network-client.ts` の `publishSnapshot` は controller 呼び出し中心になっている。

リスク:

- async chain の順序が変わると、SSE と response の競合で再発する。
- cleanup の場所を変えると publish tracker が残る、または早く消えすぎる。

rollback:

- `ui/network/publish-flow.ts` を削除し、`network-client.ts` の `publishSnapshot` を抽出前に戻す。

## 9. Phase 3: client publish flow の network parity

目的:

- 抽出後に、今回の不具合系統が再発していないことを確認する。

検証:

```powershell
npm run test:network:parity
npm run test:jest -- test/e2e/network_special_cards.e2e.test.ts
```

公開確認が必要な場合:

- Chrome host + Edge guest
- `盤面縮小神`
- `守る意志`
- `繁殖の意志`
- `増殖の意志`
- `金の意志`
- `十字爆弾`
- `クロス爆弾`
- 多動系特殊石

完了条件:

- local parity が pass。
- live 確認を行った場合、artifact path を記録。

## 10. Phase 4: Worker publish の characterization

目的:

- `handlePublish` 分割前に Worker authority 挙動を固定する。

対象テスト:

- `test/workers.match-publish-sanitize.test.ts`
- `test/workers.match-publish-idempotency.test.ts`
- `test/workers.match-pending-effect-id.test.ts`
- `test/workers.match-card-pattern-parity.test.ts`
- `test/network.playback-event-assembly.contract.test.ts`
- 必要なら新規 `test/workers.match-worker-publish-controller.test.ts`

固定する挙動:

- room missing は `ROOM_NOT_FOUND`。
- seat 未参加は `SEAT_NOT_JOINED`。
- seat/player 不一致は `SEAT_MISMATCH`。
- token 不一致は `SEAT_TOKEN_MISMATCH`。
- operationId なしは `OPERATION_ID_REQUIRED`。
- duplicate operationId は idempotent replay。
- baseVersion mismatch は既存の rejectedReason を維持。
- out-of-turn は既存の許可例外も含めて維持。
- debug fill hand は debug enabled の場合だけ許可。
- rematch reset の挙動を維持。
- accepted publish の stateVersion、hash、turn timer、broadcast、authority log を維持。

検証:

```powershell
npm run test:jest -- test/workers.match-publish-sanitize.test.ts test/workers.match-publish-idempotency.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-card-pattern-parity.test.ts test/network.playback-event-assembly.contract.test.ts
```

完了条件:

- Worker publish の主要契約が、分割前にテストで固定されている。

## 11. Phase 5: `workers/match-worker-publish-controller.ts` 追加

目的:

- `handlePublish` の authority publish 手順を controller 化し、`MatchRoomDurableObject` 本体から分離する。

新規ファイル:

- `workers/match-worker-publish-controller.ts`

変更ファイル:

- `workers/match-worker.ts`
- `workers/match-worker-types.ts` または contract 型ファイル
- 必要なら `test/workers.match-worker-publish-controller.test.ts`

最初に抽出する責務:

- publish request context の normalize
- seat / token / operationId / version の preflight
- idempotent replay response
- rejected response payload 作成

次に抽出する責務:

- command / rematch / debug branch の実行
- commit metadata 作成
- accepted response payload 作成
- authority log entry 作成

`match-worker.ts` に残す責務:

- Durable Object lifecycle
- storage load/save
- broadcast 呼び出し
- turn timer controller 呼び出し
- Worker entrypoint

検証:

```powershell
npm run test:jest -- test/workers.match-publish-sanitize.test.ts test/workers.match-publish-idempotency.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-card-pattern-parity.test.ts test/network.playback-event-assembly.contract.test.ts
npm run test:network:parity
npm run typecheck
```

完了条件:

- `handlePublish` は controller 呼び出しと DO 固有 side effect の接続に近い形になる。
- response shape、status code、rejectedReason が変わらない。

リスク:

- Worker authority は公開 contract に近い。
- response status と payload のどちらか片方だけ変わると、client retry / recovery が壊れる。
- `saveRoom` と `broadcastSnapshot` の順序変更は再接続時の再現性に影響する。

rollback:

- `workers/match-worker-publish-controller.ts` を削除し、`handlePublish` を抽出前に戻す。

## 12. Phase 6: Worker/local parity と mirror

目的:

- Worker 分割後に local server / Worker / browser の publish contract が揃っていることを確認する。

検証:

```powershell
npm run test:network:parity
npm run match:check
npm run build:ts
```

mirror 影響がある場合:

```powershell
npm run worker:prepare
```

完了条件:

- parity suite が pass。
- worker-public に必要な生成差分だけが出ている。

## 13. Phase 7: optional cleanup

目的:

- Phase 2 と Phase 5 の後に見える小さい重複だけを整理する。

候補:

- client / worker で重複する publish rejection reason の小さい helper 化。
- publish telemetry event 名の一覧化。
- test fixture の重複削減。

この phase で避けること:

- `utils/match-authority.ts` の広範囲 split。
- public payload shape の変更。
- Worker/local server 共通化を名目に authority 境界を曖昧にすること。

## 14. 完了条件

全体の完了条件:

- `ui/network-client.ts` の `publishSnapshot` が互換 shell として小さくなっている。
- `workers/match-worker.ts` の `handlePublish` が controller 呼び出し中心になっている。
- `NetworkMatchClient.publishSnapshot()` の public API は維持されている。
- Worker publish API の status code / response shape / rejectedReason は維持されている。
- `npm run typecheck` pass。
- `npm run build:ts` pass。
- `npm run test:network:parity` pass。
- 代表 live check を行った場合、Chrome host + Edge guest の artifact が残っている。

## 15. 推奨 commit 分割

1. `Characterize client publish flow`
2. `Extract network publish flow controller`
3. `Characterize worker publish authority`
4. `Extract worker publish controller`
5. `Sync worker assets after publish refactor`

各 commit は focused tests を通してから作る。生成物や artifact は、必要なものだけを明示的に含める。

## 16. 判断保留事項

- `utils/match-authority.ts` の projection / payload / pending helper 分割は、この計画の後に別計画で扱う。
- `ui/network/snapshot.ts` の DOM 参照を完全に runtime adapter 側へ移すかは、publish flow 分割後に判断する。
- live check runner を正式 script 化するかは、公開環境の負荷と保守コストを見て別途決める。
