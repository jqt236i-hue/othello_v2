# 石影の実行時ブラー撤去 実装計画

## 文書の役割

- 役割: [設計書](stone-shadow-filter-free-design.md) に基づく実装手順
- 対象: 石影CSS、focused test、browser/Worker生成面
- 非目標: 影レイヤー削減、JavaScriptアニメーション変更、画像アセット追加、ゲーム仕様変更

## Step 1: 変更前の表示と契約を固定

- outcome: 同一条件で比較できる盤面画像と、現在のCSS・テスト契約を確認する。
- components: `styles-board.css`, `styles-stone-shadows.css`, `test/ui.disc-shadow.test.ts`
- dependency: なし
- verification: 変更前スクリーンショット、対象セレクタとcomputed styleの確認
- done: 2つの影の所有者、位置、変形、不透明度、表示条件が記録されている。

## Step 2: 共通のfilter-free減衰を実装

- outcome: 2つの影へ共通の多段 radial-gradient を適用し、実行時ブラーを撤去する。
- components: `styles-board.css`, `styles-variables.css`
- dependency: Step 1
- verification: source inspection、focused Jest
- done: 両影に `filter: blur()` がなく、既存の幾何・変形・所有者・不透明度が維持される。

## Step 3: 回帰契約と表示を検証

- outcome: テストを現行の不透明度とfilter-free契約へ合わせ、変更後画像で影の欠落や方向ずれがないことを確認する。
- components: `test/ui.disc-shadow.test.ts`
- dependency: Step 2
- verification: focused Jest、実際の通常石画像と盤面テクスチャを使った変更後スクリーンショット比較
- done: テスト成功、実アセット上でも黒石・白石・盤面上の影が視認でき、同じ方向と所有関係で表示される。

## Step 4: 生成面を同期してコミット

- outcome: browser build と Worker mirror を正本から生成し、task-owned差分だけをコミットする。
- components: `public/*`, `index.html`, `worker-public/*`, 設計/計画書
- dependency: Step 2, Step 3
- verification: `npm run build:browser`, `npm run worker:prepare`, `git diff --check`, `git status --short`, staged diff inspection
- done: 必須チェック成功、無関係な既存変更を含まないコミットが作成される。

## Self-review

- JavaScriptへ影の受け渡し処理を追加する案を除外し、Single Visual Writerと既存アニメーション経路へ影響しない順序にした。
- root CSSを先に変更し、Worker mirrorを生成する正本順序を明記した。
- 見た目維持をソース検査だけで済ませず、同一条件の前後スクリーンショットを完了条件へ追加した。
- fallback色だけの簡易盤面では実表示の視認性を判断できなかったため、実際の石画像と盤面テクスチャを使う条件へ修正した。

## 完了チェックリスト

- [x] 変更前スクリーンショット取得
- [x] 共通filter-freeグラデーション実装
- [x] blur用の未使用CSS変数整理
- [x] focused Jest成功
- [x] 変更後スクリーンショット確認
- [x] `npm run build:browser` 成功
- [x] `npm run worker:prepare` 成功
- [x] `git diff --check` 成功
- [x] task-owned diffのみをコミット
- [x] 無関係な既存変更を保持
