# 絶対保護削除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `絶対保護` / `絶対保護石` / `ABSOLUTE_PROTECTED` を active game source から削除し、`強い意志` は進化しない永続反転無効カードとして残す。

**Architecture:** 仕様正本を先に更新し、`PERMA_PROTECT_NEXT_STONE` から昇格メタデータと昇格処理を外す。`ABSOLUTE_PROTECTED` の特殊石分類・保護判定・画像・音・吹き出し・テストを削除し、顕現石の既存保護は `絶対保護` ではなく `不可侵` として内部名も `inviolable` 系へ改名する。互換エイリアスは残さず、最後に限定 `rg` で active source に旧語が戻っていないことを確認する。

**Tech Stack:** TypeScript / JavaScript, Jest, catalog generation, asset manifest generation, browser build, Worker mirror preparation.

---

## Document Role

この文書は実装計画書。対象は root source の active game behavior、active player-visible docs、active tests、generated/mirror outputs。`01-rulebook.md` と `正本/*.md` を仕様正本として先に直し、実装はその後に行う。

Non-goals:

- `強い意志` / `PERMA_PROTECT_NEXT_STONE` / `PERMA_PROTECTED` は削除しない。
- 顕現石の `不可侵` は削除しない。`絶対保護` という名前と `ABSOLUTE_PROTECTED` 石を消し、顕現石保護は `inviolable` として残す。
- `worker-public/`、`dist/`、`public/module-registry.js` は直接編集しない。必要な生成コマンドで更新する。
- `docs/archive/` の歴史文書は active source ではない。active source の復活防止は `rg` gate で担保する。

## Current Findings

- `01-rulebook.md:209` と `01-rulebook.md:481` が `強い意志` から `絶対保護` への昇格を仕様化している。
- `shared/special-stone-registry.ts:386` が `ABSOLUTE_PROTECTED` を特殊石として定義し、`shared/special-stone-registry.ts:396` が `PERMA_PROTECT_NEXT_STONE` の `promotedMarkerType` にしている。
- `game/logic/cards-internal/effect-timing.ts:684` が所有者ターン開始時に `PERMA_PROTECTED` を `ABSOLUTE_PROTECTED` へ昇格させる。
- `game/logic/card-resolution/protect.ts:50` に直接 `ABSOLUTE_PROTECTED` を付与する `applyAbsoluteProtect` が残っている。
- `shared/manifest-stone-registry.ts:20` などで顕現石が `absoluteProtected: true` という内部名を使っている。これは今回 `inviolable: true` へ改名する。
- `assets/images/special-stones/absolute_protect_next_stone-black.png`、`assets/images/special-stones/absolute_protect_next_stone-white.png`、`assets/audio/sound-effect/強い意志の石が進化したタイミング.mp3` は削除対象。
- 実装前の active source 限定検索:

```powershell
rg -n "ABSOLUTE_PROTECTED|absolute_protect_next_stone|strong_will_promoted|absoluteProtectedStone|hasAbsoluteProtection|absoluteProtected|absolute_protected|absolute-protection|ABSOLUTE_PROTECT_NEXT_STONE|absolute_protect_01" shared game ui cards test tests workers scripts 01-rulebook.md 正本 docs\architecture-contracts.md --glob "!**/dist/**" --glob "!**/worker-public/**" --glob "!docs/archive/**" --glob "!docs/superpowers/plans/**" --glob "!docs/superpowers/specs/**"
rg -n "絶対保護|絶対保護石|最強の意志|強い意志の石が進化した" 01-rulebook.md 正本 cards game ui shared test tests workers docs\architecture-contracts.md --glob "!**/dist/**" --glob "!**/worker-public/**" --glob "!docs/archive/**" --glob "!docs/superpowers/plans/**" --glob "!docs/superpowers/specs/**"
```

## File Structure

Modify:

- `01-rulebook.md`: remove `6.5 絶対保護`, remove strong-will promotion, remove absolute-protection glossary entries, update cell removal exceptions to `顕現石` / `不可侵`.
- `正本/共通ルール正本.md`: delete `絶対保護` section, rewrite `セル消滅` exception to `不可侵の顕現石`.
- `正本/カード仕様正本.md`: rewrite affected card rows: `強い意志`, `誘惑の意志`, `捕獲の意志`, `禁忌の反転`, `マステレポート`, `意志狩りの王`, `意志の喪失`, `盤面縮小`, `盤面縮小神`, `因果抹消`, `盤界の執行者`.
- `正本/効果音対応表.md`: remove the strong-will promotion sound row.
- `docs/architecture-contracts.md`: remove `absoluteProtectedStones` from protection context contract and document `inviolableStones`.
- `cards/catalog.json`: update strong-will and cell-removal card text.
- `cards/catalog.js`, `cards/catalog.ts`, `cards/catalog.generated.js`: regenerate from `cards/catalog.json`.
- `cards/card-interaction-effects.ts`: remove absolute-protection tag and old detail text.
- `cards/card-last-used-panel-copy.ts`: remove strong-will evolution copy.
- `shared/game-term-glossary.ts`: remove `絶対保護` term and update descriptions.
- `shared/special-stone-registry.ts`: remove `ABSOLUTE_PROTECTED`, `promotedMarkerType`, and `isAbsoluteProtectedSpecialType`.
- `shared/manifest-stone-registry.ts`: rename `absoluteProtected` metadata to `inviolable`; export `isInviolableManifestStoneType`.
- `shared/stone-status-snapshot.ts`: rename `hasAbsoluteProtection` to `inviolable` / `hasInviolableProtection`; do not emit `絶対保護` tag.
- `shared/player-profile-contract.ts`: remove `ABSOLUTE_PROTECTED` avatar option.
- `shared-constants.ts`: remove `STRONG_WILL_PROMOTION_OWNER_TURNS` and browser export.
- `game/logic/card-resolution/protect.ts`: keep `applyStrongWill`; delete `applyAbsoluteProtect`; remove strong-will promotion counters.
- `game/logic/cards-internal/effect-timing.ts`: remove strong-will promotion threshold, processing, presentation event, and constants plumbing.
- `game/logic/cards-internal/protection-context.ts`: replace `absoluteProtectedStones` with `inviolableStones` for manifest/inviolable cells only.
- `game/logic/cards-internal/destroy-protection-context.ts`: remove `ABSOLUTE_PROTECTED` reason branch; use registry `destroyProtected` and inviolable handling.
- `game/logic/cards-internal/effect-target-counts.ts`, `game/logic/cards-internal/capture-source.ts`, `game/logic/cards.ts`, `game/cards/target-resolver.ts`, `game/logic/cards/*.ts`, `game/cpu-decision-*.ts`: remove `ABSOLUTE_PROTECTED` branches and update manifest/inviolable checks.
- `game/logic/board_ops.ts`: rename `_isAbsoluteProtectedCell` to `_isInviolableCell`; return `inviolable` / `inviolable_source` reasons for manifest stones, and no longer block anything for `ABSOLUTE_PROTECTED`.
- `game/turn/turn_pipeline_phase_helpers.ts`, `game/turn/presentation-helpers.ts`, `game/turn/pipeline-ui/sound-cues.ts`, `game/turn/pipeline-ui/card-economy-sound-cues.ts`, `game/turn/pipeline-ui/log-mappers.ts`: remove promotion speech, highlight, sound cue, and label mapping.
- `game/visual-effects-map.runtime.js`: remove `absoluteProtectedStone` definition and `SPECIAL_TYPE_TO_EFFECT_KEY.ABSOLUTE_PROTECTED`.
- `ui/diff-renderer.ts`: remove absolute-protection glossary copy and update `穴マス` / `抹消` text.
- `ui/player-profile-avatar-options.ts`: remove `ABSOLUTE_PROTECTED` option.
- `ui/debug-test-scenarios.ts`: rename `absoluteProtected` fixture data to `inviolable`.
- Tests listed in tasks below.

