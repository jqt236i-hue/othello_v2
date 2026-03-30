---
name: 'card-cost-adjustment-workflow'
description: 'カードの cost 数値変更を、catalog 再生成、tier 表示、CPU 参照、docs / tests、worker-public 同期まで漏れなく通すワークフロー。Use when changing existing card costs in cards/catalog.json, rebalancing one or more card costs, or verifying cost-tier and CPU fallout in this card-othello repository.'
argument-hint: 'どのカードの cost をいくつからいくつへ変えるか。tier 境界を跨ぐか、network/worker まで確認するかも書く'
---

# Card Cost Adjustment Workflow

このスキルは、既存カードの cost 数値変更を、catalog 再生成、tier 表示、CPU 評価、docs / tests、worker-public 同期まで漏れなく通す手順です。

## When to Use

- 既存カードの `cost` だけを変更する時
- 効果や pending target は変えず、バランス調整だけしたい時
- cost 境界を跨いで UI の色や CPU 判断が変わりうる時

## Do Not Use

- カード追加 / 削除 / 効果変更 / cardId 変更は `card-effect-integration-workflow`
- 多数カードの大規模再設計や方針文書化は `design-plan-runbook-authoring-workflow`

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- `.github/instructions/cards.instructions.md`
- 触る領域に応じて `game`, `ui`, `docs`, `workers` の instruction

## Primary Files

- `cards/catalog.json`
- `cards/catalog.js`
- `cards/catalog.generated.js`
- `shared-constants.js`
- `game/logic/cards/costs.js`, `game/logic/cards.js`
- `game/cpu-decision.js`, `game/ai/cpu-policy-core.js`, `game/turn-handlers/pending-target-selector.js`
- `ui/animation-utils.js`, `ui/deck-builder-renderer.js`, `ui/deck-builder-controller.js`
- `cards/card-renderer.js`, `cards/card-interaction.js`
- `styles-cards.css`
- `docs/Card_Strategy_Full_Catalog.md`
- `scripts/prepare-worker-assets.js`, `worker-public/*` は mirror のみ

## Common Traps

- `cards/catalog.json` ではなく generated 面や `worker-public/` を先に直してしまうこと
- `npm run generate:catalog` を忘れて `cards/catalog.js` と `cards/catalog.generated.js` が古いままになること
- 境界値 `0 / 1 / 6 / 11 / 16 / 21 / 31` を跨いだのに tier 表示を見ないこと
- 仕様文言の色と内部 class 名を混同すること
  - 6〜10 は rulebook 上は「緑」だが CSS class は `cost-tier-red`
  - 31+ は rulebook 上は「黒」だが class は `cost-tier-special`
- `cardCost >= 20` や `recoveryCostGap` の閾値を見ずに CPU 影響を見落とすこと
- `docs/Card_Strategy_Full_Catalog.md` やテストのハードコード cost を放置すること
- dirty tree のまま `npm run worker:prepare` を流して mirror 差分を雑に混ぜること

## Procedure

1. 変更が cost 数値だけか確認する。効果・対象選択・cardId まで触るなら別 workflow へ切り替える。
2. 外から見える仕様文書や一覧を変える必要があるか先に決める。公開仕様の変更なら `01-rulebook.md` を先に更新する。
3. `cards/catalog.json` を正本として更新し、対象カードの `cardId`, 日本語名, 旧 cost を検索して波及面を洗う。
4. `npm run generate:catalog` を実行し、`cards/catalog.js` と `cards/catalog.generated.js` を揃える。
5. tier 境界を跨いだ時は `ui/animation-utils.js`, `cards/card-renderer.js`, `cards/card-interaction.js`, `ui/deck-builder-renderer.js`, `styles-cards.css` を確認し、数値と色が一致するかを見る。
6. CPU / game 側は `game/logic/cards/costs.js`, `game/cpu-decision.js`, `game/ai/cpu-policy-core.js`, `game/turn-handlers/pending-target-selector.js` を見て、閾値や score への波及を確認する。
7. docs / tests / deck / help に旧 cost の説明や期待値が残っていれば同タスクで更新する。
8. network / worker deploy 面まで影響を出す時だけ root から `npm run worker:prepare` を実行し、mirror を同期する。
9. 最後に `cardId`, 日本語名, 旧 cost, 新 cost, `cost-tier-` で残り参照を見直す。

## Validation Bundle

- `npm run generate:catalog`
- 必要なら `npm run worker:prepare`
- 近いテスト候補
  - `npm run test:jest -- --runTestsByPath test/ui.animation-utils.hand-fallback.test.js`
  - `npm run test:jest -- --runTestsByPath test/cpu.decision.refactor.test.js test/game.cpu-policy-core.test.js test/game.pending-target-selector.test.js`
- tier 境界を跨いだ時は deck builder / hand / card detail で badge と card face を目視確認
- 旧 cost を前提にした docs / tests の残り参照検索

## Completion Checklist

- `cards/catalog.json` の cost を更新した
- `npm run generate:catalog` を実行した
- tier 境界跨ぎの有無を確認した
- CPU 閾値影響の有無を確認した
- docs / tests / rules help / deck の残り参照を確認した
- `npm run worker:prepare` の要否を判断し、実行したなら報告した
- `01-rulebook.md` を更新したか、不要ならその理由を報告した
- 変更報告に `cardId`, `旧 cost -> 新 cost`, tier 変化有無, 実行コマンド, テスト結果を含めた