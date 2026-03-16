---
name: 'story-tutorial-workflow'
description: 'チュートリアルとストーリーモードを、この repo の重複配置と overlay 罠を踏まえて安全に直すワークフロー。Use when editing ui/tutorial, ui/story, ui/handlers/story.js, ui/handlers/tutorial.js, story progression, tutorial dialogue flow, unlock conditions, or related story/tutorial tests in this card-othello repository.'
argument-hint: 'story / tutorial のどこを直したいか。overlay, progression, dialogue, unlock なども書く'
---

# Story Tutorial Workflow

このスキルは、tutorial と story の進行、overlay、unlock 条件、共有 handler の噛み合わせを安全に直す時の手順です。

## When to Use

- tutorial の会話や進行条件が崩れている時
- story の encounter や unlock 条件を直したい時
- 閉じた overlay がクリックを奪うなど UI 罠が出ている時
- root と `worker-public/` の二重配置が関わる時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `ui/tutorial/*`
- `ui/story/*`
- `ui/handlers/tutorial.js`, `ui/handlers/story.js`
- 関連 test: `test/ui.story-encounter.test.js`, `test/ui.story-steps.test.js`, `test/ui.story-battle-ui.test.js`, `test/ui.tutorial-handler.test.js`

## Common Traps

- 閉じた overlay が click を奪う状態を残すこと
- story と tutorial の共有 handler 変更で片側だけ回帰させること
- 進行状態や unlock 条件の保存を UI だけでずらすこと
- root と `worker-public/` のどちらが正本か曖昧なまま直すこと

## Procedure

1. 不具合が tutorial、story、overlay、progression のどこにあるかを分ける。
2. root 側の正本 file を先に決め、mirror は最後に扱う。
3. dialogue flow、unlock 条件、overlay 表示状態を別責務として整理する。
4. click block や shared handler の副作用を、実際の進行順に沿って確認する。
5. UI test と代表シナリオで progression を確認する。

## Validation Bundle

- `test/ui.story-encounter.test.js`
- `test/ui.story-steps.test.js`
- `test/ui.story-battle-ui.test.js`
- `test/ui.tutorial-handler.test.js`

## Completion Checklist

- overlay 罠と progression の責務を分けて直している
- story と tutorial の共有影響を確認している
- 実行した UI test と root / mirror の扱いを報告している
- `01-rulebook.md` 更新有無を報告している
