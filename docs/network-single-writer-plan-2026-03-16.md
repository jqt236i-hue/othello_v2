# ネットワーク Single Writer 化 実装計画書

作成日: 2026-03-16
対象: ui / game / shared / workers / scripts / test / docs / worker-public
状態: Draft
前提文書: docs/network-match-v2-rebuild-plan-2026-03-15.md

## 0. この文書の位置づけ

- この文書は、ネット対戦モードにおけるクライアント側の状態管理を **Single Writer** 化するための実装計画である。
- 仕様の一次情報は `01-rulebook.md` とし、本文書は内部実装方針のみを定める。
- 先行する `network-match-v2-rebuild-plan-2026-03-15.md` とは目的が異なる。v2 plan は「v1 → v2 への protocol 移行」を計画したが、調査の結果 **v2 command-based publish は既に実装済み**であるため、この文書はその前提を踏まえた上で「残存する二重書き込み問題の根本解消」を扱う。

## 0.1 結論

- v2 command-based publish（クライアントが command を送信 → サーバーが `TurnPipeline.applyTurnSafe()` で正本 snapshot を生成）は **既に稼働中**。
- 残っている network バグ（busy lock 残留、操作不能、playback 崩れ）の根本原因は、クライアント側で **ローカル楽観適用とサーバー応答適用の二重書き込み** が起きていることにある。
- この文書は、network モードにおいて **サーバー応答のみを state の唯一の書き手にする** ことで、reconcile ロジックを排除し、残存バグの構造的原因を絶つ。

## 0.2 大幅改革を許可する理由

- 二重書き込みに起因する busy lock 残留、shadow playback 崩れ、presentation queue 汚染は **過去に複数回の局所修理を経ても再発している**。
- 原因は reconcile ロジックの複雑性（`shouldEmitShadowPlayback`、`suppressPlayback`、`allowStaleShadowPlayback` の組合せ分岐）そのものにある。
- 局所 patch をこれ以上重ねるより、**二重書き込みが発生しない構造への移行**の方が、総変更量が小さく再発リスクも低い。

## 1. 検証済みの前提

### 1.1 サーバー側（実装済み、変更不要）

- `workers/match-worker.mjs` は `applyCommandPublishToSnapshot()` で command を受理し、`TurnPipeline.applyTurnSafe()` で正本 snapshot と `presentationEvents` を生成する。
- `mapServerPresentationToPlaybackEvents()` でサーバー生成の `playbackEvents` を返す。
- client-authored snapshot publish パスは既に存在しない（`COMMAND_REQUIRED` で reject）。
- `scripts/local-match-server.js` も同一パスで動く。
- `baseVersion` による楽観的並行制御が機能している。

### 1.2 クライアント側（現状・変更対象）

- `ui/network-client.js` の action bridge は `wrappedRunTurnWithAdapter` でローカル `runTurnWithAdapter` を呼び出し、結果として `TurnPipeline.applyTurnSafe()` がクライアント側でも実行される。
- board placement (`isBoardPlacement === true`) は action bridge 内で publish されず、`game/move-executor.js` → `game/network-turn-handoff.js` → `finalizeNetworkTurnHandoff()` → `publishNetworkSnapshot()` 経由で publish される。
- card 効果、pass、その他のアクションは action bridge 内で直接 `publishSnapshot()` が呼ばれる。
- サーバー応答（HTTP POST response / SSE stream）で `applySnapshot()` が呼ばれ、2 回目の state 書き込みが発生する。
- `ui/network/snapshot.js` の `reconcilePresentationQueues()` が shadow playback の emit 判定を担うが、分岐が複雑で busy lock が残留する条件を作っている。

### 1.3 pending selection（カード対象選択）の特殊性

- 22 種のカードが pending selection を使用し、うち 2 種は multi-stage（入替の意志、盤面拡張・神）。
- `pendingEffectByPlayer` は `TurnPipeline.applyTurnSafe()` 内の `applyCardUsage()` で設定される。この値がないと selection UI（対象選択のハイライト、クリックハンドラ）が初期化されない。
- **したがって、`use_card` アクション時には「カード使用宣言」の部分だけローカルで実行して `pendingEffectByPlayer` を設定し、対象選択完了後に完全な action を command publish する**必要がある。
- 対象選択後の最終アクションは `{ type: 'place', trapTarget: {row, col}, ... }` のように target フィールドを含み、サーバーはこれを inline で処理する（別 command 不要）。

