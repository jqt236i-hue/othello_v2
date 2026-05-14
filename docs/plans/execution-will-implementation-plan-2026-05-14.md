# 執行の意志 実装計画

**作成日**: 2026-05-14  
**対象**: `01-rulebook.md`, `cards/`, `game/logic/`, `game/cards/`, `game/turn/`, `test/`, `worker-public/`  
**状態**: 実装前  
**起票理由**: 新カード `執行の意志` を、既存の破壊履歴・手札破壊・turn pipeline 契約に沿って追加する

---

## 0. この文書の位置づけ

- この文書は、`執行の意志` を root 正本から安全に追加するための implementation plan である。
- 一次仕様は `01-rulebook.md`、内部契約は `docs/architecture-contracts.md`、作業導線は `AGENTS.md` に従う。
- 今回の主眼は、カード仕様の追加、headless 実装、presentation 契約、test/worker mirror までを一貫して通すことである。
- `worker-public/` は mirror であり、直接修正完了扱いにしない。root 正本を直した上で `npm run worker:prepare` で同期する。

## 1. 対象仕様

今回の確定仕様は次のとおり。

- カード名: `執行の意志`
- コスト: `2`
- 使用条件: 「相手が自分の石を破壊した直後のターン」に使用可能
- 実装解釈: `救済の意志` と同じく、**前の相手ターンの破壊履歴**を参照する
- 効果: 相手の手札からランダムで最大 `3` 枚破壊する

## 2. 一次情報と根拠

- 仕様正本: `01-rulebook.md`
- 既存の「前の相手ターンで起きた破壊履歴」を使うカード:
  - `game/logic/cards.ts` の `getSalvationWillTargetCount`
  - `test/game.salvation-will.test.ts`
- 破壊履歴の記録地点:
  - `game/logic/board_ops.ts`
- turn start での ledger 管理:
  - `game/turn/turn_pipeline_phases.ts`
- 相手手札破壊の既存パターン:
  - 単体破壊: `game/cards/effects/hand-effects.ts` (`CONDEMN_WILL`)
  - 全破壊: `game/cards/effects/trap.ts` (`TRAP_WILL`)
- `HAND_REMOVE` presentation 契約:
  - `game/turn/turn_pipeline_phases.ts`
  - `test/game.turn-pipeline.destroy-hand-card.test.ts`

## 3. 目的

- `執行の意志` を catalog・logic・UI/help・tests・worker mirror まで抜けなく追加する
- 使用条件を既存の破壊履歴 ledger に揃えつつ、「自分の石が破壊された件数だけ」を見る専用判定にする
- 効果を deterministic random で処理し、browser / headless / worker で一致させる
- `HAND_REMOVE` と effect log を既存 presentation 契約に沿って出す

## 4. 非目標

- out-of-turn 反応システムの新設
- `救済の意志` の既存仕様変更
- hand overlay や target selection UI の追加
- network authority 契約の拡張
- unrelated card balance 調整

## 5. 既存調査からの結論

### 5.1 使用条件

- timing は `救済の意志` と同じ ledger reuse で足りる
- ただし `getSalvationWillTargetCount` は「前の相手ターンで破壊された石全体」を数えるため、そのまま流用しない
- `執行の意志` では `prevOpponentTurnDestroyedStonesByPlayer[playerKey]` のうち `entry.owner === playerKey` の件数だけを見る helper を新設する

### 5.2 効果解決

- このカードは target selection 不要の即時解決カードとして扱う
- `CONDEMN_WILL` の `removeHandCardAt + addCardToDiscard` を母型にし、これを最大 3 回繰り返す
- `TRAP_WILL` のような `clearHandToDiscard` は全破壊用なので使わない

### 5.3 random 契約

- `Math.random` は使わない
- 既存の deterministic PRNG / `resolveDeterministicRandomIndex` 系に合わせる
- 3 枚分の index を最初に固定せず、毎回「抽選 -> 1枚除去 -> 残りから再抽選」とする

### 5.4 presentation 契約

- `HAND_CLEAR` ではなく `HAND_REMOVE` を使う
- `reason` は新規に `execution_will` を追加する
- 効果ログは `pipeline_ui_adapter.ts` に 1 本追加する

## 6. 実装方針

### 6.1 仕様・catalog 層

更新対象:

- `01-rulebook.md`
- `cards/catalog.json`
- 必要に応じて `cards/card-interaction-effects.ts`
- 必要に応じて `ui/handlers/rules-help.ts`

方針:

- 表示名、コスト、条件文、効果文を先に正本へ追加する
- `cards/catalog.json` を正本にし、生成物は後段で同期する

### 6.2 usability helper 層

更新対象:

- `game/logic/cards.ts`
- `game/logic/cards-internal/card-usage-prechecks.ts`
- `game/logic/cards-internal/hand-manager.ts`

方針:

- 新 helper 例: `getExecutionWillTargetCount(cardState, playerKey)` を追加する
- 判定は以下を両方満たす時だけ true:
  - 前の相手ターンで自分石が 1 件以上破壊されている
  - 相手手札が 1 枚以上ある
- `救済の意志` の helper は変更しない。新カードだけ別 helper を使う

### 6.3 headless effect 層

更新対象:

- `game/cards/effects/hand-effects.ts` または同等の hand effect 正本
- `game/logic/cards.ts`

方針:

- 新 effect 例: `applyExecutionWill(cardState, playerKey, prng)` を追加する
- 実行内容:
  1. 相手手札を参照
  2. `min(3, hand.length)` 回ループ
  3. deterministic random で index を決める
  4. `removeHandCardAt`
  5. `addCardToDiscard`
  6. 破壊 cardId 一覧を返す

