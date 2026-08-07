# 時間停石 実装完遂計画書

作成日: 2026-03-18
更新日: 2026-03-19
対象: docs / cards / game / ui / utils / test / worker-public
状態: In Progress（root 実装は大半完了、generated / mirror / 専用回帰が未完）

## 0. この文書の位置づけ

- この文書は、`TIME_STOP_GOD` を **新規実装するための plan ではなく、既に root に入っている実装を repo の完了条件まで持っていく差分計画** である。
- 一次仕様は `01-rulebook.md` とし、この文書は「既実装」「未完」「未検証」を分け、次の実行者が残課題だけに着手できる状態を作る。
- 目的は、root だけ先行している `時間停石` を generated 面、worker-public mirror、専用 test、snapshot / sanitize 回帰まで揃えることにある。

## 0.1 現状スナップショット

### root で既に入っているもの

- `01-rulebook.md` に `TIME_STOP_GOD（時間停石）` の仕様が追加済み。
- `cards/catalog.json`、`shared-constants.js`、`cards/card-interaction-effects.js` にカード定義と説明が追加済み。
- `game/logic/cards.js` に以下が追加済み。
  - 自石 3 個破壊の候補収集と使用解決
  - `timeStopConsecutiveTurnsRemainingByPlayer` の専用 state
  - 時間停石トリガー時の bonus turn 予約と消費
- `game/logic/cards-internal/effect-timing.js` に `TIME_STOP` marker 生成が追加済み。
- `game/turn/turn_pipeline_phases.js` に `time_stop_god_cost_resolved`、`time_stop_triggered`、`time_stop_fizzled` の event と turn-start 処理が追加済み。
- `game/visual-effects-map.js`、`ui/board-renderer.js`、`styles-board.css`、`styles-layout.css` に時間停石と全画面モノクロの root UI 実装が追加済み。
- `game/ai/cpu-policy-core.js` に `TIME_STOP_GOD` の CPU 評価が追加済み。

### 未完または未追随のもの

- `cards/catalog.js` と `cards/catalog.generated.js` はまだ `TIME_STOP_GOD` を含んでおらず、root generated 面が stale。
- `worker-public/` 側の catalog / game / ui mirror は `TIME_STOP_GOD` を含んでおらず、root と乖離している。
- `worker-public/assets/images/stones/` に time stop 専用外部 asset は確認できず、旧相談由来の候補名 `zi-black.png`, `zi-white.png` の扱いだけが未整理。
- time stop 固有の dedicated test はまだ無く、現時点で確認できたのは `ui.board-renderer.fallback-legal-hint.test.js` の class toggle のみ。
- `snapshot / reconnect / public snapshot / worker sanitize` で time stop 固有 state と event を守る専用回帰は未確認。

## 0.2 採用済み設計判断

- 時間停止は `DOUBLE_PLACE` 系の追加配置ではなく、**通常手番を 1 回追加予約する専用 state** として扱う。
- カウント減少は所有者ターン開始基準で行う。
- `時間停石` は反転無効を持たず、発動前に空マス化または所有者変更が起きた場合は不発にする。
- 定数の正本は `shared-constants.js` に置き、`TIME_STOP_GOD_TURNS`、`TIME_STOP_GOD_CONSECUTIVE_TURNS`、`TIME_STOP_GOD_SELF_DESTROY_COUNT` を共有する。
- root の見た目は外部 PNG ではなく `game/visual-effects-map.js` の inline SVG builder で組み立てる。したがって、`zi-*` の正式リネームは完遂条件ではなく、不要 asset の整理タスクとして切り分ける。

## 1. 検証済みの事実

### 1.1 仕様と根側実装

- `01-rulebook.md` 10.13.1 節は、コスト 0、自石 3 個破壊、時間停石化、3 回目の所有者ターン開始時発動、2 連続行動、モノクロ表示、発動時消滅、不発条件をすでに定義している。
- `game/logic/cards.js` には `collectTimeStopGodDestroyableOwnStonePositions(...)`、`resolveTimeStopGodUsage(...)`、`reserveTimeStopConsecutiveTurns(...)`、`consumeTimeStopConsecutiveTurn(...)`、`processTimeStopEffectsAtTurnStartAnchor(...)` が存在する。
- `game/logic/cards-internal/card-usage-prechecks.js` に `TIME_STOP_GOD` 分岐が存在する。
- `game/logic/cards-internal/effect-timing.js` は pending `TIME_STOP_GOD` から `TIME_STOP` marker を生成している。

