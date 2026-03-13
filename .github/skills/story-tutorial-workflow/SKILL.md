---
name: story-tutorial-workflow
description: 'チュートリアルとストーリーモードを、この repo の重複配置と overlay 罠を踏まえて安全に直すワークフロー。Use when editing ui/tutorial, ui/story, ui/handlers/story.js, ui/handlers/tutorial.js, story progression, tutorial dialogue flow, unlock conditions, or related story/tutorial tests in this card-othello repository.'
argument-hint: 'tutorial/story のどこを変えたいか。steps, state, overlay, controller, handler, unlock, story-deck-lab のどれかも書く'
---

# Story Tutorial Workflow

このスキルは、このリポジトリでチュートリアルとストーリーモードを安全に触るための実務手順です。

## When to Use

- チュートリアルの台詞、steps、状態遷移、待機条件を直したい
- ストーリーの章構成、解除条件、遭遇進行、メニュー導線を直したい
- story と tutorial の overlay / controller / handler の噛み合わせを直したい
- story-deck-lab や story deck codec/spec のような周辺 authoring UI も含めて確認したい
- root 側と worker-public 側のどちらを正本にするか迷いやすい変更をしたい

## Default Stance

- ワークスペース向けのスキルとして扱う
- まず root 側か worker-public 側かの正本を決めてから編集する
- story と tutorial は別機能として見つつ、overlay と storage の共有影響を前提に扱う
- 変更が UI 内で閉じるなら game/ を触らない
- 強制ルールは再定義せず、既存の instructions と skill を補助する
- 差分は最小にし、進行不能やクリック阻害のような実害を優先して潰す

## Repo-specific Facts

- root の index.html が tutorial / story の script 順と overlay の入口
- tutorial は ui/tutorial と ui/handlers/tutorial.js が中心
- story は ui/story と ui/handlers/story.js が中心
- story-deck-lab は story-deck-lab.html, ui/story-deck-lab, shared/story-deck-spec.js, shared/story-deck-codec.js を合わせて見る
- worker-public 側にも tutorial / story の複製があるので、どちらを正本にするか先に固定しないと drift しやすい
- story 側の導線や解除条件は tutorial storage とつながっているので、片側だけ見て判断しない

## Procedure

1. 先にルールを読む
   - 01-rulebook.md を一次情報として確認する
   - AGENTS.md と .github/copilot-instructions.md を確認する
   - ui/ と該当 handler に効く .github/instructions/ui.instructions.md を確認する
   - 読む順や入口の把握が必要なら SKILLS.md も確認する

2. 正本を先に決める
  - root の ui/tutorial / ui/story を触るのか、worker-public 側を触るのか先に決める
   - 通常のゲーム画面を直すなら root 側を優先する
   - worker-public 専用ページや配布物だけを直すなら worker-public 側を優先する
   - 片側しか直さない場合は、もう片側を触らない理由を最後に明記する

3. 変更の種類を分類する
   - データ変更: steps / state / encounter / storage
   - 進行変更: runtime / controller / action-wait / scenario
   - UI変更: overlay / handler / story menu / tutorial overlay / CSS
   - authoring 変更: story-deck-lab / shared story deck spec / codec
   - どの種類か決めてから読む範囲を狭める

4. 読む順を固定する
  - index.html で button, overlay, script 順を確認する
   - state / steps / encounter / storage を読んでデータの入口を確認する
   - overlay / runtime / action-wait で見た目と待機条件を確認する
   - controller で進行の接続点を見る
   - handler で DOM 起点の wiring を確認する
   - 最後に対応する test を確認する

5. 共有影響を先に確認する
   - story が tutorial overlay や tutorial storage に依存していないか確認する
   - 閉じた overlay が pointer-events でクリックを奪わないか確認する
   - aria-hidden, open/close class, button state の 3 点が揃っているか確認する
   - scene background, support image, dialogue window など story と tutorial の共有 DOM を壊さないか確認する

6. 小さく編集する
   - steps/state だけで直る問題を controller や handler まで広げない
   - overlay の見た目だけの問題なら進行ロジックを触らない
   - story/tutorial の両方に効く修正は、共有原因を説明できる形で入れる
   - worker-public と root で同じ修正が必要なら、片方を正本として揃える

7. 変更の種類ごとに検証する
   - tutorial 本体を触ったら次を優先する
     - npx jest test/ui.tutorial-storage.test.js test/ui.tutorial-steps.test.js test/ui.tutorial-runtime.test.js test/ui.tutorial-overlay.test.js test/ui.tutorial-handler.test.js test/ui.tutorial-controller.test.js test/ui.tutorial-action-wait.test.js --runInBand
   - story 本体を触ったら次を優先する
     - npx jest test/ui.story-steps.test.js test/ui.story-handler.test.js test/ui.story-controller.test.js test/ui.story-encounter.test.js test/ui.result-overlay.story-result.test.js --runInBand
   - story-deck-lab や shared codec/spec を触ったら次を優先する
     - npx jest test/ui.story-deck-lab-state.test.js test/ui.story-deck-lab-renderer.test.js test/shared.story-deck-spec.browser-merge.test.js test/shared.story-deck-codec.test.js test/story-deck-lab.page.test.js --runInBand
   - script 順や配布物も影響するなら次を追加する
     - npm run worker:prepare
     - npx jest test/index.local-script-paths.test.js test/index.card-module-scripts.test.js test/story-deck-lab.page.test.js test/index.sniper-module-load.test.js --runInBand
   - window 公開やロード順が怪しければ npm run check:window も回す

8. 最後に報告を固定する
   - root cause を 1 行で書く
   - 正本としてどちらを触ったかを書く
   - もう片側を同期したか、していないなら理由を書く
   - 実行したテストと結果を書く
   - 01-rulebook.md を更新したか必ず書く
   - 最後に専門用語を避けた短い説明を付ける

## Branching Guide

- 台詞や章構成だけを変える
  - steps / encounter / state を優先し、controller には極力触らない

- ボタンを押しても開かない、閉じない、解除されない
  - handler → controller → storage → steps の順で確認する

- overlay が邪魔、クリックできない、閉じても盤面を塞ぐ
  - overlay 実装と CSS を優先し、aria-hidden と pointer-events を同時に確認する

- story の解除条件が壊れた
  - tutorial storage と story steps を両方見る

- story-deck-lab が壊れた
  - page HTML → shared spec/codec → state → renderer → controller → page test の順で見る

## Guardrails

- hidden な tutorial/story overlay の子要素が pointer-events:auto のまま残らないようにする
- story/tutorial の DOM 入口は index.html の button と overlay id を壊さない
- script 順に依存する UI なので、script の移動は必要な時だけにする
- root と worker-public の二重配置は放置して広げない
- UI の問題を直すだけなら game/ の実装に逃がさない

## Stop And Clarify Only If

- root 側と worker-public 側で、どちらを正本にすべきかがタスク文だけでは決められない
- 章解除条件や進行仕様そのものを変える必要があるが、期待する新挙動が曖昧
- story/tutorial の shared DOM を分離するような大きい設計変更が必要
- 既存の未コミット変更と同じ story/tutorial ファイルで競合している

## Good Prompts

- tutorial overlay が閉じた後もクリックを塞ぐので、安全に直して関連テストだけ回して
- story の chapter unlock 条件だけを修正して。controller まで広げないで
- story handler と tutorial storage の接続を壊さずに、story menu の導線を直して
- story-deck-lab の表示崩れを shared codec/spec との整合を保ったまま直して