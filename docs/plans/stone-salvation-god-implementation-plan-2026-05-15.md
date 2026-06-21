# 石救済神 実装計画

**作成日**: 2026-05-15  
**対象**: `01-rulebook.md`, `cards/`, `assets/images/stones/`, `game/logic/`, `game/turn/`, `shared/`, `ui/`, `test/`, `worker-public/`  
**状態**: 実装前  
**起票理由**: 新カード `石救済神` を、既存の `救済の意志`・特殊石・破壊/復活 presentation 契約に沿って追加する

---

## 0. この文書の位置づけ

- この文書は、`石救済神` を root 正本から安全に追加するための implementation plan である。
- 一次仕様は `01-rulebook.md`、内部契約は `docs/architecture-contracts.md`、作業導線は `AGENTS.md` に従う。
- 今回の主眼は、カード仕様、次石特殊化、破壊時復活 aura、持続終了、presentation、test、worker mirror を一貫して通すことである。
- `worker-public/` は mirror であり、直接修正完了扱いにしない。root 正本を直した上で `npm run worker:prepare` で同期する。
- この文書は実装計画であり、ゲーム仕様の正本ではない。仕様文言は実装前に `01-rulebook.md` へ反映する。
- 注記: この文書は実装前の履歴記録であり、現行仕様では `石救済神` のコストは `20`、復活石で挟める列があれば通常反転する。

## 1. 対象仕様

今回の依頼仕様は次のとおり。

- カード名: `石救済神`
- コスト: `25`（当時案。現行仕様は `20`）
- 効果: 次に置く石を `救済神` 化する
- `救済神` は特殊石として扱う
- `救済神` は反転されない
- `救済神` は破壊を通常どおり受ける
- `救済神` が盤面にいる間、自分の石が破壊された場合、破壊された自石をすべて自分の通常石としてランダムな空きマスに復活させる
- 復活対象は通常石・特殊石を問わない
- 復活後は必ず通常石になり、元の特殊状態、残りターン、保護、爆弾、回避回数、付帯効果などは引き継がない
- 当時案では復活に反転を付けない前提だったが、現行仕様では復活石で挟める列があれば通常反転する
- 空きマスが足りない場合は、空きがある分だけ復活する
- 10ターン持続
- 持続切れ時は同色の通常石に戻る
- `救済神` 自身が破壊された場合、その時点で `救済神` 効果は終了し、`救済神` 自身は復活しない
- 画像は黒側・白側の 2 種を正式名へリネームして登録する

## 2. 一次情報と根拠

- 仕様正本: `01-rulebook.md`
- card display 正本: `cards/catalog.json`
- 特殊石表示・説明: `shared/special-stone-registry.ts`
- special stone image mapping: `game/visual-effects-map.runtime.js`
- 次石特殊化の既存接続: `game/logic/cards-internal/effect-timing.ts`
- 破壊処理の共通入口: `game/logic/board_ops.ts`
- 既存 `救済の意志`: `game/logic/cards.ts` の `getSalvationWillTargetCount` / `applySalvationWill`
- `救済の意志` focused test: `test/game.salvation-will.test.ts`
- 復活・状態復元の既存互換カード: `game/logic/cards/living_will.ts`, `test/game.living-will.test.ts`
- 反転されない・10ターン後通常石化の既存例: `ULTIMATE_HYPERACTIVE_GOD`, `GHOST`, `TIME_STOP` 周辺
- card state 初期化・copy shape: `game/logic/cards-internal/state-factory.ts`
- turn 表示文・phase helper: `game/turn/turn_pipeline_phase_helpers.ts`

## 3. 目的

- `石救済神` を catalog・rulebook・logic・visual・test・worker mirror まで抜けなく追加する
- 既存 `救済の意志` の「ランダム空きマスへの復活」部品を再利用しつつ、`救済の意志` の「前ターン破壊履歴」「復活時反転」は流用しない
- 破壊処理を `BoardOps.destroyAt` に集約し、破壊カードごとに個別実装を増やさない
- 復活後は必ず通常石に正規化し、特殊石 marker / bomb marker / overlay marker を引き継がない
- browser / headless / worker で同じ deterministic random 結果になるようにする

