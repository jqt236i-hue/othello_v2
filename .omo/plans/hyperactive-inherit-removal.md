# 多動の継承 (HYPERACTIVE_INHERIT_WILL) 完全削除

## TL;DR

> **Quick Summary**: カード「多動の継承」（HYPERACTIVE_INHERIT_WILL / hyperactive_inherit_01）を catalog・ロジック・CPU・UI・ストーリー・テスト・ドキュメント・mirror まで完全削除する。
>
> **Deliverables**:
> - 全 root 正本ファイルから cardId / type / 表示名の参照を削除
> - 専用エフェクトファイル削除、専用テストファイル削除、他テストファイルのフィクスチャ修正
> - ストーリーステップからの参照削除
> - catalog ファイル再生成、mirror 同期
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 複数 Wave

---

## Context

### Original Request
「多動の継承というカードを完全に削除したいです」

### Research Findings
**3軸grep 結果（root ソースのみ）**：

カタログ・定数:
- `cards/catalog.json`, `cards/catalog.ts`, `cards/catalog.js`, `cards/catalog.generated.js` — card ID: hyperactive_inherit_01
- `shared-constants.ts` — CARD_DEFS + 種類リスト
- `src/types/card.ts` — CardType union
- `cards/card-interaction.ts`, `cards/card-interaction-effects.js` — 表示テキスト

ゲームロジック:
- `game/card-effects/hyperactive-inherit.ts` — **専用エフェクトファイル**
- `game/logic/cards.ts` — ロジック参照
- `game/logic/cards/hyperactive.ts` — hyperactive モジュール（継承関連分岐）
- `game/cards/target-resolver.ts` — ターゲット解決
- `game/turn/turn_pipeline_phases.ts` — パイプライン
- `game/turn/turn_pipeline_phase_helpers.js` — パイプラインヘルパー
- `game/turn-handlers/pending-target-selector.js` — pending 選択
- `game/visual-effects-map.js` — 視覚効果
- `game/logic/cards-internal/hand-manager.ts`, `card-usage-prechecks.ts`, `pending-state-manager.ts`, `selector-orchestrator.ts` — 内部管理

CPU/AI:
- `game/ai/cpu-policy-core.ts` — 7箇所の参照
- `game/cpu-decision.ts` — 計画圧 + CPU判断ロジック
- `game/cpu-turn-handler.ts` — CPU ターン
- `docs/teacher-cpu-card-usage-buckets.md` — ドキュメント

UI/Story:
- `ui/animation-engine.ts` — アニメーション
- `ui/story/story-steps.ts` — **ストーリーステップ（多動の継承がストーリーに登場）**
- `public/module-registry.js` — モジュールレジストリ

ドキュメント:
- `01-rulebook.md` — セクション記述

テスト:
- `test/game.hyperactive-inherit-will.test.ts` — **専用テストファイル**
- `test/game.card-effects.hyperactive-inherit.test.ts` — カードエフェクトテスト
- `test/game.special-stone-bubble-rollout.test.ts` — フィクスチャ
- `test/ui.animation-engine.guard-timer.test.ts` — フィクスチャ
- `test/cards.numeric-effect-tags.test.ts` — フィクスチャ
- `test/selfplay.runner.test.ts` — フィクスチャ
- `test/game.move-generator.expansion-pending.test.ts` — フィクスチャ

---

## Work Objectives

### Core Objective
カード「多動の継承」をリポジトリから完全に抹消する。

### Concrete Deliverables
- 全 root ソースファイルの該当参照を削除
- `game/card-effects/hyperactive-inherit.ts` ファイル削除
- `test/game.hyperactive-inherit-will.test.ts` ファイル削除
- `test/game.card-effects.hyperactive-inherit.test.ts` ファイル削除
- catalog ファイル再生成、mirror 同期
- TypeScript 型チェック通過

### Must Have
- catalog・定数・型からの削除
- 専用エフェクトファイル (hyperactive-inherit.ts) の削除
- ストーリーステップからの参照削除
- テストファイル削除・修正
- 01-rulebook.md 更新

### Must NOT Have
- `enabled: false` で残さない
- `dist/` や `worker-public/` を直接触らない
- 無関係な掃除を混ぜない

---

## Verification Strategy

### QA Policy
- Wave ごとに `npm run typecheck` を実行
- 全タスク完了後に 3-axis grep で実参照ゼロ確認
- 最後に `npm run worker:prepare` で mirror 同期

---

## Execution Strategy

