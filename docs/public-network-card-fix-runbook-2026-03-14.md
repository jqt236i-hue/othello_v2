# 公開ネット対戦 カード使用バグ修正 Runbook

作成日: 2026-03-14  
対象: `ui/` / `cards/` / `test/` / `worker-public/` / `docs`  
状態: Execution-ready

## 0. この文書の目的

- 公開 URL のネット対戦で起きている「カード使用後の入力不能 / 早すぎる再入力 / 演出中の stale click / publish 競合」を、**今回の修正で閉じる範囲だけ**に絞って直す。
- 「次にやるべきこと」が無限に増えないように、今回の修正対象と完了条件を先に固定する。
- 既存の広い Draft 計画書は参考資料とし、**実装順と終了条件はこの文書を正本**にする。

## 1. 今回の調査で確定したこと

### 1.1 今回の主因候補

- `cards/card-interaction.js` の通常手札操作は、`runTurnWithAdapter(...)` 後に `ensureCurrentPlayerCanActOrPass(...)` を即呼んでいる。
  - 対象: `useSelectedCard()` / `destroySelectedHandCard()`
  - これが playback や network publish より先に入力を戻し、公開環境の遅延で stale click を起こしやすい。
- `ui/network-client.js` の action bridge は、`row,col` の盤面配置でも `deferNetworkPublish` 付きでもない action を即 publish する。
  - つまり通常の `use_card` 系は、UI 側では早く unlock されるのに、network 側では publish がまだ進行中というズレが起こりうる。
- Worker は `baseVersion === room.stateVersion` を厳密に要求する。
  - ローカルオフラインでは見えにくいが、公開 worker の遅延や 2 タブ競合ではズレが表面化しやすい。

### 1.2 今回の第一原因ではないと判断したもの

- root と `worker-public/` の mirror 漏れ
  - 調査対象の front-end ファイルは一致していた。
- hidden token sanitize の基本経路
  - `workers.match-publish-sanitize` と `workers.match-condemn-visibility` の既存テストで基本経路は守られている。
- pending selection 全体の全面改修
  - 多くの選択系はすでに `PendingSelectionFlow.finalizePendingSelectionFlow(...)` に寄っている。
  - 今回の最短修正では、そこを全面再設計しない。

## 2. 今回の修正スコープ（固定）

### 2.1 触る対象

- `ui/network-client.js`
  - 既存 `publishTracker` を利用した「自分の publish が落ち着いたか」を待てる read-only API を追加する
- `cards/card-interaction.js`
  - 通常手札操作の post-action 完了処理を共通 helper 化する
  - `useSelectedCard()` / `destroySelectedHandCard()` から即時 `ensureCurrentPlayerCanActOrPass(...)` を外す
- 関連 test
  - `test/ui.card-use-source-element.test.js`
  - `test/ui.card-destroy-hand.test.js`
  - 必要なら `test/ui.network-client.*` に 1 本追加
- `worker-public/`
  - root 側修正後に `npm run worker:prepare` で同期

### 2.2 今回は触らない対象

- `workers/match-worker.mjs` の protocol / schema 変更
- `game/cpu-decision.js` / `src/engine/selfplay-runner.js` の広範囲改修
- pending selection policy table の全面再設計
- `01-rulebook.md`
  - 今回は仕様変更ではなく、既存仕様どおりに public network で崩れないよう戻す作業とする

## 3. 設計

### 3.1 設計方針

- **UI unlock を 1 か所に寄せる**
  - 「手札使用後にいつ入力を戻すか」を通常手札操作ごとに書かない。
- **network active 時だけ publish settle も見る**
  - オフライン/ローカルと公開 network の違いは publish 中の非同期性なので、network 有効時だけ追加待機を入れる。
- **Worker 側を先に疑って広げない**
  - まず UI の早期 unlock を閉じる。これで再現が止まるなら、worker 修正へは広げない。

### 3.2 追加する共通 helper

`cards/card-interaction.js` に、通常手札操作専用の post-action helper を 1 つ追加する。

想定責務:

- `runTurnWithAdapter(...)` の結果から playback event を読む
- `waitForPlaybackIdle()` が必要なら待つ
- network mode かつ `NetworkMatchClient` が active の時だけ、publish settle 待機 API を呼ぶ
- 最後に `ensureCurrentPlayerCanActOrPass(...)` を呼ぶ
- 失敗時は busy flag を戻して終える

この helper は **selection 系には広げない**。selection 系は既存 `PendingSelectionFlow.finalizePendingSelectionFlow(...)` を正本にする。

### 3.3 `ui/network-client.js` に足す API

`publishTracker` はすでに以下を持っている。

- `queued`
- `inflight`
- `acknowledged`
- `selfSnapshotReceived`

今回追加するのは、これを読むだけの小さい待機 API。

候補:

- `waitForSettledOwnPublishes(options)`
- もしくは `waitForPublishTrackerIdle(options)`

要求:

- 既存 publish の意味を変えない
- timeout を持つ
- network inactive 時は即 resolve
- 「queued / inflight が無くなった」または「responseSettled と selfSnapshotReceived が揃った」で抜ける

この API は **UI lock の解除タイミング制御だけ**に使い、publish 自体の protocol は変えない。

## 4. 実行手順（この順で固定）

### Step 1. network-client に待機 API を追加する

対象:

- `ui/network-client.js`
- 必要なら `test/ui.network-client.publish-base-version.test.js`
- 必要なら `test/ui.network-client.result-sync.test.js`

作業:

- `publishTracker` の既存状態を使って待機 API を実装する
- global export / public API は既存 `NetworkMatchClient` の範囲内で最小追加にする
- stale response rollback や apply 判定は変えない

完了条件:

- 既存 publish / reconnect / snapshot 系テストが落ちない
- 追加 API が network inactive 時に即完了する
- 追加 API が publish 中は早く resolve しない

### Step 2. 通常手札操作の unlock を共通 helper に寄せる

対象:

- `cards/card-interaction.js`
- `test/ui.card-use-source-element.test.js`
- `test/ui.card-destroy-hand.test.js`

作業:

- `useSelectedCard()` と `destroySelectedHandCard()` の末尾にある直接 `ensureCurrentPlayerCanActOrPass(...)` を削る
- 新 helper 経由で
  - playback idle
  - network publish settle（network active 時のみ）
  - その後の `ensureCurrentPlayerCanActOrPass(...)`
  の順に統一する
- 既存の `_renderCardUiWithOptionalPlaybackDelay(...)` はそのまま使い、描画責務を混ぜない

完了条件:

- 通常カード使用で演出中に board/hand が先に clickable に戻らない
- 手札破壊後も、演出や publish が落ち着く前に次操作へ進めない
- オフライン挙動は維持される

### Step 3. 既存 selection 系が壊れていないことだけ確認する

対象:

- `test/ui.card-condemn-selection-deferred-publish.test.js`
- `test/ui.network-client.multi-stage-selection.test.js`
- `test/game.pending-selection-flow.test.js`
- 必要なら `test/ui.card-sell-selection-deferred-publish.test.js`

作業:

- Step 1-2 の影響で selection 系の helper 契約が崩れていないか確認する
- ここでは selection-flow の設計は広げない

完了条件:

- 既存 selection deferred publish テストが通る
- 新規の selection 系修正 TODO を追加しなくてよい状態である

### Step 4. worker-public を同期し、2 タブ smoke を固定する

対象:

- `worker-public/`
- ローカル worker dev
- 公開前確認

作業:

- `npm run worker:prepare`
- `npm run worker:dev`
- 2 タブで次の smoke を固定実施する

smoke 項目:

1. 通常カード使用後に、演出中の連打で盤面/手札が壊れない
2. 手札破壊後に、即連打しても二重反応しない
3. `CONDEMN_WILL` 選択後に overlay/board が二重反応しない
4. `POSITION_SWAP_WILL` 1 回目選択後に pending が維持される
5. 相手タブで state が破綻せず追随する

完了条件:

- root と `worker-public/` が同期済み
- 上の 5 項目がローカル worker dev の 2 タブで再現しない

### Step 5. 公開して最終確認する

作業:

- `npm run worker:deploy`
- 公開 URL で Step 4 と同じ 5 項目だけを再確認する
- 追加調査に広げず、この 5 項目で可否判定する

完了条件:

- 公開 URL でも 5 項目が再現しない
- `VERSION_MISMATCH` / `PUBLISH_REJECTED` / `SEAT_MISMATCH_LOCAL` が通常操作で出ない

## 5. 実行コマンド（固定）

Step 1-3 の検証:

```bash
npx jest --runInBand test/ui.network-client.publish-base-version.test.js test/ui.network-client.result-sync.test.js test/ui.card-use-source-element.test.js test/ui.card-destroy-hand.test.js test/ui.card-condemn-selection-deferred-publish.test.js test/ui.network-client.multi-stage-selection.test.js test/game.pending-selection-flow.test.js test/workers.match-publish-sanitize.test.js test/ui.pass-stale-busy.test.js
```

mirror / local worker:

```bash
npm run worker:prepare
npm run worker:dev
```

公開:

```bash
npm run worker:deploy
```

## 6. ここで止める条件（無限に広げないための gate）

以下のどれかに当てはまらない限り、**今回の修正では worker / CPU / selfplay へ広げない**。

- Step 1-2 完了後も、公開 URL で `INVALID_OPPONENT_HAND_STATE` が再現する
- Step 1-2 完了後も、`CONDEMN_WILL` / `HEAVEN_BLESSING` の hidden hand 投影だけが壊れる
- Step 1-2 完了後に、selection 系既存テストが崩れ、`PendingSelectionFlow` 自体の修正が必須になった

つまり、今回の第 1 ラウンドは **「通常手札操作の早期 unlock を閉じる」まで**を本体とする。

## 7. 最終完了条件

- `ui/network-client.js` に publish settle 待機 API が追加されている
- `cards/card-interaction.js` の通常手札操作が共通 post-action helper 経由になっている
- Section 5 の Jest コマンドが通る
- `npm run worker:prepare` 実行後の local 2 タブ smoke 5 項目が通る
- 公開 URL の 5 項目が通る
- 最終報告に以下を必ず書ける
  - 変更ファイル
  - 実行した test / smoke
  - `01-rulebook.md` を更新しなかった理由

## 8. `01-rulebook.md` 方針

- 今回は仕様変更ではなく、既存の UI/network 契約を public 環境でも崩さないよう戻す修正なので、`01-rulebook.md` 更新は不要。
- ただし実装途中で「通常カード使用後は意図的に即クリック可能である」など仕様根拠が見つかった場合だけ、その時点で別途見直す。