## 4. 非目標

- `救済の意志` の既存仕様変更
- `生きる意志` の状態復元仕様変更
- 盤面外・墓地・永続捕獲領域の新設
- out-of-turn UI 選択や手動復活先選択の追加
- 当時案としては revive 石の通常反転、chain flip、復活石効果の誘発を非目標としていた。現行仕様では revive 石の通常反転は採用済み。
- 複数 `救済神` による復活数の乗算
- unrelated card balance 調整

## 5. 既存調査からの結論

### 5.1 `救済の意志` から流用できるもの

- `applySalvationWill` は `resolveRandomBoardSpawnEffectUsage` を使い、指定個数をランダムな空きマスへ spawn する既存経路を持つ。
- `test/game.salvation-will.test.ts` は random spawn、履歴消費、presentation event、空き不足の近い検証母型になる。
- `BoardOps.spawnAt` を通すと `SPAWN` presentation と stone id 管理に乗るため、復活 spawn でもこの経路を使う。

### 5.2 `救済の意志` から流用しないもの

- `getSalvationWillTargetCount` と `prevOpponentTurnDestroyedStonesByPlayer` は「前の相手ターンで破壊された石」を参照する。`石救済神` は盤面上の aura なので、この ledger を条件・効果本体には使わない。
- 当時案では `applySalvationWill` の `normalFlip: true` / `flipReason: 'salvation_flip'` を流用せず、revive 反転なしで設計していた。現行仕様では revive 石の通常反転を行う。
- `救済の意志` は card use 時の即時解決だが、`石救済神` は次石特殊化後に、以後の `destroyAt` で反応する常在効果として扱う。

### 5.3 `生きる意志` との違い

- `生きる意志` は対象石に snapshot を付け、失われる直前の状態を復元する。
- `石救済神` は snapshot を持たず、破壊された自石を通常石として新しい空きマスに spawn する。
- したがって `living_will.ts` の marker snapshot 復元は流用しない。ただし「特殊状態を引き継がない」検証観点は `test/game.living-will.test.ts` と対比して明示する。

### 5.4 特殊石 lifecycle

- 次石特殊化は `applyPlacementEffects` に pending type branch を追加するのが既存パターンである。
- 反転保護は `shared/special-stone-registry.ts` に `flipProtected: true` を定義し、既存の flip protection 判定に乗せる。
- 10ターン持続後に通常石へ戻す処理は、`GHOST` や `ULTIMATE_HYPERACTIVE` のように marker 削除だけでなく `CHANGE` / `STATUS_REMOVED` / duration-end presentation を意識する。
- `救済神` は破壊保護を持たないため、`destroyProtected` や `destroyEvadeRemaining` は付けない。
- card state の copy / snapshot / network projection で marker data が落ちると aura が消えるため、`state-factory.ts` と public snapshot tests を実装時に確認する。
- `turn_pipeline_phase_helpers.ts` と `pipeline_ui_adapter.ts` は、`duration_end`, `living_will_restored`, `SALVATION_WILL` などの表示文・再生順を持つため、新 event / reason を増やす場合は同時に確認する。

### 5.5 画像・表示

- 既存 assets は `assets/images/stones/<effect>-black.png` / `...-white.png` 形式が多い。
- 新規画像は正式名として `assets/images/special-stones/STONE_SALVATION_GOD-black.png` と `assets/images/special-stones/STONE_SALVATION_GOD-white.png` を候補にする。
- `game/visual-effects-map.runtime.js` へ `stoneSalvationGod` effect key と `PENDING_TYPE_TO_EFFECT_KEY` / special type resolution を追加する。
- 既存 `kyuusai-black.png` / `kyuusai-white.png` は名前上 `救済の意志` 系の可能性があるため、上書き・流用せず、用途を確認してから扱う。

## 6. 実装方針

### 6.1 ID / type 方針

候補:

- card id: `stone_salvation_god_01`
- card type / pending type: `STONE_SALVATION_GOD`
- special stone type: `STONE_SALVATION_GOD`
- visual effect key: `stoneSalvationGod`
- spawn reason: `stone_salvation_god_revive`
- duration-end reason: `duration_end`

