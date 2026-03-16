# ネット対戦復旧 基盤分離 実装計画書

作成日: 2026-03-15
対象: game / ui / shared / workers / scripts / cards / test / docs / worker-public
状態: Implemented for current codebase baseline

## 0.0 実装反映メモ

- 2026-03-15 時点で、Phase 1-3 の未完項目として残っていた以下は root / worker-public の実装へ反映済みとする。
- pass 経路の shared handoff 集約
- busy state owner の [ui/playback-state-manager.js](../ui/playback-state-manager.js) への集約
- publish rejection 時の stale rollback guard
- [game/move-executor.js](../game/move-executor.js) の直接 presentation fallback の通常経路からの後退
- この文書の問題記述と phase 定義は、着手時点の前提と実装順を残すために保持する。

## 0. この文書の位置づけ

- この文書は、公開ネット対戦を直すための実装計画書である。
- 親計画は [docs/network-match-v2-rebuild-plan-2026-03-15.md](./network-match-v2-rebuild-plan-2026-03-15.md)、現行契約の棚卸しは [docs/network-authority-phase0-contract-inventory-2026-03-15.md](./network-authority-phase0-contract-inventory-2026-03-15.md) を正本とする。
- この文書の役割は、「ネット対戦の修理」を network 専用 hotfix ではなく、ローカル基盤の責務分離から着手する順序へ固定することにある。
- 一次仕様は [01-rulebook.md](../01-rulebook.md) とし、この文書は実装順、非目標、完了条件、代表検証束を定義する。

## 0.1 この計画の結論

- 先に直すべきものは network 層単体ではなく、local game が UI と同期制御を抱え込んでいる構造である。
- 修正順は `基盤分離` → `turn handoff 一元化` → `snapshot apply 封じ込め` → `server-authoritative command publish` → `card command 移行` → `v1 廃止` とする。
- v1 の snapshot publish を延命する追加 hotfix は原則停止し、既存 UI 殻と room / seat / deck 契約だけを残す。

## 0.2 親計画との対応

- 親計画は [docs/network-match-v2-rebuild-plan-2026-03-15.md](./network-match-v2-rebuild-plan-2026-03-15.md) であり、この文書はその network 再構築を local foundation 側から実行するための実装順固定版である。
- 対応関係は以下とする。
   - この文書の Phase 0-3: 親計画の command publish / reconnect / cutover phase を安全に着手するための基盤分離
   - この文書の Phase 4: 親計画の core action command publish 実装
   - この文書の Phase 5-6: 親計画の card command 移行と legacy cutover
- この文書だけを読んだ場合でも、phase 完了後は親計画側の対応 phase へ逆参照して gate を閉じる。

## 1. 目的

- 公開ネット対戦が壊れる主因である「local state mutation と UI / playback / network publish の結合」を段階的に解体する。
- `game/` が `ui/` へ直接依存せずに着手結果を返せる境界を作る。
- `ui/` は `game/` の結果を受けて描画と再生だけを担当し、network では server 確定局面の適用者に徹する。
- `workers/match-worker.mjs` を authority とした command publish へ移行し、client-authored next snapshot publish を縮退させる。

## 2. 非目標

- ネット対戦 UI の全面リデザイン
- CPU / selfplay / story / tutorial の同時改修
- 全カードを 1 フェーズで command publish 化すること
- `worker-public/` を root と独立した正本として扱うこと
- local match server を公開 worker より先に進化させること

## 3. 検証済みの前提

### 3.1 local 側の構造上の問題

- [game/move-executor.js](../game/move-executor.js) は `gameState` / `cardState` 反映、`PLAYBACK_EVENTS` 発行、turn handoff 呼び出しの入口責務をまだ広く持っており、network publish / turn handoff 自体は [game/network-turn-handoff.js](../game/network-turn-handoff.js) へ一部委譲済みでも境界整理が未完である。
- [game/turn-manager.js](../game/turn-manager.js) は board click 入口で pending effect 分岐、UI lock、各 selection handler 呼び出しを持ち、責務が広い。
- [ui/presentation-handler.js](../ui/presentation-handler.js) は board update から playback 再生と補助ロジックを起動し、state apply 後の見た目制御と密結合している。
- [ui/network/snapshot.js](../ui/network/snapshot.js) は authoritative snapshot 適用と busy flag / queue 復元を同時に扱っている。
- [ui/network-client.js](../ui/network-client.js) は publish tracking、authoritative match state、local presentation state を 1 モジュールで抱えている。

### 3.2 ただし分離の足場は既にある

