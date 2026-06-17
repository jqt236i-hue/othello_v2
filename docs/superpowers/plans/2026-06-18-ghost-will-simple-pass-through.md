# Ghost Will Simple Pass-Through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `幽霊の意志` の `幽体` 性能を「反転」と「破壊」だけを受け流す仕様に単純化する。`誘惑の意志`、`捕獲の意志`、位置入替などは、個別カードの通常ルールどおり幽体にも成立するようにする。`交換の意志` は相手通常石のみ対象のため、特殊石本体である幽体は対象条件外として維持する。

**Architecture:** 仕様正本は `01-rulebook.md`、詳細挙動メモは `正本/*.md`、カード表示は `cards/*`、headless ロジックは `game/logic/*` が担当する。幽体の防御判定は UI ではなく headless の `BoardOps` / card-resolution 側で一元化し、表示・音・演出は既存の `events[]` とカード表面テキストから追従させる。`worker-public/` は mirror のため直接編集せず、必要なら `npm run worker:prepare` で同期する。

**Tech Stack:** TypeScript / JavaScript, Jest, Playwright-on-Jest surfaces, npm scripts, Cloudflare Worker mirror generation.

---

## Desired Rules

- `GHOST` は通常の反転処理では色が変わらない。
- `GHOST` は通常の破壊処理では盤面から取り除かれない。
- `誘惑の意志` は反転ではなく所有権変更として扱い、`GHOST` にも通常どおり成立する。
- `捕獲の意志` は破壊ではなく捕獲として扱い、`GHOST` にも通常どおり成立する。成立時は対象の幽体石を除去し、カード `ghost_01` を捕獲者の手札へ加える。
- 位置入替、その他「反転」「破壊」ではない効果は、各カード固有の対象条件を満たす限り幽体にも通常どおり成立する。
- `交換の意志` は相手通常石のみ対象のため、幽体を対象にできない。この不成立は幽体の受け流しではなく、交換側の対象条件による。
- 反転・破壊を受け流した場合だけ、既存の幽体防御ログ・演出を出す。誘惑・捕獲では幽体防御ログを出さない。

## Current State To Verify First

- [ ] `git status --short` を実行し、既存の dirty files を分類する。
- [ ] `01-rulebook.md`、`正本/*.md`、`cards/*`、`game/logic/*`、`test/*` に既存変更がある場合は、今回の仕様変更に関連する差分かどうかを確認する。
- [ ] unrelated dirty changes が同じファイルに混在していて hunk staging で安全に分離できない場合は、実装を止めてユーザーへ確認する。
- [ ] `rg -n "GHOST_WILL|ghost_01|幽霊の意志|幽体|ghost" 01-rulebook.md cards game shared test docs 正本` で幽体仕様の全参照を棚卸しする。

## Step 1: Lock Expected Behavior With Tests

- [ ] `test/game.ghost-will.test.ts` の `誘惑の意志` ケースを更新する。
  - 旧期待: 幽体は誘惑対象に選べるが、所有者・色は変わらない。
  - 新期待: 幽体は誘惑対象に選べ、成立後は対象セルの所有者が誘惑した側へ変わる。
  - 追加確認: 幽体 marker は残り、marker owner も新 owner に移る。
- [ ] `test/game.capture-will.test.ts` の `捕獲の意志` ケースを更新する。
  - 旧期待: 幽体は捕獲対象に選べるが、盤面に残る。
  - 新期待: 幽体は捕獲され、対象セルは空になり、捕獲者の手札に `ghost_01` が入る。
  - 追加確認: 対象セルの ghost marker は削除される。
- [ ] `交換の意志` の通常石限定テストを維持または追加する。
  - 新期待: 幽体は特殊石本体なので、交換の意志の対象候補に出ず、直接解決しても成立しない。
  - この不成立は幽体が受け流した扱いではなく、交換の意志の対象条件外として扱う。
- [ ] 反転防御の既存テストは維持する。
  - 標準反転、反転系カード、連鎖反転で `GHOST` が色変更されないこと。
- [ ] 破壊防御の既存テストは維持する。
  - 破壊系カード、破壊 batch、地形破壊などで `GHOST` が除去されないこと。
