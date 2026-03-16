---
name: 'design-plan-runbook-authoring-workflow'
description: '設計書、計画書、実行手順書を、この repo の docs 命名規約と phase/完了条件/検証束の書き方に合わせて作るワークフロー。Use when drafting docs/*-plan*.md, *-runbook*.md, implementation plans, phased migration docs, bug eradication runbooks, or other design/plan/runbook documents in this card-othello repository.'
argument-hint: 'どの文書を作るか。design, plan, runbook のどれかと、対象領域を書く'
---

# Design Plan Runbook Authoring Workflow

このスキルは、design / plan / runbook 文書を、この repo の docs 命名規約と phase / 完了条件 / 検証束の型に合わせて作る時の手順です。

## When to Use

- `docs/*-plan*.md` や `*-runbook*.md` を新規作成する時
- 広い変更を phase 分けした実装計画にしたい時
- バグ撲滅用 runbook や移行計画をまとめたい時
- 単なるメモではなく、次の実行者がそのまま動ける文書が必要な時
- 構造問題や再発不具合に対し、局所 patch ではなく段階的な大幅改革を許可したい時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `docs/*.md` の対象文書
- 根拠になる実装ファイルや test
- 仕様変更がある時だけ `01-rulebook.md`
- 関連 runbook / plan / report の既存文書

## Common Traps

- plan, runbook, report の役割を混ぜること
- 未検証の推測を verified fact のように書くこと
- phase ごとの完了条件や検証束を書かないこと
- 単なる TODO 置き場になり、次の実行者が動けない文書にすること
- 構造問題なのに「最小変更だから」で局所延命に寄せてしまうこと

## Procedure

1. まず文書タイプを design, plan, runbook のどれにするかを決める。
2. 対象、位置づけ、一次情報、非目標、検証済み事実を先に固定する。
3. 局所修正ではなく段階的置換を選ぶ理由があるなら、その判断を最初に明文化する。
4. phase 単位で目的、作業、主対象、完了条件を並べる。
5. 検証束と完了条件を先に決め、後ろに追いやらない。
6. 仕様変更が必要な場合だけ `01-rulebook.md` との関係を明示する。

## Validation Bundle

- 文書名と中身が design / plan / runbook の役割に合っている
- 主張が根拠ファイルと矛盾していない
- phase ごとの完了条件と検証束がある
- 仕様変更を文書外に隠していない

## Completion Checklist

- 文書の位置づけと非目標が明確になっている
- 次の実行者がそのまま動ける粒度になっている
- 検証束と完了条件を含めている
- `01-rulebook.md` 更新有無を報告している
- 大幅改革を許可する理由と置換境界が明確になっている
