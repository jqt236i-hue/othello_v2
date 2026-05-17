# 特殊石 / 爆弾 marker 統合 実装計画書

作成日: 2026-03-16
対象: game / ui / utils / test / docs / worker-public
状態: Draft

## 0. この文書の位置づけ

- この文書は、persistent marker の内部表現から `kind: 'bomb'` の独立枝を外し、`specialStone` の下位分類へ統合するための実装計画書である。
- 一次仕様は `01-rulebook.md` とし、この文書は内部構造、段階移行順、完了条件、検証束を定義する。
- 目的は「爆弾というゲーム上の概念を消すこと」ではない。**爆弾固有の挙動は残したまま、root schema の二重分類を解消すること** が目的である。

## 0.1 結論

- 長期的な正本は、persistent marker を `kind: 'specialStone'` に統一した形にするのが合理的である。
- ただし、爆弾固有ロジックそのものは消さない。`remainingTurns`、起爆、反転で解除、通常石化などの処理は、`kind` ではなく subtype / category helper で扱う。
- 現時点で persistent marker として盤面に残る爆弾は実質 `TIME_BOMB` 系であり、`CROSS_BOMB` / `X_BOMB` は pending 解決時の爆発処理として別に残る。この差は移行計画でも維持する。

## 0.2 構造変更を選ぶ理由

- 現状は、仕様と内部実装の分類軸がずれている。
  - `01-rulebook.md` では、見た目基準の「特殊石」に爆弾を含める文脈が既にある。
  - 一方で内部 schema は `specialStone` と `bomb` を root `kind` で分け、さらに `cardState.specialStones` / `cardState.bombs` の legacy arrays まで残している。
- `game/logic/markers_adapter.js` 自体が「`specialStones/bombs` から unified `markers[]` への移行 adapter」と明記しており、現状が中間状態であることを示している。
- `game/logic/cards/utils.js` の見た目基準 helper は既に bombs を「通常石画像ではない石」として扱っており、read 側だけ先に統合された意味論が存在する。`kind` 分岐を残し続けるほど、今後も drift が再発しやすい。
- このため、責務境界内の修正で `bomb` 分岐を残し続けるより、**schema を一段整理して read / write / projection を同じ意味へ揃える方が再発防止として合理的** である。

## 1. 検証済みの前提

### 1.1 仕様側の前提

- `01-rulebook.md` では、`意志狩りの王` の優先対象とカード詳細タグの `特殊石` が「通常の黒白単色石画像を使わない石」を指し、**爆弾石を含み、hidden `TRAP` は含まない** と定義されている。
- 一方で、`TIME_BOMB` の起爆、`LOSS_WILL` での爆弾解除、複製・分裂・全体対象など、ゲーム効果としては「特殊石」と「爆弾」を並列表記している箇所も残っている。
- したがって、今回の移行は **用語の全面統一ではなく、内部 schema の統一** として扱う。外向き仕様は挙動が変わるまで維持する。

### 1.2 実装側の前提

- `game/logic/markers_adapter.js`
  - `MARKER_KINDS.SPECIAL_STONE` と `MARKER_KINDS.BOMB` を持つ。
  - `syncMarkersToLegacy()` が `cardState.specialStones` と `cardState.bombs` を再構成しており、legacy mirror がまだ生きている。
- `game/logic/cards/utils.js`
  - `getSpecialMarkerAt()` は `specialStone` / `bomb` の両方を拾う。
  - `isMarkerRenderedAsSpecialStone()` は bomb を見た目基準の特殊石として扱う。
  - `isSpecialStoneAt()` と `isNonNormalStoneVisualAt()` は、実質的に「通常石画像ではない石」判定である。
- `ui/marker-bridge.js`、`game/logic/context.js`、`game-core-logic.js`、`utils/match-authority.js` には `specialStones` / `bombs` の legacy read / projection が残っている。
- persistent bomb の書き込み元は主に `TIME_BOMB` と、その複製・分裂経路である。`CROSS_BOMB` / `X_BOMB` は board marker を維持せず、pending 解決時に爆発処理へ入る。

## 2. 目的

- persistent marker の root schema を `specialStone` に統一し、`kind: 'bomb'` という独立枝を廃止する。
- 爆弾固有ロジックを「root kind 判定」ではなく、marker subtype / category helper へ移す。
- `cardState.bombs` と `context.bombs` への内部依存を段階的に削減し、必要なら compatibility edge だけで派生させる。
- 見た目、対象選択、起爆、解除、複製、分裂、公開 snapshot を壊さずに移行する。

