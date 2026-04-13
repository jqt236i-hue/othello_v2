---
name: 'prompt-refinement-workflow'
description: '雑な依頼、短いメモ、曖昧な指示を、目的・制約・完了条件・出力形式が明確な指示文 / prompt に変換するワークフロー。Use when turning rough notes into precise prompts, rewriting vague instructions, preparing agent tasks, or deciding whether to ask questions vs state assumptions in this card-othello repository.'
argument-hint: '元の依頼、想定する相手、必要なら守らせたい制約'
---

# Prompt Refinement Workflow

このスキルは、短いメモや雑な依頼から、実行者が迷わず動ける指示文を作るための標準手順です。repo 固有作業なら、上位文書の制約も prompt に織り込みます。

## When to Use

- ふわっとした依頼をそのまま投げるとズレそうな時
- coding agent / reviewer / planner / docs writer 向けに依頼を言い直したい時
- 目的は決まっているが、入力・制約・完了条件が抜けている時
- 質問を先に返すべきか、仮定を置いて進めるべきか迷う時

## Not For

- すでに必要十分に具体的な依頼
- repo-wide rule 自体の変更
- 一度きりの軽い言い換えだけで十分な文章

## Read First

- repo 作業の prompt なら `01-rulebook.md`
- repo 作業の prompt なら `.github/copilot-instructions.md`
- repo 作業の prompt なら `AGENTS.md`
- 触る領域が決まっているなら対応する `.github/instructions/*.instructions.md`

## Output Contract

最終出力は、必要に応じて次の順で返します。

1. 完成版の指示文
2. 置いた仮定
3. 不足情報があれば最小質問
4. 必要なら短縮版 1 本

## Ask-or-Assume Branch

- 正しさが対象 repo、環境、壊してはいけない挙動、納品物に依存するなら先に質問する
- 欠けている情報がスタイルや粒度だけなら、仮定を明示して先に完成版を出す
- 選択肢が複数ありどれも成立する時は、本文を 1 本に絞り、末尾に代替案だけを短く添える
- 質問は広げず、完成版の精度を最も上げるものを 3 個以内に絞る

## Procedure

1. まず、誰に向ける指示かを固定する。coding agent / reviewer / planner / docs writer / 汎用 assistant を先に決める。
2. 元の依頼から 5 要素を抽出する。目的、対象、制約、完了条件、出力形式。
3. 足りない要素を「致命的に足りない」「仮定で埋められる」「なくてもよい」に分ける。
4. 曖昧語を具体化する。例: 「いい感じ」なら見た目基準、「直して」なら期待挙動と非目標、「調べて」なら調査範囲と欲しい結論。
5. repo 作業なら、この repo で守るべき制約を本文へ織り込む。仕様変更時の `01-rulebook.md`、root 正本 / `worker-public/` mirror、対象 test / check 報告、外部依存追加の扱いを必要に応じて明記する。
6. 指示文を固定順で組む。目的、前提コンテキスト、必須制約、実行してほしい作業、検証、返答形式。
7. hidden assumption を本文へ混ぜず、`前提` か `仮定` として別出しする。
8. 最後に、実行者が成功判定できるかを確認する。観測できない完了条件しかない prompt は作り直す。

## Prompt Template

```md
目的:
- 何を達成したいかを 1 文で固定する

前提:
- 対象の repo / ファイル / 症状 / 入力条件
- 必要なら既知の制約や非目標

必須制約:
- 守るべき仕様
- 触ってよい範囲
- 触ってはいけない範囲

実行内容:
1. まず何を確認するか
2. 次に何を変更または整理するか
3. どの粒度まで仕上げるか

検証:
- 実行してほしい test / check
- 結果として報告してほしいこと

返答形式:
- 変更要約
- 検証結果
- 残るリスクや未確定事項
```

## Quality Checks

- 目的が 1 つに絞れている
- 実行者が誰か明示されている
- 完了条件が観測可能
- 質問すべき不足情報と、仮定で進める情報が分離されている
- repo 固有案件なら、必要な上位文書や制約が落ちていない
- 出力形式があるなら、最後に何を返せばよいかまで書かれている

## Completion Checklist

- 元の雑な依頼よりも、対象・制約・完了条件が増えている
- 不足情報を隠さず、質問か仮定のどちらかで処理している
- 実行者が最初の一手を迷わない
- repo 作業なら、必要な確認と報告が含まれている