### 1.2 presentation / UI / CPU

- `game/turn/turn_pipeline_phases.js` は `time_stop_god_cost_resolved`、`time_stop_triggered`、`time_stop_fizzled` を扱う。
- `game/turn/pipeline_ui_adapter.js` は上記 event の文言と `時間停石` 表示名を持つ。
- `ui/board-renderer.js` は `cardState.timeStopConsecutiveTurnsRemainingByPlayer` を見て `time-stop-active` class を `documentElement` と `body` に同期する。
- `styles-layout.css` と `styles-board.css` には時間停止用の見た目定義が存在する。
- `game/ai/cpu-policy-core.js` は `TIME_STOP_GOD` の評価テーブルを持つ。

### 1.3 直編集不要の可能性が高い面

- `ui/handlers/rules-help.js` は `cards/card-interaction-effects.js` を読む構造であり、time stop 専用分岐を持たない。したがって rules help は **card-interaction-effects 更新済みなら確認のみ** が妥当。
- `shared/deck-spec.js` には `TIME_STOP_GOD` の個別分岐が見当たらない。deck 面は **catalog / enable 状態で選択可能かの確認のみ** を基本とする。

### 1.4 未検証事項

- `cards/catalog.js` / `cards/catalog.generated.js` が stale なままでも root runtime がどこまで問題なく動くかは未検証。
- `ui/network/snapshot.js`、`utils/match-authority.js`、`scripts/local-match-server.js` は generic 経路で通る可能性が高いが、time stop 固有 state / event の保持は専用 test でまだ固定されていない。
- `worker-public/` mirror は未追随のため、public / network 実行面で時間停石が本当に使えるかは未検証。

## 2. 非目標

- root 側の `TIME_STOP_GOD` を最初から作り直すこと
- 汎用の時間停止 framework を新設すること
- `DOUBLE_PLACE` / `LAST_RESORT` の再設計
- `worker-public/` の直編集
- inline SVG 方式をやめて外部 stone asset へ戻すこと
- CPU バランス調整を大きくやり直すこと

## 3. 主対象ファイル

### root 正本として直す面

- `cards/catalog.json`
- `cards/card-interaction-effects.js`
- `shared-constants.js`
- `game/logic/cards.js`
- `game/logic/cards-internal/card-usage-prechecks.js`
- `game/logic/cards-internal/effect-timing.js`
- `game/turn/turn_pipeline_phases.js`
- `game/turn/pipeline_ui_adapter.js`
- `game/visual-effects-map.js`
- `ui/board-renderer.js`
- `styles-board.css`
- `styles-layout.css`
- `test/*` の time stop 専用回帰

### コマンドで再生成する面

- `cards/catalog.js`
- `cards/catalog.generated.js`

### prepare で mirror 同期する面

- `worker-public/*`

### 確認を先行し、必要時だけ直す面

- `ui/handlers/rules-help.js`
- `shared/deck-spec.js`
- `ui/network/snapshot.js`
- `utils/match-authority.js`
- `scripts/local-match-server.js`

### 既実装の根拠として参照する面

- `01-rulebook.md`
- `game/ai/cpu-policy-core.js`

## 4. 残課題フェーズ

## Phase 1: root generated 面の同期

### 目的

- root で先に入った `TIME_STOP_GOD` を `cards/catalog.js` と `cards/catalog.generated.js` に反映し、catalog 面の不整合を止める。

### 作業

1. `node scripts/generate-catalog.js` を実行し、`cards/catalog.js` と `cards/catalog.generated.js` を再生成する。
2. `TIME_STOP_GOD` が `cards/catalog.json`、`cards/catalog.js`、`cards/catalog.generated.js`、`shared-constants.js` で一致することを確認する。
3. `zi-*` 画像は mandatory scope から外し、inline SVG を正本とするか、別 cleanup に切るかを明記する。
4. rules help / deck / story deck は直編集不要なら、その確認結果を計画と完了報告へ残す。

### 完了条件

- root catalog の 4 面が `TIME_STOP_GOD` で揃っている。
- `zi-*` の扱いが「不要 asset」か「今後整理」に分類されている。
- rules help / deck / story deck が直編集不要かどうか説明できる。

### 検証束

