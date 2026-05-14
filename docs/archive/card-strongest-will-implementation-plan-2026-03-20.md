# 最強の意志 / 強い意志昇格 仕様変更計画書

作成日: 2026-03-20
更新日: 2026-03-20
対象: docs / 01-rulebook.md / cards / game / ui / shared / assets / test / worker-public
状態: Draft（独立カード案を破棄し、強い意志の昇格仕様へ差し替え）

## 0. この文書の位置づけ

- この文書は、**独立カード `最強の意志` を実装する計画ではなく、既存の `強い意志` を 10 ターン経過で `最強の意志` 相当へ昇格させる仕様変更計画**である。
- 既存の `docs/card-strongest-will-implementation-plan-2026-03-20.md` が想定していた「手札から直接使う `最強の意志`」案は、この文書内容で置き換える。
- 一次仕様は `01-rulebook.md` とし、この文書は「何を消し、何を残し、どの順で揃えるか」を固定する。
- root を正本とし、`worker-public/` は最後に `npm run worker:prepare` で同期する。

## 0.1 現状スナップショット

- `01-rulebook.md` 6.5 節と 10.6.1 節は、現時点では `最強の意志` を**独立カード**として定義している。
- `cards/catalog.json` と `shared-constants.js` には、`強い意志`（`PERMA_PROTECT_NEXT_STONE`）と `最強の意志`（`ABSOLUTE_PROTECT_NEXT_STONE`）の両方が登録されている。
- `cards/card-interaction-effects.js`、`game/ai/cpu-policy-core.js`、generated catalog 面も同様に 2 枚の別カード前提で追随している。
- `game/logic/cards-internal/effect-timing.js` には、`PERMA_PROTECT_NEXT_STONE` で `PERMA_PROTECTED` を付ける処理と、`ABSOLUTE_PROTECT_NEXT_STONE` で `ABSOLUTE_PROTECTED` を付ける処理が両方存在する。
- `game/logic/cards.js` と `game/logic/board_ops.js` には、`ABSOLUTE_PROTECTED` を対象外にする helper / guard がすでに存在し、絶対保護そのもののゲーム内契約は土台がある。
- `game/visual-effects-map.js` には `protectedStone` と `absoluteProtectedStone` の両方が定義済みで、`assets/images/stones/perma_protect_next_stone-*.png` と `assets/images/stones/absolute_protect_next_stone-*.png` もすでに存在する。
- したがって今回の画像要件は、新規 asset 追加ではなく、**昇格時に `ABSOLUTE_PROTECTED` 側の既存画像へ切り替わる経路を保証する作業**として扱える。

## 0.2 採用する設計判断

- プレイアブルなカードとしての `ABSOLUTE_PROTECT_NEXT_STONE` は削除し、`ABSOLUTE_PROTECTED` は**昇格後の内部状態 / 特殊石 marker / visual key**としてだけ残す。
- `強い意志` は現在の「次に置く石へ永続保護を付与」という即時効果を維持したうえで、**その石が 10 回の所有者ターン開始を生き延びると自動昇格**する仕様へ変更する。
- 「10ターン」の基準は、repo 既存の `remainingOwnerTurns` 系と揃えて**所有者ターン開始カウント**に寄せる。
- 昇格進捗は通常の持続ターンではなく**昇格専用 progress** として `PERMA_PROTECTED` marker data に保持し、`remainingOwnerTurns` と混ぜない。
- この progress は「持続ターン」ではないため、**凍結による通常の特殊石タイマー停止対象には含めない**方針で進める。つまり凍結中でも石が盤上に残っていれば昇格カウントは進む。
- 時間停止などで追加手番が発生した場合は、実際に所有者ターン開始が増えるならその回数ぶん昇格カウントも進む。
- 昇格時は marker type を `PERMA_PROTECTED` から `ABSOLUTE_PROTECTED` へ置き換え、必要なら専用 presentation event（仮: `strong_will_promoted`）を出す。
- 石ビジュアルは新規画像を増やさず、**昇格後に `absoluteProtectedStone` の既存画像 (`absolute_protect_next_stone-black.png` / `absolute_protect_next_stone-white.png`) へ切り替える**。
- `ABSOLUTE_PROTECTED` の防御契約は既存 helper を再利用し、昇格専用の別無敵状態を増やさない。

## 1. 検証済みの事実

### 1.1 仕様・文書面

