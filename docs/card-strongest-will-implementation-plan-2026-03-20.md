# 最強の意志 実装計画書

作成日: 2026-03-20
対象: docs / 01-rulebook.md / cards / game / ui / assets / test / worker-public
状態: Draft

## 0. この文書の位置づけ

- この文書は、新カード `最強の意志` を **安全に実装するための事前計画** である。
- 一次仕様は `01-rulebook.md` とし、この文書は「どこを、どの順で、どの完了条件で直すか」を固定する。
- 今回の要求は、既存の `完全保護` より強い「本当の意味での無敵石」を新設するものであり、外から見える挙動が変わるため、**実装前に `01-rulebook.md` の更新が必須** である。
- root を正本とし、`worker-public/` は最後に `npm run worker:prepare` で mirror 同期する。

## 0.1 現状スナップショット

- `01-rulebook.md` にはすでに `Protected` / `PermaProtected` / `完全保護` の段階が存在する。
- ただし現行の `完全保護` は絶対防御ではない。`01-rulebook.md` 6.4 節では反転・交換・破壊・誘惑・意志の喪失を無効化すると定義される一方、12 章の用語集では「マス破壊以外の全ての効果を無効化」とされ、さらに `METEOR_WILL` 系では完全保護を貫通する記述もある。
- `cards/catalog.json` には `PROTECTED_NEXT_STONE`（弱い意志）と `PERMA_PROTECT_NEXT_STONE`（強い意志）があり、次配置石に段階的な保護を付与する先行パターンが存在する。
- `game/logic/cards-internal/effect-timing.js` には `PROTECTED_NEXT_STONE` と `PERMA_PROTECT_NEXT_STONE` の placement-time hook があり、次配置石系カードの追加先が明確である。
- `game/visual-effects-map.js` は pending type と special stone type を stone visual effect key に変換し、`ui/board-renderer.js` / `ui/diff-renderer.js` はその key で特殊石の見た目を決めている。
- `ui/handlers/rules-help.js` は `cards/card-interaction-effects.js` の quick/detail テキストと `PENDING_TYPE_TO_EFFECT_KEY` / `STONE_VISUAL_EFFECTS` を使ってカード図鑑の詳細説明と特殊石画像を表示している。
- `assets/images/stones/` には既存の特殊石画像に加え、今回提供された `sa-white.png` と `si-black.png` が存在する。現状の名前は意味が分からないため、実装時に正式名へリネームする必要がある。

## 0.2 採用する設計判断

- 既存の `完全保護` を拡張して無理に流用しない。**新しい protection tier / special stone type を追加** し、`完全保護` と `絶対保護` を分ける。
- 作業用の内部名は、次の 4 つを起点に固定する。
  - カード type: `ABSOLUTE_PROTECT_NEXT_STONE`
  - 特殊石 marker type: `ABSOLUTE_PROTECTED`
  - visual effect key: `absoluteProtectedStone`
  - 画像ファイル: `assets/images/stones/absolute_protect_next_stone-black.png` / `assets/images/stones/absolute_protect_next_stone-white.png`
- `最強の意志` が生成する石は、時間制限を持たない恒久 marker として扱い、`remainingOwnerTurns` / `expiresForPlayer` のような期限フィールドは持たせない。
- 無敵判定は 1 箇所の helper / predicate に寄せ、反転、破壊、移動、入替、テレポート、マス破壊、特殊状態解除などの書き込み経路に **同じ判定** を通す。カードごとの個別 if の散在は避ける。
- ユーザー要件の「一度置けば二度と消えない」を優先し、**相手効果だけでなく自分起因の破壊・生贄・状態解除でも除外対象にする** 方針で設計する。

## 1. 検証済みの事実

### 1.1 仕様・文書面

- `01-rulebook.md` 6.1 / 6.2 / 6.4 は保護段階を定義しているが、現時点では「絶対に消えない石」の段階は存在しない。
- `01-rulebook.md` 742 行付近では `METEOR_WILL` が `GUARD_WILL` / `GUARDIAN_GOD` の完全保護を貫通すると明記されている。
- `01-rulebook.md` 1225-1233 行付近では、カード図鑑の効果一覧強調語と「特殊石画像を表示する」仕様が定義されている。