```powershell
node scripts/generate-catalog.js
rg -n "TIME_STOP_GOD|TIME_STOP" cards/catalog.json cards/catalog.js cards/catalog.generated.js shared-constants.js cards/card-interaction-effects.js
rg -n "zi-black|zi-white|time-stop-stone" cards game ui styles*.css docs
```

---

## Phase 2: time stop 専用 root 回帰の追加

### 目的

- 近縁カードの借用 test ではなく、`時間停石` 固有の契約を専用 test で固定する。

### 作業

1. 追加する dedicated test を決める。
   - 例: `test/game.time-stop-god-usage.test.js`
   - 例: `test/game.time-stop-god-turn-start.test.js`
   - 例: `test/game.time-stop-god-bonus-turn.test.js`
2. 次の契約を test で固定する。
   - 使用不可条件: 破壊可能な自石が不足すると使えない
   - 使用成功時: 自石をちょうど 3 個破壊する
   - pending 契約: 次配置 1 回だけが `TIME_STOP` 化する
   - 減算契約: 所有者ターン開始でのみ減る
   - 不発契約: 反転 / 破壊 / 交換 / 所有者変更で不発になる
   - handoff 契約: bonus turn は 1 回だけ消費され、`turnNumber` は通常 handoff と同様に進む
3. presentation event 契約を固定する。
   - `time_stop_god_cost_resolved`
   - `time_stop_triggered`
   - `time_stop_fizzled`
4. UI 表示回帰を必須化する。
   - `ui.board-renderer.fallback-legal-hint.test.js` の class toggle を維持する
   - `ui/diff-renderer.js` の `TIME_STOP` 表示名と石情報表示を `test/ui.stone-rendering.test.js` か専用 UI test で固定する

### 完了条件

- `時間停石` 固有の gameplay 契約が専用 test で表現されている。
- borrowed test 名だけに依存していない。
- cost / trigger / fizzle event の契約が固定されている。

### 検証束

```powershell
npm run test:jest -- test/game.time-stop-god-usage.test.js test/game.time-stop-god-turn-start.test.js test/game.time-stop-god-bonus-turn.test.js test/ui.board-renderer.fallback-legal-hint.test.js test/ui.stone-rendering.test.js
```

---

## Phase 3: snapshot / reconnect / sanitize の time stop 回帰

### 目的

- generic 経路に任せている `cardState` / presentation event / public snapshot が、time stop 固有 state を落とさないことを test で固定する。

### 作業

1. `utils.match-authority.public-snapshot.test.js` に、`timeStopConsecutiveTurnsRemainingByPlayer` と marker / owner 情報の保持確認を足す。
2. `workers.match-publish-sanitize.test.js` に、time stop state と presentation event が sanitize で壊れないことを足す。
3. `ui.network-snapshot.single-writer-baseline.test.js` と `ui.network-client.reconnect-sync.test.js` のどちらか、または両方に、snapshot / reconnect 後の time stop class と state 復元を足す。
4. `scripts/local-match-server.js` を触る場合は、presentation event の assembly 経路が time stop event を落とさないことを別 test か既存 network playback contract test で確認する。
5. ここで落ちた場合だけ `ui/network/snapshot.js`、`utils/match-authority.js`、`scripts/local-match-server.js` を直す。

### 完了条件

- public snapshot と sanitize で time stop 固有 state が消えない。
- reconnect / snapshot 後に `time-stop-active` の付け外しが破綻しない。
- generic 経路で足りるのか、専用分岐が必要なのかを test で判断できる。

### 検証束

```powershell
npm run test:jest -- test/utils.match-authority.public-snapshot.test.js test/workers.match-publish-sanitize.test.js test/ui.network-snapshot.single-writer-baseline.test.js test/ui.network-client.reconnect-sync.test.js test/network.playback-event-assembly.contract.test.js test/game.network-turn-handoff.test.js
```

---

## Phase 4: worker-public mirror 同期

### 目的

- root だけ先行している `TIME_STOP_GOD` を mirror 側へ揃え、public 実行面の欠落をなくす。

### 作業