- [ ] 表示テキスト系テストを更新する。
  - `test/cards.tempt-will-surfaces.test.ts`: 幽体が誘惑で色変更されない旨を削除し、通常どおり対象になる説明へ変更する。
  - `test/cards.capture-will-surfaces.test.ts` があれば、幽体が捕獲を受け流す旨を削除する。
  - `test/cards.ghost-will-surfaces.test.ts` がなければ追加し、`幽霊の意志` の詳細が「反転・破壊だけを受け流す」説明になっていることを検証する。
  - `test/ui.rules-help-panel.test.ts` など用語説明を固定期待しているテストがあれば更新する。
- [ ] ここで focused test を実行し、実装前に期待どおり失敗することを確認する。

```powershell
npm run test:jest -- test/game.ghost-will.test.ts test/game.capture-will.test.ts test/cards.tempt-will-surfaces.test.ts
```

## Step 2: Update Source-Of-Truth Specs And Player Text

- [ ] `01-rulebook.md` を更新する。
  - §6.6 `幽体` の説明を「反転・破壊は対象にはなるが、その石自身は効果を受けない」に限定する。
  - `10.5 GHOST_WILL` を同じ内容へ更新する。
  - `10.9 TEMPT_WILL` から「幽体は誘惑を受け流す / 色は変わらない」趣旨を削除し、幽体にも通常成立する旨へ変更する。
  - `10.10 CAPTURE_WILL` から「幽体は捕獲を受け流す」趣旨を削除し、幽体も捕獲可能で `ghost_01` を得る旨へ変更する。
  - 効果用語の `幽体` を「反転・破壊のみ防ぐ。誘惑・捕獲など対象条件を満たす効果は通常どおり受ける。交換は通常石のみ対象のため対象外」へ統一する。
- [ ] `正本/カード仕様正本.md` を更新する。
  - `幽霊の意志` の挙動から「誘惑・捕獲を受け流す」を削除し、交換は通常石限定による対象外として明記する。
  - `誘惑の意志` / `捕獲の意志` の幽体例外を削除する。
- [ ] `正本/共通ルール正本.md` を更新する。
  - 幽体の共通ルールを「反転・破壊のみ防ぐ」に単純化する。
  - 交換・誘惑・捕獲の特例記述を削除する。
- [ ] `正本/演出正本.md` を更新する。
  - 幽体防御演出は反転防御と破壊防御だけに発生する。
  - 誘惑・捕獲成立時は通常の誘惑・捕獲演出を使う。
- [ ] `cards/catalog.json` の対象カード説明を更新する。
  - `ghost_01`: 「反転・破壊だけを受け流す。誘惑・捕獲など対象条件を満たす効果は通常どおり受ける。交換は通常石のみ対象のため対象外」へ変更する。
  - `tempt_01`: 幽体が誘惑を受け流す説明を削除する。
  - `capture_01`: 幽体が捕獲を受け流す説明を削除する。
  - `swap_with_enemy` は通常石限定の説明を維持し、幽体が交換対象になる説明を入れない。
- [ ] `cards/card-interaction-effects.ts` と `cards/card-interaction.ts` の quick/detail/term 文言を同じ仕様へ統一する。
- [ ] catalog 生成物がある場合は既存 script で再生成する。手編集対象と生成対象を混同しない。

## Step 3: Simplify Headless Ghost Protection

- [ ] `game/logic/board_ops.ts` を確認する。

```powershell
rg -n "_shouldBlockGhostDestroy|_shouldBlockGhostChange|allowGhostFlip|blockedByGhost|ghost_protected" game/logic/board_ops.ts game/logic game/card-effects
```

- [ ] `_shouldBlockGhostChange(cause, reason)` を「反転系だけ true」にする。
  - `standard_flip`、`reverse`、`flip`、反転カード由来の reason/cause は true。
  - `TEMPT_WILL`、`tempt_applied`、`tempt_convert` は false。
  - 所有権変更や交換を表す reason/cause は false。
- [ ] `_shouldBlockGhostDestroy(reason, meta)` を「破壊系だけ true」にする。
  - `destroy`、`explosion`、破壊カード由来の reason/cause は true。
  - `CAPTURE_WILL`、`capture_selected`、`capture` は false。
  - 捕獲成立時は marker/card source 解決が通常どおり進むようにする。
