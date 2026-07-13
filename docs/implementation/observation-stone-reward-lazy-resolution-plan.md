# 観測石報酬の遅延ロード修正 実装計画

## 文書の役割

- 役割: [設計書](observation-stone-reward-lazy-resolution-design.md) に基づく実装手順
- 対象: `ui/result-overlay.ts` と観測石報酬の回帰テスト
- 非目標: optional registry の分類変更、観測石仕様やガチャ抽選仕様の変更、既存の生成/mirrorファイルの手編集

## Step 1: 実装方針と依存解決境界を確定

- outcome: 設計書に、モジュール評価時の固定参照をやめて報酬処理時に再解決する方針を記録する。
- components: `docs/implementation/observation-stone-reward-lazy-resolution-design.md`
- dependency: なし
- verification: 設計書の自己レビュー、根拠パスの存在確認
- done: 採用案、非目標、保存API未解決時の扱い、完了条件が明記されている。

## Step 2: 遅延解決を実装

- outcome: `result-overlay` が報酬サマリー計算時に最新のガチャ依存を取得し、必要APIが揃った時だけ報酬を保存する。
- components: `ui/result-overlay.ts`
- dependency: Step 1
- verification: TypeScriptソース検査、focused Jest
- done: 起動時に依存が未ロードでも、後から global namespace に登録された依存で報酬処理が成功する。

## Step 3: ブラウザ遅延ロード回帰テストを追加

- outcome: 起動時未解決→報酬処理時解決のケースをテストで固定する。
- components: `test/ui.result-overlay.network-seat.test.ts`
- dependency: Step 2
- verification: `npx jest --runInBand --runTestsByPath test/ui.result-overlay.network-seat.test.ts test/ui.gacha-progress-storage.test.ts`
- done: 遅延解決、通常CPU/ネット報酬、既存重複防止のテストが成功する。

## Step 4: 完了検証とコミット

- outcome: task-owned diff、型、差分空白、作業ツリーを確認し、変更をコミットする。
- components: `ui/result-overlay.ts`, `test/ui.result-overlay.network-seat.test.ts`, 設計/計画書
- dependency: Step 2, Step 3
- verification: focused Jest、`npm run typecheck`、`npm run build:browser`、`git diff --check`、`git status --short`
- done: 全チェック成功、無関係な未コミット変更を含めず、短い目的明示コミットが作成される。

## Self-review

- テストだけでなく、`awardObservationStones` の存在確認を実装側の完了条件に含め、依存の部分ロード時に成功表示だけ残る状態を避ける計画へ修正した。
- optional registry や生成出力は変更せず、root TypeScriptを正本として実装する順序になっている。
- browser build は表示テキストや生成manifestを変更しないため必須条件にしていない。focused test と typecheck で今回の内部境界を検証する。

## 完了チェックリスト

- [ ] `ui/result-overlay.ts` の報酬依存を処理時に再解決
- [ ] 保存API未解決時に成功扱いにしない
- [ ] ブラウザ遅延ロード回帰テストを追加
- [x] focused Jest 成功
- [x] `npm run typecheck` 成功
- [x] `npm run build:browser` 成功
- [x] `git diff --check` 成功
- [x] task-owned diff のみをコミット
- [x] 無関係な既存変更を保持