Delete:

- `test/game.absolute-protect-next-stone.test.ts`
- `assets/images/special-stones/absolute_protect_next_stone-black.png`
- `assets/images/special-stones/absolute_protect_next_stone-white.png`
- `assets/audio/sound-effect/強い意志の石が進化したタイミング.mp3`

Regenerate:

- `cards/catalog.js`
- `cards/catalog.ts`
- `cards/catalog.generated.js`
- `assets/asset-manifest.json`
- `public/module-registry.js`
- `public/module-registry.optional.js`
- `worker-public/**` mirror outputs

---

### Task 1: Preflight And Isolation

**Files:**

- Inspect only: working tree

- [ ] **Step 1: Start with git status**

Run:

```powershell
git status --short
```

Expected: identify existing unrelated dirty files. Do not stage, revert, or delete them.

- [ ] **Step 2: Confirm active-source search baseline**

Run:

```powershell
rg -n "ABSOLUTE_PROTECTED|absolute_protect_next_stone|strong_will_promoted|absoluteProtectedStone|hasAbsoluteProtection|absoluteProtected|absolute_protected|absolute-protection|ABSOLUTE_PROTECT_NEXT_STONE|absolute_protect_01" shared game ui cards test tests workers scripts 01-rulebook.md 正本 docs\architecture-contracts.md --glob "!**/dist/**" --glob "!**/worker-public/**" --glob "!docs/archive/**" --glob "!docs/superpowers/plans/**" --glob "!docs/superpowers/specs/**"
rg -n "絶対保護|絶対保護石|最強の意志|強い意志の石が進化した" 01-rulebook.md 正本 cards game ui shared test tests workers docs\architecture-contracts.md --glob "!**/dist/**" --glob "!**/worker-public/**" --glob "!docs/archive/**" --glob "!docs/superpowers/plans/**" --glob "!docs/superpowers/specs/**"
```

Expected: matches across rulebook, `正本`, `cards`, `shared`, `game`, `ui`, and tests. This confirms the plan scope.

- [ ] **Step 3: Read nested AGENTS before implementation edits**

Run this before each implementation area:

```powershell
Get-Content -Raw cards\AGENTS.md
Get-Content -Raw shared\AGENTS.md
Get-Content -Raw game\AGENTS.md
Get-Content -Raw game\logic\AGENTS.md
Get-Content -Raw game\logic\cards-internal\AGENTS.md
Get-Content -Raw game\logic\card-resolution\AGENTS.md
Get-Content -Raw game\turn\AGENTS.md
Get-Content -Raw ui\AGENTS.md
Get-Content -Raw test\AGENTS.md
```

Expected: no instruction conflicts. Follow the most local applicable file.

---

### Task 2: Rewrite Player-Visible Specification

**Files:**

- Modify: `01-rulebook.md`
- Modify: `正本/共通ルール正本.md`
- Modify: `正本/カード仕様正本.md`
- Modify: `正本/効果音対応表.md`
- Test: source inspection and search

- [ ] **Step 1: Update `01-rulebook.md` protection sections**

Replace `6.2 永続保護` bullets with:

```markdown
### 6.2 永続保護（PermaProtected）

- `PERMA_PROTECT_NEXT_STONE（強い意志）` で付く強い石。特殊石本体として扱う
- 反転不可
- 交換不可
- 破壊は可能
- 誘惑・捕獲・意志の喪失の対象に含まれる
- 解除なし（破壊、捕獲、意志の喪失などで失われるまで継続）
```

Delete the entire `### 6.5 絶対保護（最強の意志）` section. Renumber later sections only if the local document already keeps numeric headings strictly sequential; otherwise leave stable headings unchanged to minimize churn.

- [ ] **Step 2: Update `01-rulebook.md` strong-will card section**

Replace the `10.6 PERMA_PROTECT_NEXT_STONE（強い意志）` bullets with:

```markdown
### 10.6 PERMA_PROTECT_NEXT_STONE（強い意志）

- コスト16
- 次に置く石に永続保護を付与
- その石は以後ずっと反転されない
- 置かれた石は `強い石（PERMA_PROTECTED）` になり、特殊石本体として扱う
- `強い石` は誘惑・捕獲・意志の喪失の対象に含まれる
- 防ぐのは反転と通常の交換対象化で、破壊・誘惑・捕獲・意志の喪失は防がない
- 所有者ターン開始回数による進化はしない
```

Remove the UI bullets for promotion countdown and purple promotion highlight.

- [ ] **Step 3: Update `01-rulebook.md` affected global definitions**

Apply these exact rule changes:

```markdown
- `特殊石本体` list removes `絶対保護石（ABSOLUTE_PROTECTED）`.
- `誘惑可能な石効果` excludes 完全保護, 顕現石, 盤面マーカー, 配置時効果; it no longer mentions 絶対保護石.
- `意志の喪失（LOSS_WILL）` says `弱い石（PROTECTED）` and `強い石（PERMA_PROTECTED）` are reverted, and does not mention `ABSOLUTE_PROTECTED`.
- `禁忌反転` no longer has an absolute-protection exception; 顕現石 remains outside normal target/effect handling through 不可侵.
- `穴マス` says 顕現石があるマス以外には確定で穴マスにできる.
- `抹消` says 完全保護や反転無効では防げない. Do not add an absolute-protection exception.
- `破壊／爆発` says 完全保護・不可侵には効かない. Do not mention 絶対保護.
```

Use direct text edits in the sections currently around `01-rulebook.md:285`, `01-rulebook.md:301`, `01-rulebook.md:307`, `01-rulebook.md:557`, `01-rulebook.md:746`, `01-rulebook.md:1083`, `01-rulebook.md:1140`, `01-rulebook.md:1164`, `01-rulebook.md:1242`, `01-rulebook.md:1374`, `01-rulebook.md:1750`, and `01-rulebook.md:2003`.

- [ ] **Step 4: Remove strong-will promotion sound from `01-rulebook.md`**

Delete this mapping:

```markdown
- `strong_will_promoted` → `強い意志の石が進化したタイミング.mp3`
```

- [ ] **Step 5: Update `正本/共通ルール正本.md`**

Delete:

```markdown
### 絶対保護

絶対保護とは、反転、破壊、移動、位置入替、テレポート、マス破壊を含むすべての直接効果を無効化する最上位の保護状態です。

絶対保護は解除されません。絶対保護石があるマスを穴化、縮小、移動先、交換先として処理しようとしても、その石とマスは残ります。
因果抹消、因果抹消神、盤面縮小、盤面縮小神の穴化では、絶対保護石があるマスだけが残ります。それ以外のマスは、封鎖、凍結、種などの既存マス状態や通常の保護状態ごと穴へ上書きされます。
```

Replace the `セル消滅` paragraph with:

```markdown
セル消滅とは、対象セルを石・盤面状態ごと消して穴に置き換える処理です。
不可侵の顕現石があるセルだけはセル消滅しません。
生きる意志、復活の意志、破壊回避、幽体、完全保護などの石ローカル効果はセル消滅を止めません。
```

- [ ] **Step 6: Update `正本/カード仕様正本.md` affected rows**

Use these replacement row bodies:

