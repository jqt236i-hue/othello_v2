# 最後の切り札 仕様変更計画書

作成日: 2026-03-19
更新日: 2026-03-19
対象: docs / cards / game / shared / test / worker-public
状態: Planned（自前調査完了、未実装）

## 0. この文書の位置づけ

- この文書は、`LAST_RESORT（最後の切り札）` の仕様変更を root 正本から安全に反映するための plan であり、仕様そのものの正本ではない。
- 一次仕様は `01-rulebook.md`、カード定義の一次情報は `cards/catalog.json` とする。
- 目的は、今回の要求 3 点を docs / root 実装 / generated / CPU / test / mirror まで矛盾なく通すことにある。

## 0.1 今回の要求

- コストを `12` から `9` に変更する。
- 使用条件を「通常の合法手が 0」から、「相手より石数が少ない かつ 通常の合法手が 0」に変更する。
- 自由配置回数を `2` 回から `3` 回に変更する。

## 0.2 非目標

- `FREE_PLACEMENT` や投石連鎖系の仕様を同時に見直すこと
- `LAST_RESORT` 以外のカード全体バランスを再調整すること
- `worker-public/` を直編集して root より先に反映すること
- CPU 全体方針を大きく組み替えること

## 1. 検証済みの事実

### 1.1 現仕様と文言の重複面

- `01-rulebook.md` の `7.2.1` と `10.21.1` は、現在の `LAST_RESORT` を「コスト12 / 合法手0時のみ / 自由配置2回」と定義している。
- `01-rulebook.md` の CPU 方針節にも、`LAST_RESORT` を「合法手0でのみ成立する条件札」として扱う記述がある。
- `cards/catalog.json`、`cards/catalog.js`、`cards/catalog.generated.js`、`shared-constants.js`、`cards/card-interaction-effects.js`、`game/turn/turn_pipeline_phase_helpers.js` に、同じ前提のコスト・条件・回数・説明文が分散している。

### 1.2 使用条件の実装面

- `game/logic/cards-internal/card-usage-prechecks.js` の `LAST_RESORT` 分岐は、現在「通常合法手があるかどうか」だけを見ている。
- `game/logic/cards-internal/hand-manager.js` の `getUsableCardIds(...)` でも、同じ条件が別実装で重複している。
- `game/logic/cards.js` は `hasStandardLegalMoveForPlayer(...)` を両者へ渡しているが、「相手より石数が少ない」を判定する共有 helper はまだ無い。

### 1.3 自由配置回数の実装面

- `game/logic/cards-internal/pending-state-manager.js` と `game/logic/cards.js` の fallback pending 生成は、`placementsRemaining` を `2` で seed している。
- `game/logic/cards-internal/effect-timing.js` は `placementsRemaining` を 1 回ごとに減算し、`remaining > 0` の間だけ pending を残す構造になっている。
- `game/turn/turn_pipeline_phases.js` も `placementsRemaining > 0` を前提に継続判定しており、「ちょうど2回」を前提にした handoff 固定分岐は見当たらない。
- したがって、自由配置 `3` 回化は大規模な進行再設計ではなく、seed / default / 文言 / テスト更新が主になる見込み。
- ただし `game/cpu-decision.js` の pending 評価は `LAST_RESORT` の fallback 回数を `2` とみなしているため、ここは合わせて更新が必要。

### 1.4 CPU とテストの現状

- `game/ai/cpu-policy-core.js` は、`LAST_RESORT` を「合法手が残っている間は使いにくい札」として扱う penalty を持つが、「合法手0でも石数で負けていないなら使用不可」という新条件までは表現していない。
- `test/game.last-resort.test.js` は、現在「合法手0なら成功する」「2回置いたら終了する」を固定している。
- `test/game.cards.pending-state-manager-module.test.js`、`test/game.cards.effect-timing-module.test.js`、`test/cpu.decision.refactor.test.js`、`test/game.move-generator.expansion-pending.test.js` にも `placementsRemaining: 2` 前提がある。
- `test/game.cpu-policy-core.test.js` と `test/game.cards.hand-manager-module.test.js` は、「合法手がある間は unusable」という前提は持つが、「石数で負けていない間も unusable」という新条件までは固定していない。

### 1.5 石数判定の実装上の注意

- `game/logic/core.js` の `countDiscs(...)` は、8x8 盤面だけでなく `boardExpansion` の追加セルも含めて石数を数える。
- 新条件の「相手より石数が少ない」は、この `countDiscs(...)` 相当の数え方を使うべきであり、8x8 だけを直読する実装にはしない。