```
Wave 1 (カタログ・定数・型・ドキュメント):
├── Task 1: 01-rulebook.md — 多動の継承セクション削除
├── Task 2: cards/catalog.json — hyperactive_inherit_01 エントリ削除
├── Task 3: cards/catalog.ts — hyperactive_inherit_01 エントリ削除
├── Task 4: shared-constants.ts — CARD_DEFS + 種類リスト削除
├── Task 5: src/types/card.ts — CardType union から削除
├── Task 6: cards/card-interaction.ts + card-interaction-effects.js — 表示テキスト削除
├── Task 7: docs/teacher-cpu-card-usage-buckets.md — 行削除

Wave 2 (ゲームロジック — 専用エフェクト含む):
├── Task 8: game/card-effects/hyperactive-inherit.ts — ファイル削除
├── Task 9: game/cards/effects/hyperactive.ts — ファイル削除（applyHyperactiveInheritWill専用）
├── Task 10: game/logic/cards.ts — HYPERACTIVE_INHERIT_WILL + INHERITED_HYPERACTIVE 削除
├── Task 11: game/logic/cards/hyperactive.ts — 継承関連分岐削除（注意：他hyperactive型と共有）
├── Task 12: game/logic/cards/selectors.ts — getHyperactiveInheritTargets削除
├── Task 13: game/cards/target-resolver.ts — 参照削除
├── Task 14: game/turn/turn_pipeline_phases.ts — 分岐削除
├── Task 15: game/turn/turn_pipeline_phase_helpers.js — 分岐削除
├── Task 16: game/turn-handlers/pending-target-selector.js — 分岐削除
├── Task 17: game/visual-effects-map.js — 参照削除
├── Task 18: game/network-turn-handoff.js — 'INHERITED_HYPERACTIVE'削除
├── Task 19: game/logic/cards-internal/hand-manager.ts — 型判定削除
├── Task 20: game/logic/cards-internal/card-usage-prechecks.ts — 型判定削除
├── Task 21: game/logic/cards-internal/pending-state-manager.ts — 型判定削除
├── Task 22: game/logic/cards-internal/selector-orchestrator.ts — 型判定削除
├── Task 23: game/logic/cards-internal/presentation-helpers.ts — INHERITED_HYPERACTIVE 削除

Wave 3 (CPU/AI + UI + Story + CSS):
├── Task 24: game/ai/cpu-policy-core.ts — 全 HYPERACTIVE_INHERIT_WILL 削除
├── Task 25: game/cpu-decision.ts — 計画圧 + CPU判断ロジック削除
├── Task 26: game/cpu-turn-handler.ts — 参照削除
├── Task 27: ui/animation-engine.ts — アニメーション分岐削除
├── Task 28: ui/board-renderer.ts — INHERITED_HYPERACTIVE レンダリング削除
├── Task 29: ui/diff-renderer.ts — INHERITED_HYPERACTIVE 参照削除
├── Task 30: ui/story/story-steps.ts — ストーリー参照削除
├── Task 31: public/module-registry.js — エントリ削除
├── Task 32: entry-browser.js + entry-browser-augmented.js — hyperactive-inherit require削除
├── Task 33: styles-board.css — .inherited-hyperactive-timer ルール削除

Wave 4 (テスト):
├── Task 34: test/game.hyperactive-inherit-will.test.ts — ファイル削除
├── Task 35: test/game.card-effects.hyperactive-inherit.test.ts — ファイル削除
├── Task 36: test/ui.animation-engine.inherited-hyperactive-timer.test.ts — ファイル削除
├── Task 37: test/game.special-stone-bubble-rollout.test.ts — フィクスチャ削除
├── Task 38: test/ui.animation-engine.guard-timer.test.ts — フィクスチャ削除
├── Task 39: test/cards.numeric-effect-tags.test.ts — フィクスチャ削除
├── Task 40: test/selfplay.runner.test.ts — フィクスチャ削除
├── Task 41: test/game.move-generator.expansion-pending.test.ts — フィクスチャ削除
├── Task 42: test/game.pipeline-ui-adapter.sound-cue.test.ts — フィクスチャ削除
├── Task 43: test/index.card-module-scripts.test.ts — hyperactive-inheritエントリ削除
├── Task 44: test/ui.stone-timer-position.test.ts — .inherited-hyperactive-timer断言削除
├── Task 45: test/ui.stone-rendering.test.ts — INHERITED_HYPERACTIVEテスト削除
├── Task 46: test/ui.network-snapshot.hyperactive-source-empty.test.ts — INHERITED_HYPERACTIVEテスト削除
├── Task 47: test/ui.long-press-info.test.ts — INHERITED_HYPERACTIVEテスト削除

Wave FINAL (ビルド＋検証):
├── Task F1: npm run build:ts 実行（dist/ 再生成）
├── Task F2: npm run typecheck 実行
├── Task F3: npm run generate:catalog 実行
├── Task F4: npm run worker:prepare 実行（mirror 同期）
├── Task F5: 3軸grepで実参照ゼロ確認
├── Task F6: CSS orphan check (rg 'inherited-hyperactive' *.css → 0件)
├── Task F7: entry-browser orphan check (rg 'hyperactive-inherit' entry-browser*.js → 0件)
├── Task F8: git status + 完了報告
```

---

## TODOs

### Wave 1 — カタログ・定数・型・ドキュメント

- [x] 1. `01-rulebook.md` — HYPERACTIVE_INHERIT_WILL セクション削除（該当セクション＋番号振り直し）

- [x] 2. `cards/catalog.json` — `hyperactive_inherit_01` エントリ削除