### 1.2 カタログ・説明文・生成面

- `cards/catalog.json` がカード定義の正本で、`scripts/generate-catalog.js` が `cards/catalog.generated.js` と `cards/catalog.js` を生成する。
- `cards/card-interaction-effects.js` は quick/detail 効果説明の辞書であり、`cards/card-interaction.js` と `ui/handlers/rules-help.js` の両方から参照されている。
- deck 選択面は catalog / shared constants ベースで動いているため、新カードの enable 状態やソート順は既存のカード追加パターンを踏襲できる可能性が高いが、確認は必要である。

### 1.3 placement / visual / CPU の入口

- `game/logic/cards-internal/effect-timing.js` 296 行付近に `PROTECTED_NEXT_STONE`、310 行付近に `PERMA_PROTECT_NEXT_STONE` の placement-time 処理がある。
- `game/visual-effects-map.js` は `PENDING_TYPE_TO_EFFECT_KEY` と `SPECIAL_TYPE_TO_EFFECT_KEY` の 2 面を持ち、pending state と特殊石 marker の両方に対して見た目を割り当てている。
- `ui/handlers/rules-help.js` の `_resolveSpecialStoneImagePath(card.type)` は上記 pending map と visual definitions を使ってカード図鑑用の特殊石画像を解決する。
- `game/ai/cpu-policy-core.js` には `PROTECTED_NEXT_STONE` と `PERMA_PROTECT_NEXT_STONE` が defensive / stability / keep-priority 系の集合と score table に入っている。

### 1.4 実装リスク

- 既存の protection は 1 箇所だけで守られておらず、反転、破壊、移動、入替、ターゲット選別、特殊状態解除、爆発連鎖など複数経路に散っている。
- そのため、marker を 1 つ足すだけでは「真の無敵」にならない。**state mutation の入口監査** が必要である。

## 2. 目的

- `最強の意志`（コスト 30）を追加する。
- 使用後、次に置いた石を custom visual 付きの特殊石へ変換する。
- その特殊石は、反転、交換、破壊、マス破壊、マステレポート、テレポート、入替、意志の喪失、その他の状態変更を受けない。
- 一度生成されたら、所有者・相手を問わず、通常のゲーム効果では消えない契約を実現する。
- 仕様、catalog、CPU、rules help、test、mirror を同時に揃える。

## 3. 非目標

- この文書の時点で実装まで完了させること
- 既存の `Protected` / `PermaProtected` / `完全保護` の仕様を全面再設計すること
- 盤面特殊石の schema を大規模に刷新すること
- `worker-public/` を直編集すること
- 提供された画像の絵柄や配色自体を作り直すこと
- 既存カード全体のバランスを一括で調整すること

## 4. 主対象ファイル

### 4.1 仕様と文書

- `01-rulebook.md`
- `docs/card-strongest-will-implementation-plan-2026-03-20.md`

### 4.2 root 正本の実装候補

- `cards/catalog.json`
- `cards/card-interaction-effects.js`
- `shared-constants.js`
- `game/logic/cards.js`
- `game/logic/cards-internal/effect-timing.js`
- `game/logic/board_ops.js`
- `game/visual-effects-map.js`
- `ui/board-renderer.js`
- `ui/diff-renderer.js`
- `ui/handlers/rules-help.js`
- `game/ai/cpu-policy-core.js`
- `assets/images/stones/*`

### 4.3 生成・mirror・確認面

- `cards/catalog.js`
- `cards/catalog.generated.js`
- `worker-public/*`
- `shared/deck-spec.js`
- `shared/story-deck-spec.js`
- network snapshot / sanitize 関連 test（marker 伝播確認が必要な場合）

## 5. フェーズ計画

## Phase 0: 仕様確定と命名凍結

### 目的

- 実装前に「既存の完全保護との差」を仕様として固定し、後続のコード判断をぶらさない。

### 作業

1. `01-rulebook.md` の保護ルールへ新しい段階を追加する。
   - 仮称: `絶対保護`
   - `完全保護` との差分を明文化する。
2. `01-rulebook.md` のカード効果節へ `最強の意志` を追加する。
   - コスト 30
   - 次に置く石を絶対保護の特殊石にする
   - 一度置かれた後は通常効果で除去されない