- `01-rulebook.md` 6.2 節は `強い意志` 相当の永続保護を、6.5 節は `最強の意志` 相当の絶対保護を定義している。
- `01-rulebook.md` 10.6 節は `PERMA_PROTECT_NEXT_STONE（強い意志）`、10.6.1 節は `ABSOLUTE_PROTECT_NEXT_STONE（最強の意志）` を別カードとして定義している。
- `cards/catalog.json` の説明文も同じく 2 枚別カード前提である。

### 1.2 カタログ・説明文・CPU 面

- `shared-constants.js` の `CARD_DEFS` と card type 一覧には `ABSOLUTE_PROTECT_NEXT_STONE` が残っている。
- `cards/card-interaction-effects.js` は quick/detail ともに `ABSOLUTE_PROTECT_NEXT_STONE` を持っている。
- `game/ai/cpu-policy-core.js` は `PERMA_PROTECT_NEXT_STONE` と `ABSOLUTE_PROTECT_NEXT_STONE` を別カードとして評価している。

### 1.3 ゲームロジック・ビジュアル面

- `game/logic/cards-internal/effect-timing.js` は placement-time hook の既存入口であり、`強い意志` と `最強の意志` の両方をここで特殊石化している。
- `game/logic/cards.js` の `isAbsoluteProtectedCell(...)` と `game/logic/board_ops.js` の `_isAbsoluteProtectedCell(...)` は、絶対保護石への破壊・移動・状態変更を拒否する既存経路を持っている。
- `game/visual-effects-map.js` は pending type と marker type の両面で `absoluteProtectedStone` を解決できる。
- `assets/images/stones/absolute_protect_next_stone-black.png` / `absolute_protect_next_stone-white.png` はすでに存在する。

### 1.4 追随確認が必要な面

- `cards/catalog.js` と `cards/catalog.generated.js` は `cards/catalog.json` から再生成されるため、独立カード削除後は再生成が必要。
- `ui/handlers/rules-help.js` はカード図鑑・特殊石画像表示の入口なので、`最強の意志` をカードとして消しても `絶対保護` の用語や画像経路が崩れないか確認が必要。
- 進捗 field を marker data に足す場合、snapshot / sanitize / public state で generic に保持されるかは test で確認した方が安全。

## 2. 目的

- `最強の意志` を手札から直接使う独立カードとしては廃止する。
- `強い意志` を「永続保護 + 10 所有者ターン後に絶対保護へ昇格するカード」へ変更する。
- 昇格後の石ビジュアルを、従来 `最強の意志` が使っていた既存画像へ切り替える。
- `絶対保護` そのもののゲーム内契約は維持しつつ、到達経路だけを `強い意志` の昇格へ寄せる。
- 仕様、catalog、説明文、CPU、描画、test、mirror を同時に揃える。

## 3. 非目標

- 保護 tier 全体をゼロから再設計すること
- `絶対保護` 概念自体をゲームから削除すること
- 新しい石画像を描き起こすこと
- `worker-public/` を直編集すること
- 既存カード全体の大規模なバランス再調整を行うこと

## 4. 主対象ファイル

### 4.1 仕様・計画書

- `01-rulebook.md`
- `docs/card-strongest-will-implementation-plan-2026-03-20.md`

### 4.2 root 正本の実装候補

- `cards/catalog.json`
- `cards/card-interaction-effects.js`
- `shared-constants.js`
- `game/logic/cards.js`
- `game/logic/cards-internal/effect-timing.js`
- `game/logic/board_ops.js`
- `game/turn/turn_pipeline_phases.js`
- `game/turn/pipeline_ui_adapter.js`
- `game/visual-effects-map.js`
- `ui/board-renderer.js`
- `ui/diff-renderer.js`
- `ui/handlers/rules-help.js`
- `game/ai/cpu-policy-core.js`
- `test/*` の昇格専用回帰

### 4.3 再生成・mirror 同期面

- `cards/catalog.js`
- `cards/catalog.generated.js`
- `worker-public/*`

### 4.4 直編集前に確認する面

- `shared/deck-spec.js`
- snapshot / sanitize / public snapshot 関連 test

## 5. フェーズ計画

## Phase 0: 仕様差し替えと文言凍結

### 目的

- 「独立カードの最強の意志」から「強い意志の昇格先」へ仕様の正本を切り替え、後続のコード判断をぶらさない。

### 作業