- [x] 3. `cards/catalog.ts` — `hyperactive_inherit_01` エントリ削除

- [x] 4. `shared-constants.ts` — CARD_DEFS + 種類リストから HYPERACTIVE_INHERIT_WILL 削除

- [x] 5. `src/types/card.ts` — CardType union から `'HYPERACTIVE_INHERIT_WILL'` 削除

- [x] 6. `cards/card-interaction.ts` + `cards/card-interaction-effects.js` — 表示テキスト削除

- [x] 7. `docs/teacher-cpu-card-usage-buckets.md` — 該当行削除

### Wave 2 — ゲームロジック

- [x] 8. `game/card-effects/hyperactive-inherit.ts` — ファイル削除（git rm）

- [x] 9. `game/logic/cards.ts` — HYPERACTIVE_INHERIT_WILL 関連ロジック削除

- [x] 10. `game/logic/cards/hyperactive.ts` — 継承関連分岐削除

- [x] 11. `game/cards/target-resolver.ts` — 参照削除

- [x] 12. `game/turn/turn_pipeline_phases.ts` — 分岐削除

- [x] 13. `game/turn/turn_pipeline_phase_helpers.js` — 分岐削除

- [x] 14. `game/turn-handlers/pending-target-selector.js` — 分岐削除

- [x] 15. `game/visual-effects-map.js` — 参照削除

- [x] 16. `game/logic/cards-internal/hand-manager.ts` — 型判定削除

- [x] 17. `game/logic/cards-internal/card-usage-prechecks.ts` — 型判定削除

- [x] 18. `game/logic/cards-internal/pending-state-manager.ts` — 型判定削除

- [x] 19. `game/logic/cards-internal/selector-orchestrator.ts` — 型判定削除

### Wave 3 — CPU/AI + UI + Story

- [x] 20. `game/ai/cpu-policy-core.ts` — 全 HYPERACTIVE_INHERIT_WILL 削除

- [x] 21. `game/cpu-decision.ts` — 計画圧プロファイル + CPU判断ロジック削除

- [x] 22. `game/cpu-turn-handler.ts` — 参照削除

- [x] 23. `ui/animation-engine.ts` — アニメーション分岐削除

- [x] 24. `ui/story/story-steps.ts` — ストーリー参照を別カードに置換または削除

- [x] 25. `public/module-registry.js` — エントリ削除

### Wave 4 — テスト

- [x] 26. `test/game.hyperactive-inherit-will.test.ts` — ファイル削除

- [x] 27. `test/game.card-effects.hyperactive-inherit.test.ts` — ファイル削除

- [x] 28. `test/game.special-stone-bubble-rollout.test.ts` — フィクスチャ削除

- [x] 29. `test/ui.animation-engine.guard-timer.test.ts` — フィクスチャ削除

- [x] 30. `test/cards.numeric-effect-tags.test.ts` — フィクスチャ削除

- [x] 31. `test/selfplay.runner.test.ts` — フィクスチャ削除

- [x] 32. `test/game.move-generator.expansion-pending.test.ts` — フィクスチャ削除

### Wave FINAL — ビルド＋検証

- [x] F1. **npm run build:ts** — dist/ 再生成
- [x] F2. **npm run typecheck** — 型チェック
- [x] F3. **npm run generate:catalog** — catalog 再生成
- [x] F4. **npm run worker:prepare** — mirror 同期
- [x] F5. **3軸grepで実参照ゼロ確認**
- [x] F6. **git status + 完了報告**

---

## Final Checklist
- [x] 01-rulebook.md 更新
- [x] cards/catalog.{json,ts,js,generated.js} からエントリ削除
- [x] shared-constants.ts から削除
- [x] src/types/card.ts から削除
- [x] cards/card-interaction.ts + effects.js から削除
- [x] game/card-effects/hyperactive-inherit.ts 削除
- [x] game/logic/cards.ts からロジック削除
- [x] game/logic/cards/hyperactive.ts から分岐削除
- [x] game/cards/target-resolver.ts から削除
- [x] game/turn/turn_pipeline_phases.ts から分岐削除
- [x] game/turn/turn_pipeline_phase_helpers.js から分岐削除
- [x] game/turn-handlers/pending-target-selector.js から分岐削除
- [x] game/visual-effects-map.js から参照削除
- [x] game/logic/cards-internal/ (5ファイル) から削除
- [x] game/ai/cpu-policy-core.ts から11参照削除
- [x] game/cpu-decision.ts から削除
- [x] game/cpu-turn-handler.ts から削除
- [x] ui/animation-engine.ts + board-renderer.ts + diff-renderer.ts から削除
- [x] ui/story/story-steps.ts から削除
- [x] public/module-registry.js から削除
- [x] docs/teacher-cpu-card-usage-buckets.md 更新
- [x] 3つの専用テストファイル削除
- [x] 14テストファイルのフィクスチャ修正
- [x] npm run typecheck 通過
- [x] npm run worker:prepare 成功
- [x] 3軸grepで実参照ゼロ確認