3. `01-rulebook.md` のカード図鑑 / 効果一覧面に、必要なら `絶対保護` の用語を追加する。
4. 内部名と asset 名を凍結する。
   - `ABSOLUTE_PROTECT_NEXT_STONE`
   - `ABSOLUTE_PROTECTED`
   - `absoluteProtectedStone`
   - `absolute_protect_next_stone-black.png`
   - `absolute_protect_next_stone-white.png`
5. マス破壊・マステレポート・位置入替のような「石ではなくセルに作用する効果」と衝突した場合の挙動を先に決める。
   - 推奨: 対象にできない / 対象になってもそのセル変更は不発扱い

### 完了条件

- `最強の意志` の仕様が `01-rulebook.md` だけで説明できる。
- `完全保護` と `絶対保護` の違いが曖昧でない。
- 実装で使う内部名・visual key・asset 名が固定されている。

### 検証束

```powershell
rg -n "完全保護|絶対保護|最強の意志|ABSOLUTE_PROTECT_NEXT_STONE" 01-rulebook.md docs
```

---

## Phase 1: カタログ・説明文・asset 面の追加

### 目的

- 新カードを UI と説明文の入口から認識できる状態にする。

### 作業

1. `cards/catalog.json` に `最強の意志` を追加する。
2. `cards/card-interaction-effects.js` に quick/detail 説明を追加する。
3. 提供済み画像を正式名へリネームする。
   - `sa-white.png` -> `absolute_protect_next_stone-white.png`
   - `si-black.png` -> `absolute_protect_next_stone-black.png`
4. `game/visual-effects-map.js` に pending / special stone 用の visual key と画像パス定義を追加する。
5. `ui/handlers/rules-help.js` で、必要なら glossary 強調語へ `絶対保護` を追加する。
6. `npm run generate:catalog` を実行し、generated 2 面を同期する。

### 完了条件

- カード図鑑とカード詳細で `最強の意志` の名称・簡易説明・詳細説明が表示される。
- カード図鑑で特殊石ビジュアル画像が表示される。
- asset 名が repo 内で一貫している。
- `cards/catalog.json` / `cards/catalog.js` / `cards/catalog.generated.js` が一致している。

### 検証束

```powershell
npm run generate:catalog
rg -n "最強の意志|ABSOLUTE_PROTECT_NEXT_STONE|absolute_protect_next_stone" cards ui game shared-constants.js assets
```

---

## Phase 2: placement-time special stone 化

### 目的

- カード使用後の「次配置 1 回」を、新しい特殊石生成に正しく接続する。

### 作業

1. `game/logic/cards.js` の card use / pending effect 流れに新しい type を通す。
2. `game/logic/cards-internal/effect-timing.js` に `ABSOLUTE_PROTECT_NEXT_STONE` の hook を追加する。
3. 既存の marker system を再利用し、`kind: 'specialStone'` + `data.type: 'ABSOLUTE_PROTECTED'` で恒久 marker を作る。
4. 期限切れ処理の対象に入らないよう、期限フィールドは持たせない。
5. pending が 1 回の配置で消費されること、対象選択が不要なことを既存 next-stone cards と同じ契約で確認する。

### 完了条件

- カード使用後、次に置いた石だけが `ABSOLUTE_PROTECTED` 化する。
- 2 個目以降の配置へ effect が漏れない。
- ターン経過で勝手に消えない。

### 検証束

```powershell
rg -n "PROTECTED_NEXT_STONE|PERMA_PROTECT_NEXT_STONE|ABSOLUTE_PROTECT_NEXT_STONE" game/logic/cards.js game/logic/cards-internal/effect-timing.js
```

---

## Phase 3: 絶対無敵判定の共通化と mutation 経路監査

### 目的

- 「真の無敵」を marker 名だけで終わらせず、実際にあらゆる書き込み経路から守る。

### 作業

1. `ABSOLUTE_PROTECTED` 判定 helper を追加する。
   - 例: `isAbsoluteProtectedStone(cardState, row, col)`