## 2. 目的

- network モードのクライアントを **Single Writer** にし、サーバー応答 snapshot を唯一の state mutation 源にする。
- busy lock 残留、shadow playback 崩れ、presentation queue 汚染の構造的原因を排除する。
- ターン制ゲームとして許容範囲の RTT 遅延（100–300ms）を受け入れる。

## 3. 非目標

- サーバー側 protocol の変更
- ローカル対戦（CPU 戦、デバッグ対戦）への影響
- 仕様上の visible behavior の変更（演出タイミングの微差は許容）
- UI 全面リデザイン
- optimistic visual hint の導入（将来課題とし、本計画では扱わない）

## 4. 残す契約

- ローカル対戦は従来どおり `runTurnWithAdapter` → ローカル state mutation → playback で動く。
- サーバー API の外向き契約は変更しない。
- `publishSnapshot()` 呼び出しの外向き API 名は変えない（中身の挙動を変える）。
- `applySnapshot()` の外向き API 名は変えない（中身を簡素化する）。
- カードの対象選択 UI（ハイライト、クリック操作）の見た目は変えない。

## 5. 廃止または置換する契約

- action bridge によるローカル `runTurnWithAdapter` 実行（network モード時のみ）。
- `game/network-turn-handoff.js` の `waitForPlaybackIdleIfNeeded()`（network モードではローカル playback が存在しないため不要）。
- `ui/network/snapshot.js` の shadow playback reconcile ロジック（`shouldEmitShadowPlayback`、`suppressPlayback: true` パス）。
- `ui/network-client.js` の `resolveSelfSnapshotShadowPlaybackEvents()`（self-op でもサーバー playbackEvents をそのまま再生するため不要）。
- `armSuppressDiffBoardUpdateContext('self_snapshot_sync')` の呼び出し。

---

## 6. 段階計画

## Phase 0: 境界テストの拡充と安全網

### 目的

- 変更前の挙動を回帰テストで固定し、Phase 1 以降の変更で壊れた箇所を即座に検出する。

### 作業

1. 既存 network テスト 33 件が全て pass することを確認する。
2. 以下の新規テスト（または既存テストの項目追加）を追加する。
   - action bridge が network active 時にローカル `runTurnWithAdapter` を呼ばないことの確認。
   - `applySnapshot()` で受信した playbackEvents がそのまま `emitPlaybackEvents` に渡ることの確認。
   - `applySnapshot()` 後に `isProcessing === false` かつ `isCardAnimating === false` であることの確認。
   - pending selection: `use_card` コマンド後にサーバー snapshot で `pendingEffectByPlayer` が設定され、selection UI が初期化されることの確認。
3. Phase 0 結果をベースラインとして記録する。

### 主対象

- test/ui.network-client.action-bridge-next-snapshot.test.js（新規 or 拡張）
- test/ui.network-snapshot.*.test.js（既存確認）

### 完了条件

- 既存 33 network テスト + 新規テストが全て pass
- ベースラインの test 結果が記録されている

---

## Phase 1: action bridge の Single Writer 化（place / pass）

### 目的

- board placement と pass を network モードで **ローカル適用なし → command 送信 → サーバー応答で反映** に切り替える。
- カードはまだ従来動作を維持する（Phase 2 で移行）。

### 作業

1. `ui/network-client.js` の `wrappedRunTurnWithAdapter` を変更する。
   - network active 時、`action.type === 'place'`（board placement）のとき:
     - `state.originalRunTurnWithAdapter` を**呼ばない**。
     - 代わりに、action から command payload を構築し、`publishSnapshot()` を直接呼ぶ。
     - action bridge は `{ ok: true, skippedLocalExecution: true }` を返す。
   - network active 時、`action.type === 'pass'` のとき:
     - 同様にローカル実行をスキップし、`publishSnapshot()` を呼ぶ。
   - その他の action（`use_card`、`cancel_card` 等）は従来どおりローカル実行する（Phase 2 対象）。

