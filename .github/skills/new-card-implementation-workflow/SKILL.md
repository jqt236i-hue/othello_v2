---
name: 'new-card-implementation-workflow'
description: '新カード実装を、既存 type 再利用か新 type 追加かの分岐から、catalog 生成、effect, pending target / deferred publish, CPU, presentation, docs / tests, worker-public 同期まで漏れなく通すワークフロー。Use when implementing one or more brand-new cards in this card-othello repository.'
argument-hint: '追加するカードの id, type, cost, desc と、既存 type 再利用か新 type 追加か、pending target の有無、CPU と演出まで触るかを書いてください'
---

# New Card Implementation Workflow

このスキルは、新カードの実装を、仕様確認、type 分岐、catalog 追加、effect 実装、CPU / presentation / docs / tests / mirror 同期まで漏れなく通す手順です。

## When to Use

- 新しいカードを 1 枚以上追加する時
- 既存 type を再利用するか、新しい type を増やすかを判断したい時
- pending target、CPU、presentation まで含めて新カードを end-to-end で通したい時

## Do Not Use

- 既存カードの cost 数値変更だけなら `card-cost-adjustment-workflow`
- 既存カードの削除や局所仕様変更なら `card-effect-integration-workflow`
- 段階的な大規模再設計や計画書作成なら `design-plan-runbook-authoring-workflow`

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- `.github/instructions/cards.instructions.md`
- `.github/instructions/game.instructions.md`
- `.github/instructions/ui.instructions.md`
- worker / docs / shared を触る時は対応する instruction

## Decision Gates

1. 新カードは既存 type の亜種か、新しい type か
2. 選択式カードか。pending target ranking が必要か
3. 新しい visual dispatch や特殊石表示が必要か
4. rules help / card detail の個別文言が必要か
5. deck / worker deploy まで同タスクで通す必要があるか

## Primary Files

- `cards/catalog.json`
- `cards/catalog.js`
- `cards/catalog.generated.js`
- `game/card-effects/*`
- `game/logic/cards.ts`（`.js` は互換 shim）, `game/logic/cards-internal/*`
- `game/turn-handlers/pending-target-selector.ts / .js shim`
- `game/cpu-decision.ts / .js shim`, `game/cpu-turn-handler.ts / .js shim`, `game/ai/cpu-policy-core.ts / .js shim`
- `ui/presentation-handler.ts / .js shim`, `ui/stone-visuals.js`, `game/visual-effects-map.js`
- `cards/card-interaction-effects.ts / .js shim`, `ui/handlers/rules-help.ts / .js shim`
- `shared/deck-spec.ts / .js shim`
- `index.html`, `test/index.card-module-scripts.test.js`
- `test/cards.catalog.test.js`, `test/cards.generate.test.js`, `test/selfplay.runner.test.js`
- `scripts/prepare-worker-assets.ts / .js shim`, `worker-public/*` は mirror のみ

## Common Traps

- `cards/catalog.json` ではなく generated 面や `worker-public/` を先に直してしまうこと
- `cards/` に効果解決や state mutation を持ち込むこと
- 既存 type 再利用で済むのに新 type を増やして分岐を肥大化させること
- 新 type を増やしたのに pending target、CPU、presentation のどこかを追っていないこと
- `npm run generate:catalog` を忘れて browser と headless で card 定義がずれること
- 新しい classic-script ファイルを足したのに `index.html` の読み込み順と `test/index.card-module-scripts.test.js` を見ていないこと
- selection / deferred publish カードなのに `pending-selection-flow-workflow` と切り離して contract 差分を作ること
- `cards/card-interaction-effects.ts / .js shim` の quick / detail 文言を放置し、card detail が catalog の先頭文 fallback だけになること
- dirty tree のまま `npm run worker:prepare` を流して mirror 差分を雑に混ぜること

## Procedure

1. まず `01-rulebook.md` で外から見える仕様を確定し、既存 type 再利用か新 type 追加かを分類する。
2. 新カードの `id`, `type`, `cost`, `desc_ja`, `display_type_ja`, `enabled` を `cards/catalog.json` に追加する。
3. `npm run generate:catalog` を実行し、`cards/catalog.js` と `cards/catalog.generated.js` を揃える。
4. 既存 type 再利用なら、既存 handler と UI 文言で足りるか確認する。足りなければ個別文言と tests を追加する。
5. 新 type なら `game/card-effects/*` と必要な `game/logic/cards.ts`（`.js` は互換 shim） / `game/logic/cards-internal/*` に効果解決を実装する。`game/` に UI 依存は持ち込まない。
6. 選択式カードや deferred publish が絡むカードなら `game/turn-handlers/pending-target-selector.ts / .js shim` と関連 pending state を更新し、CPU 自動選択の ranking を決める。selection contract が増える時は `pending-selection-flow-workflow` も併用する。
7. CPU が使うカードなら `game/cpu-decision.ts / .js shim` と必要に応じて `game/ai/cpu-policy-core.ts / .js shim` を更新し、使用タイミングと fallback を決める。
8. 新 visual や特殊石表示があるなら `ui/presentation-handler.ts / .js shim`, `ui/stone-visuals.js`, `game/visual-effects-map.js` を確認し、Single Visual Writer を崩さずに接続する。
9. カード詳細や図鑑に個別説明が必要なら `cards/card-interaction-effects.ts / .js shim` と `ui/handlers/rules-help.ts / .js shim` を更新する。
10. 新しい classic-script ファイルを追加した場合だけ `index.html` の load order を更新し、`test/index.card-module-scripts.test.js` で順序を確認する。
11. `cardId`, `type`, 表示名で残り参照を検索し、docs / tests / deck まで漏れがないことを確認する。
12. deploy 面まで触る時だけ root を正本として `npm run worker:prepare` を実行し、mirror を同期する。

## Validation Bundle

- `npm run generate:catalog`
- `npm run test:jest -- --runTestsByPath test/cards.catalog.test.js test/cards.generate.test.js`
- 新 type や内部 helper を触った時の近いテスト
  - `npm run test:jest -- --runTestsByPath test/game.cards.effect-timing-module.test.js test/game.cards.pending-state-manager-module.test.js`
- pending target や deferred publish を触った時
  - `npm run test:jest -- --runTestsByPath test/game.pending-target-selector.test.js test/game.pending-selection-flow.test.js test/cpu.turn-handler.pending.test.js`
- CPU を触った時
  - `npm run test:jest -- --runTestsByPath test/cpu.decision.refactor.test.js test/game.cpu-policy-core.test.js`
- classic-script 順を触った時
  - `npm run test:jest -- --runTestsByPath test/index.card-module-scripts.test.js test/code.window-usage.test.js`
- pending target や card flow を触った時
  - `npm run test:jest -- --runTestsByPath test/selfplay.runner.test.js`
- 必要なら `npm run worker:prepare`

## Completion Checklist

- 新カード定義を `cards/catalog.json` に追加した
- `npm run generate:catalog` を実行した
- 既存 type 再利用か新 type 追加かを明示した
- pending target / deferred publish, CPU, presentation, card detail の要否を判断した
- 新しい script / helper を足した時は load order と tests を確認した
- `cardId`, `type`, 表示名の残り参照を確認した
- `npm run worker:prepare` の要否を判断し、実行したなら報告した
- `01-rulebook.md` を更新したか、不要ならその理由を報告した
- 変更報告にカード名, `cardId`, type, 実行コマンド, 実行テスト, 未対応の残課題を含めた
