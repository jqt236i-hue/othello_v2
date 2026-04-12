---
name: 'card-effect-integration-workflow'
description: '既存カードの削除、既存定義の仕様変更、関連統合作業を、catalog 生成から logic, pending target, CPU, presentation, worker-public 同期まで漏れなく通すワークフロー。Use when removing cards, editing existing card definitions, reconciling pending target / CPU / presentation fallout, or updating related card integration tests in this card-othello repository.'
argument-hint: 'どの既存カードをどう変えたいか。削除, 仕様変更, pending target, CPU, presentation のどこまで触るかも書く'
---

# Card Effect Integration Workflow

このスキルは、既存カードの削除や仕様変更を、catalog から logic、pending target、CPU、presentation、docs / tests、mirror 同期まで漏れなく通す手順です。

## When to Use

- 既存カードを削除する、または cardId / type / 表示名を変更する時
- 既存カード効果や対象選択の仕様を変える時
- cards 側の見た目だけでなく、CPU や presentation まで影響する時
- catalog / logic / pending target / CPU / presentation の統合作業を同じタスクでそろえたい時

## Do Not Use

- brand-new cards の新規実装は `new-card-implementation-workflow`
- 既存カードの cost 数値変更だけなら `card-cost-adjustment-workflow`
- pending selection 契約や deferred publish の修正が主目的なら `pending-selection-flow-workflow`

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `cards/catalog.json`
- `cards/catalog.js`
- `cards/catalog.generated.js`
- `game/logic/cards.js`, `game/logic/cards-internal/*`, `game/card-effects/*`
- `game/cpu-decision.js` と関連 CPU helper
- `ui/handlers/rules-help.js`, presentation / pending target 周り, `shared/deck-spec.js`, `shared/story-deck-spec.js`

## Common Traps

- `cards/catalog.json` だけ直して generated 面や helper 面を放置すること
- 効果解決ロジックを `cards/` に持ち込むこと
- pending target、CPU、presentation のどれかを更新し忘れること
- カード削除後の参照を deck / rules help / docs / test に残すこと

## Procedure

1. 削除、改名、仕様変更のどれかを先に分類し、外から見える仕様変更なら `01-rulebook.md` を先に更新する。
2. `cards/catalog.json` を正本として直し、必要な helper 面と generated 面をそろえる。
3. 効果解決、pending target、進行処理は `game/` 側へ寄せ、`cards/` には UI とカタログだけを残す。
4. CPU の判断、presentation、rules help、deck spec への波及を同じタスク内で追う。pending selection 契約や deferred publish が主戦場なら `pending-selection-flow-workflow` も併用する。
5. 削除や改名では `cardId`, `type`, 表示名で残り参照を全文検索する。
6. 公開面まで影響するなら root を直してから `worker-public/` を同期する。

## Validation Bundle

- `npm run generate:catalog`
- 近い card / effect / pending target / CPU / presentation test
- `cardId`, `type`, 表示名の残り参照検索
- 必要時だけ `npm run worker:prepare`

## Completion Checklist

- `cards/catalog.json`, `cards/catalog.js`, `cards/catalog.generated.js` がそろっている
- logic, pending target, CPU, presentation の波及面を確認している
- 削除 / 改名の残り参照がない
- 実行した生成 / test / search と `01-rulebook.md` 更新有無を報告した