2. 少なくとも次の mutation 入口を監査し、共通 helper を通す。
   - 通常反転 / 連鎖反転 / 禁忌反転 / 効果由来反転
   - 破壊 / 爆発 / 吸い込み / 自己破壊 / 生贄
   - 交換 / 入替 / テレポート / マステレポート / 強風 / 超浮力 / 超重力などの位置変更
   - マス破壊 / 穴化 / セル上書き
   - 特殊状態解除 / 意志の喪失 / 特殊石除去
3. 影響が大きい処理では、失敗時を silent skip にせず、既存契約に沿った invalid target / no-op event / exclusion として表現する。
4. 「自分でも消せない」要件に合わせ、所有者起因の破壊系カードからも除外する。

### 完了条件

- `ABSOLUTE_PROTECTED` 石が通常のカード効果で消えない、動かない、状態解除されない。
- 影響を受けなかったときの処理結果が曖昧でない。
- 無敵判定が複数のファイルにコピペされていない。

### 検証束

```powershell
rg -n "destroy|swap|teleport|meteor|sacrifice|remove|loss|flip" game/logic game/turn game/card-effects
```

---

## Phase 4: presentation / CPU / help 同期

### 目的

- 盤面見た目、カード図鑑、CPU 評価を新しい石種に追随させる。

### 作業

1. `game/visual-effects-map.js` に `absoluteProtectedStone` を追加する。
2. `ui/board-renderer.js` / `ui/diff-renderer.js` が新しい `specialStone` type を正しく描画できることを確認し、必要時のみ最小差分で追随する。
3. `ui/handlers/rules-help.js` の glossary 強調と特殊石画像表示を確認する。
4. `game/ai/cpu-policy-core.js` に defensive / keep-priority / stability / score table の必要追随を追加する。
5. 必要ならカード使用コメントやラベル表示面を確認する。

### 完了条件

- 盤面で最強石の見た目が黒白ともに崩れない。
- カード図鑑で詳細説明と特殊石画像が見える。
- CPU が新カードを未知カード扱いしない。

### 検証束

```powershell
rg -n "PENDING_TYPE_TO_EFFECT_KEY|SPECIAL_TYPE_TO_EFFECT_KEY|absoluteProtectedStone|ABSOLUTE_PROTECT_NEXT_STONE" game ui
rg -n "DEFENSIVE_CARD_TYPES|KEEP_PRIORITY|STABILITY|ABSOLUTE_PROTECT_NEXT_STONE" game/ai/cpu-policy-core.js
```

---

## Phase 5: 回帰 test・network 伝播・mirror 同期

### 目的

- root 実装をテストで固定し、generated / network / mirror まで完了条件を満たす。

### 作業

1. 専用 test を追加する。
   - カード使用 -> 次配置 1 回だけ特殊石化
   - ターン経過で消えない
   - 反転・破壊・入替・テレポート・マス破壊・特殊状態解除で無効化されない
   - rules help / visual mapping / CPU 分類の回帰
2. marker が snapshot / sanitize / reconnect で落ちないかを確認し、必要なら network 系 test へ追加する。
3. `npm run worker:prepare` を実行し、`worker-public/` を同期する。

### 完了条件

- 専用回帰があるため、今後の修正で最強石の無敵契約が壊れても検出できる。
- public / network 面で marker が欠落しない。
- `worker-public/` が root と同期している。

### 検証束

```powershell
npm run test:jest -- test/cards.catalog.test.js
npm run test:network:parity
npm run worker:prepare
```

## 6. 追加で先に決めるべき論点

- `絶対保護` をカード図鑑の強調語に追加するか、それとも `完全保護` を流用せず説明文だけで区別するか
- `マス破壊` や `マステレポート` が最強石のセルを対象にしたとき、カード使用自体を不発にするのか、対象候補から除外するのか
- 最強石を「通常石ではない特殊石」と明示した場合、既存の「交換の意志の対象外」契約へ自動で乗せるか、別途明文化するか
- 最強石の色変更不可を「反転不可」に含めるのか、それとも swap / owner change / special takeover を個別列挙するか

## 7. 全体完了条件

- `01-rulebook.md` が新カードと新 protection tier の一次情報になっている。
- root 正本の card / logic / visual / CPU / test が揃っている。
- generated 2 面と `worker-public/` が同期している。
- 専用 test により「一度置いたら通常効果では二度と消えない」が固定されている。