2. `game/move-executor.js` の `executeMoveViaPipeline` で、action bridge が `skippedLocalExecution: true` を返した場合のガードを追加する。
   - `res.ok === false` と同じ早期 return パスに合流させ、ローカル state mutation と playback emit をスキップする。

3. `game/network-turn-handoff.js` の `finalizeNetworkTurnHandoff` で、network single writer モード時に `waitForPlaybackIdleIfNeeded()` をスキップする。
   - `opts.skipLocalPlaybackWait === true` フラグで制御する。

4. `ui/network/snapshot.js` の `applySnapshot()` を簡素化する。
   - self-op の場合でも、サーバーの `playbackEvents` をそのまま `emitPlaybackEvents` に渡す（`suppressPlayback: false`）。
   - `shouldEmitShadowPlayback` 分岐を削除しない（Phase 2 でカード移行後に削除）。ただし place/pass の self-op パスでは使われなくなる。

5. `ui/network-client.js` の HTTP POST 応答ハンドリングを更新する。
   - self-op の成功応答で `res.data.snapshot` を受信した場合、`applySnapshot()` に `playbackEvents: res.data.playbackEvents` を渡す。
   - `shadowPlaybackEvents` は渡さない（ローカル playback が存在しないため）。

6. `ui/network-client.js` の SSE `onSnapshot` ハンドラを更新する。
   - self-op の場合でも `acceptedPlaybackEvents = playbackEvents`（サーバー生成 events をそのまま受け入れ）。
   - `shadowPlaybackEvents = []`（reconcile 不要）。

### 主対象

- ui/network-client.js（action bridge + 応答ハンドリング）
- game/move-executor.js（skippedLocalExecution ガード）
- game/network-turn-handoff.js（skipLocalPlaybackWait）
- ui/network/snapshot.js（self-op playbackEvents 直接再生）

### 完了条件

- `place` と `pass` が network モードで「ローカル実行なし → command → サーバー応答 → playback」の 1 パスで完結する。
- 自操作後に busy lock が残留しない。
- 相手操作の受信と再生が従来どおり動く。
- ローカル対戦（CPU 戦）に影響がない。
- Phase 0 で追加したテスト + 既存テストが pass する。

### 検証束

```bash
npx jest --runInBand test/ui.network-client.action-bridge-next-snapshot.test.js test/ui.network-client.publish-base-version.test.js test/ui.network-client.result-sync.test.js test/ui.network-snapshot.move-source-empty.test.js test/game.network-turn-handoff.test.js
```

---

## Phase 2: カード使用の Single Writer 化

### 目的

- `use_card` / `cancel_card` / `destroy_hand_card` を Single Writer パスに移行する。
- pending selection が正しく動作する形でのローカル state 最小利用を実装する。

### 作業

1. **no-target カード**（即時効果、対象選択不要）を先に移行する。
   - action bridge: `use_card` かつ pending selection 不要のとき、ローカル実行をスキップして command publish する。
   - サーバー応答 snapshot でカード効果の結果と playbackEvents を受け取り再生する。

2. **target カード（pending selection）** を移行する。
   - 2 段階の flow を導入する。
     - **段階 A: カード使用宣言 → pending 設定（ローカル最小実行）**
       - action bridge が `use_card` を検出し、`pendingEffectByPlayer` の設定だけをローカルで行う。
       - これは `CardLogic.applyCardUsage()` を直接呼び出すか、TurnPipeline の card usage phase のみを実行する薄い helper を使う。
       - この時点では command publish しない。
       - selection UI が `pendingEffectByPlayer` を読み取り、対象選択のハイライトとクリックハンドラを表示する。
     - **段階 B: 対象選択完了 → command publish（サーバー確定）**
       - ユーザーが対象セルをクリックすると、`selection-flow.js` が target を含む完全な action を構築する。
       - **ローカルで `runTurnWithAdapter` を呼ばず**、直接 command publish する。
       - サーバーが `TurnPipeline.applyTurnSafe()` で use_card + pending resolution を一括実行する。
       - サーバー応答の snapshot と playbackEvents で state 更新 + アニメーション再生。
   - `selection-flow.js` の `executePendingSelection()` に network single writer パスを追加する。
     - `adapter.runTurnWithAdapter()` をスキップし、代わりに `publishPendingSelectionSnapshot()` を呼ぶ。
     - 応答待ち中は selection busy を維持する。

