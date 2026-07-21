# 非CPUランタイム負荷の残存対策 実装計画

## 前提

- 設計正本: `docs/implementation/non-cpu-runtime-performance-remediation-design.md`
- 内部契約: `docs/architecture-contracts.md` 7.3
- root実装を変更し、`dist/`, `public/module-registry.js`, `worker-public/` は既存生成コマンドから更新する。
- プレイヤー向けルール・演出仕様は変更しないため、`01-rulebook.md` と `正本/` は変更しない。

## 実装手順

1. [x] controllerで同じrender session・4 channel revisionのidle frameをGPUへ再適用せず、settlement中は最新metadataだけをcoalesceする。
2. [x] 同一frameのworld-state commit、settlement中coalesce、revision/session変更時の再適用を焦点テストへ追加する。
3. [x] Vite bridge生成器へ `compatibility` / `diagnostics` の専用遅延グループを追加し、URL型とloaderを拡張する。
4. [x] Viteエントリで明示DOM選択を起動前ロードし、board rendererの初期/context-loss fallbackでcompatibility登録を待つ。
5. [x] 性能計測起動時だけdiagnostics payloadをロードしてharnessを設置する。
6. [x] 生成器／payload loader／フォールバックの焦点テストを追加・更新する。
7. [x] `ui/status-display.ts` に要素単位のCPU肖像ロード世代管理を追加する。
8. [x] `cards/card-renderer.ts` の解決済みfont-ready重複サイクルをRAF前に終了する。
9. [x] status/cardの回帰テストで、同一更新時のImage/RAF非生成と強制時の再実行を確認する。
10. [x] focused Jest、typecheck、TypeScript/Vite/browser build、Pixi playback/fallback/cross-platform smokeを実行する。
11. [x] opponent-action性能キャプチャとbundle出力をbaseline比較する。
12. [x] `git diff --check` と関連diffを確認し、タスク所有ファイルだけをコミットする。

## 変更単位

- 単位A: controller preparation cadence + test
- 単位B: Vite lazy payload delivery + fallback/diagnostic loading + tests/generated browser assets
- 単位C: status portrait/font-ready memoization + tests
- 最終単位: 実測結果と計画完了記録

各単位は単独で契約が成立するが、生成物と最終実測を含めた全体検証後に、関連差分を明示的にstageしてコミットする。

## 検証コマンド

```powershell
npx jest --runInBand test/ui.board-visual-controller-settlement.test.ts test/ui.pixi-board-backend.test.ts
npx jest --runInBand test/browser-vite.optional-payload-loader.test.ts test/ui.board-renderer.backend-selection.test.ts
npx jest --runInBand test/ui.status-display.network-seat.test.ts test/ui.card-renderer-hand-inspect.test.ts
npm run typecheck
npm run build:ts
npm run build:vite
npm run build:browser
npm run match:pixijs-board-playback-check
npm run match:pixi-runtime-fallback-check
npm run match:cross-platform-smoke:vite
npm run worker:prepare
```

性能キャプチャは既存のopponent-action quick harnessを用い、同一条件で25サンプルの有効性、Long Task、RAF、Pixi `prepareCount` / `stalePrepareCount` を比較する。

## ロールバック境界

- controller変更でsettlement順序または最終表示が壊れる場合、準備スケジュール変更だけを戻せる。
- 遅延配信でfallbackが不安定な場合、Vite startup除外集合だけを戻せる。DOM backend実装自体は変更しない。
- UI memoizationはWeakMap helperと2つの呼び出し箇所に閉じ、ラベル処理から独立して戻せる。

## Self-review

- 初回計画では全変更を一括実装としていたが、原因別に検証とロールバックができる3単位へ分解した。
- browser-visible root変更後の `build:browser` と、mirror確認の `worker:prepare` を明示した。
- Pixi変更に必要なplayback/fallback/cross-platform検証を追加した。
- 長時間selfplayは負荷原因と無関係であり、プロジェクトルールに従って除外した。

## 実装・検証結果

- opponent-action quick capture: 5シナリオ×5件=25/25有効、invalid 0、アプリ起因Long Task 0、RAF最大16.8ms。
- Pixi stale preparation平均: 全シナリオで0。変更前は7、7、8、7、7回だった。
- Pixi prepare/apply平均: 通常着手13→4、カード使用15→6、多対象カード17→7、Lv6 Worker 13→4、高refresh fixture 13→4。
- Vite主JS: 4,119.24KB（gzip約1,047.3KB）から約3,963.75KB（gzip約1,004.56KB）へ縮小。compatibility 123.92KB、diagnostics 37.06KBを必要時取得へ分離した。
- Pixi playback、明示DOM、Pixi初期失敗fallback、optional feature、Chromium/Firefox/WebKitのdesktop/mobile×Pixi/DOM smokeが成功した。
