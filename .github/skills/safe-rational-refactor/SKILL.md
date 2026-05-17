---
name: 'safe-rational-refactor'
description: '安全に、合理的に、局所的な責務整理を公開契約と責務境界を保ちながら進めるためのワークフロー。Use when refactoring existing code, extracting helpers, splitting files, deduplicating logic, reducing complexity, preserving behavior, fixing root cause, and validating targeted tests in this card-othello repository.'
argument-hint: 'どこを、何のために安全に整理したいか'
---

# Safe Rational Refactor

このスキルは、既存挙動と公開契約をできるだけ保ちながら、局所的な責務整理、重複解消、helper 抽出を、責務境界と単一ソースを明確にする方向で進める時の標準手順です。構造問題を段階的に置き換える構造変更そのものには使いません。

## When to Use

- 巨大関数や巨大ファイルを分割したい時
- 重複ロジックを共通化したい時
- バグ修正を伴う構造整理を root cause から進めたい時
- 公開入口を保ったまま内部だけを整理したい時
- 構造変更ではなく、責務境界内の整理として閉じられる時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- 今回触る module とその公開入口
- 関連 test
- 必要なら `shared-constants.ts`（`.js` は互換 shim）, 正規化 helper, DI 入口ファイル

## Common Traps

- リファクタと機能変更を同じ差分で混ぜること
- 境界 (`game/`, `ui/`, `cpu/`) をまたいで責務を崩すこと
- 共通化のつもりで別の重複 helper を増やすこと
- fallback や silent ignore で不具合を見えなくすること
- 構造変更が必要なのに、このスキルで場当たり整理に寄せてしまうこと

## Procedure

1. まず、今回が責務境界内の整理で十分か、master plan を先に切るべき構造変更かを分類する。
2. 局所整理として成立するなら、変えてはいけない公開契約、単一ソース、非目標を固定する。
3. 依存経路、定数、正規化地点、関連 test を先に把握する。
4. 再発要因を減らし、責務境界が明確になる extract / split / dedupe から進める。必要なまとめ変更は避けない。
5. 挙動変更が入るなら `01-rulebook.md` を先に更新し、ただの整理と混ぜない。
6. 入れたリスクだけを targeted test で確認する。

## Validation Bundle

- 最小の関連 test から先に回す
- 必要なら `npm run test:jest:changed` や targeted `jest` を使う
- language diagnostics や残り参照検索で補完する

## Completion Checklist

- 公開契約を不用意に変えていない
- 境界と単一ソースを崩していない
- 実行した test / check を報告している
- `01-rulebook.md` 更新有無を報告している
- 構造変更が必要な案件を無理にこのスキルへ押し込んでいない
