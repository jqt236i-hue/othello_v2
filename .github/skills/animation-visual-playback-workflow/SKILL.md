---
name: 'animation-visual-playback-workflow'
description: 'PLAYBACK_EVENTS、Single Visual Writer、board render 差分、playback lock、visual regression を、この repo の events 順 / Spec B 前提で安全に直すワークフロー。Use when editing ui/animation-*.js, ui/diff-renderer.js, ui/playback-engine.js, ui/presentation-handler.js, ui/playback-state-manager.js, ui/board-renderer.js, ui/stone-visuals.js, or related animation/visual tests in this card-othello repository.'
argument-hint: 'どの演出崩れや再生崩れを直したいか。flip, board render, playback lock, visual regression なども書く'
---

# Animation Visual Playback Workflow

このスキルは、`events[]` の順序、Single Visual Writer、Spec B、board render 差分、playback lock、visual regression をまとめて扱う時の標準手順です。差分の小ささより Single Visual Writer と再生契約の整合を優先し、局所不具合はその責務境界で完結するように直します。再生契約そのものが壊れている時は phase を切った段階的な置換も許容します。

## When to Use

- フリップや stone 演出の見え方が崩れた時
- 再生中に盤面 DOM が別経路から更新されている時
- playback lock や busy lock が早く外れる、または残り続ける時
- animation / render 変更で UI test や visual regression が落ちた時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `ui/animation-engine.js`
- `ui/animation-utils.js`
- `ui/board-renderer.js`
- `ui/diff-renderer.js`
- `ui/presentation-handler.js`
- `ui/playback-engine.js`
- `ui/playback-state-manager.js`
- `ui/stone-visuals.js`
- 関連 test: `test/ui.animation-engine.*`, `test/ui.diff-renderer.flip.test.js`, `test/presentation.board-updated.serial.test.js`

## Common Traps

- `events[]` に無い見た目補完を UI 側で推測して足すこと
- board DOM の書き手を 2 系統以上に増やすこと
- Spec B を崩し、古い見た目からそのまま反転させること
- タイマーを足して順序バグを隠すこと

## Procedure

1. `01-rulebook.md` の UI / 演出仕様と、今回触る `events[]` の順序を確認する。
2. 現在どの module が visual write を持っているかを追い、Single Visual Writer を固定する。
3. 不具合を event source、playback state、board diff、lock timing、visual regression のどこかに分類する。
4. 分類できたら、その責務を持つ root 側 module から直す。局所不具合ならその責務境界で完結するように直し、再生契約そのものが壊れているなら phase を切って置換する。
5. lock / unlock は playback state に寄せ、演出ロジックを別ファイルへ複製しない。
6. 最後に順序と見た目の両方を検証する。

## Validation Bundle

- 近い `test/ui.animation-engine.*`
- `test/ui.animation-engine.playback-state.test.js`
- `test/ui.init.playback-runtime.test.js`
- `test/ui.diff-renderer.flip.test.js`
- `test/presentation.board-updated.serial.test.js`
- 画像差分が出るなら `npm run test:visual` と `tests/visual-regression/*` を確認する

## Completion Checklist

- `events[]` の順序を壊していない
- 再生中の盤面 DOM の書き手が 1 つに保たれている
- Spec B を守っている
- 実行した test / visual check と `01-rulebook.md` 更新有無を報告した