1. `01-rulebook.md` 10.6 節を書き換える。
   - コスト 15 は維持
   - 次配置石へ永続保護を付与
   - 所有者ターン開始 10 回で `絶対保護` に昇格
2. `01-rulebook.md` 10.6.1 節は「独立カード定義」としては削除し、必要なら 6.5 節や用語説明で**昇格先としての最強の意志**を説明する形へ整理する。
3. `01-rulebook.md` 6.5 節に、到達経路が `強い意志` の昇格であることと、ビジュアル切替を含む外から見える契約を追記する。
4. `cards/catalog.json` と `cards/card-interaction-effects.js` の `強い意志` 文言も同じ仕様へ合わせる。
5. 昇格カウントの定義を文書で先に固定する。
   - 所有者ターン開始基準
   - 凍結では止まらない
   - 追加手番は開始回数として数える

### 完了条件

- `01-rulebook.md` 単体で、新しい `強い意志` と `最強の意志` の関係を説明できる。
- `最強の意志` が「カード名」なのか「昇格状態名」なのか曖昧さがない。
- 昇格カウントの基準がコード実装前に固定されている。

### 検証束

```powershell
rg -n "強い意志|最強の意志|PERMA_PROTECT_NEXT_STONE|ABSOLUTE_PROTECT_NEXT_STONE|絶対保護" 01-rulebook.md docs cards
```

---

## Phase 1: 独立カード面の撤去

### 目的

- プレイヤーが手札・図鑑・CPU で `最強の意志` を独立カードとして扱わない状態へ揃える。

### 作業

1. `cards/catalog.json` から `absolute_protect_01` を削除する。
2. `shared-constants.js` の `CARD_DEFS` と type 一覧から `ABSOLUTE_PROTECT_NEXT_STONE` を削除する。
3. `cards/card-interaction-effects.js` から `ABSOLUTE_PROTECT_NEXT_STONE` の quick/detail を削除する。
4. `game/ai/cpu-policy-core.js` から `ABSOLUTE_PROTECT_NEXT_STONE` をカード評価対象として扱う分岐を削除する。
5. `cards/catalog.js` と `cards/catalog.generated.js` を再生成する。
6. `absolute_protect_01` / `ABSOLUTE_PROTECT_NEXT_STONE` の残り参照を検索し、**残してよいのは internal marker / visual 由来だけ**に絞る。
7. `shared/deck-spec.js` / rules help で独立カード前提が残っていないか確認する。

### 完了条件

- 手札・図鑑・CPU が `最強の意志` をプレイアブルカードとして扱わない。
- generated catalog 面が root catalog と一致している。
- `ABSOLUTE_PROTECT_NEXT_STONE` の参照が残る場合、その理由を説明できる。

### 検証束

```powershell
node scripts/generate-catalog.js
rg -n "absolute_protect_01|ABSOLUTE_PROTECT_NEXT_STONE" cards shared-constants.js game ui shared test
```

---

## Phase 2: 強い意志の昇格状態を実装する

### 目的

- `強い意志` の placement-time 特殊石化と、10 所有者ターン後の自動昇格を同じ状態遷移でつなぐ。

### 作業

1. `game/logic/cards-internal/effect-timing.js` の `PERMA_PROTECT_NEXT_STONE` 経路で、`PERMA_PROTECTED` marker に昇格 progress を初期化する。
2. 進捗 field は `remainingOwnerTurns` とは別名にする。
   - 例: `promotionOwnerTurnStarts`
   - 例: `promotionThreshold`
3. 所有者ターン開始処理で progress を進める既存入口を決める。
   - 候補: `game/logic/cards.js`
   - 候補: `game/turn/turn_pipeline_phases.js`
4. progress が 10 に達したら、対象 marker を `ABSOLUTE_PROTECTED` へ置き換える。
5. 既存の `applyAbsoluteProtect` / `isAbsoluteProtectedCell` / visual mapping を再利用し、昇格後だけ強い防御契約へ切り替える。
6. 独立カード由来でしか使われない `ABSOLUTE_PROTECT_NEXT_STONE` の pending branch が不要なら削除する。
7. 必要なら昇格専用 presentation event（仮: `strong_will_promoted`）を追加し、UI / ログ面で昇格が分かるようにする。

### 完了条件

- `強い意志` を付けた石が、所有者ターン開始 10 回後に `ABSOLUTE_PROTECTED` へ昇格する。
- 昇格 progress が通常の寿命タイマーと混ざっていない。
- 既存の絶対保護 helper を流用し、別系統の最強状態を増やしていない。