## 3. 非目標

- 爆弾というゲーム用語そのものの廃止
- `CROSS_BOMB` / `X_BOMB` の効果仕様変更
- 特殊石の見た目、音、カード効果、CPU 方針の変更
- 1 フェーズで `worker-public` と全 test を同時に巻き込む一括置換
- public snapshot 契約を予告なく破壊すること

## 4. 残す契約

- hidden `TRAP` は引き続き「通常石として隠れている間は特殊石扱いしない」。
- `TIME_BOMB` は引き続き timer を持ち、反転で解除され、起爆時は `bomb_explode` 系と destroy phase 契約を守る。
- `意志狩りの王` やカード詳細タグの「特殊石」判定は、引き続き見た目基準で bombs を含む。
- `LOSS_WILL`、`CLONE_WILL`、`DRAGON` 系などの bomb-specific behavior は維持する。
- root を正本とし、`worker-public/` は最終 phase で `npm run worker:prepare` により同期する。

## 5. 置換する契約

- `kind === 'bomb'` を persistent marker の根本分類として使う契約
- `cardState.bombs` を内部正本として読む契約
- `context.bombs` を内部ロジックの前提データとして直読みする契約
- `MarkersAdapter.MARKER_KINDS.BOMB` を直接参照して一般 read 判定を組む契約

## 6. 目標データモデル

最終形の persistent bomb は、次のような `specialStone` marker として保持する。

```js
{
  id,
  row,
  col,
  kind: 'specialStone',
  owner,
  createdSeq,
  data: {
    type: 'TIME_BOMB',
    category: 'bomb',
    remainingTurns,
    placedTurn
  }
}
```

### 6.1 この形にする理由

- `kind` は「盤面上の石 marker かどうか」という上位分類に固定できる。
- `data.type` は既存の特殊石と同じく具体的な石種を表せる。
- `data.category` を持たせると、将来 `TIME_BOMB` 以外の persistent bomb stone が増えても、`isBombCategoryMarker()` のような helper を保てる。
- 爆弾固有ロジックは `category === 'bomb'` と `type === 'TIME_BOMB'` の両方を必要な粒度で使い分けられる。

## 7. 段階計画

## Phase 0: Baseline 固定と helper 境界の明文化

### 目的

- 移行前の期待挙動を test で固定し、以後の phase で壊れた面を検出しやすくする。
- `bomb` を root kind から外す対象と、今後も残すべき effect-specific helper を切り分ける。

### 作業

1. `kind === 'bomb'`、`getBombMarkers()`、`findBombMarkerAt()`、`cardState.bombs`、`context.bombs` の残存箇所を棚卸しする。
2. 既存の見た目基準 helper (`isSpecialStoneAt()` / `isNonNormalStoneVisualAt()`) を **general read model** の起点として固定する。
3. persistent bomb と immediate explosion effect を分離して記録する。
   - persistent: `TIME_BOMB`
   - immediate effect: `CROSS_BOMB` / `X_BOMB`
4. 代表 test を Phase gate として固定する。

### 主対象

- `game/logic/cards/utils.js`
- `game/logic/markers_adapter.js`
- `game/logic/context.js`
- `ui/marker-bridge.js`
- `utils/match-authority.js`

### 完了条件

- どこが schema 問題で、どこが effect-specific 問題かを 1 枚で説明できる。
- 残存箇所の分類が「read」「write」「projection / compatibility」に分かれている。
- 代表 test 束が決まっている。

---

## Phase 1: dual-shape bridge helper の導入

### 目的

- 旧 shape (`kind: 'bomb'`) と新 shape (`kind: 'specialStone' + data.category: 'bomb'`) の両方を読める helper 層を先に作る。
- 以後の移行を raw string 判定ではなく helper 経由に限定する。

### 作業

1. `game/logic/markers_adapter.js` または `game/logic/cards/markers.js` に以下の helper を追加する。
   - `isBombCategoryMarker(marker)`
   - `isSpecialStoneMarker(marker)`
   - `getMarkerCategory(marker)`
   - `getBombCategoryMarkers(cardState)` または既存 `getBombMarkers()` の意味更新
2. helper は以下の両方を true として扱う。
   - `marker.kind === 'bomb'`
   - `marker.kind === 'specialStone' && marker.data && marker.data.category === 'bomb'`
