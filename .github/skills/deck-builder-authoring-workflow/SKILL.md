---
name: 'deck-builder-authoring-workflow'
description: 'deck builder と story-deck-lab の authoring UI を、spec/codec と state/renderer/controller の責務を守って安全に直すワークフロー。Use when editing shared/deck-spec.js, shared/deck-codec.js, ui/deck-builder-*.js, ui/story-deck-lab/*, story-deck-lab.html, or related deck builder tests in this card-othello repository.'
argument-hint: 'deck builder と story-deck-lab のどこを直したいか。spec, codec, state, renderer, controller のどこかも書く'
---

# Deck Builder Authoring Workflow

このスキルは、deck builder と story-deck-lab の authoring UI を、spec / codec / state / renderer / controller の責務を保ったまま直す時の手順です。

## When to Use

- deck builder の構築制約、表示順、操作感を直したい時
- `deckCode` や `storyDeckCode` の encode / decode を変える時
- story-deck-lab の authoring UI や保存形式を直す時
- spec と UI の責務が混ざって崩れている時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `shared/deck-spec.js`
- `shared/deck-codec.js`
- `ui/deck-builder-*.js`
- `ui/story-deck-lab/*` と `story-deck-lab.html`
- 関連 help / docs / tests

## Common Traps

- 通常対局の `deckCode` と story 用の `storyDeckCode` を混同すること
- spec や codec の責務を renderer 側だけで吸収すること
- scroll, selection, focus の UI 状態を無秩序に分散させること
- 構築制約や表示順の変更を help / docs / test に反映し忘れること

## Procedure

1. 変更対象が通常 deck builder か story-deck-lab かを先に分ける。
2. まず `shared/deck-spec.js` と `shared/deck-codec.js` で仕様と保存形式を固定する。
3. その後で state、renderer、controller の順に責務を守って UI を直す。
4. 通常の `deckCode` と story 用の `storyDeckCode` は混ぜず、外部契約を分けたまま扱う。
5. help, docs, test の波及を最後にまとめて確認する。

## Validation Bundle

- 近い deck spec / codec test
- 近い deck builder / story-deck-lab UI test
- encode / decode の round-trip 確認
- 必要なら deck builder 実画面での代表操作確認

## Completion Checklist

- spec / codec / state / renderer / controller の責務が崩れていない
- `deckCode` と `storyDeckCode` を混同していない
- 関連 test / round-trip 確認を報告している
- `01-rulebook.md` 更新有無を報告している