- [game/turn/pipeline_ui_adapter.js](../game/turn/pipeline_ui_adapter.js) が存在し、domain 結果を playback event へ写像する境界として育てられる。
- [game/network-turn-handoff.js](../game/network-turn-handoff.js) が存在し、turn handoff / playback idle wait / publish の共通化を進められる。
- [shared/network-action-schema.js](../shared/network-action-schema.js) が存在し、snapshot publish から command publish への移行足場がある。
- pending selection の共通化入口として [game/card-effects/selection-flow.js](../game/card-effects/selection-flow.js) が存在する。

### 3.3 残すべき外側契約

- room / seat / deck / timer / chat などのネット対戦外側契約は [01-rulebook.md](../01-rulebook.md) と [docs/network-match-v2-rebuild-plan-2026-03-15.md](./network-match-v2-rebuild-plan-2026-03-15.md) に従う。
- `game/` は `ui/` に直接依存しない。
- `worker-public/` は mirror であり、phase 終端で `npm run worker:prepare` で同期する。

## 4. 修正原則

### 4.1 Single State Writer

- canonical な `gameState` / `cardState` の適用者を 1 経路へ寄せる。
- network snapshot apply は「確定状態の置換」のみを担当し、turn handoff や入力解除を決めない。

### 4.2 compute と present を分ける

- `game/` は「操作を受けて次状態を返す」までに限定する。
- playback event 生成は [game/turn/pipeline_ui_adapter.js](../game/turn/pipeline_ui_adapter.js) または UI 側 adapter に寄せる。
- DOM / sound / overlay / CPU scheduling は `ui/` または handoff helper でのみ行う。

### 4.3 network は command sender / snapshot applier に徹する

- client は next snapshot を author しない。
- server が canonical snapshot / playback / stateVersion を決定する。
- client は `operationId` と `baseVersion` を使って command を送るだけに縮退する。

### 4.4 bounded migration にする

- place / pass / reset_game を先に command 化する。
- card は `no-target` → `single-target` → `selection-only end turn` → `multi-stage hidden-hand` の順で移行する。
- `local-match-server` は worker と別契約に育てず、共有 helper か smoke 用に限定する。

## 5. 実装計画

## Phase 0: Baseline 固定と hotfix 停止

### 目的

- 現行 v1 を延命する修正を止め、これ以降の修正が基盤分離に沿っているかを判定できる状態へする。

### 主対象

- [docs/network-match-v2-rebuild-plan-2026-03-15.md](./network-match-v2-rebuild-plan-2026-03-15.md)
- [docs/network-authority-phase0-contract-inventory-2026-03-15.md](./network-authority-phase0-contract-inventory-2026-03-15.md)
- [test/game.network-turn-handoff.test.js](../test/game.network-turn-handoff.test.js)
- [test/game.pending-selection-flow.test.js](../test/game.pending-selection-flow.test.js)
- [test/ui.network-client.result-sync.test.js](../test/ui.network-client.result-sync.test.js)

### 作業

1. v1 snapshot publish を前提にした個別 hotfix を原則停止する。
2. 基準テスト束を固定し、以後の phase はこの束を落とさないことを gate にする。
3. 既存の stale click / stale rollback / busy lock / invalid hidden-hand の症状を parent doc へ集約し、この文書には実装順だけを残す。

### 完了条件

- 基準テスト束が決まっている。
- 新規修正が「v1 を延命するだけ」か「v2 へ進む変更」か判断できる。

## Phase 1: domain transition 境界の抽出

### 目的

- `game/` が UI side effect を知らずに turn 結果を返せる境界を作る。

### 主対象

- [game/move-executor.js](../game/move-executor.js)
- [game/turn/turn_pipeline.js](../game/turn/turn_pipeline.js)
- [game/turn/turn_pipeline_phases.js](../game/turn/turn_pipeline_phases.js)
- [game/turn/turn_pipeline_phase_helpers.js](../game/turn/turn_pipeline_phase_helpers.js)
- [game/turn/pipeline_ui_adapter.js](../game/turn/pipeline_ui_adapter.js)
- [game/logic/cards.js](../game/logic/cards.js)

### 作業

1. `TurnPipeline` の戻り値契約を固定する。
   - `nextGameState`
   - `nextCardState`
   - `domain result`（着手結果、pending 進行、turn handoff に必要な情報）
   - UI 固有の DOM 参照や source element を持ち込まない
2. [game/turn/pipeline_ui_adapter.js](../game/turn/pipeline_ui_adapter.js) を「domain result から playback events を作る唯一の場所」に寄せる。
3. [game/move-executor.js](../game/move-executor.js) から `emitPresentationEventViaBoardOps` / `showResult` / network publish の判断を段階的に追い出す。
4. まず通常の `place` / `pass` 経路だけを対象にし、selection 系は Phase 2 で扱う。

### 完了条件

