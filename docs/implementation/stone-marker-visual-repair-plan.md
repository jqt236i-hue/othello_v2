# 石マーカー表示修正 実装計画

## 文書の役割

- 役割: [石マーカー表示修正 設計書](stone-marker-visual-repair-design.md) に基づく実装手順
- 対象: Pixi石マーカー、HELP見本CSS、演出補足、unit/browser fixture、browser生成面
- 非目標: 石効果のルール、残り回数計算、turn/network authority、renderer選択の変更

## Step 1: Pixiのtimer意味とshapeを修正

- outcome: 共有snapshotの `timerClass` から持続とカウントダウンを区別し、全対象markerを仕様どおりのshapeとslotへ描く。
- components: `ui/pixi/stone-view.ts`
- dependency: なし
- verification: focused `test/ui.pixi-board-scene.test.ts`、typecheck
- done: REGEN/ZOMBIEのハート、TIME_STOP/ZOMBIEの赤三角、反転回避の紫円、破壊回避の左下菱形、guardの青五角形、毒の左上紫三角が一つのPixi stone view内で描画され、二桁値が読める。

## Step 2: HELP見本と演出補足を同期

- outcome: HELP見本に石面とmarker CSSが適用され、再生位置の補足が一次情報と一致する。
- components: `styles-layout-info.css`, `styles-board-dom-compat.css`, `正本/演出正本.md`
- dependency: Step 1のshape/slot契約
- verification: focused `test/ui.rules-help-panel.test.ts`、CSS source inspection、実ブラウザcomputed styleとスクリーンショット
- done: HELPの全見本が完成形で表示され、追加selectorがactive Pixi boardへ一致せず、再生位置が中央左と記載される。

## Step 3: 回帰テストとbrowser fixtureを強化

- outcome: 以前の裸数字や誤分類がlabel値だけのテストを通過できないようにする。
- components: `test/ui.pixi-board-scene.test.ts`, `test/ui.rules-help-panel.test.ts`, `scripts/capture-pixijs-playfield-baseline.ts`, `scripts/pixijs-board-browser-check.ts`, 必要に応じて `ui/board-visual/effect-branch-inventory.ts`
- dependency: Step 1, Step 2
- verification: focused Jest、browser fixtureのdiagnostics、effect inventory check
- done: REGEN/ZOMBIE/TIME_STOP/destroy/poison/guardのkind・position・shapeと、HELPの適用scopeが自動検証される。

## Step 4: Browser配信面とruntime互換を検証

- outcome: root sourceからbrowser bundleを再生成し、Pixi通常経路とDOM fallbackを実環境で確認する。
- components: `public/module-registry.js`, browser bundle/cachebuster、Vite生成面、Worker mirror（すべて既存scriptの生成物）
- dependency: Step 1〜3
- verification: `npm run build:browser`, `npm run build:vite`, `npm run match:pixijs-board-playback-check`, `npm run match:pixi-runtime-fallback-check`, 実ブラウザ screenshot
- done: buildとruntime checksが成功し、通常Pixi盤面とHELPで表示が正しい。開始前からdirtyな生成物はtask-owned source commitへ混入しない。

## Step 5: 最終レビューとtask-owned commit

- outcome: 仕様、architecture、tests、生成面の整合を確認し、分離可能な修正を確定する。
- components: 設計書、計画書、全task-owned source/test/doc
- dependency: Step 1〜4
- verification: `git diff --check`, focused diff inspection, `git status --short`, staged diff inspection
- done: 未解決のmarker表示バグがなく、検証結果と残存する無関係差分を説明でき、task-owned変更だけのcommitがある。

## Self-review

- player-visible source、Pixi実装、HELP CSS、browser fixture、実ブラウザ確認を同じ完了経路へ含めた。
- unit testではdiagnostics値だけでなくGraphics commandと座標を検査し、同じ誤描画の再発を防ぐ計画にした。
- root sourceを先に直してから生成し、既存のdirtyなbrowser/Worker生成物をcommit scopeから分離する順序にした。
- DOM fallback自体を書き換えるのではなく、その正しい表示契約をHELPへ安全に共有する範囲へ限定した。

## 完了チェックリスト

- [x] Pixiのtimer分類を共有snapshotへ統一
- [x] 全対象markerのshape・色・slot・二桁表示を修正
- [x] HELP見本のstone構造とmarker CSS scopeを修正
- [x] `正本/演出正本.md` の再生位置を同期
- [x] focused Pixi/HELP tests成功
- [x] browser fixtureとeffect inventory整合
- [x] typecheck成功
- [x] browser/Vite build成功
- [x] Pixi playback/fallback check成功
- [x] 実ブラウザで通常盤面とHELPをスクリーンショット確認
- [x] `git diff --check` とtask-owned diff確認
- [x] task-owned変更だけをコミット