### 検証束

```powershell
rg -n "PERMA_PROTECT_NEXT_STONE|PERMA_PROTECTED|ABSOLUTE_PROTECTED|strong_will_promoted" game/logic/cards.js game/logic/cards-internal/effect-timing.js game/turn
```

---

## Phase 3: ビジュアル切替と説明面の同期

### 目的

- 昇格した瞬間に、盤面見た目とカード説明が新仕様と一致する状態にする。

### 作業

1. `game/visual-effects-map.js` の `PERMA_PROTECTED` / `ABSOLUTE_PROTECTED` マッピングを確認し、昇格時に marker type 変更だけで画像が切り替わるかを確かめる。
2. 必要時のみ `ui/board-renderer.js` / `ui/diff-renderer.js` を昇格仕様と描画契約が揃う範囲で追随する。
3. `cards/card-interaction-effects.js` と rules help 側の `強い意志` 詳細文を、昇格仕様に更新する。
4. `最強の意志` をカード図鑑から消しても、`絶対保護` の説明や既存 absolute 画像経路が壊れないことを確認する。
5. 昇格 event を入れた場合は `game/turn/pipeline_ui_adapter.js` の文言も同期する。

### 完了条件

- 昇格前は `perma_protect_next_stone-*.png`、昇格後は `absolute_protect_next_stone-*.png` が表示される。
- `強い意志` の説明文だけで、昇格仕様が理解できる。
- `最強の意志` を独立カードとして参照する UI が残っていない。

### 検証束

```powershell
rg -n "perma_protect_next_stone|absolute_protect_next_stone|強い意志|最強の意志" cards game ui assets/images/stones
```

---

## Phase 4: 回帰 test / generated / mirror の完了

### 目的

- 仕様変更が root だけ先行して崩れないように、昇格契約を test と mirror まで固定する。

### 作業

1. gameplay 専用 test を追加する。
   - 例: `test/game.strong-will-promotion.test.js`
2. 少なくとも次の契約を固定する。
   - `最強の意志` カードが catalog に存在しない
   - `強い意志` 付与直後は `PERMA_PROTECTED`
   - 所有者ターン開始 9 回では未昇格
   - 所有者ターン開始 10 回で `ABSOLUTE_PROTECTED` へ昇格
   - 昇格後は `METEOR_WILL` / `LOSS_WILL` / `TELEPORT_WILL` / `POSITION_SWAP_WILL` などで守られる
   - 昇格後は absolute 画像 key が使われる
3. 進捗 field を marker data に足したことで snapshot / sanitize が壊れないか、既存 test へ必要最小限の追加確認を入れる。
4. `node scripts/generate-catalog.js` を実行する。
5. root 変更が確定したら `npm run worker:prepare` で `worker-public/` mirror を更新する。

### 完了条件

- 昇格仕様が test で再現できる。
- generated catalog と worker-public mirror が root と一致する。
- 画像切替と防御契約の両方が回帰で守られる。

### 検証束

```powershell
node scripts/generate-catalog.js
npm run test:jest -- test/game.strong-will-promotion.test.js test/ui.stone-rendering.test.js test/utils.match-authority.public-snapshot.test.js
npm run worker:prepare
```

---

## 6. 最終完了条件

- `01-rulebook.md` が「強い意志の昇格仕様」を正本として説明している。
- `最強の意志` はプレイアブルカードとしては消え、`絶対保護` の昇格状態としてだけ残っている。
- `強い意志` を置いた石が 10 所有者ターン後に昇格し、盤面画像も absolute 画像へ切り替わる。
- `ABSOLUTE_PROTECTED` の既存防御契約を壊していない。
- `cards/catalog.js` / `cards/catalog.generated.js` / `worker-public/*` が同期している。
- 変更範囲の test / check を実行し、結果を完了報告へ残せる。

## 7. この計画の実行順メモ

1. まず `01-rulebook.md` と `cards/catalog.json` の仕様差し替えを行う。
2. 次に独立カードの撤去面（shared constants / CPU / generated / rules help）を片付ける。
3. その後に `PERMA_PROTECTED -> ABSOLUTE_PROTECTED` の昇格ロジックを入れる。
4. 最後に見た目、test、mirror を揃える。

この順にすることで、「カードは消えたが昇格ロジックがまだ無い」「昇格したが図鑑と CPU が古い」といった中途半端な状態を最小化できる。