```markdown
| 強い意志 | 守護 | 16 | 通常 | 次に置く石は強い石になり、永続的に反転されない。強い石は特殊石本体として扱い、誘惑・捕獲・意志の喪失の対象に含まれる。所有者ターン開始回数による進化はしない。 |
| 誘惑の意志 | 執行 | 34 | 通常 | 相手の誘惑可能な石効果1つを選び、自分側へ変える。誘惑可能な石効果には、特殊石本体、罠石、時限爆弾、生きる意志を含める。完全保護中の石、顕現石、盤面マーカー、配置時効果は対象外。弱い石・強い石・幽体石は対象に含まれる。残りターンなどの付帯状態は維持する。この色変更は反転枚数に数えない。 |
| 捕獲の意志 | 執行 | 20 | 通常 | 相手の捕獲可能な特殊石本体1つを盤面から取り除き、元カードとして自分の手札に加える。弱い石・強い石・幽体石は対象に含まれる。罠石、時限爆弾、生きる意志、完全保護中の石、顕現石、盤面マーカー、配置時効果は対象外。幽体石にも通常どおり成立し、捕獲すると幽霊の意志として手札に加わる。 |
| 禁忌の反転 | 禁忌 | 44 | 通常 | 次の配置だけ、通常の挟みでなくても敵石列を1方向だけ強制反転できる。候補が複数ある場合は反転枚数が最大の方向を優先し、同数ならランダムに1方向を選ぶ。 |
| マステレポート | 執行 | 18 | 通常 | 石があるマス1つを選び、その石を盤面外側の空き候補へランダムテレポートさせ、元マスをセル消滅で永続の穴にする。元マスのセル消滅は生きる意志・復活の意志・破壊回避では残らない。不可侵の顕現石は対象外。 |
| 意志狩りの王 | 戦闘 | 33 | 通常 | 次に置く石を意志狩りの王にする。配置直後と自分のターン開始時に敵石1つを破壊し、そのマスへ移動する。敵の特殊石がある場合は通常石より優先して狙うが、完全保護中の石・顕現石は破壊対象候補に含めない。反転回避2回と破壊回避2回を持ち、回避の移動先と不成立条件は共通ルールに従う。8ターン持続する。 |
| 意志の喪失 | 執行 | 15 | 通常 | 使用時、使用カードと特殊カード以外の自分手札をすべて破壊する。その後、盤面上の特殊石本体をすべて同色の通常石に戻し、爆弾は解除する。弱い石・強い石・幽体石・残像石・復活石・罠石は通常石化の対象に含まれる。敵味方を問わない。完全保護中の石、石状態、盤面マーカー、配置時効果、顕現石は対象外。 |
| 盤面縮小 | 禁忌 | 19 | 通常 | 現在の盤面外周で連続する3マスを順に選び、3つ目の選択時に同時にセルごと穴化する。角を含むL字3マスも連続外周として選べる。盤面拡張マスも対象にできる。生きる意志・復活の意志・破壊回避・封鎖・凍結・種などはセル消滅を止めない。不可侵の顕現石は対象外。 |
| 盤面縮小神 | 禁忌 | 27 | 通常 | 現在の盤面外周の角を1つ選び、そこから伸びる辺1列を選ぶ。選んだ辺1列を同時にセルごと穴化する。生きる意志・復活の意志・破壊回避・封鎖・凍結・種などはセル消滅を止めない。不可侵の顕現石は対象外。 |
| 因果抹消 | 執行 | 21 | 通常 | 盤面上のマス1つを選び、そのマスをセルごと永続の穴にする。生きる意志・復活の意志・破壊回避・封鎖・凍結・種などはセル消滅を止めない。穴マスには配置できず、移動先にもならず、反転経路も遮断する。完全保護は穴化を止めない。不可侵の顕現石は対象外。 |
| 盤界の執行者 | 特殊 | 0 | 実装済み | 盤面に自分の特殊石本体が1つ以上あるときだけ使用できる。使用時に盤面上のすべての特殊石本体を穴マスにする。罠石と時限爆弾は対象に含み、顕現石・石状態・盤面マーカー・配置時効果は対象外。使用後、次に置く自石を4ターン持続・不可侵の顕現石「盤界の執行者」にする。盤界の執行者が盤面にある間、両者は手札からカードを使用できない。両者ターン開始時、その手番プレイヤーはドロー前の `max(0, 所持カード枚数 - 1)^2` 布石を失う。 |
```

- [ ] **Step 7: Update `正本/効果音対応表.md`**

Delete this row:

```markdown
| `強い意志の石が進化したタイミング.mp3` | 強い意志の石が最強の意志へ進化し、絶対保護を得た瞬間。 | 単なる永続保護の付与時には鳴らさない。 |
```

- [ ] **Step 8: Run spec search**

Run:

```powershell
rg -n "絶対保護|絶対保護石|最強の意志|強い意志の石が進化した|ABSOLUTE_PROTECTED|strong_will_promoted" 01-rulebook.md 正本 docs\architecture-contracts.md
```

Expected: no matches in `01-rulebook.md`, `正本`, or `docs/architecture-contracts.md` after Task 3 updates the architecture contract.

- [ ] **Step 9: Commit spec update**

Run:

```powershell
git status --short
git diff -- 01-rulebook.md 正本\共通ルール正本.md 正本\カード仕様正本.md 正本\効果音対応表.md
git add 01-rulebook.md 正本\共通ルール正本.md 正本\カード仕様正本.md 正本\効果音対応表.md
git commit -m "Remove absolute protection from specs"
```

Expected: commit contains only spec files.

---

### Task 3: Update Catalog, Help Text, And Generated Catalog Files

**Files:**

- Modify: `cards/catalog.json`
- Modify: `cards/card-interaction-effects.ts`
- Modify: `cards/card-last-used-panel-copy.ts`
- Modify: `shared/game-term-glossary.ts`
- Modify: `ui/diff-renderer.ts`
- Regenerate: `cards/catalog.js`, `cards/catalog.ts`, `cards/catalog.generated.js`
- Test: `test/cards.catalog.test.ts`, `test/cards.generate.test.ts`, `test/ui.card-detail-effect-tags.test.ts`, `test/ui.rules-help-panel.test.ts`, `test/ui.text-term-highlighter.test.ts`, `test/ui.deck-builder-card-detail.test.ts`

- [ ] **Step 1: Update `cards/catalog.json` strong-will copy**

Replace `perma_01.desc_ja` with:

```json
"desc_ja": "次に置く石はずっと反転されない強い石になる。強い石は特殊石本体として扱われ、破壊・誘惑・捕獲・意志の喪失の対象になる。"
```

- [ ] **Step 2: Update cell-removal card copy in `cards/catalog.json`**

Replace `BOARD_SHRINK_WILL` description with:

```json
"desc_ja": "外周から連続する3マスを選んで石ごと抹消し、穴マスにして盤面を縮小する。"
```

Replace `BOARD_SHRINK_GOD` description with:

```json
"desc_ja": "角を含む辺1列を選んで石ごと抹消し、穴マスにして盤面を縮小する。"
```

- [ ] **Step 3: Remove absolute-protection tag support from `cards/card-interaction-effects.ts`**

Delete `ABSOLUTE_PROTECTION` from `CARD_EFFECT_TAG_KIND`, delete the `label: '絶対保護'` branch, and delete `absoluteProtectionTag`.

Update these entries:

```ts
PERMA_PROTECT_NEXT_STONE: '次に置く石を強い石化。ずっと反転されず、特殊石として扱う。',
```

```ts
PERMA_PROTECT_NEXT_STONE: '強い石は特殊石として扱い、誘惑・捕獲・意志の喪失の対象になる。\n防ぐのは反転と通常の交換対象化で、破壊・誘惑・捕獲・意志の喪失までは防がない。\n所有者ターン開始回数による進化はしない。',
```