- 通常配置経路で `game/` が UI 直接呼び出しに依存しない。
- `pipeline_ui_adapter` が playback event 変換境界として機能する。
- `move-executor` が「状態反映と handoff 呼び出し」に縮退している。

## Phase 2: turn handoff と pending selection の一元化

### 目的

- 入力解除、playback idle wait、CPU handoff、network publish タイミングを 1 か所に寄せる。

### 主対象

- [game/network-turn-handoff.js](../game/network-turn-handoff.js)
- [game/card-effects/selection-flow.js](../game/card-effects/selection-flow.js)
- [game/turn-manager.js](../game/turn-manager.js)
- [cards/card-interaction.js](../cards/card-interaction.js)
- [game/pass-handler.js](../game/pass-handler.js)
- [game/card-effects](../game/card-effects)

### 作業

1. 通常配置と selection-only end-turn の handoff を [game/network-turn-handoff.js](../game/network-turn-handoff.js) に寄せる。
2. pending selection 完了後の UI unlock は [game/card-effects/selection-flow.js](../game/card-effects/selection-flow.js) だけで決める。
3. [cards/card-interaction.js](../cards/card-interaction.js) の post-action 完了処理を共通 helper 化し、各カード個別に unlock しない。
4. 移行順は以下に固定する。
   - movement / trap / swap など selection-only end-turn
   - destroy / sacrifice / guard / freeze など single-target board selection
   - condemn / heaven / sell など multi-stage or hidden-hand selection

### 完了条件

- `deferNetworkPublish`、`waitForPlaybackIdle`、`onTurnStart`、CPU handoff の責務が共通 helper に集約されている。
- 通常カード使用と selection 完了後の入力解除タイミングが 1 ルールで説明できる。
- stale click を個別カード hotfix で潰す状態から脱している。

## Phase 3: snapshot apply と busy state の封じ込め

### 目的

- network snapshot apply が UI lock / queue 調停 / turn progress を兼務している構造を解く。

### 主対象

- [ui/network/snapshot.js](../ui/network/snapshot.js)
- [ui/network-client.js](../ui/network-client.js)
- [ui/playback-state-manager.js](../ui/playback-state-manager.js)
- [ui/presentation-handler.js](../ui/presentation-handler.js)

### 作業

1. snapshot apply は authoritative state の反映だけに限定する。
2. busy flag の owner を [ui/playback-state-manager.js](../ui/playback-state-manager.js) へ寄せる。
3. pending local publish が残る間は、同版以下 snapshot の force apply で局面を巻き戻さない。
4. local presentation queue は、incoming authoritative playback が無い限り保存する。
5. self-originated snapshot suppress や stale shadow playback は縮退対象として isolate する。
6. reconnect / heartbeat / turn timer recovery の full contract 自体は親計画の network phase で扱い、この phase ではそれらの入口が snapshot apply と busy state を再び兼務しない状態までを対象にする。

### 完了条件

- reconnect / heartbeat / force sync で board rollback と UI lock が起きない。
- snapshot apply と playback 再生の責務が別モジュールで説明できる。
- busy flag 再セット条件が 1 か所で管理される。

## Phase 4: core action の command publish 化

### 目的

- `place` / `pass` / `reset_game` を client-authored snapshot publish から外す。

### 主対象

- [shared/network-action-schema.js](../shared/network-action-schema.js)
- [ui/network-client.js](../ui/network-client.js)
- [workers/match-worker.mjs](../workers/match-worker.mjs)
- [scripts/local-match-server.js](../scripts/local-match-server.js)

### 作業

1. `actionType` を単なるラベルではなく command schema として固定する。
2. client は `roomId` / `seatToken` / `operationId` / `baseVersion` / command payload のみ送る。
3. worker が canonical snapshot / playback events / stateVersion を生成して返す。
4. local server を残す場合は worker と shared helper を使わせ、別契約で進化させない。

### 完了条件

- `place` / `pass` / `reset_game` で client-authored snapshot publish を使っていない。
- worker が唯一の canonical snapshot 供給元になっている。
- idempotency と stale response 処理が `operationId` 基準で閉じている。

## Phase 5: card command の段階移行

### 目的

- card flow を snapshot publish 依存から外し、network でも server-authoritative に動かす。

### 主対象

- [cards/card-interaction.js](../cards/card-interaction.js)
- [game/card-effects/selection-flow.js](../game/card-effects/selection-flow.js)
- [game/card-effects](../game/card-effects)
- [shared/network-action-schema.js](../shared/network-action-schema.js)
- [workers/match-worker.mjs](../workers/match-worker.mjs)

### 作業