3. `game/logic/cards/utils.js`、`board_ops.js`、`game/logic/cards/markers.js` など低レイヤの read 側を helper へ寄せる。
4. この phase では **新しい書き込み形にはまだ切り替えない**。read 側だけ先に dual-shape 化する。

### 主対象

- `game/logic/markers_adapter.js`
- `game/logic/cards/markers.js`
- `game/logic/cards/utils.js`
- `game/logic/board_ops.js`

### 完了条件

- low-level read 層で `kind === 'bomb'` の直書きが helper 化されている。
- 旧 shape と新 shape のどちらでも同じ read 結果になる。
- `bomb` helper の意味が「root kind」ではなく「bomb category」へ変わっている。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\game.special-stone-visual-rule.test.js test\game.special-stone-browser-order.test.js test\game.will-hunter-king.test.js test\game.time-bomb-selection.test.js
```

---

## Phase 2: root write path を `specialStone` へ移行

### 目的

- gameplay 中に新規生成される persistent bomb marker を、新 shape で書く。
- 以後は旧 `kind: 'bomb'` を root 側の新規生成経路で増やさない。

### 作業

1. `TIME_BOMB` の配置処理を `kind: 'specialStone'` + `data.type: 'TIME_BOMB'` + `data.category: 'bomb'` へ切り替える。
2. `CLONE_WILL` など、bomb marker を複製する経路を新 shape へ切り替える。
3. debug / helper 生成経路も合わせる。
4. `tickBombs()`、`tickBombAt()`、`removeBombAt()` 相当の処理は category helper を使うように更新する。
5. 旧 shape 読み込みは残し、新旧混在状態でも tick / destroy / clone が壊れないようにする。

### 主対象

- `game/logic/cards.js`
- `game/logic/cards/time_bomb.js`
- `game/logic/cards/clone.js`
- `game/logic/cards/markers.js`
- `game/debug/debug-actions.js`

### 完了条件

- root 側の新規 gameplay write path が `kind: 'bomb'` を生成しない。
- `TIME_BOMB` の設置、カウントダウン、起爆、解除、複製、分裂が従来どおり動く。
- 旧 shape を含む save / test fixture もまだ読める。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\game.time-bomb-selection.test.js test\game.loss-will.test.js test\game.split-will.test.js test\game.logic.clone-module.test.js test\game.special-effects.bombs.batch.test.js
```

---

## Phase 3: read / projection / context の legacy `bombs` 依存を縮退

### 目的

- internal read model から `cardState.bombs` と `context.bombs` を外し、必要なら compatibility edge でのみ派生させる。
- UI / network / projection が `markers[]` を正本として扱う状態に寄せる。

### 作業

1. `game/logic/context.js` の safe fallback を、`bombs` 配列中心ではなく marker/category ベースへ変更する。
2. `game-core-logic.js` の fallback context 生成を同じ形へ寄せる。
3. `ui/marker-bridge.js` を縮退する。
   - 互換性のために `specialStones` / `bombs` を export する必要がある場合だけ、1 箇所で派生させる。
4. `utils/match-authority.js` の projection と trap filtering は `markers[]` を正本にし、legacy arrays は optional mirror に後退させる。
5. `ui/network-client.result-sync` 系や public snapshot test の期待値を、新しい compatibility policy に合わせて更新する。

### 主対象

- `game/logic/context.js`
- `game-core-logic.js`
- `ui/marker-bridge.js`
- `utils/match-authority.js`
- 関連 UI / network test

### 完了条件

