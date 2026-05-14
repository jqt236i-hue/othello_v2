---
name: 'card-removal-workflow'
description: 'カードを repo から安全かつ完全に削除するためのワークフロー。catalog 正本、generated catalog、logic、pending target、CPU、presentation、deck / rules help、docs / tests、worker-public mirror まで、残り参照ゼロを確認しながら通す。Use when permanently removing one or more existing cards from this card-othello repository.'
argument-hint: '削除したいカードの cardId / type / 表示名。複数枚なら列挙し、仕様も消すかどうかも書く'
---

# Card Removal Workflow

このスキルは、既存カードを「無効化」ではなく repo から完全に消したい時に、catalog・ロジック・UI・deck・docs・tests・mirror 同期まで漏れなく追うための削除専用ワークフローです。

## When to Use

- 既存カードを `enabled: false` ではなく完全削除したい時
- cardId / type / 表示名を含め、カードの存在を repo から消したい時
- カード削除後に default deck, custom deck, rules help, test, docs まで残骸ゼロにしたい時
- 1 枚だけでなく、複数カードをまとめて整理・廃止したい時

## Do Not Use

- 一時的に使えなくするだけなら catalog 側の `enabled: false` を検討する
- 既存カードの仕様変更や cost 調整だけが主目的なら、この削除用 workflow ではなく、その変更範囲に合う局所手順で進める
- brand-new cards の追加は対象外なので、この削除用 workflow に寄せない

## Read First

- `01-rulebook.md`
- `AGENTS.md`
- `cards/README.ai.md`
- 必要に応じて `SKILLS.md` と関連する `.opencode/skills/**/SKILL.md`

## Primary Files

- `cards/catalog.json`
- `cards/catalog.js`
- `cards/catalog.generated.js`
- `shared-constants.ts`
- `game/logic/cards.ts`, `game/logic/cards-internal/*`, `game/card-effects/*`
- `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`, `game/ai/*`
- `shared/deck-spec.ts`
- `ui/handlers/rules-help.ts` と関連 presentation / surface
- `docs/`, `test/`
- `scripts/prepare-worker-assets.ts`, `worker-public/*`

## Common Traps

- `cards/catalog.json` だけ消して `cards/catalog.js` / `cards/catalog.generated.js` を再生成しないこと
- `cardId` は消したが `type` や表示名の参照が rules help / docs / tests に残ること
- pending target / deferred publish / CPU target 選択の分岐だけ残ること
- deck spec 側に削除カードが残り、既存 deck の normalize が壊れること
- root を直さず `worker-public/` を直接触ること
- 削除なのに `enabled: false` のまま残し、実質的に抹消できていないこと

## Procedure

1. まず、そのカードを「無効化」で足りるのか「完全削除」なのかを固定する。完全削除なら `cardId`, `type`, 表示名の 3 軸を追う前提で始める。
2. 外から見える仕様やカード一覧が変わるなら、関連実装より先に `01-rulebook.md` を更新する。
3. `cards/catalog.json` を正本として対象カードを削除し、`npm run generate:catalog` で `cards/catalog.js` と `cards/catalog.generated.js` を再生成する。
4. `game/` 側の card effect, pending selection, turn progression, CPU 判断, presentation hook にそのカード専用分岐や `type` 判定が残っていないかを消す。
5. `shared/deck-spec.ts`, `ui/handlers/rules-help.ts`, `docs/`, `test/` を含め、`cardId`, `type`, 表示名で残り参照を全文検索し、削除または別カードへ置換する。
6. 削除によって generated / mirror / surface の公開面が変わるなら、root を直したあとでだけ `npm run worker:prepare` を実行して `worker-public/` をそろえる。
7. 削除後に関連 deck / rules help / card surface / effect test を回し、削除カード前提の fixture や期待値を修正する。
8. 最後に、同じ 3 軸検索をもう一度行い、意図した historical docs や audit メモを除いて実参照が残っていないことを確認する。

## Validation Bundle

- `npm run generate:catalog`
- `npm run typecheck`
- 変更範囲に近い card / effect / pending target / CPU / presentation / deck / rules help test
- `cardId`, `type`, 表示名の残り参照検索
- 公開面に影響がある時だけ `npm run worker:prepare`

## Completion Checklist

- `cards/catalog.json`, `cards/catalog.js`, `cards/catalog.generated.js` がそろっている
- logic, pending target, CPU, presentation の削除波及を確認している
- `shared/deck-spec.ts`, `ui/handlers/rules-help.ts`, `docs/`, `test/` の残り参照を確認している
- root 正本を更新してから必要な mirror 同期だけを行っている
- 実行した generate / test / search と `01-rulebook.md` 更新有無を報告できる