`STONE_SALVATION_GOD` を card type と special stone type で共有すると、pending branch、marker data、presentation meta、registry 表示が追いやすい。

### 6.2 仕様・catalog 層

更新対象:

- `01-rulebook.md`
- `cards/catalog.json`
- generated catalog outputs
- `shared/deck-spec.js` など deck / help にカード一覧を持つ箇所
- `ui/handlers/rules-help.ts`

方針:

- `01-rulebook.md` にカード仕様を先に追加する。
- catalog には `cost: 25` と、反転されない・破壊は受ける・復活は通常石・10ターン持続を省略せず入れる。
- 表示分類は既存分類に合わせ、第一候補を `守護` とする。破壊反応 aura のため、既存分類と矛盾する場合は近傍カードの分類を確認して調整する。

### 6.3 assets / visual 層

更新対象:

- `assets/images/special-stones/STONE_SALVATION_GOD-black.png`
- `assets/images/special-stones/STONE_SALVATION_GOD-white.png`
- `game/visual-effects-map.runtime.js`
- `test/ui.visual-effects-map.shared.test.ts`
- 必要に応じて `test/ui.card-renderer-hand-inspect.test.ts`

方針:

- ユーザー提供画像を正式ファイル名へリネームして配置する。
- 黒側画像は黒背景版、白側画像は白背景版として扱う。
- `imagePathByOwner` を使い、owner `1` / `-1` で表示を切り替える。
- hand card preview と board special overlay の両方で同じ map を使う。

### 6.4 headless placement 層

更新対象:

- `game/logic/cards-internal/effect-timing.ts`
- `game/logic/cards.ts`
- `shared/special-stone-registry.ts`

方針:

- card use で `pendingEffectByPlayer[playerKey] = { type: 'STONE_SALVATION_GOD' }` を作る。
- 次の配置時に `applyPlacementEffects` が `specialStone` marker を追加する。
- marker data は最小にする:
  - `type: 'STONE_SALVATION_GOD'`
  - `remainingOwnerTurns: 10`
- `flipEvadeRemaining` / `destroyEvadeRemaining` / `destroyProtected` は持たせない。

### 6.5 破壊時復活 aura 層

更新対象:

- `game/logic/board_ops.ts`
- 必要なら `game/logic/cards/stone_salvation_god.ts` を新設
- 必要なら `shared/destroy-outcome-contract.ts`

方針:

1. `destroyAt` の実破壊が成立した後、破壊前 owner を確定する。
2. 破壊対象セルにある marker を削除する前に、対象が `STONE_SALVATION_GOD` 自身か判定する。
3. 対象が `STONE_SALVATION_GOD` 自身なら、通常どおり破壊して終了する。復活は発火しない。
4. 対象 owner の盤面上に active `STONE_SALVATION_GOD` marker が残っているか確認する。
5. active marker がある場合だけ、破壊された石 1 個につきランダム空きマスへ通常石を 1 個 spawn する。
6. 復活 spawn は `BoardOps.spawnAt` を通し、meta に `revivedFromRow`, `revivedFromCol`, `revivedOwner`, `sourceSpecial: 'STONE_SALVATION_GOD'` を含める。
7. 復活後に marker は追加しない。特殊状態は引き継がない。
8. 復活では `normalFlip` や `changeAt` による反転を行わない。

複数 `救済神` が同じ owner で存在する場合は、`owner に active marker が 1 個以上あるか` の boolean として扱い、復活数を増やさない。

### 6.6 random 契約

更新対象:

- `game/logic/board_ops.ts`
- `game/logic/cards.ts` または新 helper
- random-source helper 呼び出し箇所

方針:

- `Math.random` は使わない。
- 既存 `resolveRandomBoardSpawnEffectUsage` か同等の deterministic random-source 経路を使う。
- `destroyAt` の `meta.random` がある場合はそれを優先し、なければ `cardState` 作成時の PRNG / turn pipeline の PRNG 注入を使う。
- 空きマス候補は board shape / expansion / blocked cell 既存 helper と整合させる。
- 空き不足時は失敗ではなく、spawn できた数だけ返す。