- [ ] `game/logic/card-resolution/ownership.ts` の `applyTemptWill` から幽体専用 deflect branch を削除する。
  - 通常の `BoardOps.changeAt(..., 'TEMPT_WILL', 'tempt_applied')` 経路で成立させる。
  - `transferCellMarkerOwnership(...)` が ghost marker の owner を新 owner に移すことを確認する。
- [ ] `game/logic/card-resolution/ownership.ts` の `applyCaptureWill` から幽体専用 deflect branch を削除する。
  - 通常の `resolveCaptureSourceInfo(...)` と `BoardOps.destroyAt(..., 'CAPTURE_WILL', 'capture_selected')` 経路で成立させる。
  - `GHOST` marker から `ghost_01` が捕獲カードとして解決されることを確認する。
- [ ] 交換系は通常石限定を維持する。
  - 対象候補生成・validate・解決のいずれでも、特殊石本体である `GHOST` は対象外にする。
  - `GHOST` を対象外にする理由は幽体防御ではなく、交換の意志の通常石限定条件であることをテストと文言で明示する。
- [ ] UI 層、DOM、network client、sound から幽体防御可否を判断しない。headless の結果イベントを表示するだけに留める。

## Step 4: Update Presentation And Logs

- [ ] `rg -n "ghost_protected|blockedByGhost|幽体|誘惑|捕獲" game ui cards test 正本 01-rulebook.md` で、誘惑・捕獲を幽体防御として扱うログや演出分岐を探す。
- [ ] 誘惑・捕獲で `blockedByGhost` を出している箇所を削除または通常成立 event に変更する。
- [ ] 反転・破壊の `blockedByGhost` event は維持する。
- [ ] 演出正本に合わせ、幽体防御 highlight/sound は反転・破壊だけで発火するようにする。

## Step 5: Regenerate Mirrors And Verify

- [ ] TypeScript build / catalog generation / worker mirror の必要範囲を確認する。
- [ ] worker-public に反映が必要な root source 変更がある場合だけ `npm run worker:prepare` を実行する。
- [ ] focused tests を実行する。

```powershell
npm run test:jest -- test/game.ghost-will.test.ts test/game.capture-will.test.ts test/cards.tempt-will-surfaces.test.ts
```

- [ ] 仕様・catalog 影響が広い場合は追加で catalog / rules help 系テストを実行する。

```powershell
npm run test:jest -- test/ui.rules-help-panel.test.ts test/ui.card-detail-effect-tags.test.ts
```

- [ ] headless 共有ロジックの変更後に typecheck を実行する。

```powershell
npm run typecheck
```

- [ ] worker mirror を更新した場合は差分確認後、必要に応じて Worker parity を実行する。

```powershell
npm run test:network:parity
```

## Step 6: Diff Review And Commit

- [ ] `git diff -- 01-rulebook.md 正本 cards game test docs` で今回変更だけが入っていることを確認する。
- [ ] `worker-public/` は `npm run worker:prepare` の結果だけを含める。手編集差分は入れない。
- [ ] unrelated dirty files がある場合は、今回対象ファイルだけを `git add` する。`git add -A` は使わない。
- [ ] focused tests と `npm run typecheck` が成功していれば、今回分だけを commit する。
- [ ] unrelated dirty changes が混在して分離できない場合は commit せず、対象ファイルと理由をユーザーへ報告する。

## Completion Criteria

- [ ] `幽霊の意志` の表示・ヘルプ・ルール本文が「反転・破壊だけを受け流す」に統一されている。
- [ ] `誘惑の意志` は幽体に成立し、幽体 marker の owner が移る。
- [ ] `捕獲の意志` は幽体に成立し、`ghost_01` が捕獲者の手札へ入る。
- [ ] `交換の意志` は通常石限定のため幽体を対象外にし、それ以外の反転・破壊ではない効果に幽体専用の hidden exclusion が残っていない。
- [ ] 反転・破壊に対する幽体防御は既存どおり成立する。
- [ ] focused Jest と typecheck が通っている。
- [ ] 必要な root-to-worker mirror が再生成済みで、手編集 mirror がない。