3. **multi-stage カード**（入替の意志、盤面拡張・神）を移行する。
   - stage 1 選択 → ローカルで pending stage を進める（pending.stage を更新）。
   - stage 2 選択完了 → 段階 B と同じ command publish。
   - multi-stage の中間状態はサーバーに送らない（サーバーは最終 action を一括処理する）。

4. `cancel_card` / `destroy_hand_card` を移行する。
   - ローカル実行をスキップし command publish するだけ（pending selection なし）。

### 主対象

- ui/network-client.js（action bridge のカード分岐）
- game/card-effects/selection-flow.js（network single writer パス）
- game/card-effects/trap.js, sacrifice.js, swap.js, position-swap.js, board-expansion.js, その他 22 カード
- ui/network/snapshot.js（pending snapshot 受信時の selection UI 初期化）

### 完了条件

- 全カード効果が network モードで「command → サーバー応答 → playback」で完結する。
- pending selection 中の busy lock が正しく管理される。
- multi-stage カードの中間状態が正しく表示される。
- カード効果の playbackEvents がサーバー生成分で正しくアニメーションされる。
- ローカル対戦に影響がない。

### 検証束

```bash
npx jest --runInBand test/ui.network-client.multi-stage-selection.test.js test/ui.network-client.trap-deferred-publish.test.js test/ui.network-client.swap-deferred-publish.test.js test/ui.network-client.sacrifice-deferred-publish.test.js test/ui.network-client.guard-tempt-deferred-publish.test.js test/ui.network-client.movement-deferred-publish.test.js test/game.pending-selection-flow.test.js test/game.trap-selection-turn-handoff.test.js test/game.swap-selection-turn-handoff.test.js test/game.movement-selection-turn-handoff.test.js
```

---

## Phase 3: reconcile ロジックの削除と簡素化

### 目的

- Phase 1-2 で不要になった shadow playback reconcile を削除し、snapshot.js を簡素化する。

### 作業

1. `ui/network/snapshot.js` から以下を削除する。
   - `shouldEmitShadowPlayback` 分岐。
   - `suppressPlayback: true` で emit するパス。
   - `reconcilePresentationQueues` 内の shadow playback 関連分岐。
   - `captureTransientPresentationQueues` / `restoreTransientPresentationQueues` のうち shadow 用途のもの。

2. `ui/network-client.js` から以下を削除する。
   - `resolveSelfSnapshotShadowPlaybackEvents()`。
   - `armSuppressDiffBoardUpdateContext('self_snapshot_sync')` の呼び出し。
   - `shadowPlaybackEvents` / `shadowPlaybackEventStrings` のトラッキング。
   - `getTrackedPublishRequestedPlaybackEvents()` のうち shadow 用途のもの。

3. `applySnapshot()` のパス数を検証し、不要な分岐がないことを確認する。
   - 正常パス: snapshot.gameState + snapshot.cardState を `replaceObjectState` → `playbackEvents` を emit → `refreshUi` → return。
   - force sync パス: 同上だが version check をスキップ。
   - stale reject パス: version check で return false。
   - 上記 3 パスだけで十分であることを確認する。

### 主対象

- ui/network/snapshot.js
- ui/network-client.js

### 完了条件

- shadow playback 関連のコードが削除されている。
- `applySnapshot()` の分岐が 3 パスに収まっている。
- 全テストが pass する。

### 検証束

```bash
npx jest --runInBand test/ui.network-snapshot.move-source-empty.test.js test/ui.network-snapshot.hyperactive-source-empty.test.js test/ui.network-client.reconnect-sync.test.js test/ui.network-client.result-sync.test.js test/ui.network-client.publish-base-version.test.js
```

---

## Phase 4: reconnect / force sync の安定化

### 目的

- Single Writer 前提で reconnect / heartbeat / force sync を整理する。

### 作業

