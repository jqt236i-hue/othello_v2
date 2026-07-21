# 手アニメーションのモバイル性能改善 実装計画

## 1. 文書の役割

`docs/implementation/hand-animation-mobile-performance-design.md` を実装・検証するための実行計画である。プレイヤー向け時間仕様は変更せず、既存のhand-skin runtime、animation queue、card UI sync、Single Visual Writer境界を使う。

## 2. 現在のフェーズ

前回のactor画像再利用とカードUI差分描画は完了済み。ただしスマートフォン実機で配置・ドローの見た目のかくつきが残ったため、モーション曲線と描画レイヤー寿命を第2段階として修正する。

## 3. 実装手順

1. 既存仕様と実測値を設計書へ反映し、最大移動量・rAF・レイヤー終了状態を完了条件にする。
2. `ui/animation-utils.ts` に長距離移動用の共通イージング、レイヤーmount、ラッパー表示状態、残留Animation破棄のhelperを追加する。
3. 配置・ドローを、opacity 0で初期状態を準備してから表示し、終了時にmountを維持する経路へ変更する。
4. capture・カード使用・UI resetも、共有レイヤーを隠さず一時要素だけを後始末するよう揃える。
5. `styles-cards.css` と正本HTMLの `index.classic.html` を常時mount前提へ変更する。`index.html`、`index.vite.html`、Worker mirrorは生成スクリプトに任せる。
6. focused Jestでphase時間、easing、待機opacity、Animation破棄、reset状態、disabled/no-animation経路を検証する。
7. typecheckとbrowser/Worker生成を通し、生成物とmirrorを同期する。
8. 実ブラウザのモバイル条件で自分・相手の配置・ドローを再計測し、最大移動量、rAF、LongTask、終了状態を確認する。
9. 配置中・ドロー中・終了後をスクリーンショットで目視し、最終diffを自己レビューしてタスク所有ファイルだけをコミットする。

## 4. 検証コマンド

- focused animation Jest: `npx jest --runInBand --runTestsByPath test/ui.animation-utils.hand-fallback.test.ts`
- focused bootstrap Jest: `npx jest --runInBand --runTestsByPath test/ui.bootstrap.cpu-early-registration.test.ts`
- no-animation guard: `npm run test:jest:noanim -- --runTestsByPath test/ui.animation-utils.hand-fallback.test.ts`
- TypeScript: `npm run typecheck`
- browser/Worker mirror: `npm run worker:prepare`
- browser playtest: ローカルサーバーとPlaywrightを使い、844×390、device scale factor 3、CPU 6倍スロットルで配置・ドローを計測する。
- final hygiene: `git diff --check`、関連diff、`git status --short`

## 5. 自己レビュー

- phase時間とイベント順を変えず、移動曲線だけを共有定数へ集約する。
- 画面全体のレイヤーに合成を強制せず、小さいラッパーだけを透明待機させる。
- fallback/no-animation/disabled経路が不要な表示状態変更を起こさないことを維持する。
- `fill: forwards` の最終状態を残さず、開始時にも防御的に前回分を破棄する。
- 生成・mirrorファイルはroot sourceのfocused test後に既存スクリプトで更新する。
- 完了条件を実測で満たさない場合は、実装済みという理由で終了せず再設計する。

## 6. 実施結果

1. 長距離移動を平均速度に近い対称曲線へ統一し、既存phase時間とイベント順を維持した。
2. 手レイヤーと小さいラッパーをmountしたまま再利用し、待機中はopacity 0、演出中だけopacity 1にした。
3. 開始前・終了後・UI reset時に残留Animationをcancelし、reset/timeout後に後続phaseを始めないガードを追加した。
4. 配置・ドロー・capture・カード使用・UI resetの共有レイヤー寿命を揃え、phase時間、easing、終了状態、cancel異常経路の回帰テストを追加した。
5. focused animation Jest 47件、bootstrap resetを含むfocused Jest、no-animation Jest、TypeScript typecheck、browser/Vite build、asset case、Worker runtime preload、Worker mirror検証を通した。
6. CPU 6倍スロットルのwarm計測で、自分・相手の配置・ドロー全4経路が最大移動量30px未満、rAF最大16.8ms、LongTask 0となった。
7. 配置中、ドロー中、終了後のスクリーンショットで、二重表示、ちらつき、残像、UI欠落がないことを確認した。