### 6.7 duration / revert 層

更新対象:

- `game/logic/cards-internal/effect-timing.ts`
- `game/logic/board_ops.ts`
- `game/turn/turn_pipeline_phases.ts`
- `game/turn/pipeline_ui_adapter.ts`

方針:

- owner turn start だけ `remainingOwnerTurns` を 1 減らす既存 pattern に合わせる。
- 0 到達時は marker を外し、盤面の石は同色通常石として残す。
- duration-end は破壊ではないため、`救済神` 自身の「破壊された場合」処理とは区別する。
- presentation は `STATUS_REMOVED` または duration-end `CHANGE` を既存 duration-end revert phase に乗せる。

### 6.8 turn pipeline / event 層

更新対象:

- `game/turn/turn_pipeline_phases.ts`
- `game/turn/pipeline_ui_adapter.ts`
- `game/turn/turn_pipeline_phase_helpers.ts`
- `game/log-messages.ts`
- sound cue が必要なら sound mapping tests

方針:

- card use は既存の次石特殊化カードと同じ `CARD_USED` + placement pending 消費で扱う。
- 復活時は raw `SPAWN` event を primary evidence とし、必要なら集約 raw event `stone_salvation_god_revived` を追加する。
- `救済の意志` の `salvation_will_resolved` とは別 event name にする。
- UI playback は `SPAWN` を既存 `spawn` phase に乗せる。復活時の反転 event は出さない。

### 6.9 CPU / strategy 層

更新対象:

- `game/cpu-decision.ts`
- `game/ai/cpu-policy-core.ts`
- `game/ai/policy-onnx-runtime.ts` に明示 bucket があれば追加
- `docs/Card_Strategy_Full_Catalog.md` や teacher bucket 文書が必要なら更新

方針:

- 高コスト守護/aura カードとして扱う。
- `救済の意志` と同じ recovery 系に分類するが、条件カードではなく次石設置カードとして decision path を合わせる。
- CPU が使用後に合法 placement を行える既存 pending flow を使う。

## 7. フェーズ計画

### Phase 0: 仕様固定

**目的**: 実装前に、破壊時 aura と edge case を固定する。

**タスク**:

1. `01-rulebook.md` に `石救済神` と `救済神` の仕様を追加する
2. 復活は通常石・反転なし・特殊状態引き継ぎなしを明記する
3. `救済神` 自身破壊時は復活しないことを明記する
4. 複数 `救済神` がいても復活数を乗算しない方針を明記する
5. 空きマス候補に board expansion / blocked / frozen / meteor hole を含めるか、既存 spawn helper に従うかを決める

**完了条件**:

- rulebook とこの計画書に仕様矛盾がない
- 実装時に `救済の意志` / `生きる意志` と混同する余地がない

### Phase 1: catalog / assets / visual 登録

**目的**: カードと特殊石の表示正本を追加する。

**タスク**:

1. `cards/catalog.json` へ `stone_salvation_god_01` を追加する
2. ユーザー提供画像を正式名で `assets/images/stones/` に配置する
3. `game/visual-effects-map.runtime.js` へ `stoneSalvationGod` を追加する
4. `shared/special-stone-registry.ts` へ `STONE_SALVATION_GOD` を追加する
5. generated catalog / asset manifest を再生成する

**完了条件**:

- card id / type / cost / name が lookup できる
- board special overlay と hand preview が owner 別画像を解決できる
- `救済神` が長押し/詳細表示で「反転されない・破壊は受ける・10ターン」を表示できる

### Phase 2: 次石特殊化実装

**目的**: 使用後、次に置く石が `救済神` marker を持つ。

**タスク**:

1. card use で pending `STONE_SALVATION_GOD` を設定する
2. `applyPlacementEffects` に marker 追加 branch を加える
3. `effects.stoneSalvationGodPlaced` のような placement flag を返す
4. pending 消費・card use animation・spawn meta の既存契約に乗せる

**完了条件**:

- 使用後の次 placement に `specialStone` marker `{ type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 10 }` が付く
- その石は反転対象にならない
- その石は破壊対象になり、破壊保護や破壊回避を持たない

### Phase 3: 破壊時復活実装

**目的**: `救済神` が盤面にいる間、自分の破壊された石だけを通常石として復活させる。

**タスク**:

1. `BoardOps.destroyAt` の実破壊成立後 hook を設計する
2. owner の active `STONE_SALVATION_GOD` marker を探索する helper を追加する
3. `救済神` 自身の破壊を復活対象から除外する
4. 破壊対象が通常石・特殊石・爆弾付き石でも、復活先には marker を付けない
5. `SPAWN` meta に復活元と原因を入れる
6. 空き不足時は spawn できた分だけ返す

**完了条件**:

- 自分の通常石破壊で通常石が 1 個復活する
- 自分の特殊石破壊でも通常石が 1 個復活し、特殊 marker は復活しない
- 相手石破壊では復活しない
- `救済神` 自身破壊では復活せず、以後 aura が消える
- 復活 spawn 後に反転 event が発生しない

### Phase 4: duration / expiry / presentation

**目的**: 10ターン持続と見え方を既存 playback 契約へ接続する。

**タスク**:

1. owner turn start で `remainingOwnerTurns` を減算する
2. 0 到達時に marker を削除し、同色通常石へ戻す
3. duration-end presentation event を既存 phase に乗せる
4. effect log / special stone bubble / sound cue が必要なら追加する

**完了条件**:

- owner 以外の turn start では残りターンが減らない
- 10回目の owner turn start で通常石に戻る
- duration end は破壊扱いにならず、復活を誘発しない
- playback で特殊石表示が消え、通常石表示に戻る

### Phase 5: CPU / network / mirror 同期

**目的**: runtime 差分をなくし、CPU と network でも同じカードとして扱う。

**タスク**:

1. CPU card classification / scoring に追加する
2. public snapshot / network sanitize で marker data が落ちないことを確認する
3. generated outputs を再生成する
4. `npm run worker:prepare` で mirror 同期する

**完了条件**:

- CPU がカードを使用候補にできる
- network snapshot に `STONE_SALVATION_GOD` marker と timer が残る
- root と `worker-public/` が同期している

## 8. テスト計画

### 8.1 新規 focused tests

- `test/game.stone-salvation-god.test.ts`
  - catalog entry: id / type / cost `25`
  - placement: pending から `救済神` marker を付与
  - flip: `救済神` は反転されない
  - destroy: `救済神` 自身は通常どおり破壊され、復活しない
  - revive: 自分通常石破壊で通常石 spawn
  - revive: 自分特殊石破壊でも通常石 spawn、marker を引き継がない
  - no revive: 相手石破壊では spawn しない
  - no flip on revive: `CHANGE` / `salvation_flip` が出ない
  - shortage: 空きマス不足時は空き分だけ spawn
  - deterministic: PRNG sequence で spawn 先が固定される
  - multiple anchors: active marker 複数でも破壊 1 個につき spawn は 1 個
  - duration: owner turn only decrement, 10ターン後通常石化
- `test/game.pipeline-ui-adapter.spawn.test.ts`
- `test/game.pipeline-ui-adapter.special-revert-phase.test.ts`
  - `STONE_SALVATION_GOD` revive spawn が card/disc playback phase と矛盾しない
- `test/game.pipeline-ui-adapter.normal-logs.test.ts`
  - 復活・持続終了の player-facing log が既存文言と矛盾しない
- `test/ui.visual-effects-map.shared.test.ts`
  - black / white owner 画像解決
- `test/ui.card-detail-effect-tags.test.ts` または `test/ui.long-press-info.test.ts`
  - `救済神` 説明と timer / 反転保護 tag

### 8.2 参照する既存テスト

- `test/game.salvation-will.test.ts`
- `test/game.living-will.test.ts`
- `test/game.ultimate-hyperactive-god.test.ts`
- `test/game.pipeline-ui-adapter.spawn.test.ts`
- `test/game.pipeline-ui-adapter.special-revert-phase.test.ts`
- `test/game.pipeline-ui-adapter.sound-cue.test.ts`
- `test/game.regen.consume-visual.test.ts`
- `test/ui.visual-effects-map.shared.test.ts`
- `test/utils.match-authority.public-snapshot.test.ts`

