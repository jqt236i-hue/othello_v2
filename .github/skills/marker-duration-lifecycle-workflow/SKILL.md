---
name: 'marker-duration-lifecycle-workflow'
description: 'marker 追加, remainingOwnerTurns, turn-start expire, spawn meta / STATUS_* presentation を、game / pipeline adapter 契約に合わせて安全に直すワークフロー。Use when editing game/logic/cards/markers.ts / .js shim, game/logic/cards-internal/effect-timing.ts / .js shim, game/turn/pipeline_ui_adapter.ts / .js shim, game/turn/turn_pipeline_phases.ts / .js shim, or related marker duration tests in this card-othello repository.'
argument-hint: 'どの marker / duration / expire / STATUS_* を直したいか。addMarker, remainingOwnerTurns, duration_end, spawn meta なども書く'
---

# Marker Duration Lifecycle Workflow

このスキルは、marker の追加、残りターン、turn-start expire、presentation metadata を、同じ lifecycle 契約で直す時の手順です。

## When to Use

- `remainingOwnerTurns` や duration 変更が turn 開始時の実挙動とずれる時
- `STATUS_APPLIED` / `STATUS_REMOVED` と marker data が噛み合わない時
- spawn meta の backfill や hidden trap の扱いが壊れた時
- duration end, anchor expire, promotion のログや再生が崩れた時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `game/logic/cards/markers.ts / .js shim`
- `game/logic/cards-internal/effect-timing.ts / .js shim`
- `game/turn/pipeline_ui_adapter.ts / .js shim`
- `game/turn/turn_pipeline_phases.ts / .js shim`
- `game/logic/cards.ts`（`.js` は互換 shim）
- 関連 test: `test/game.cards.markers-module.test.js`, `test/game.cards.markers-duration-module.test.js`, `test/game.cards.effect-timing-module.test.js`

## Common Traps

- duration decrement を `effect-timing.onTurnStart` の外でばらばらに処理すること
- 複数 marker が同じ cell にあるのに、cell 単位の timer として潰してしまうこと
- hidden trap まで `STATUS_APPLIED` と spawn meta backfill を出してしまうこと
- `_presentationEventsPersist` の action 単位 backfill を忘れること
- `duration_end` / `anchor_expired` の扱いを `pipeline_ui_adapter.js` と別契約にすること

## Procedure

1. 不具合を add、duration change、turn-start expire、presentation mapping のどこで起きているかに分類する。
2. marker の正本と per-marker data は `markers.js` に寄せ、turn-start の countdown / promotion は `effect-timing.js` に寄せる。
3. `remainingOwnerTurns` や関連カウンタを変える時は、対象 marker ごとに更新し、同じ cell の別 marker を暗黙に束ねない。
4. `STATUS_APPLIED` / `STATUS_REMOVED` と `_presentationEventsPersist` backfill は同じ action 単位でそろえる。
5. `duration_end` や `anchor_expired` が出る時は `pipeline_ui_adapter.js` の再生・ログ面まで確認する。
6. 見た目だけの崩れではなく lifecycle 自体が正しいかを先に固定し、visual-only なら `animation-visual-playback-workflow` を併用する。

## Validation Bundle

- `test/game.cards.markers-module.test.js`
- `test/game.cards.markers-duration-module.test.js`
- `test/game.cards.effect-timing-module.test.js`
- `test/game.turn-pipeline-strong-will-timer.test.js`
- `test/game.udg-duration.test.js`
- `test/game.duration-end-revert.test.js`
- `test/game.specialstone.spawn-meta-backfill.test.js`
- `test/game.pipeline-ui-adapter.regen-status-removed.test.js`
- `test/game.pipeline-ui-adapter.effect-logs.anchor-expire.test.js`

## Completion Checklist

- marker の追加、残りターン、expire の責務が 1 つの lifecycle にそろっている
- hidden / visible marker の presentation 差が意図どおりである
- duration_end 系の presentation / playback が marker data と一致している
- 実行した test と `01-rulebook.md` 更新有無を報告した
