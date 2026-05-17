---
name: 'deck-builder-authoring-workflow'
description: 'deck builder の authoring UI を、spec/codec と state/renderer/controller の責務を守って安全に直すワークフロー。Use when editing shared/deck-spec.ts / .js shim, shared/deck-codec.ts / .js shim, ui/deck-builder-*.js, ui/handlers/deck-builder.ts / .js shim, or related deck builder tests in this card-othello repository.'
argument-hint: 'deck builder のどこを直したいか。spec, codec, state, renderer, controller のどこかも書く'
---

# Deck Builder Authoring Workflow

このスキルは、deck builder の authoring UI を、spec / codec / state / renderer / controller の責務を保ったまま直す時の手順です。

## When to Use

- deck builder の構築制約、表示順、操作感を直したい時
- `deckCode` の encode / decode を変える時
- spec と UI の責務が混ざって崩れている時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `shared/deck-spec.ts / .js shim`
- `shared/deck-codec.ts / .js shim`
- `ui/deck-builder-*.js`, `ui/handlers/deck-builder.ts / .js shim`
- 関連 help / docs / tests

## Common Traps

- spec や codec の責務を renderer 側だけで吸収すること
- scroll, selection, focus の UI 状態を無秩序に分散させること
- 構築制約や表示順の変更を help / docs / test に反映し忘れること

## Procedure

1. まず `shared/deck-spec.ts / .js shim`, `shared/deck-codec.ts / .js shim` で仕様と保存形式を固定する。
2. その後で state、renderer、controller の順に責務を守って UI を直す。
3. 構築制約や表示順は spec / codec 側の契約として先に決め、renderer 側に埋め込まない。
4. help, docs, test の波及を最後にまとめて確認する。

## Validation Bundle

- `test/shared.deck-codec.test.js`
- `test/ui.deck-builder-controller.test.js`

## Completion Checklist

- spec / codec / state / renderer / controller の責務が崩れていない
- 関連 test / round-trip 確認を報告している
- `01-rulebook.md` 更新有無を報告している