```ts
TEMPT_WILL: '対象は相手の誘惑可能な石効果。\n特殊石、罠石、時限爆弾、生きる意志を対象に含む。\n弱い石・強い石・幽体石は特殊石として対象に含まれる。\n完全保護中の石は対象効果を受けない。\n顕現石・盤面マーカー・配置時効果は対象外。\n残りターンなどの状態を維持したまま自分側になる。',
CAPTURE_WILL: '盤面から取り除き、その特殊石の元になったカードとして自分の手札へ加える。\n弱い石・強い石・幽体石は対象に含まれる。\n完全保護が付いた相手特殊石は対象効果を受けない。\n幽体石にも通常どおり成立する。',
LOSS_WILL: '盤面上の特殊石を全て通常石に戻す。\n自分の手札を全て破壊して使用。\n幽体石・残像石・復活石・罠石も特殊石として通常石化する。\n守る石・生きる意志・盤面マーカー・配置時効果は対象外。\n完全保護中の石は対象外。\n解除できる特殊石も爆弾も無い局面では使用できない。',
```

Keep the tag for strong will as:

```ts
PERMA_PROTECT_NEXT_STONE: freezeCardEffectTags([specialStoneTag(), flipProtectionTag()]),
```

- [ ] **Step 4: Update `cards/card-last-used-panel-copy.ts`**

Replace the `perma_01` copy with:

```ts
perma_01: '次に置く石はずっと反転されない強い石になる。',
```

- [ ] **Step 5: Update `shared/game-term-glossary.ts`**

Delete this entry:

```ts
Object.freeze({ id: 'absolute-protection', label: '絶対保護', category: 'protection', description: 'テレポート・位置交換・マス破壊を含む全ての効果を無効化。解除されない。' }),
```

Use these replacement descriptions:

```ts
Object.freeze({ id: 'taboo-flip', label: '禁忌反転', category: 'flip', description: '挟めなくても反転可能。実際に反転する枚数が最大の列1方向のみ選ぶ。' }),
Object.freeze({ id: 'destroy', label: '破壊', category: 'destroy', description: '石を破壊して盤面から消す効果。反転無効では防げないが、完全保護・不可侵には効かない。' }),
Object.freeze({ id: 'erase', label: '抹消', category: 'destroy', description: 'そのマスの石を取り除きます。\n完全保護や反転無効では防げません。' }),
Object.freeze({ id: 'blast', label: '破壊／爆発', category: 'destroy', description: '石を破壊して盤面から消す効果。反転無効では防げないが、完全保護・不可侵には効かない。', aliases: Object.freeze(['爆破', '爆発']) }),
Object.freeze({ id: 'hole-cell', label: '穴マス', category: 'cell', description: 'マスを永続の穴にする。穴マスには誰も置けず、反転経路も遮断する。\n顕現石があるマス以外には確定で穴マスにできる。', aliases: Object.freeze(['穴マス化', '穴化']) }),
```

- [ ] **Step 6: Update `ui/diff-renderer.ts` glossary copy**

Replace old glossary entries with:

```ts
'抹消': 'そのマスの石を取り除きます。\n完全保護や反転無効では防げません。',
'穴マス': 'マスを永続の穴にする。穴マスには誰も置けず、反転経路も遮断する。\n顕現石があるマス以外には確定で穴マスにできる。',
```

Delete the `絶対保護` glossary entry.

- [ ] **Step 7: Regenerate catalog**

Run:

```powershell
npm run generate:catalog
```

Expected: `cards/catalog.js`, `cards/catalog.ts`, and `cards/catalog.generated.js` update from `cards/catalog.json`.

- [ ] **Step 8: Update text tests**

Update these tests to assert the new copy and no absolute term:

```powershell
test/cards.catalog.test.ts
test/cards.tempt-will-surfaces.test.ts
test/ui.card-detail-effect-tags.test.ts
test/ui.rules-help-panel.test.ts
test/ui.text-term-highlighter.test.ts
test/ui.deck-builder-card-detail.test.ts
```

Representative assertion replacements:

```ts
expect(card.desc_ja).not.toContain('絶対保護');
expect(card.desc_ja).not.toContain('最強の意志');
expect(card.desc_ja).toContain('進化はしない');
```

```ts
expect(getTagLabels()).not.toContain('絶対保護');
expect(termDescription).toBe('マスを永続の穴にする。穴マスには誰も置けず、反転経路も遮断する。\n顕現石があるマス以外には確定で穴マスにできる。');
```

- [ ] **Step 9: Run text/card tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cards.catalog.test.ts test/cards.generate.test.ts test/cards.tempt-will-surfaces.test.ts test/ui.card-detail-effect-tags.test.ts test/ui.rules-help-panel.test.ts test/ui.text-term-highlighter.test.ts test/ui.deck-builder-card-detail.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 10: Commit catalog and help text update**

Run:

```powershell
git status --short
git diff -- cards\catalog.json cards\catalog.js cards\catalog.ts cards\catalog.generated.js cards\card-interaction-effects.ts cards\card-last-used-panel-copy.ts shared\game-term-glossary.ts ui\diff-renderer.ts test\cards.catalog.test.ts test\cards.generate.test.ts test\cards.tempt-will-surfaces.test.ts test\ui.card-detail-effect-tags.test.ts test\ui.rules-help-panel.test.ts test\ui.text-term-highlighter.test.ts test\ui.deck-builder-card-detail.test.ts
git add cards\catalog.json cards\catalog.js cards\catalog.ts cards\catalog.generated.js cards\card-interaction-effects.ts cards\card-last-used-panel-copy.ts shared\game-term-glossary.ts ui\diff-renderer.ts test\cards.catalog.test.ts test\cards.generate.test.ts test\cards.tempt-will-surfaces.test.ts test\ui.card-detail-effect-tags.test.ts test\ui.rules-help-panel.test.ts test\ui.text-term-highlighter.test.ts test\ui.deck-builder-card-detail.test.ts
git commit -m "Remove absolute protection from card text"
```

Expected: commit contains text, generated catalog files, and matching tests only.

---

### Task 4: Keep Strong Will, Remove Promotion

**Files:**

- Modify: `shared-constants.ts`
- Modify: `game/logic/card-resolution/protect.ts`
- Modify: `game/logic/cards-internal/effect-timing.ts`
- Modify: `test/game.perma-protected-next-stone.test.ts`
- Modify: `test/game.cards.effect-timing-module.test.ts`
- Modify: `test/game.turn-pipeline-strong-will-timer.test.ts`
- Modify: `test/game.pipeline-ui-adapter.sound-cue.test.ts`
- Modify: `test/ui.animation-engine.guard-timer.test.ts`
- Delete or rewrite promotion-only assertions in related files

- [ ] **Step 1: Write failing strong-will no-promotion tests**

In `test/game.perma-protected-next-stone.test.ts`, replace promotion countdown/promotion tests with:

```ts
test('use card -> place creates PERMA_PROTECTED marker without promotion metadata', () => {
  const def = getPermaProtectNextStoneDef();
  expect(def).toBeTruthy();
  const { cardState, gameState } = createStateWithHand('black', [def.id]);

  const useRes = CardLogic.useCard(cardState, gameState, 'black', 0, {});
  expect(useRes.success).toBe(true);

  const placeRes = TurnPipeline.applyTurn(cardState, gameState, 'black', 2, 3, {});
  expect(placeRes.success).toBe(true);

  const marker = findSpecialMarker(cardState, 2, 3);
  expect(marker).toBeTruthy();
  expect(marker.data).toEqual({ type: 'PERMA_PROTECTED' });
});

test('owner turn starts do not promote strong will stones', () => {
  const def = getPermaProtectNextStoneDef();
  const { cardState, gameState } = createStateWithHand('black', [def.id]);

  CardLogic.useCard(cardState, gameState, 'black', 0, {});
  TurnPipeline.applyTurn(cardState, gameState, 'black', 2, 3, {});

  for (let i = 0; i < 25; i += 1) {
    TurnPipeline.applyTurnStart(cardState, gameState, 'black', {});
  }

  const marker = findSpecialMarker(cardState, 2, 3);
  expect(marker.data).toEqual({ type: 'PERMA_PROTECTED' });
  expect(cardState.events || []).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ reason: 'strong_will_promoted' })
  ]));
});
```

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.perma-protected-next-stone.test.ts
```

Expected before implementation: failures because promotion metadata or promotion behavior still exists.

- [ ] **Step 2: Remove promotion constants**

In `shared-constants.ts`, delete:

```ts
export const STRONG_WILL_PROMOTION_OWNER_TURNS = 20;
(window as any).STRONG_WILL_PROMOTION_OWNER_TURNS = STRONG_WILL_PROMOTION_OWNER_TURNS;
STRONG_WILL_PROMOTION_OWNER_TURNS,
```

- [ ] **Step 3: Simplify `applyStrongWill`**

In `game/logic/card-resolution/protect.ts`, replace `applyStrongWill` marker handling with:

```ts
const existingMarker = getSpecialMarkers(cardState).find((marker: any) => (
    marker &&
    marker.row === row &&
    marker.col === col &&
    marker.data &&
    marker.data.type === 'PERMA_PROTECTED'
));

const markerData = { type: 'PERMA_PROTECTED' };

if (existingMarker) {
    existingMarker.owner = playerKey;
    existingMarker.data = markerData;
    return { applied: true };
}

addMarker(cardState, 'specialStone', row, col, playerKey, markerData);
return { applied: true };
```

Delete `DEFAULT_STRONG_WILL_PROMOTION_OWNER_TURNS`.

- [ ] **Step 4: Delete `applyAbsoluteProtect`**

In `game/logic/card-resolution/protect.ts`, remove the entire `applyAbsoluteProtect` function and remove it from the export:

```ts
export = {
    applyStrongWill,
    applyGuardWill
};
```

- [ ] **Step 5: Remove promotion processing from `effect-timing.ts`**

Delete:

```ts
STRONG_WILL_PROMOTION_OWNER_TURNS: any;
STRONG_WILL_PROMOTION_OWNER_TURNS: constants.STRONG_WILL_PROMOTION_OWNER_TURNS,
function getStrongWillPromotionOwnerTurns(...)
function processStrongWillPromotionOnTurnStart(...)
processStrongWillPromotionOnTurnStart(cardState, playerKey, specialMarkers, helpers, constants);
```

Expected behavior: turn start no longer mutates `PERMA_PROTECTED` based on owner-turn count and no longer emits `STATUS_APPLIED` with `strong_will_promoted`.

- [ ] **Step 6: Remove promotion UI/sound hooks**

Delete promotion handling from:

```powershell
game\turn\presentation-helpers.ts
game\turn\pipeline-ui\sound-cues.ts
game\turn\pipeline-ui\card-economy-sound-cues.ts
game\turn\turn_pipeline_phase_helpers.ts
game\turn\pipeline-ui\log-mappers.ts
ui\animation-engine.ts
```

Concrete removals:

```ts
// remove branches keyed by:
'strong_will_promoted'
'absolute_protected_promoted'
'ABSOLUTE_PROTECTED'
```

Do not remove generic `STATUS_APPLIED` handling used by other cards.

- [ ] **Step 7: Update promotion tests**

Remove or rewrite tests that assert promotion sound, purple promotion highlight, or speech:

```powershell
test/game.cards.effect-timing-module.test.ts
test/game.pipeline-ui-adapter.sound-cue.test.ts
test/game.turn-pipeline-strong-will-timer.test.ts
test/ui.animation-engine.guard-timer.test.ts
test/game.turn-pipeline-phase-helpers.special-stone-speech.test.ts
```

Replacement assertion pattern:

```ts
expect(events).not.toEqual(expect.arrayContaining([
  expect.objectContaining({ reason: 'strong_will_promoted' })
]));
```

- [ ] **Step 8: Run strong-will focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.perma-protected-next-stone.test.ts test/game.cards.effect-timing-module.test.ts test/game.turn-pipeline-strong-will-timer.test.ts test/game.pipeline-ui-adapter.sound-cue.test.ts test/ui.animation-engine.guard-timer.test.ts test/game.turn-pipeline-phase-helpers.special-stone-speech.test.ts
```

Expected: all listed tests pass and no promotion event/sound/highlight remains.

- [ ] **Step 9: Commit strong-will behavior update**

Run:

```powershell
git status --short
git diff -- shared-constants.ts game\logic\card-resolution\protect.ts game\logic\cards-internal\effect-timing.ts game\turn\presentation-helpers.ts game\turn\pipeline-ui\sound-cues.ts game\turn\pipeline-ui\card-economy-sound-cues.ts game\turn\turn_pipeline_phase_helpers.ts game\turn\pipeline-ui\log-mappers.ts ui\animation-engine.ts test\game.perma-protected-next-stone.test.ts test\game.cards.effect-timing-module.test.ts test\game.turn-pipeline-strong-will-timer.test.ts test\game.pipeline-ui-adapter.sound-cue.test.ts test\ui.animation-engine.guard-timer.test.ts test\game.turn-pipeline-phase-helpers.special-stone-speech.test.ts
git add shared-constants.ts game\logic\card-resolution\protect.ts game\logic\cards-internal\effect-timing.ts game\turn\presentation-helpers.ts game\turn\pipeline-ui\sound-cues.ts game\turn\pipeline-ui\card-economy-sound-cues.ts game\turn\turn_pipeline_phase_helpers.ts game\turn\pipeline-ui\log-mappers.ts ui\animation-engine.ts test\game.perma-protected-next-stone.test.ts test\game.cards.effect-timing-module.test.ts test\game.turn-pipeline-strong-will-timer.test.ts test\game.pipeline-ui-adapter.sound-cue.test.ts test\ui.animation-engine.guard-timer.test.ts test\game.turn-pipeline-phase-helpers.special-stone-speech.test.ts
git commit -m "Stop strong will from evolving"
```

Expected: commit contains strong-will behavior and presentation fallout only.

---

### Task 5: Remove `ABSOLUTE_PROTECTED` From Registries And Core Rules

**Files:**

- Modify: `shared/special-stone-registry.ts`
- Modify: `shared/manifest-stone-registry.ts`
- Modify: `shared/stone-status-snapshot.ts`
- Modify: `game/logic/cards-internal/protection-context.ts`
- Modify: `game/logic/cards-internal/destroy-protection-context.ts`
- Modify: `game/logic/board_ops.ts`
- Modify: `game/logic/cards/markers.ts`
- Modify: `game/logic/cards/utils.ts`
- Modify: `game/logic/cards/targets.ts`
- Modify: `game/logic/cards/selectors.ts`
- Modify: `game/logic/cards/selectors-core-utils.ts`
- Modify: `game/logic/cards/will_hunter_king.ts`
- Modify: `game/logic/cards.ts`
- Modify: `game/cards/target-resolver.ts`
- Modify: `game/logic/cards-internal/effect-target-counts.ts`
- Modify: `game/logic/cards-internal/capture-source.ts`
- Test: `test/shared.special-stone-registry.test.ts`, `test/manifest-stone-registry.test.ts`, `test/shared.manifest-stone-registry.marker-data.test.ts`, `test/game.protection-context.test.ts`, `test/game.cell-removal.contract.test.ts`, focused card tests listed below

