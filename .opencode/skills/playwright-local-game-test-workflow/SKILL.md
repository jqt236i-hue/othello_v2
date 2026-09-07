---
name: 'playwright-local-game-test-workflow'
description: 'ローカルサーバー上で headed の実ブラウザを Playwright で直接動かし、AI エージェントが script 実行だけで済ませず、自分の click / fill / evaluate / wait でゲームを実機検証するワークフロー。visible な新規 Chrome / browser window または新規 tab を実際に開けない時は fallback せず失敗として報告する。必要時だけ chrome-devtools を console / network / trace 補助として併用する。debug mode は通常 URL で開いた後、UI 上の DEBUG ボタンを押して有効化する前提で進める。Use when you want an agent to directly drive local card-othello gameplay with Playwright, verify UI and board behavior in a real browser, and optionally capture deeper browser evidence with Chrome DevTools.'
argument-hint: '何をローカル実機確認したいか。single-player か room 対戦か、カード使用有無、animation も見るか、debug mode 要否、chrome-devtools 併用要否、再現したい症状を書く'
---

# Playwright Local Game Test Workflow

このスキルは、このリポジトリのゲームをブラウザで操作し、通常起動・入力・
カード効果・ターン進行・表示を確認するときの補助手順です。ゲーム仕様の正本や
ルート `AGENTS.md` を置き換えません。文書だけの変更や純粋関数の検証には適用しません。

## 準備

- ルート `AGENTS.md` と、対象に関係する下位 `AGENTS.md` を読みます。
- 仕様は `01-rulebook.md`、実装境界は `docs/architecture-contracts.md`、
  調査・検証候補は `docs/game-maintenance-reference.md` を参照します。
  これらのパスと以下のパスはリポジトリルート基準です。
- 使用可能なブラウザ操作ツールとAPIを確認します。Playwright、画面表示、
  新規ウィンドウが明示指定されていればそれに従います。それ以外は既存の適切な
  タブ・セッションを再利用し、依頼を検証できるサポート済みの手段を選びます。
- 必要なブラウザ機能がなければ、その検証が未実施であると伝え、独立してできる
  コード・テスト・参照の確認を続けます。存在しないツールやスキルを必須にしません。

## ローカルサーバー

通常プレイ用URLは `http://127.0.0.1:8000/` です。応答中のサーバーがこの
リポジトリのものか確認し、適切なら再利用します。停止中に起動が必要な場合だけ
ルート規則に従って `npm run serve` を使います。既存の8000番を避けるための
二重起動や別ポートへの自動回避を行いません。別プロジェクトのプロセスは停止せず、
衝突を報告します。`build:vite` と5174番の配信に関するルート制約を守ります。

## 操作と観察

1. 確認する初期状態、操作、期待結果を対象仕様から定めます。通常起動を調べる
   ときは通常URLから入り、必要な設定はUIで操作します。`?debug=1` はデバッグ
   経路そのもの、または必要なテスト専用フックを調べる場合に限定します。
2. 選択したツールで許可されたUI操作を使います。別のAPIの `page.evaluate`
   などを推測して呼ばず、ツールが禁止する内部状態の読み書きで代用しません。
3. 操作後は対象の状態変化や演出終了を待ち、固定の長い待機だけを判定根拠に
   しません。セットアップで直接設定した状態と、UI操作で確かめた結果を区別します。
4. ロジック上の成立だけでなく、変更した表示・入力について実描画を確認します。
   canvasの見た目をDOMの存在だけで合格にせず、必要な場面のスクリーンショットや
   実際の操作結果で確認します。画面表示が明示指定されている場合はその条件を守り、
   ヘッドレス実行だけで満たしたことにしません。
5. 変更に関連する中断、リセット、連打、入力ロック解除、対象消失も確認します。
   既存テストが十分なら重複テストを増やさず、不足する再現ケースだけ追加します。

## 検証候補

- `test/e2e/e2e-runtime-helpers.js`：Jest/Playwrightテストのサーバーとページの後始末。
- `test/e2e/board-dom-compat.multi-turn-progression.e2e.test.ts`：複数ターン。
- `test/e2e/board-dom-compat.reset-click.e2e.test.ts`：リセット操作。
- `test/e2e/card_effects.e2e.test.ts`：カード効果のブラウザ統合。
- `tests/visual-regression/`：既存の画像差分検証。

自動テストでは既存ヘルパーを使い、手動に近い操作確認とは実施範囲を分けて報告します。
全テストや新しい可視ブラウザを毎回必須にせず、依頼と変更リスクから範囲を選びます。

## 完了

確認したURL・操作・結果と、未確認の重要な範囲を簡潔に報告します。失敗・未実施を
成功扱いせず、必要なら再現条件と証拠を残します。この作業が作ったテスト資源だけ
片付け、既存タブやプロセスを無断で閉じません。通常プレイ用サーバーはルート規則に
従って維持します。