1. Phase 1-3 の root 修正後に `npm run worker:prepare` を実行する。
2. `worker-public/cards/catalog.json`、`worker-public/cards/catalog.js`、`worker-public/cards/catalog.generated.js` に `TIME_STOP_GOD` が入ることを確認する。
3. `worker-public/game/logic/cards.js`、`worker-public/game/logic/cards-internal/effect-timing.js`、`worker-public/game/turn/turn_pipeline_phases.js`、`worker-public/game/turn/pipeline_ui_adapter.js`、`worker-public/game/visual-effects-map.js`、`worker-public/ui/board-renderer.js`、`worker-public/ui/diff-renderer.js`、`worker-public/styles-board.css`、`worker-public/styles-layout.css` に time stop 実装が入ることを確認する。
4. asset は inline SVG 方針なら mirror に専用 PNG を持たせない。`zi-*` を残すか消すかは cleanup 扱いで分ける。

### 完了条件

- mirror 側に root と同じ `TIME_STOP_GOD` 実装が存在する。
- root にだけある time stop 実装が無くなる。
- `worker:prepare` を実行したことを完了報告に含められる。

### 検証束

```powershell
npm run worker:prepare
rg -n "TIME_STOP_GOD|TIME_STOP|time-stop-active" worker-public
```

---

## Phase 5: 最終回帰と完了報告

### 目的

- root と mirror の差異を閉じ、time stop の残課題が無い状態で終える。

### 作業

1. root generated 面、専用 test、snapshot / sanitize test、mirror 同期をまとめて再確認する。
2. `DOUBLE_PLACE` 系や既存 pending / turn pipeline に副作用が出ていないか近傍回帰を回す。
3. CPU は既に `game/ai/cpu-policy-core.js` へ入っているため、今回の完了条件では「既存評価が残っていること」と「不正使用しないこと」を確認対象にする。
4. 完了報告では、以下を分けて書く。
   - 今回直した面
   - 確認のみで済んだ面
   - `01-rulebook.md` を追加更新したかどうか
   - `npm run worker:prepare` 実行有無

### 完了条件

- root generated 面が揃っている。
- dedicated test が揃っている。
- snapshot / sanitize / reconnect の回帰が通る。
- worker-public mirror が揃っている。
- 完了報告で「直した面」と「確認のみの面」が分離されている。

### 検証束

```powershell
node scripts/generate-catalog.js
npm run worker:prepare
npm run test:jest -- test/game.time-stop-god-usage.test.js test/game.time-stop-god-turn-start.test.js test/game.time-stop-god-bonus-turn.test.js test/game.double-place-pipeline.test.js test/game.cards.effect-timing-module.test.js test/ui.board-renderer.fallback-legal-hint.test.js test/utils.match-authority.public-snapshot.test.js test/workers.match-publish-sanitize.test.js test/ui.network-snapshot.single-writer-baseline.test.js test/ui.network-client.reconnect-sync.test.js
rg -n "TIME_STOP_GOD|TIME_STOP|time-stop-active" 01-rulebook.md cards game ui worker-public test shared-constants.js
```

## 5. 実装上の注意点

- `game/` から `ui/` へ直接依存を増やさない。DOM 変更は `ui/` 側で受ける。
- `extraPlaceRemainingByPlayer` を流用して bonus turn を表現しない。`timeStopConsecutiveTurnsRemainingByPlayer` を正本にする。
- time stop の数値は `shared-constants.js` を正本にし、`cards.js` 側のローカル定数を増やさない。
- `zi-*` asset の整理は feature completion と切り離す。inline SVG 維持なら、まず未参照確認だけでよい。
- `worker-public/` は mirror なので、root fix より先に直さない。

## 6. 全体の完了条件

- `01-rulebook.md` の time stop 仕様が一次情報として維持されている。
- `cards/catalog.json`、`cards/catalog.js`、`cards/catalog.generated.js`、`shared-constants.js`、`cards/card-interaction-effects.js` が `TIME_STOP_GOD` で揃っている。
- time stop 専用 gameplay test と snapshot / sanitize test がある。
- `ui.board-renderer.fallback-legal-hint.test.js` だけに依存せず、root gameplay まで回帰できる。
- `npm run worker:prepare` 実行後に worker-public mirror が揃っている。
- 完了報告で、`01-rulebook.md` 更新有無、`worker:prepare` 実行有無、確認のみで済んだ面を明示できる。

## 7. 着手順

1. `node scripts/generate-catalog.js` で root generated 面を揃える。
2. time stop 専用 test を追加する。
3. snapshot / reconnect / sanitize 回帰を足す。
4. `npm run worker:prepare` で mirror を同期する。
5. 最終回帰を通して完了報告を作る。