- [ ] **Step 1: Write registry tests for absence**

In `test/shared.special-stone-registry.test.ts`, replace expected type lists so `ABSOLUTE_PROTECTED` is absent:

```ts
expect(SpecialStoneRegistry.getSpecialStoneInfo('ABSOLUTE_PROTECTED')).toBeNull();
expect(SpecialStoneRegistry.getSpecialStoneCardDefinition('PERMA_PROTECT_NEXT_STONE')).toEqual(expect.objectContaining({
  cardId: 'perma_01',
  markerType: 'PERMA_PROTECTED'
}));
expect(SpecialStoneRegistry.getSpecialStoneCardDefinition('PERMA_PROTECT_NEXT_STONE')).not.toHaveProperty('promotedMarkerType');
```

Remove assertions for:

```ts
classifySpecialStoneRuleClass('ABSOLUTE_PROTECTED')
canLossWillRevert('ABSOLUTE_PROTECTED')
isTemptTargetableStoneEffect('ABSOLUTE_PROTECTED')
blocksTempt('ABSOLUTE_PROTECTED')
```

- [ ] **Step 2: Rename manifest metadata tests**

In `test/manifest-stone-registry.test.ts`, replace:

```ts
expect(SpecialStoneRegistry.isAbsoluteProtectedSpecialType('THEORY_INCARNATION')).toBe(true);
```

with:

```ts
expect(ManifestStoneRegistry.isInviolableManifestStoneType('THEORY_INCARNATION')).toBe(true);
```

In `test/shared.manifest-stone-registry.marker-data.test.ts`, replace `absoluteProtected: true` with `inviolable: true`.

- [ ] **Step 3: Remove absolute stone from `shared/special-stone-registry.ts`**

Delete:

```ts
ABSOLUTE_PROTECTED: Object.freeze({
    name: '絶対保護石',
    desc: 'あらゆる効果を受けない。',
    flipProtected: true,
    destroyProtected: true
})
```

Change strong-will definition to:

```ts
PERMA_PROTECT_NEXT_STONE: Object.freeze({
    cardId: 'perma_01',
    cardNameJa: '強い意志',
    cardType: 'PERMA_PROTECT_NEXT_STONE',
    markerType: 'PERMA_PROTECTED'
}),
```

Delete the explicit `out.ABSOLUTE_PROTECTED = makeStoneEffectRule(...)` block.

Delete `isAbsoluteProtectedSpecialType` and remove it from exports.

Change fallback loss-will classification:

```ts
revertibleByLossWill: rule ? rule.lossWillRevertible : targetableAsSpecialStone,
```

- [ ] **Step 4: Rename manifest registry protection fields**

In `shared/manifest-stone-registry.ts`, replace each metadata entry:

```ts
absoluteProtected: true,
```

with:

```ts
inviolable: true,
```

Rename function:

```ts
function isInviolableManifestStoneType(rawType: unknown): boolean {
    const metadata = getManifestStoneMetadata(rawType);
    return !!(metadata && metadata.inviolable === true);
}
```

In `createManifestStoneMarkerData`, replace:

```ts
absoluteProtected: metadata.absoluteProtected === true,
```

with:

```ts
inviolable: metadata.inviolable === true,
```

Export `isInviolableManifestStoneType`, not `isAbsoluteProtectedManifestStoneType`.

- [ ] **Step 5: Update manifest marker creation fallbacks**

Replace fallback marker data in:

```powershell
game\logic\card-resolution\theory-incarnation.ts
game\logic\card-resolution\board-executor.ts
game\logic\card-resolution\observer-will.ts
```

from:

```ts
absoluteProtected: true,
```

to:

```ts
inviolable: true,
```

- [ ] **Step 6: Update stone status snapshot**

In `shared/stone-status-snapshot.ts`, rename the snapshot field:

```ts
hasAbsoluteProtection: boolean;
```

to:

```ts
inviolable: boolean;
```

Delete fallback `normalizeSpecialStoneType(rawType) === 'ABSOLUTE_PROTECTED'`.

Use manifest metadata / marker data for inviolable:

```ts
const inviolable = !hasGhost && (
  isManifestStone ||
  markerData.inviolable === true
);
```

Do not push `絶対保護` into tags. Keep `不可侵` tag behavior for manifest stones.

- [ ] **Step 7: Replace protection context shape**

In `game/logic/cards-internal/protection-context.ts`, rename:

```ts
absoluteProtectedStones
```

to:

```ts
inviolableStones
```

Build it from active manifest markers only:

```ts
const inviolableStones = manifests
    .map((entry) => mapOwnerPosition(entry, constants));
```

Return:

```ts
return {
    protectedStones,
    inviolableStones,
    permaProtectedStones,
    bombs,
    blockedCells
};
```

Do not return an `absoluteProtectedStones` compatibility alias.

- [ ] **Step 8: Replace board operation guard**

In `game/logic/board_ops.ts`, rename `_isAbsoluteProtectedCell` to `_isInviolableCell`.

Use `ManifestStoneRegistry.isManifestStoneType` / marker data `inviolable === true` as the predicate. Do not treat `ABSOLUTE_PROTECTED` as protected.

Replace reasons:

```ts
return { applied: false, reason: 'inviolable', row, col, destroyed: false };
return { destroyed: false, reason: 'inviolable' };
return { changed: false, reason: 'inviolable' };
return { moved: false, reason: 'inviolable_source' };
return { swapped: false, reason: 'inviolable_source' };
```

Update callers in teleport/ownership modules that map `absolute_protected_source` to use `inviolable_source`.

- [ ] **Step 9: Remove `ABSOLUTE_PROTECTED` branches in card logic**

Edit these files to remove named checks for `ABSOLUTE_PROTECTED`:

```powershell
game\logic\cards-internal\destroy-protection-context.ts
game\logic\cards-internal\effect-target-counts.ts
game\logic\cards-internal\capture-source.ts
game\logic\cards\markers.ts
game\logic\cards\utils.ts
game\logic\cards\targets.ts
game\logic\cards\selectors.ts
game\logic\cards\selectors-core-utils.ts
game\logic\cards\will_hunter_king.ts
game\logic\cards.ts
game\cards\target-resolver.ts
game\logic\card-resolution\ownership.ts
game\logic\card-resolution\trap.ts
game\logic\cards\teleport.ts
```

Concrete rule replacements:

```ts
if (type === 'GUARD' || type === 'ABSOLUTE_PROTECTED') return false;
```

becomes:

```ts
if (type === 'GUARD') return false;
```

and source/destination immunity uses `isInviolableCell` / manifest checks, not special-stone type names.

- [ ] **Step 10: Update CPU absolute-stone heuristics**

In:

```powershell
game\cpu-decision-tempt-value.ts
game\cpu-decision-pending-score.ts
```

Remove `ABSOLUTE_PROTECTED` scoring and target rejection. Keep `GUARD`, `顕現石`, and `不可侵` handling if already present; otherwise route through shared target helpers.

