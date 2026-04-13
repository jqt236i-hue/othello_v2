---
name: 'board-expansion-movement-workflow'
description: 'board expansion cell, movement target, expansion render / sound, CPU target choice を、geometry / diff-render 契約に合わせて安全に直すワークフロー。Use when editing game/logic/core.js, game/logic/cards/expansion.js, game/logic/cards/movement.js, game/card-effects/position-swap.js, game/move-generator.js, game/cpu-decision.js, game/cpu-turn-handler.js, ui/diff-renderer.js, or related expansion / movement tests in this card-othello repository.'
argument-hint: 'どの expansion / movement を直したいか。cell materialize, move target, reveal sound, CPU target, network multi-stage のどこかも書く'
---

# Board Expansion Movement Workflow

このスキルは、board expansion と movement 系カードを、geometry、move generation、render、CPU まで同じ座標契約で直す時の手順です。

## When to Use

- expansion cell が materialize されない、または legacy field と `cells[]` がずれる時
- move generation や合法手が expansion cell を見落とす時
- strong wind 系や swap 系の移動で marker / stone 位置が崩れる時
- expansion reveal の class / sound / suppress 条件が壊れた時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `game/logic/core.js`
- `game/logic/cards/expansion.js`
- `game/logic/cards/movement.js`
- `game/move-generator.js`
- `game/card-effects/board-expansion.js`
- `game/card-effects/strong-wind.js` と関連 movement handler
- `game/card-effects/position-swap.js`
- `game/logic/cards/markers.js`
- `game/cpu-decision.js`, `game/cpu-decision-board-utils.js`
- `game/cpu-turn-handler.js`
- `ui/diff-renderer.js`

## Common Traps

- main board の `{ row, col }` と expansion cell の `side / row / col / cells[]` を混ぜて扱うこと
- `boardExpansion.cells` を直して legacy field (`active`, `side`, `row`, `owner`) を同期し忘れること
- main board と expansion cell の間で move / swap したのに marker や stone-linked state を動かし忘れること
- reveal sound や reveal class を毎 render で鳴らすこと
- move generation、effect handler、CPU target choice が別々の座標ルールで進化すること

## Procedure

1. 問題を geometry/state、selection、movement execution、render/sound、CPU のどこにあるかへ分類する。
2. expansion state の正本は `core.js` と `expansion.js` に寄せ、既存の normalize / getter / setter を再利用する。
3. move / swap で座標が変わる時は `markers.js` を含む linked state を shared helper 経由で更新し、場当たりの row / col 直書きを増やさない。
4. `move-generator.js`、effect handler、`game/cpu-decision.js`、`game/cpu-turn-handler.js` の target 候補を同じ cell 集合にそろえる。
5. `ui/diff-renderer.js` の reveal class / sound は state 契約が固まってから合わせる。
6. `BOARD_EXPANSION_GOD` や network multi-stage selection が絡む時は `pending-selection-flow-workflow` も併用する。

## Validation Bundle

- `test/game.cards.expansion-module.test.js`
- `test/game.logic.movement-module.test.js`
- `test/game.board-expansion-will.test.js`
- `test/game.card-effects.board-expansion-sound.test.js`
- `test/game.move-generator.expansion-pending.test.js`
- `test/game.movement-selection-turn-handoff.test.js`
- `test/game.swap-selection-turn-handoff.test.js`
- `test/game.work-will.expansion.test.js`
- `test/cpu.turn-handler.pending.test.js`
- `test/ui.board-expansion-cell-render.test.js`
- expansion と marker-linked 座標を一緒に触る時は `test/game.cards.markers-module.test.js`
- `BOARD_EXPANSION_GOD` や network defer が絡む時は `test/ui.network-client.multi-stage-selection.test.js`
- `test/ui.network-client.movement-deferred-publish.test.js`

## Completion Checklist

- expansion geometry と legacy field が同じ状態を表している
- move / swap 後の marker と linked state が座標に追従している
- reveal class / sound が新規 expansion cell にだけ出る
- 実行した test と `01-rulebook.md` 更新有無を報告した