### 6.4 turn pipeline 接続層

更新対象:

- `game/cards/effect-resolver.ts`
- `game/turn/turn_pipeline_phases.ts`

方針:

- card use 後の pending 作成は既存経路に乗せる
- target selection は不要なので即時解決 branch に追加する
- 成功時は:
  - pending clear
  - raw event `execution_will_resolved`
  - `HAND_REMOVE` presentation emission

### 6.5 presentation / log / mirror 層

更新対象:

- `game/turn/pipeline_ui_adapter.ts`
- generated catalog outputs
- `worker-public/` mirror

方針:

- 効果ログに「相手手札を最大3枚破壊」の結果を追加する
- catalog 生成後に mirror を同期する

## 7. フェーズ計画

### Phase 0: 仕様固定

**目的**: 実装前に、timing と edge case を固定する。

**タスク**:

1. `01-rulebook.md` に `執行の意志` を追加する
2. 「最大3枚」「前の相手ターン参照」を文言で明示する
3. 相手手札 0 枚時は使用不可にする前提を仕様へ寄せる

**完了条件**:

- rulebook 文言と catalog 文言が矛盾しない
- 次工程で解釈の余地が残らない

### Phase 1: card catalog と type 追加

**目的**: card ID / type / cost / 表示文面を正本へ追加する。

**タスク**:

1. `cards/catalog.json` へ新カード追加
2. 必要な shared constants / type lookup を更新
3. generated catalog を再生成する

**完了条件**:

- 新カードが catalog から参照できる
- type/cost/name の lookup が壊れていない

### Phase 2: usability 条件実装

**目的**: 自分石破壊件数ベースで使用可能判定を通す。

**タスク**:

1. `getExecutionWillTargetCount` を追加
2. precheck 層へ条件追加
3. `getUsableCardIds` 側へ条件追加

**完了条件**:

- 前の相手ターンで自分石が破壊されていないと使用不可
- 自分石が破壊され、かつ相手手札があると使用可能

### Phase 3: 効果本体と pipeline 接続

**目的**: 最大3枚ランダム破壊を headless に実装し、turn pipeline から解決する。

**タスク**:

1. hand effect 本体を追加
2. `effect-resolver` に接続
3. `turn_pipeline_phases` の即時解決分岐に追加
4. raw event / `HAND_REMOVE` emission を追加

**完了条件**:

- 相手手札 1/2/3/4+ 枚で期待どおり最大3枚破壊される
- discard と hand の整合が崩れない
- deterministic random でテスト可能

### Phase 4: UI/log/test/mirror 同期

**目的**: 見え方と検証束を揃える。

**タスク**:

1. effect log を追加
2. card detail/help surface を更新
3. focused tests を追加・更新
4. `npm run worker:prepare` で mirror 同期

**完了条件**:

- UI 文言が仕様と一致する
- hand remove 演出が既存契約どおりに出る
- root と mirror が同期している

## 8. テスト計画

### 8.1 新規または重点更新テスト

- `test/game.execution-will.test.ts`
  - 使用不可: 自分石破壊 0 件
  - 使用不可: 相手手札 0 枚
  - 使用可: 自分石破壊 1 件以上
  - 1/2/3/4+ 枚 hand で最大3枚破壊
  - deterministic random で cardId 順が固定される
- `test/game.turn-pipeline.destroy-hand-card.test.ts`
  - `HAND_REMOVE` reason `execution_will`
- 必要に応じて `test/ui.card-detail-effect-tags.test.ts`
- 必要に応じて network parity / worker publish 系

### 8.2 参照する既存テスト

- `test/game.salvation-will.test.ts`
- `test/game.condemn-will.test.ts`
- `test/game.trap-will.test.ts`

## 9. 検証束

### 9.1 局所確認

- 変更ファイルへの `lsp_diagnostics`
- 新 helper / event / reason 文字列の `rg` 確認

### 9.2 テスト

- focused Jest:
  - `test/game.execution-will.test.ts`
  - 関連 hand / pipeline / UI tests

### 9.3 ビルド

- `npm run typecheck`
- `npm run build:ts`

### 9.4 mirror / generated

- catalog generation コマンド
- `npm run worker:prepare`

## 10. リスク

- `救済の意志` と helper を共有すると、「自分石のみ」の条件を壊す恐れがある
- hand index を先に 3 個固定すると、除去後に index ずれを起こす
- `HAND_REMOVE.cardIds` の network 可視性が既存 sanitize 契約に影響する可能性がある
- generated catalog と mirror の同期漏れで、runtime 間差分が出る可能性がある

## 11. 完了条件

この計画に基づく実装完了は、次をすべて満たした時だけ成立する。

1. `01-rulebook.md` と catalog に `執行の意志` が追加されている
2. 使用条件が「前の相手ターンで破壊された自分石」に限定されている
3. 相手手札を deterministic に最大3枚破壊できる
4. `HAND_REMOVE` と effect log が既存 presentation 契約に沿っている
5. 変更ファイルの diagnostics が clean である
6. focused tests / typecheck / build が通る
7. mirror が必要な場合は `worker-public/` まで同期されている

## 12. 実装時の判断メモ

- 相手手札 0 枚時は使用不可を既定にする
- `救済の意志` の既存挙動は触らず、新カード専用 helper を増やす
- out-of-turn 機構は追加しない
- presentation は `HAND_REMOVE` に統一する
