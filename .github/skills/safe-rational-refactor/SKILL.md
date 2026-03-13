---
name: safe-rational-refactor
description: '安全に、合理的に、最小差分でリファクタリングするためのワークフロー。Use when refactoring existing code, extracting helpers, splitting files, deduplicating logic, reducing complexity, preserving behavior, fixing root cause, and validating targeted tests in this card-othello repository.'
argument-hint: 'どこを、何のために安全に整理したいか'
---

# Safe Rational Refactor

このスキルは、このリポジトリで既存コードを安全に整理するときの実務手順です。

## When to Use

- 既存挙動をできるだけ変えずに責務分離したい
- 重複コードを共通化したい
- 巨大関数や巨大ファイルを安全に分割したい
- バグ修正を伴う整理を、根本原因から進めたい
- game/ui/cpu の境界を壊さずに内部構造を改善したい

## Default Stance

- ワークスペース向けのスキルとして扱う
- 外部依存は増やさない
- 差分は最小にする
- 表面の書き換えより根本原因の整理を優先する
- 挙動変更が入るなら 01-rulebook.md を先に更新する
- 迷ったら公開入口を維持し、内部だけを整理する

## Procedure

1. 先にルールを読む
   - 01-rulebook.md を一次情報として確認する
   - AGENTS.md と .github/copilot-instructions.md を確認する
   - 触る領域に対応する .github/instructions/*.instructions.md を確認する
   - 読む順番や DI の入口が重要なら SKILLS.md も確認する

2. 編集前にリファクタ契約を固定する
   - 対象ファイル、公開入口、非目標、変えてはいけない挙動を明文化する
   - 今回が挙動維持なのか、挙動変更なのかを先に宣言する
   - 挙動変更なら 01-rulebook.md を先に更新する

3. 依存経路を先に把握する
   - 定義と参照を検索してからコードを移す
   - 次の境界を崩さない
     - game/ は ui/ に直接依存しない
     - ui/ は game/ の公開 API / events / DI だけを使う
     - cpu/ は読み取り専用で DOM/UI/音/タイマーを直接触らない
   - owner / player / color の正規化地点を先に確認する
   - 定数の単一ソースを先に確認する

4. 一番安全な整理形を選ぶ
   - 大規模な書き換えより extract function / extract module / 重複解消を優先する
   - 新しい並列経路を増やさず、既存の共通経路へ寄せる
   - 正当な理由がなければ公開名とシグネチャは維持する
   - リファクタと無関係な掃除を同じ差分に混ぜない

5. 編集前にリスク確認を入れる
   - event 順や playback 順を変えないか
   - 再生中の単一書き手ルールを壊さないか
   - window/global の公開を増やさないか
   - debug の通常時副作用を混ぜないか
   - 定数やカード定義を重複させないか
   - game/ui/cpu 境界を越えないか
   - どれかが怪しいならスコープを縮める

6. 小さく編集する
   - 責務境界を 1 つずつ動かす
   - 既存スタイルと命名を維持する
   - 難読な制御だけ最小限コメントを足す
   - 無関係な整形はしない

7. 入れたリスクだけを検証する
   - 変更ファイルのエラーを確認する
   - まず最小の関連テストを回す
   - 必要に応じて次を使う
     - npm run test:jest:changed
     - npx jest <targeted-test> --runInBand
     - npm run check:window
   - gameplay/UI を触ったら代表ケースと境界ケースを確認する
   - scripts/benchmarks を触ったら整数化、ループ回数、timeout、直接呼び出し経路も確認する

8. 最後に報告を固定する
   - 根本原因と整理方針を短くまとめる
   - 実行したテストと結果を明記する
   - 01-rulebook.md を更新したか必ず書く
   - 更新していない場合は不要だった理由を書く
   - 最後に専門用語を避けた短い説明を付ける

## Repo-specific Guardrails

- UI は events[] を順番どおりに再生する
- playback 中に盤面 DOM を書く主体は 1 つに絞る
- フリップ演出は Spec B を守る
- debug 動作は ?debug=1 などの明示条件に閉じる
- owner / player / color は入口で正規化する
- 定数は shared-constants.js と constants/ を単一ソースにする

## Stop And Clarify Only If

- 仕様変更が必要だが、意図する新挙動が曖昧
- 新しい依存追加が必要
- 差分が広すぎて影響範囲を縮められない
- 既存の未コミット変更と同じ箇所で衝突する

## Good Prompts

- scripts 配下の ONNX ゲート処理を、安全に責務分割して。挙動は変えない
- game と ui の境界を守ったまま、重複した選択ハンドラを共通化して
- この巨大関数を最小差分で分割し、必要なテストまで回して
- 仕様変更なしで、根本原因を直しながら安全にリファクタリングして