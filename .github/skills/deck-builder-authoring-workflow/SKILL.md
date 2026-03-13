---
name: deck-builder-authoring-workflow
description: 'deck builder と story-deck-lab の authoring UI を、spec/codec と state/renderer/controller の責務を守って安全に直すワークフロー。Use when editing shared/deck-spec.js, shared/deck-codec.js, ui/deck-builder-*.js, ui/story-deck-lab/*, story-deck-lab.html, or related deck builder tests in this card-othello repository.'
argument-hint: 'deck builder のどこを直したいか。spec, codec, state, renderer, controller, story-deck-lab のどれかも書く'
---

# Deck Builder Authoring Workflow

このスキルは、このリポジトリで deck builder と story-deck-lab の authoring UI を安全に直すための実務手順です。

## When to Use

- deck builder の候補クリック後に viewport がずれる
- spec / codec と UI state の整合が崩れる
- story-deck-lab の表示や保存が壊れる
- preset 切り替えや rerender で notice や selected area が崩れる
- shared deck の形式変更が room 側や page test に波及する

## Default Stance

- まず `shared/deck-spec.js` と `shared/deck-codec.js` を正本として確認する
- UI は state / renderer / controller / handler の責務を崩さない
- scroll 保持は body 全体ではなく、クリックした card の位置を基準に扱う
- 通常は root 側を正本にし、`worker-public/` は mirror として扱う
- story-deck-lab まで絡む時は page HTML も含めて確認する

## Repo-specific Facts

- deck builder 本体は `ui/deck-builder-state.js`, `ui/deck-builder-renderer.js`, `ui/deck-builder-controller.js`, `ui/handlers/deck-builder.js` の分担で成り立つ
- deck 形式の単一ソースは `shared/deck-spec.js` と `shared/deck-codec.js`
- story deck 側には `shared/story-deck-spec.js`, `shared/story-deck-codec.js`, `ui/story-deck-lab/*`, `story-deck-lab.html` がある
- rerender 時の viewport drift は `body.scrollTop` ではなく anchor card の offset 差分で補正する必要がある
- shared deck に触ると network room deck test まで影響しやすい

## Procedure

1. 先にルールを読む
   - `AGENTS.md` と `.github/copilot-instructions.md` を確認する
   - `ui/` と `shared/` に効く instruction を確認する
   - repo memory の deck builder 系メモを確認する

2. 対象を分類する
   - format の問題か
   - state 正規化の問題か
   - renderer / viewport の問題か
   - controller / handler wiring の問題か
   - story-deck-lab page の問題か

3. 読む順を固定する
   - `shared/deck-spec.js` と `shared/deck-codec.js` を確認する
   - `ui/deck-builder-state.js` で draft normalize と count 制約を確認する
   - `ui/deck-builder-renderer.js` で DOM 構造と anchor 補正を確認する
   - `ui/deck-builder-controller.js` で rerender と notice を確認する
   - `ui/handlers/deck-builder.js` と page test を確認する
   - story-deck-lab が絡むなら `shared/story-deck-spec.js`, `shared/story-deck-codec.js`, `ui/story-deck-lab/*`, `story-deck-lab.html` を確認する

4. 小さく編集する
   - spec / codec だけで直る問題を controller 側まで広げない
   - viewport 補正は clicked card の offset を基準に維持する
   - renderer の見た目だけの問題を state 正規化に逃がさない
   - root 側の修正で足りるか、`worker-public/` mirror が必要かを明示する

5. shared deck の波及を確認する
   - room deck payload に触るなら network room deck test まで見る
   - codec 変更時は silent drop が起きないか確認する
   - story-deck-lab page wiring が崩れていないか確認する

6. 検証する
   - `npx jest test/ui.deck-builder-controller.test.js --runInBand`
   - `npx jest test/shared.deck-codec.test.js --runInBand`
   - `npx jest test/ui.story-deck-lab-state.test.js test/ui.story-deck-lab-renderer.test.js test/story-deck-lab.page.test.js --runInBand`
   - shared deck まで触った場合は `npx jest test/workers.match-room-deck.test.js --runInBand`
   - path / mirror に波及した場合だけ `npm run worker:prepare` を追加する

7. 最後に報告を固定する
   - format / state / renderer / controller のどこが根本原因だったかを書く
   - root を直したか、`worker-public/` を同期したかを書く
   - 実行した test と結果を書く
   - `01-rulebook.md` を更新したか必ず書く
   - 最後に専門用語を避けた短い説明を付ける

## Branching Guide

- 候補カードを押すと画面がずれる
  - anchor card の offset 補正が残っているかを先に見る

- 保存や読込だけ壊れる
  - spec / codec / state normalize の順で確認する

- story-deck-lab だけ壊れる
  - `story-deck-lab.html` と `ui/story-deck-lab/*` の wiring を先に見る

- network room 側だけ deck が崩れる
  - shared deck と room deck test まで確認する

## Guardrails

- scroll 保持を `body.scrollTop` だけで済ませない
- draft normalize で情報を silent に落とさない
- spec / codec を変えたら page / room deck まで確認する
- `worker-public/` を正本にしない
- UI の見た目問題を shared spec 変更でごまかさない

## Stop And Clarify Only If

- deck 形式そのものを変える必要がある
- root 側と `worker-public/` 側のどちらを正本にすべきか決められない
- 既存の未コミット変更と同じ deck builder 関連ファイルで衝突している

## Good Prompts

- deck builder で候補カードを押すたびに画面がずれるので、anchor 補正を守って直して
- story-deck-lab の保存形式が崩れるので、spec と codec を起点に安全に直して
- preset 切り替え後の rerender で notice が壊れるので、controller と renderer の責務を守って修正して
- shared deck 変更が room 側に波及したので、必要な test だけ回して安全に揃えて