- [ ] **Step 11: Run core registry and protection tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/shared.special-stone-registry.test.ts test/manifest-stone-registry.test.ts test/shared.manifest-stone-registry.marker-data.test.ts test/game.protection-context.test.ts test/game.cell-removal.contract.test.ts test/game.capture-will.test.ts test/game.loss-will.test.ts test/game.meteor-will.test.ts test/game.board-shrink-will.test.ts test/game.will-hunter-king.test.ts test/game.taboo-reverse-will.test.ts test/game.special-stone-visual-rule.test.ts test/game.special-card-inviolable.test.ts test/special-card-foundation.test.ts
```

Expected: all listed tests pass with `ABSOLUTE_PROTECTED` removed and manifest protection reason renamed to `inviolable`.

- [ ] **Step 12: Delete obsolete absolute-protected test file**

Run after the replacement tests pass:

```powershell
Remove-Item -LiteralPath test\game.absolute-protect-next-stone.test.ts
```

Expected: no focused behavior only covered by that file is still desired.

- [ ] **Step 13: Commit core removal**

Run:

```powershell
git status --short
git diff -- shared shared-constants.ts game test
git add shared\special-stone-registry.ts shared\manifest-stone-registry.ts shared\stone-status-snapshot.ts shared\player-profile-contract.ts game\logic\cards-internal\protection-context.ts game\logic\cards-internal\destroy-protection-context.ts game\logic\cards-internal\effect-target-counts.ts game\logic\cards-internal\capture-source.ts game\logic\board_ops.ts game\logic\cards\markers.ts game\logic\cards\utils.ts game\logic\cards\targets.ts game\logic\cards\selectors.ts game\logic\cards\selectors-core-utils.ts game\logic\cards\will_hunter_king.ts game\logic\cards.ts game\cards\target-resolver.ts game\logic\card-resolution\ownership.ts game\logic\card-resolution\trap.ts game\logic\cards\teleport.ts game\cpu-decision-tempt-value.ts game\cpu-decision-pending-score.ts game\logic\card-resolution\theory-incarnation.ts game\logic\card-resolution\board-executor.ts game\logic\card-resolution\observer-will.ts test\shared.special-stone-registry.test.ts test\manifest-stone-registry.test.ts test\shared.manifest-stone-registry.marker-data.test.ts test\game.protection-context.test.ts test\game.cell-removal.contract.test.ts test\game.capture-will.test.ts test\game.loss-will.test.ts test\game.meteor-will.test.ts test\game.board-shrink-will.test.ts test\game.will-hunter-king.test.ts test\game.taboo-reverse-will.test.ts test\game.special-stone-visual-rule.test.ts test\game.special-card-inviolable.test.ts test\special-card-foundation.test.ts
git add -u test\game.absolute-protect-next-stone.test.ts
git commit -m "Remove absolute protected stone core rules"
```

Expected: commit contains core behavior, registry, and tests only.

---

### Task 6: Remove Visual, Audio, Avatar, And Asset Manifest References

**Files:**

- Modify: `game/visual-effects-map.runtime.js`
- Modify: `ui/player-profile-avatar-options.ts`
- Modify: `test/assets.images.test.ts`
- Modify: `test/ui.visual-effects-map.shared.test.ts`
- Modify: `test/ui.long-press-info.test.ts`
- Modify: `test/sound-engine.default-bgm.test.ts`
- Delete: `assets/images/special-stones/absolute_protect_next_stone-black.png`
- Delete: `assets/images/special-stones/absolute_protect_next_stone-white.png`
- Delete: `assets/audio/sound-effect/強い意志の石が進化したタイミング.mp3`
- Regenerate: `assets/asset-manifest.json`

- [ ] **Step 1: Remove visual map entry**

In `game/visual-effects-map.runtime.js`, delete the `absoluteProtectedStone` object and delete:

```js
'ABSOLUTE_PROTECTED': 'absoluteProtectedStone'
```

Do not change `protectedStone`; it is still used by `強い意志`.

- [ ] **Step 2: Remove avatar option**

In `ui/player-profile-avatar-options.ts`, delete:

```ts
ABSOLUTE_PROTECTED: 'assets/images/special-stones/absolute_protect_next_stone-black.png'
```

- [ ] **Step 3: Delete unused assets**

Run:

```powershell
Remove-Item -LiteralPath assets\images\special-stones\absolute_protect_next_stone-black.png
Remove-Item -LiteralPath assets\images\special-stones\absolute_protect_next_stone-white.png
Remove-Item -LiteralPath assets\audio\sound-effect\強い意志の石が進化したタイミング.mp3
```

Expected: the files are deleted from root assets only. Do not manually edit `worker-public/assets`.

- [ ] **Step 4: Regenerate asset manifest**

Run:

```powershell
npm run build:ts
npm run generate:asset-manifest
```

Expected: `assets/asset-manifest.json` removes the deleted image/audio entries.

- [ ] **Step 5: Update asset and visual tests**

In `test/assets.images.test.ts`, delete the test named `includes the promoted strongest-stone PNGs used after 強い意志 evolves`.

In `test/ui.visual-effects-map.shared.test.ts`, delete the test named `ABSOLUTE_PROTECTED が昇格後の絶対保護石画像へ解決される`.

In `test/ui.long-press-info.test.ts`, delete tests for `ABSOLUTE_PROTECTED` stone info. Keep manifest stone long-press tests and update them to expect `不可侵`, not `絶対保護`.

In `test/sound-engine.default-bgm.test.ts`, delete the assertion:

```ts
expect(soundEngine.getEffectFilePath('strong_will_promoted')).toBe(
  'assets/audio/sound-effect/強い意志の石が進化したタイミング.mp3'
);
```

- [ ] **Step 6: Run visual and asset tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/assets.images.test.ts test/assets.manifest.test.ts test/ui.visual-effects-map.shared.test.ts test/ui.long-press-info.test.ts test/sound-engine.default-bgm.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 7: Commit assets and visual cleanup**

Run:

```powershell
git status --short
git diff -- game\visual-effects-map.runtime.js ui\player-profile-avatar-options.ts assets\asset-manifest.json test\assets.images.test.ts test\ui.visual-effects-map.shared.test.ts test\ui.long-press-info.test.ts test\sound-engine.default-bgm.test.ts
git add game\visual-effects-map.runtime.js ui\player-profile-avatar-options.ts assets\asset-manifest.json test\assets.images.test.ts test\ui.visual-effects-map.shared.test.ts test\ui.long-press-info.test.ts test\sound-engine.default-bgm.test.ts
git add -u assets\images\special-stones\absolute_protect_next_stone-black.png assets\images\special-stones\absolute_protect_next_stone-white.png assets\audio\sound-effect\強い意志の石が進化したタイミング.mp3
git commit -m "Remove absolute protection assets"
```

Expected: commit contains visual/audio asset removal and tests only.

---

### Task 7: Update Network, Worker, And Public Contract Fallout

**Files:**

- Modify: `docs/architecture-contracts.md`
- Modify: worker preload or tests only if `rg` finds active references
- Regenerate: `dist/**`, `public/module-registry.js`, `public/module-registry.optional.js`, `worker-public/**`
- Test: network parity and worker tests touched by renamed reason strings

- [ ] **Step 1: Update architecture contract**

In `docs/architecture-contracts.md`, replace:

```markdown
Card resolution paths that need `protectedStones`, `permaProtectedStones`, `absoluteProtectedStones`, `bombs`, or `blockedCells` must build them through `game/logic/cards-internal/protection-context.ts` or a wrapper that delegates to it.
```

with:

```markdown
Card resolution paths that need `protectedStones`, `permaProtectedStones`, `inviolableStones`, `bombs`, or `blockedCells` must build them through `game/logic/cards-internal/protection-context.ts` or a wrapper that delegates to it.
```

Add this sentence below:

```markdown
`inviolableStones` is for manifest stones and other explicit不可侵 boundary objects only; `強い意志` remains `PERMA_PROTECTED` and must not promote into another marker type.
```

- [ ] **Step 2: Update reason strings in network-facing tests**

Search:

```powershell
rg -n "absolute_protected|absoluteProtected|ABSOLUTE_PROTECTED|absoluteProtectedStones" test tests workers ui game shared --glob "!**/dist/**" --glob "!**/worker-public/**"
```

For manifest/inviolable behavior, replace:

```ts
reason: 'absolute_protected'
reason: 'absolute_protected_source'
absoluteProtected: true
absoluteProtectedStones
```

with:

```ts
reason: 'inviolable'
reason: 'inviolable_source'
inviolable: true
inviolableStones
```

For `ABSOLUTE_PROTECTED` stone behavior, delete the test or replace it with `PERMA_PROTECTED` if the desired behavior is strong-will persistence.

- [ ] **Step 3: Build browser outputs**

Run:

```powershell
npm run build:browser
```

Expected: TypeScript compiles, `dist/` and `public/module-registry*.js` update. Do not source-edit generated outputs.

- [ ] **Step 4: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: `worker-public/**` updates from root source and generated outputs.

- [ ] **Step 5: Run network parity**

Run:

```powershell
npm run test:network:parity
```

Expected: parity suite passes with no `ABSOLUTE_PROTECTED` or `absolute_protected` contract expectations.

- [ ] **Step 6: Commit contract and mirror update**

Run:

```powershell
git status --short
git diff -- docs\architecture-contracts.md public worker-public test tests workers ui game shared
git add docs\architecture-contracts.md public\module-registry.js public\module-registry.optional.js
git add worker-public
git add test tests workers ui game shared
git commit -m "Sync absolute protection removal across runtimes"
```

Expected: commit contains generated/mirror updates and network-facing tests that could not be committed in earlier focused tasks. Do not add unrelated dirty files.

---

### Task 8: Final Active-Source Purge And Verification

**Files:**

- Inspect: active source and tests
- Test: broad focused checks

- [ ] **Step 1: Active source must not contain absolute-protection identifiers**

Run:

```powershell
rg -n "ABSOLUTE_PROTECTED|absolute_protect_next_stone|strong_will_promoted|absoluteProtectedStone|hasAbsoluteProtection|absoluteProtected|absolute_protected|absolute-protection|ABSOLUTE_PROTECT_NEXT_STONE|absolute_protect_01" shared game ui cards test tests workers scripts 01-rulebook.md 正本 docs\architecture-contracts.md assets\asset-manifest.json --glob "!**/dist/**" --glob "!**/worker-public/**" --glob "!docs/archive/**" --glob "!docs/superpowers/plans/**" --glob "!docs/superpowers/specs/**"
```

Expected: no output.

- [ ] **Step 2: Active player-visible text must not contain old Japanese terms**

Run:

```powershell
rg -n "絶対保護|絶対保護石|最強の意志|強い意志の石が進化した" 01-rulebook.md 正本 cards game ui shared test tests workers docs\architecture-contracts.md assets\asset-manifest.json --glob "!**/dist/**" --glob "!**/worker-public/**" --glob "!docs/archive/**" --glob "!docs/superpowers/plans/**" --glob "!docs/superpowers/specs/**"
```

Expected: no output.

- [ ] **Step 3: Confirm strong-will identifiers remain**

Run:

```powershell
rg -n "PERMA_PROTECT_NEXT_STONE|PERMA_PROTECTED|perma_01|強い意志" 01-rulebook.md cards game shared test 正本 --glob "!**/dist/**" --glob "!**/worker-public/**"
```

Expected: matches remain for `強い意志`, `perma_01`, `PERMA_PROTECT_NEXT_STONE`, and `PERMA_PROTECTED`.

- [ ] **Step 4: Run focused full bundle**

Run:

```powershell
npm run typecheck
npm run test:jest -- --runTestsByPath test/cards.catalog.test.ts test/cards.generate.test.ts test/game.perma-protected-next-stone.test.ts test/game.cards.effect-timing-module.test.ts test/shared.special-stone-registry.test.ts test/manifest-stone-registry.test.ts test/shared.manifest-stone-registry.marker-data.test.ts test/game.protection-context.test.ts test/game.cell-removal.contract.test.ts test/game.capture-will.test.ts test/game.loss-will.test.ts test/game.meteor-will.test.ts test/game.board-shrink-will.test.ts test/game.will-hunter-king.test.ts test/game.taboo-reverse-will.test.ts test/game.special-card-inviolable.test.ts test/special-card-foundation.test.ts test/assets.images.test.ts test/assets.manifest.test.ts test/ui.visual-effects-map.shared.test.ts test/ui.long-press-info.test.ts test/ui.card-detail-effect-tags.test.ts test/ui.rules-help-panel.test.ts test/ui.text-term-highlighter.test.ts test/sound-engine.default-bgm.test.ts
npm run test:network:parity
```

Expected: all commands pass.

- [ ] **Step 5: Run worker mirror check**

Run:

```powershell
npm run worker:prepare
git diff --check
git status --short
```

Expected: worker mirror is current, whitespace check passes, and remaining dirty files are either intentional removal work or pre-existing unrelated files.

- [ ] **Step 6: Final commit if needed**

If Task 8 produced only intentional cleanup changes, run:

```powershell
git add <intentional-files-only>
git commit -m "Verify absolute protection removal"
```

Expected: no unrelated pre-existing files are staged.

---

## Implementation Notes

- Do not keep compatibility aliases named `absoluteProtected`, `absoluteProtectedStones`, `isAbsoluteProtectedSpecialType`, or `absolute_protected`. The point of this removal is to make resurrection visible in search.
- `PERMA_PROTECTED` should remain a flip-protected special stone and remain targetable by temptation, capture, loss-will, and destruction paths according to the updated rulebook.
- 顕現石 protection should be described and tested as `不可侵`; it can still block cell removal, movement, ownership change, and normal card effects, but no active source should call that behavior `絶対保護`.
- If a test currently uses `ABSOLUTE_PROTECTED` only as a generic "unaffected object" fixture, replace it with a顕現石 fixture when testing `不可侵`, or with `PERMA_PROTECTED` when testing strong-will behavior. Do not keep `ABSOLUTE_PROTECTED` as a fixture.
- Do not manually edit `worker-public/` or `dist/`; use `npm run build:browser` and `npm run worker:prepare`.

## Self-Review

Spec coverage:

- `絶対保護` / `絶対保護石` player-visible rules are removed in Task 2.
- `強い意志` remains as `PERMA_PROTECT_NEXT_STONE` / `PERMA_PROTECTED` without promotion in Task 4.
- `ABSOLUTE_PROTECTED` generation, registry, protection, visual, sound, and tests are removed in Tasks 5 and 6.
- 顕現石 protection survives under `不可侵` / `inviolable` in Tasks 5 and 7.
- Worker/public mirror fallout and parity verification are covered in Task 7.
- Active-source no-resurrection search is covered in Task 8.

Placeholder scan:

- The plan avoids open-ended placeholders. Each task names exact files, expected replacements, commands, and expected results.

Type consistency:

- New internal names are `inviolable`, `inviolableStones`, `isInviolableManifestStoneType`, `_isInviolableCell`, `inviolable`, and `inviolable_source`.
- Removed names are `ABSOLUTE_PROTECTED`, `absoluteProtected`, `absoluteProtectedStones`, `isAbsoluteProtectedSpecialType`, `_isAbsoluteProtectedCell`, `absolute_protected`, and `strong_will_promoted`.

## Execution Handoff

Plan complete. Recommended execution order is Task 1 through Task 8 with one commit at each task's commit step. If implementation is done in parallel, update `01-rulebook.md` and `正本/*.md` in the main checkout first, commit the spec change, then sync that spec commit into implementation worktrees before code edits.