### 1.6 既存差分との衝突リスク

- 現在の worktree は広く dirty だが、今回の候補ファイルに対する `git diff` サンプリングでは `LAST_RESORT` 自体の差分は確認できなかった。
- それでも `01-rulebook.md`、`cards/catalog.json`、`shared-constants.js`、`game/logic/cards.js` などは既に未コミット変更を含むため、実装着手時に再確認は必須。

## 2. 主対象ファイル

### 2.1 仕様とカード定義の正本

- `01-rulebook.md`
- `cards/catalog.json`

### 2.2 root 実装

- `game/logic/cards.js`
- `game/logic/cards-internal/card-usage-prechecks.js`
- `game/logic/cards-internal/hand-manager.js`
- `game/logic/cards-internal/pending-state-manager.js`
- `game/logic/cards-internal/effect-timing.js`
- `game/cpu-decision.js`
- `game/ai/cpu-policy-core.js`

### 2.3 root 文言と補助定義

- `shared-constants.js`
- `cards/card-interaction-effects.js`
- `game/turn/turn_pipeline_phase_helpers.js`

### 2.4 再生成と mirror

- `cards/catalog.js`
- `cards/catalog.generated.js`
- `worker-public/*`

### 2.5 主要回帰テスト

- `test/game.last-resort.test.js`
- `test/game.cards.hand-manager-module.test.js`
- `test/game.cards.pending-state-manager-module.test.js`
- `test/game.cards.effect-timing-module.test.js`
- `test/game.cpu-policy-core.test.js`
- `test/cpu.decision.refactor.test.js`
- `test/game.move-generator.expansion-pending.test.js`

## 3. 採用方針

- 使用条件は `game/logic/cards.js` 側に共有 helper を追加して一本化し、`card-usage-prechecks.js` と `hand-manager.js` の重複条件をそこへ寄せる。
- 石数判定は `game/logic/core.js` の `countDiscs(...)` 相当を使い、拡張盤セルを含める。
- 自由配置 `3` 回化は、既存の `placementsRemaining` 減算モデルをそのまま使い、seed 値と default 値だけを更新する。
- CPU は「使えるかどうか」の契約を root 実装に合わせることを優先し、その上で retention / destroy の扱いを新条件へ寄せる。
- `worker-public/` は最後に `npm run worker:prepare` で mirror 同期する。

## 4. 実装フェーズ

## Phase 1: 仕様正本とカード定義の更新

### 目的

- 変更要求 3 点を `01-rulebook.md` と `cards/catalog.json` に先に反映し、以後の実装が仕様から逆走しない状態にする。

### 作業

1. `01-rulebook.md` の `7.2.1` と `10.21.1` を更新する。
2. `01-rulebook.md` の CPU 方針節にある `LAST_RESORT` 条件文も「石数で負けている かつ 合法手0」に合わせて更新する。
3. `cards/catalog.json` の `cost` と `desc_ja` を新仕様へ合わせる。

### 完了条件

- 仕様正本に、`cost=9`、`behind && no legal move`、`3 placements` が明記されている。
- `cards/catalog.json` の `LAST_RESORT` 定義が新仕様と一致している。

### 検証束

```powershell
git grep -n "LAST_RESORT|最後の切り札" -- 01-rulebook.md cards/catalog.json
```

---

## Phase 2: root ロジックの契約更新

### 目的

- `LAST_RESORT` の使用可否と pending 継続回数を root 実装で正しく揃える。

### 作業

1. `game/logic/cards.js` に、`LAST_RESORT` 専用の共有使用条件 helper を追加する。
2. その helper で次をまとめて判定する。
   - 通常の合法手が 0
   - 自分の石数が相手より少ない
3. `card-usage-prechecks.js` と `hand-manager.js` の `LAST_RESORT` 条件分岐を共有 helper 利用へ寄せる。
4. `pending-state-manager.js` と `cards.js` fallback の `placementsRemaining` 初期値を `3` に更新する。
5. `cpu-decision.js` の `LAST_RESORT` fallback 回数を `3` に更新する。
6. `effect-timing.js` と `turn_pipeline_phases.js` は原則そのまま使い、hidden な 2 回前提が無いかをテストで確認する。

### 完了条件

- `getUsableCardIds(...)` と `applyCardUsage(...)` が同じ条件で `LAST_RESORT` を許可 / 拒否する。
- tie / ahead かつ合法手0でも `LAST_RESORT` は使えない。
- `LAST_RESORT` 使用後の自由配置が `3` 回に増えている。

