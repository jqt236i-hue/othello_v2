# 繁殖生成石の Pixi 表示修正 実装計画

## 文書の役割

- 役割: [設計書](breeding-sprout-pixi-visual-fix-design.md) に基づく実装手順
- 対象: `ui/pixi/stone-view.ts`、`test/ui.pixi-board-scene.test.ts`、browser build 生成物
- 非目標: 繁殖ルール、canonical state、DOM compatibility、network/Worker、spawn 再生順の変更

## Step 1: 表示意味境界を設計として固定

- outcome: 繁殖アンカーと一時的な繁殖生成芽 marker の役割を分離し、Single Visual Writer 内での修正方針を確定する。
- components: `docs/implementation/breeding-sprout-pixi-visual-fix-design.md`
- dependency: なし
- verification: 設計書の自己レビュー、根拠パスと正本の確認
- done: 採用案、非目標、fail-closed 条件、テスト戦略、完了条件が明記されている。

## Step 2: Pixi stone view の分類と overlay を修正

- outcome: `breeding-sprout` が通常石を `BREEDING` 特殊石へ昇格させず、occupied normal stone 上に芽を描く。
- components: `ui/pixi/stone-view.ts`
- dependency: Step 1
- verification: source inspection、focused Jest
- done: 生成石は通常石 texture、繁殖アンカーは専用 texture、marker-only 不整合セルは表示されない。

## Step 3: 回帰テストを canonical fixture に修正

- outcome: 実ゲームと同じ「通常石 + breeding-sprout marker」を使い、誤った繁殖石 texture 選択を再発防止する。
- components: `test/ui.pixi-board-scene.test.ts`
- dependency: Step 2
- verification: `npx jest --runInBand --runTestsByPath test/ui.pixi-board-scene.test.ts`
- done: 通常石 texture、芽 overlay、繁殖アンカー専用 texture の3条件がテストで通る。

## Step 4: ブラウザ反映と完了検証

- outcome: 型、Pixi 通常経路、browser artifacts、差分品質を確認する。
- components: root TypeScript、browser 生成物、設計/計画書
- dependency: Step 2, Step 3
- verification: focused Jest、`npm run typecheck`、`npm run build:browser`、Vite/classic 各 lane の `spawn / normal` focused Pixi browser check、`git diff --check`、`git status --short`
- done: 全チェック成功、意図した生成物だけが更新され、unrelated diff がない。

## Step 5: コミット

- outcome: 検証済みの task-owned diff を1つの coherent commit にする。
- components: 実装、テスト、設計/計画、browser build 生成物
- dependency: Step 4
- verification: staged diff、commit 後 `git status --short`
- done: task-owned ファイルだけを含むコミットが作成され、作業ツリーが意図どおりである。

## Self-review

- root TypeScript と回帰テストを先に変更し、browser artifacts は focused checks 後に生成する順序へ固定した。
- `BREEDING` アンカーの既存画像を守る assertion を追加し、生成石だけを直したつもりで本体表示を壊すリスクを計画に含めた。
- board playback 実装自体は変更しないが、通常 Pixi lane の回帰確認として既存 browser check を含めた。
- 仕様変更ではないため、`01-rulebook.md` と `正本/*.md` の編集は完了条件に含めない。
- 実行時の証拠に基づき、全 lane・全 mode・全 scenario の網羅 browser suite から、同じ runner の `spawn / normal` を Vite/classic 両 lane で確認する focused 手順へ修正した。

## 完了チェックリスト

- [x] 設計書と計画書の自己レビュー完了
- [x] `breeding-sprout` を特殊石種推論から除外
- [x] occupied normal stone 上で芽 overlay を描画
- [x] marker-only 不整合セルを表示しない
- [x] 繁殖生成石と繁殖アンカーの回帰テスト成功
- [x] `npm run typecheck` 成功
- [x] Vite/classic の `spawn / normal` focused Pixi browser check 成功
- [x] `npm run build:browser` 成功
- [x] `git diff --check` と task-owned diff 確認
- [x] task-owned 変更だけをコミット