1. `no-target` card を先に command 化する。
2. `single-target board selection` を次に移行する。
3. `selection-only end-turn` card は Phase 2 の handoff helper を土台に server confirm 型へ切り替える。
4. `multi-stage hidden-hand` card は `handIndex` / `target descriptor` を command payload に含め、client 推測で確定しない。
5. card family ごとに bounded で進め、全面一括移行しない。

### 完了条件

- 主要カード系が `snapshot` ではなく `command` を publish している。
- hidden-hand 系の整合判定を client snapshot に頼らない。
- card family ごとの移行順と rollback 条件が明確である。

## Phase 6: 切替と legacy 経路削除

### 目的

- v2 経路へ切り替え、snapshot publish 前提の legacy 経路を消す。

### 主対象

- [ui/network-client.js](../ui/network-client.js)
- [ui/network/snapshot.js](../ui/network/snapshot.js)
- [workers/match-worker.mjs](../workers/match-worker.mjs)
- [scripts/prepare-worker-assets.js](../scripts/prepare-worker-assets.js)
- [worker-public](../worker-public)

### 作業

1. legacy action bridge、self-snapshot suppress、snapshot publish 専用 fallback を削除する。
2. `worker-public/` は phase 終端で `npm run worker:prepare` により同期する。
3. local worker dev と公開 URL の 2 タブ smoke を固定してから deploy する。

### 完了条件

- 公開 network mode が v2 経路だけで動く。
- v1 snapshot publish の本流経路が消えている。
- root と `worker-public/` の同期結果を確認できる。

## 6. 代表検証束

### Phase 0-2 baseline / handoff

```bash
npx jest --runInBand test/game.network-turn-handoff.test.js test/game.pending-selection-flow.test.js test/game.movement-selection-turn-handoff.test.js test/game.swap-selection-turn-handoff.test.js test/game.trap-selection-turn-handoff.test.js
```

### Phase 3 snapshot / sync

```bash
npx jest --runInBand test/ui.network-client.publish-base-version.test.js test/ui.network-client.result-sync.test.js test/ui.network-client.reconnect-sync.test.js test/ui.network-client.movement-deferred-publish.test.js test/ui.network-client.swap-deferred-publish.test.js test/ui.network-client.trap-deferred-publish.test.js test/ui.network-client.sacrifice-deferred-publish.test.js test/ui.network-client.multi-stage-selection.test.js test/workers.match-publish-sanitize.test.js
```

### Phase 4-5 command / worker

```bash
npx jest --runInBand test/ui.network-client.action-bridge-next-snapshot.test.js test/workers.match-publish-idempotency.test.js test/workers.match-stream-sse.test.js test/workers.match-turn-timer.test.js test/workers.match-heartbeat-stateversion.test.js
```

### mirror / smoke / deploy

```bash
npm run worker:prepare
npm run worker:dev
npm run worker:deploy
```

## 7. 停止条件と gate

- Phase 1 で `pipeline_ui_adapter` を境界にできない場合は、個別 hotfix に逃げず parent plan を更新してから進める。
- Phase 2 が終わる前に Phase 5 の card 全面移行へ進まない。
- Phase 3 から Phase 4 へ進む前に、reconnect / heartbeat / force sync で board rollback と busy lock が再現せず、Phase 3 の検証束が green であることを gate にする。
- worker と local server の契約差を増やす修正は受け入れない。
- `worker-public/` の直編集は行わず、root 正本から同期する。

## 8. 最終完了条件

1. `game/` が `ui/` 直接依存なしに place / pass の結果を返せる。
2. pending selection 後の handoff と入力解除が共通 helper で閉じる。
3. reconnect / heartbeat / force sync で stale lock と rollback が通常操作で再現しない。
4. `place` / `pass` / `reset_game` が server-authoritative command publish で成立する。
5. card family が段階的に command publish へ移行し、snapshot publish 依存が縮退している。
6. v1 snapshot publish 経路が削除されている。
7. root と `worker-public/` の同期が verify されている。
8. visible behavior が変わる実装は [01-rulebook.md](../01-rulebook.md) に反映されている。

## 9. 01-rulebook.md 方針

- この文書追加だけでは visible behavior は変わらないため、現時点で [01-rulebook.md](../01-rulebook.md) の更新は不要。
- ただし実装で以下が変わる時は、該当 phase 着手前に更新する。
  - 入力解除タイミング
  - reconnect 後の表示復帰タイミング
  - card selection の確定条件
  - timer / chat / result overlay の見え方

## 10. この計画の終了点

- 公開ネット対戦が v2 経路で最後まで安定して動き、v1 snapshot publish の本流経路が無くなった時点で完了とする。
- 以後の最適化や演出改善は、この文書へ継ぎ足さず別 runbook に切り出す。