### 検証束

```powershell
npm run test:jest -- test/game.last-resort.test.js test/game.cards.hand-manager-module.test.js test/game.cards.pending-state-manager-module.test.js test/game.cards.effect-timing-module.test.js
```

---

## Phase 3: 文言・CPU・回帰テストの追随

### 目的

- 画面説明、CPU 方針、回帰テストを新仕様にそろえ、実装と表示の齟齬を止める。

### 作業

1. `shared-constants.js`、`cards/card-interaction-effects.js`、`game/turn/turn_pipeline_phase_helpers.js` の説明文を更新する。
2. `game/ai/cpu-policy-core.js` で、`LAST_RESORT` を「合法手あり」だけでなく「石数で負けていない」場合も unusable 扱いとして retention / destroy 側へ寄せる。
3. 次のテストを更新または追加する。
   - `test/game.last-resort.test.js`
     - 合法手ありなら不可
     - 合法手0でも tie / ahead なら不可
     - behind かつ 合法手0 なら可
     - 3回目配置後に手番交代
   - `test/game.cards.hand-manager-module.test.js`
     - behind 条件込みの usable 判定
   - `test/game.cards.pending-state-manager-module.test.js`
     - `placementsRemaining: 3`
   - `test/game.cards.effect-timing-module.test.js`
     - 1回目後 `3 -> 2`
   - `test/game.cpu-policy-core.test.js`
     - no legal move でも tie / ahead の `LAST_RESORT` を売却 / 手札破壊候補へ回すケース
   - `test/cpu.decision.refactor.test.js`
     - `LAST_RESORT` pending fixture の初期回数を `3` に更新
   - `test/game.move-generator.expansion-pending.test.js`
     - `LAST_RESORT` fixture の初期回数を `3` に更新

### 完了条件

- 画面文言が `9 / behind && no legal move / 3 placements` に一致している。
- CPU が新条件と矛盾する `LAST_RESORT` 利用を提案しない。
- 主要回帰テストが新仕様を直接固定している。

### 検証束

```powershell
npm run test:jest -- test/game.last-resort.test.js test/game.cards.hand-manager-module.test.js test/game.cards.pending-state-manager-module.test.js test/game.cards.effect-timing-module.test.js test/game.cpu-policy-core.test.js test/cpu.decision.refactor.test.js test/game.move-generator.expansion-pending.test.js
```

---

## Phase 4: generated / mirror 同期

### 目的

- `cards/` の生成物と `worker-public/` mirror を root 正本へ追随させる。

### 作業

1. `npm run generate:catalog` で `cards/catalog.js` と `cards/catalog.generated.js` を再生成する。
2. `npm run worker:prepare` で `worker-public/` を同期する。
3. `worker-public/` は spot check のみ行い、直編集はしない。

### 完了条件

- `cards/catalog.json` と generated catalog が一致している。
- `worker-public/` が root の `LAST_RESORT` 更新を取り込んでいる。

### 検証束

```powershell
npm run generate:catalog
npm run worker:prepare
git grep -n "LAST_RESORT|最後の切り札" -- cards/catalog.json cards/catalog.js cards/catalog.generated.js shared-constants.js worker-public/cards/catalog.json worker-public/shared-constants.js
```

## 5. 実装順の要点

- 先に `01-rulebook.md` と `cards/catalog.json` を直し、その後で root ロジックへ入る。
- 使用条件の追加は 2 箇所へコピペせず、共有 helper 化で重複原因を潰す。
- 3 回配置は既存継続フローを再利用し、2 回前提の seed / default / test だけを重点更新する。
- dirty な対象ファイルが多いので、実装開始時に対象 hunk の再確認を入れる。

## 6. 想定リスク

- `01-rulebook.md` と `cards/catalog.json` が既に dirty なので、着手タイミングで別件差分が増えている可能性がある。
- CPU は「使用不可なら売却 / 破壊へ回す」挙動を複数箇所で持つため、使用条件だけ変えると hand cycle の期待とずれる恐れがある。
- `placementsRemaining` は構造上 3 回化に耐える見込みだが、UI 進行の hidden assumption はテストで確認する必要がある。

## 7. 着手前チェック

- 対象 hunk に新しい未コミット差分が増えていないか確認する。
- `LAST_RESORT` の使用条件を tie では不可とする前提でよいかを、実装開始時に最終確認する。
- 実装後は、上記の Phase ごとの検証束を同条件で実行して前後差分を残す。

