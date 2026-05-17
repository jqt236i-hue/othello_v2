---
name: 'pending-selection-flow-workflow'
description: 'pending selection, multi-stage target, deferred publish, selection cache を、game / CPU / network publish 契約に合わせて安全に直すワークフロー。Use when editing game/turn-handlers/pending-target-selector.ts / .js shim, game/turn/pending-coordinator.js, game/card-effects/selection-flow.js, game/logic/cards-internal/pending-state-manager.js, game/cpu-turn-handler.ts / .js shim, game/network-turn-handoff.ts / .js shim, ui/network/snapshot.ts / .js shim, ui/network-client.ts / .js shim, or related pending selection tests in this card-othello repository.'
argument-hint: 'どの pending type / stage を直したいか。continue-turn か end-turn か、network defer や CPU 選択も書く'
---

# Pending Selection Flow Workflow

このスキルは、pending selection の契約を `pending-state-manager`、effect handler、CPU、network publish まで同じ意味でそろえる時の手順です。

## When to Use

- 2 段階以上の target selection が途中で壊れる時
- pass / retry / turn handoff で pending や selection cache が残る時
- network で deferred publish と local 実行が二重になる時
- CPU の pending target 選択が UI / game の合法手とずれる時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `game/logic/cards-internal/pending-state-manager.js`
- `game/turn-handlers/pending-target-selector.ts / .js shim`
- `game/turn/pending-coordinator.js`
- `game/card-effects/selection-flow.js`
- `game/card-effects/*` の対象 handler
- `game/cpu-decision.ts / .js shim`, `game/cpu-turn-handler.ts / .js shim`
- `game/network-turn-handoff.ts / .js shim`
- `ui/network/snapshot.ts / .js shim`
- `ui/network-client.ts / .js shim`
- 関連 test: `test/game.pending-selection-flow.test.js`, `test/game.pending-coordinator.contract.test.js`, `test/game.pending-target-selector.test.js`, `test/ui.network-client.multi-stage-selection.test.js`

## Common Traps

- continue-turn と end-turn の contract を取り違えること
- stage 途中の選択状態を local cache だけに置き、authoritative snapshot に乗せ忘れること
- pending type / turnIndex が変わったのに selection action cache を残すこと
- busy / playback idle の穴を legacy flag で埋めること
- card ごとの handler と `selection-flow.js` / `ui/network-client.ts / .js shim` の publish 方針を別契約のまま進めること

## Procedure

1. まず `pending-state-manager.js` で対象 pending type の contract を確認し、continue-turn / end-turn、defer publish、wait-for-idle のどれが正かを固定する。
2. stage 状態は `pendingEffectByPlayer` の正本へ寄せ、selection action cache は transport 補助としてだけ扱う。
3. effect handler、`selection-flow.js`、`pending-target-selector.js` を同じ contract でそろえる。
4. CPU の pending target 選択は `game/cpu-decision.ts / .js shim` と `game/cpu-turn-handler.ts / .js shim` から shared selector を使い、UI 側独自判定を増やさない。
5. network mode では intermediate stage と final publish を分け、`ui/network-client.ts / .js shim`, `ui/network/snapshot.ts / .js shim`, `game/network-turn-handoff.ts / .js shim` の contract をそろえ、local pipeline 実行を二重化しない。
6. card 仕様や catalog まで触る時は `card-effect-integration-workflow` も併用する。

## Validation Bundle

- `test/game.cards.pending-state-manager-module.test.js`
- `test/game.pending-selection-flow.test.js`
- `test/game.pending-coordinator.contract.test.js`
- `test/game.pending-target-selector.test.js`
- `test/game.turn-pipeline.pending-cache-turn-start.test.js`
- `test/game.network-turn-handoff.test.js`
- `test/ui.network-client.multi-stage-selection.test.js`
- `test/ui.network-client.action-bridge-next-snapshot.test.js`
- `test/ui.network-snapshot.single-writer-baseline.test.js`
- `test/ui.network-snapshot.pending-presentation-reconcile.test.js`
- `test/ui.network-client.guard-tempt-deferred-publish.test.js`
- `test/ui.network-client.swap-deferred-publish.test.js`
- `test/ui.network-client.trap-deferred-publish.test.js`
- `test/cpu.turn-handler.pending.test.js`
- `test/turn-manager.retry.test.js`

## Completion Checklist

- pending type ごとの contract が 1 つの意味にそろっている
- intermediate stage が必要な時は authoritative pending state に保持されている
- selection cache の clear / retain 条件が turn と type に一致している
- 実行した test と `01-rulebook.md` 更新有無を報告した