## 9. 検証束

### 9.1 局所確認

- 変更ファイルへの `lsp_diagnostics`
- `rg -n "STONE_SALVATION_GOD|stone_salvation_god|石救済神|救済神" .`
- `rg -n "kyuusai|STONE_SALVATION_GOD" assets game ui cards test worker-public`

### 9.2 focused tests

```powershell
npx jest --runInBand --runTestsByPath test/game.stone-salvation-god.test.ts
npx jest --runInBand --runTestsByPath test/game.salvation-will.test.ts test/game.living-will.test.ts
npx jest --runInBand --runTestsByPath test/game.pipeline-ui-adapter.spawn.test.ts test/ui.visual-effects-map.shared.test.ts
```

### 9.3 broader checks

```powershell
npm run typecheck
npm run build:ts
npm run test:network:parity
```

### 9.4 generated / mirror

```powershell
npm run generate:catalog
npm run worker:prepare
```

必要に応じて asset manifest 生成 script も実行し、`assets/images/stones/STONE_SALVATION_GOD-*.png` が manifest / mirror に含まれることを確認する。

### 9.5 manual QA

- ローカルサーバーを起動し、Playwright で実ブラウザを開く
- `石救済神` を手札に持つ状態を debug setup で作る
- カード使用 -> 次石配置 -> `救済神` 表示確認
- 自分石破壊を発生させ、ランダム空きマスへの通常石復活を確認
- 復活時に反転が発生しないこと、`救済神` 自身破壊時に復活しないことを確認

## 10. リスク

- `救済の意志` の helper をそのまま使うと、前ターン ledger と復活時反転が混入する
- `生きる意志` の snapshot 復元を流用すると、特殊状態を引き継いで仕様違反になる
- `destroyAt` に hook を足すため、破壊系カード全体へ波及する
- 復活 spawn がさらに破壊/反転/復活を誘発すると chain bug になる
- `救済神` 自身の破壊判定を marker 削除後に行うと、自身復活を誤って許す
- owner 別画像の file name と `PENDING_TYPE_TO_EFFECT_KEY` がずれると、手札 preview と盤面表示だけ壊れる
- network snapshot sanitize で unknown special type が落ちる可能性がある

## 11. 完了条件

この計画に基づく実装完了は、次をすべて満たした時だけ成立する。

1. `01-rulebook.md` と catalog に `石救済神` が追加されている
2. `石救済神` 使用後、次に置く石が `救済神` marker と owner 別画像を持つ
3. `救済神` は反転されず、破壊は通常どおり受ける
4. `救済神` が盤面にいる間、自分の破壊された石だけが通常石としてランダム空きマスに復活する
5. 復活は特殊状態を引き継がず、反転も行わない
6. 空き不足時は空き分だけ復活する
7. `救済神` 自身が破壊された場合は復活せず、aura が終了する
8. 10 owner turns 後に同色通常石へ戻る
9. 変更ファイルの diagnostics が clean である
10. focused tests / typecheck / build / 必要な network parity が通る
11. generated catalog / asset manifest / `worker-public/` が同期されている

## 12. 実装時の判断メモ

- 実装の中核は `BoardOps.destroyAt` hook とし、破壊カードごとの個別 hook は増やさない
- 復活先選択は既存 spawn candidate helper を優先し、board shape / expansion / blocked cell の独自判定を増やさない
- 復活 spawn の cause / reason は `STONE_SALVATION_GOD` / `stone_salvation_god_revive` で `SALVATION_WILL` と分ける
- `救済神` は `flipProtected: true` だが `destroyProtected: false` として扱う
- 画像は既存 `kyuusai-*.png` と衝突させず、新カード専用の正式名で追加する
- 外部調査では、この repo 固有の公開実装例や `石救済神` / `救済の意志` の公開 precedent は見つからなかった。標準 Othello には復活石 mechanic がないため、repo 内の card-effect 契約を正本にする