- internal logic が `cardState.bombs` を正本として読まない。
- public / network / UI の compatibility edge 以外で `bombs` mirror を要求しない。
- trap visibility や hidden token 投影が markers 正本で説明できる。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\utils.match-authority.public-snapshot.test.js test\ui.network-client.result-sync.test.js test\game.special-stone-visual-rule.test.js
```

---

## Phase 4: `MARKER_KINDS.BOMB` の撤去と API 清掃

### 目的

- schema 上の `bomb` root kind を撤去し、互換 wrapper だけを残すか、名称ごと整理する。
- 以後の新規実装が `kind === 'bomb'` へ戻れない状態にする。

### 作業

1. `MARKER_KINDS.BOMB` を削除し、必要なら compatibility helper のみ残す。
2. `getBombMarkers()` を残す場合は「bomb category を返す semantic helper」として意味を固定する。
3. `findBombMarkerAt()` も category helper ベースへ寄せる。
4. `ui/`、`game/`、`cpu`、`test` に残る raw kind 分岐を除去する。
5. 旧 fixture / backward-compatible snapshot の必要性を確認し、不要なら legacy fallback を削除する。

### 主対象

- `game/logic/markers_adapter.js`
- `game/logic/cards/markers.js`
- `game/logic/cards.js`
- `ui/*`
- `test/*`

### 完了条件

- repo root から gameplay / UI / test の `kind === 'bomb'` 直書きが消えている。
- `bomb` は「root schema の別 kind」ではなく「specialStone の subtype / category」としてしか存在しない。
- 新規コードが schema drift を再導入しにくい形になっている。

### 検証束

```bash
npx jest --runInBand --runTestsByPath test\game.time-bomb-selection.test.js test\game.loss-will.test.js test\game.split-will.test.js test\game.logic.clone-module.test.js test\game.special-stone-visual-rule.test.js test\utils.match-authority.public-snapshot.test.js test\ui.network-client.result-sync.test.js
```

---

## Phase 5: worker-public 同期と残件清掃

### 目的

- root を正本とした移行を mirror / deploy 面へ反映し、残存ドキュメントと test の説明を揃える。

### 作業

1. `npm run worker:prepare` を実行し、`worker-public/` を同期する。
2. `worker-public` 内の対応 helper / projection / test mirror が root と一致していることを確認する。
3. docs と test 名称に残る「root kind としての bomb」前提を整理する。
4. 必要なら plan の実施結果を report / runbook へ分離する。

### 主対象

- `worker-public/*`
- `scripts/prepare-worker-assets.js`
- `docs/*`

### 完了条件

- root と `worker-public/` の契約が揃っている。
- docs と test の用語が実装に追従している。
- 移行後の検証束が 1 セットで再実行できる。

## 8. 主要リスク

- `bomb` helper を全部消そうとして、爆弾固有ロジックまで `specialStone` 一般処理へ混ぜてしまうこと
- `cardState.bombs` を急に消して、network / projection / tests の compatibility edge を壊すこと
- `TIME_BOMB` だけ persistent である前提を崩し、`CROSS_BOMB` / `X_BOMB` まで誤って marker 化してしまうこと
- `worker-public/` 同期前に root / mirror の契約差分を放置すること

## 9. 技術的判断の指針

- 消すべきものは `bomb` という概念ではなく、**root schema の別 kind** である。
- 残してよいものは「bomb category を扱う semantic helper」である。
- `data.type` は具体石種、`data.category` は横断分類として役割を分ける。
- compatibility edge は最後まで 1 箇所に閉じ込める。複数の ad hoc mirror を作らない。

## 10. 全体完了条件

- persistent marker の正本が `kind: 'specialStone'` に統一されている。
- `TIME_BOMB` の timer / 起爆 / 解除 / 複製 / 分裂 / 見た目 / 対象選択が回帰していない。
- hidden `TRAP` 除外、`意志狩りの王` 優先、カード詳細タグの `特殊石` が維持されている。
- `cardState.bombs` が内部正本でなくなっている。
- `worker-public/` が同期済みで、関連 test / check が pass している。

## 11. 代表検証束

```bash
npx jest --runInBand --runTestsByPath test\game.special-stone-visual-rule.test.js test\game.special-stone-browser-order.test.js test\game.will-hunter-king.test.js test\game.time-bomb-selection.test.js test\game.loss-will.test.js test\game.split-will.test.js test\game.logic.clone-module.test.js test\game.special-effects.bombs.batch.test.js test\utils.match-authority.public-snapshot.test.js test\ui.network-client.result-sync.test.js
```

必要に応じて追加:

```bash
npx jest --runInBand --runTestsByPath test\e2e\special_effects.e2e.test.js
npm run worker:prepare
```

## 12. `01-rulebook.md` 方針

- この計画の early phase は **内部 schema 整理** であり、外向き挙動や仕様は変えない。そのため、実装着手時点では `01-rulebook.md` の更新は不要とする。
- ただし、最終的に docs / 用語整理として「特殊石 / 爆弾」の記述を再編する場合は、**外向き仕様が変わるかどうか** を先に判断し、必要な時だけ `01-rulebook.md` を更新する。
- hidden `TRAP` 除外、見た目基準 `特殊石`、爆弾解除 / 起爆契約は維持対象であり、仕様変更として扱わない。

## 13. この計画の終了点

- repo 内で「bomb が特別扱いされている理由」が **ゲーム効果の違い** にだけ限定されている状態まで進める。
- 逆に、marker schema や generic read model の層で `bomb` を別 kind として持ち続ける状態は、この計画の完了条件に含めない。

