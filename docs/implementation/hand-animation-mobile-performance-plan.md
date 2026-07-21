# 手アニメーションのモバイル性能改善 実装計画

## 1. 前提

設計正本は `docs/implementation/hand-animation-mobile-performance-design.md`。プレイヤー向けの時間仕様は変更せず、既存のhand-skin runtime、animation queue、card UI sync、Single Visual Writer境界を利用する。

## 2. 実装手順

1. 手アニメーション用actor画像の取得・生成・再利用・表示復帰を `ui/animation-utils.ts` に実装する。
2. 配置、ドロー、カード使用の各手演出が、ローカル選択画像とactor画像の両方を正しく扱うよう既存処理を接続する。
3. `cards/card-renderer.ts` の全UI再同期で、値が同じDOMプロパティを再代入しないよう差分更新する。
4. 手札グロー層の署名が同じ場合、レイアウト値を読む前に終了する。
5. `cards/card-interaction-detail-panel.ts` の詳細本文・タグ・ライブ値を、表示モデル不変時に再構築しない。
6. actor画像の安定性、再利用、既存タイミング、disabled復帰をfocused Jestで検証する。
7. browser bundleを再生成し、実ブラウザで黒操作＋白CPU応答を自動操作する。
8. PerformanceObserverとMutationObserverで完了条件を再計測し、スクリーンショットを目視確認する。
9. 最終diffとgit statusを確認し、タスク所有ファイルだけをコミットする。

## 3. 検証コマンド

- focused Jest: `npx jest test/ui.animation-utils.hand-fallback.test.ts --runInBand`
- card UI focused test: 変更対象に最も近い既存Jestを選択し、必要なら回帰テストを追加する。
- timing guard: `npm run test:jest:noanim -- --runTestsByPath test/ui.animation-utils.hand-fallback.test.ts`
- browser build: `npm run build:browser`
- browser playtest: ローカルサーバーとPlaywright/Browserを使い、通常の1往復、DOM mutation、LongTask、rAF、最終操作可否、スクリーンショットを確認する。
- final hygiene: `git diff --check` と `git status --short`

## 4. 自己レビュー

- 実装前にactor画像を使う全経路を検索し、配置だけ直してドロー/カード使用を壊さない。
- 広いrenderer変更は、値が同じ場合だけ代入を省く純粋な最適化に限定し、表示モデルやゲーム判断を変更しない。
- mutation件数だけでなく、操作復帰、タイミング、LongTask、スクリーンショットを合わせて判定する。
- generated bundleはroot sourceのテスト後に既存スクリプトで生成し、手編集しない。
- 完了条件を満たせない場合は未完了として原因を再調査し、計画を更新する。

## 5. 実施結果

1. actor画像の分離・再利用と終了時のvisibility復帰を実装した。
2. カードrenderer、詳細本文・タグ、操作ボタン、パス表示を同値代入しない差分更新へ変更した。
3. 手札グローは署名・scroll・dirty状態が同じ場合、寸法を読む前に終了するよう変更した。
4. focused Jest 98件、focused no-animation Jest 45件、CPUレベル差分E2E 2件、typecheck、browser/Vite buildが通過した。
5. モバイル横画面の通常対局、単体配置演出、配置ON/OFF比較、スクリーンショットを検証し、設計書の完了条件を満たした。