1. reconnect 時の `syncLatestStateWithRetry()` を確認する。
   - `force: true` で `applySnapshot()` を呼ぶパス。
   - animation in-progress 時に force sync が来た場合、現在の playback をキャンセルしてから snapshot を適用する。
   - `clearTransientPresentationQueues` を force sync 時に確実に実行する。

2. heartbeat timeout による auto-pass がサーバーから来た場合の受信を確認する。
   - SSE stream の onSnapshot で auto-pass 結果を受信し、通常の opponent-op と同じパスで処理する。

3. reconnect 後の stale click guard を確認する。
   - 再接続後は `baseVersion` がサーバーと一致するまで入力を受け付けない。

### 主対象

- ui/network-client.js（reconnect、heartbeat）
- ui/network/snapshot.js（force sync）

### 完了条件

- reconnect 後に busy lock が残留しない。
- force sync でアニメーション中の board が壊れない。
- heartbeat timeout による auto-pass が正しく反映される。

### 検証束

```bash
npx jest --runInBand test/ui.network-client.reconnect-sync.test.js test/workers.match-heartbeat-stateversion.test.js test/workers.match-turn-timer.test.js test/workers.match-stream-sse.test.js
```

---

## Phase 5: 清掃と worker-public 同期

### 目的

- 不要コードを削除し、worker-public を同期する。

### 作業

1. `game/network-turn-handoff.js` の `waitForPlaybackIdleIfNeeded()` が network モードで呼ばれないことを確認し、dead code があれば削除する。
2. `ui/network-client.js` の `createTrackedPublish` から不要なフィールド（`shadowPlaybackEvents`、`shadowPlaybackEventStrings`、`requestMeta.playbackEvents`）を削除する。
3. rg で削除対象の関数名が他に参照されていないことを確認する。
4. `npm run worker:prepare` で worker-public を同期する。
5. 全テストを実行する。

### 主対象

- ui/network-client.js
- ui/network/snapshot.js
- game/network-turn-handoff.js
- worker-public/

### 完了条件

- shadow playback 関連の dead code が残っていない。
- `npm run worker:prepare` が成功する。
- 全 304 テストスイートが pass する。

### 検証束

```bash
npx jest --runInBand
npm run worker:prepare
```

---

## 7. 技術的判断の根拠

### なぜ「ローカル実行をスキップ」で済むのか

- サーバーは既に `TurnPipeline.applyTurnSafe()` で正本 snapshot を生成している。
- サーバーは `mapServerPresentationToPlaybackEvents()` で playbackEvents を生成している。
- クライアントがローカルで実行する `runTurnWithAdapter` と同じロジックがサーバーで走っている。
- クライアントがやるべきことは「command を送る」「応答 snapshot で state を設定する」「応答 playbackEvents でアニメーション再生する」の 3 つだけ。

### pending selection で「カード使用宣言だけローカル実行」が必要な理由

- selection UI は `cardState.pendingEffectByPlayer[playerKey]` を読み取って初期化される。
- この値は `TurnPipeline` の card usage phase で設定される。
- サーバーに command を送って応答を待ってからでは、対象選択の UI を表示できない。
- ただし必要なのは「pending 状態の設定」だけであり、「盤面の state mutation」は不要。

### multi-stage カードの中間状態をサーバーに送らない理由

- multi-stage（入替の意志等）では、stage 1 の選択は「次にどのセルを選べるか」を絞り込む UI インタラクションであり、ゲーム state の変更ではない。
- サーバーは最終 action（両方の target を含む）を受け取り、一括で処理する。
- stage 1 の中間状態は `pendingEffectByPlayer` のステージ進行で十分表現できる。

### RTT 遅延は許容範囲である理由

- このゲームはターン制であり、リアルタイム対戦ではない。
- 配石後にフリップアニメーション（500ms–1s）が入るため、100–300ms の追加遅延はユーザー体験を大きく損なわない。
- 将来的に optimistic visual hint（配石位置に半透明の石を即座に表示）を追加すれば、体感遅延はさらに軽減できるが、本計画では扱わない。

## 8. リスクと open question

| リスク | 影響 | 対策 |
|---|---|---|
| pending selection の「カード使用宣言ローカル実行」helper の抽出が難しい | Phase 2 の工数増 | まず TurnPipeline の card usage phase のみ実行する薄い wrapper を試作し、動作を確認してから本実装に入る |
| サーバー側 playbackEvents とクライアント側 playback engine の互換性 | アニメーション崩れ | Phase 1 で place/pass の playbackEvents 再生を先に検証する。既存の `mapServerPresentationToPlaybackEvents()` + `pipeline_ui_adapter.js` が既に稼働しているため、大きな齟齬は起きにくい |
| 一部の既存テストが「ローカル実行ありき」の前提で書かれている | テスト修正工数 | Phase 0 でテストの前提条件を洗い出し、変更が必要なテストを列挙する |
| サーバーが一時的に応答しない場合のタイムアウト処理 | UI が固まる | 既存の `publishRequestWithRetry` のタイムアウト処理が機能するため、新規対応は不要。ただし Phase 4 で確認する |
| local server / worker 間の playbackEvents 生成の微差 | ローカル開発時のみ発生しうるアニメーション差分 | 両方とも同じ `mapServerPresentationToPlaybackEvents` を使っているため、差異は出にくい |

## 9. 完了条件

1. network モードの place / pass / use_card / cancel_card / destroy_hand_card が、ローカル TurnPipeline 実行なしで command → サーバー応答 → playback の 1 パスで完結する。
2. pending selection 系カードの対象選択 UI が正しく動作する。
3. busy lock 残留が通常操作で発生しない。
4. shadow playback reconcile コードが削除されている。
5. reconnect / force sync が安定している。
6. ローカル対戦（CPU 戦、デバッグ対戦）に影響がない。
7. 全 304 テストスイートが pass する。
8. `npm run worker:prepare` が成功する。

## 10. 代表検証束

Phase 0 baseline:

```bash
npx jest --runInBand test/ui.network-client.*.test.js test/ui.network-snapshot.*.test.js test/game.network-turn-handoff.test.js test/game.pending-selection-flow.test.js
```

Phase 1 core:

```bash
npx jest --runInBand test/ui.network-client.action-bridge-next-snapshot.test.js test/ui.network-client.publish-base-version.test.js test/ui.network-client.result-sync.test.js test/game.network-turn-handoff.test.js
```

Phase 2 card migration:

```bash
npx jest --runInBand test/ui.network-client.multi-stage-selection.test.js test/ui.network-client.trap-deferred-publish.test.js test/ui.network-client.swap-deferred-publish.test.js test/ui.network-client.sacrifice-deferred-publish.test.js test/ui.network-client.guard-tempt-deferred-publish.test.js test/ui.network-client.movement-deferred-publish.test.js test/game.pending-selection-flow.test.js test/game.trap-selection-turn-handoff.test.js test/game.swap-selection-turn-handoff.test.js test/game.movement-selection-turn-handoff.test.js
```

Phase 3-5 full:

```bash
npx jest --runInBand
npm run worker:prepare
```

## 11. 01-rulebook.md 方針

- この計画自体は内部実装の変更であり、visible behavior の変更は含まない。
- 現時点で `01-rulebook.md` の更新は不要。
- ただし、Phase 1 の実装で入力応答タイミングに知覚可能な差が出る場合、「ネット対戦では確定済みの局面を盤面に反映する」旨を明文化する。

## 12. 先行文書との関係

- `docs/network-match-v2-rebuild-plan-2026-03-15.md` は、v2 command publish が未実装であることを前提に書かれたが、調査の結果 v2 は既に実装済みであった。同文書の Phase 0–5 のうち Phase 1–4 は実質完了済みであり、残る課題はこの文書の対象である「クライアント側 Single Writer 化」に集約される。
- `docs/network-foundation-separation-implementation-plan-2026-03-15.md` の責務分離方針と整合する。
- `docs/network-selection-card-stabilization-plan-2026-03-14.md` の card stabilization は前提として完了している。

## 13. この計画の終了点

- Phase 5 の検証束が全て pass し、worker-public が同期された時点で本計画は完了とする。
- その後の改善事項（optimistic visual hint、RTT 最適化等）は別文書に切り出す。
