# FPS表示トグル 実装計画

## 文書の役割

- 役割: [FPS表示トグル設計書](fps-display-toggle-design.md) に基づく実装手順
- 対象: 設定DOM、FPS計測UIモジュール、bootstrap配線、表示仕様、tests、browser生成面
- 非目標: 盤面renderer、ゲームロジック、network authority、debug性能ハーネスの変更

## Step 1: プレイヤー向け仕様とDOM契約を更新

- outcome: FPSトグルの文言、状態、セッション範囲、画面端表示を正本とmarkupへ追加する。
- components: `01-rulebook.md`, `index.classic.html`（正本）、`index.vite.html` / `index.html`（生成先）
- dependency: なし
- verification: source inspection、markup contract test
- done: 設定行にaccessibleなtoggleがあり、body直下に初期hiddenの表示要素があり、仕様書が同じ挙動を定義する。

## Step 2: FPS計測と初期化配線を実装

- outcome: ON時だけRAFを計測し、ボタン・表示・session stateを同期するUI controllerを導入する。
- components: `ui/fps-display.ts`, `ui/bootstrap/init-dom.ts`, `ui/bootstrap/init-events.ts`
- dependency: Step 1
- verification: focused unit test、typecheck
- done: ON/OFF、500ms sample、長いgap、session復元、cleanup、RAF非対応が設計どおり動く。

## Step 3: 表示スタイルと回帰契約を完成

- outcome: 既存設定skinにトグルを統合し、右上端に小型で入力透過のFPS値を表示する。
- components: `styles-layout-controls.css`, `test/ui.fps-display.test.ts`, UI layout/markup contract tests
- dependency: Step 1, Step 2
- verification: focused Jest、CSS/markup source contract、実ブラウザON/OFF確認
- done: 狭い設定パネルで折返し可能、ON状態が視認でき、画面端表示が他操作を妨げず継続更新する。

## Step 4: Browser生成面を同期してコミット

- outcome: root sourceからbrowser artifactsを再生成し、task-owned差分だけを確定する。
- components: `public/*`, `browser-vite/generated/*`, `vite-dist/*`, `index.html`, 設計/計画書
- dependency: Step 1〜3
- verification: `npm run build:vite`, focused tests再確認、`git diff --check`, `git status --short`, staged diff inspection
- done: 必須検証成功、生成面がroot実装と一致し、task-owned commitが作成される。

## Self-review

- canonicalなplayer-visible仕様とroot sourceを生成物より先に更新する順序にした。
- 単体テストだけでなく、設定パネルのmarkup/CSS契約と実ブラウザ操作を完了条件へ含めた。
- `build:browser`だけでは新規moduleのVite bridge/bundle反映まで完了しないため、包含関係のある `build:vite` を生成手順に選んだ。
- OFF時のRAF停止、background gap、再初期化cleanup、storage/RAF失敗をStep 2の客観的done条件へ含めた。
- 初回の `index.html` 直接変更は `index.classic.html` からのVite生成で失われた。計画を修正し、既存ファイルがある場合の生成入力である `index.classic.html` を先に変更してから両配信面を再生成する順序へ改訂した。

## 完了チェックリスト

- [x] `01-rulebook.md` にFPS表示仕様を追加
- [x] 設定ボタンと画面端表示DOMを追加
- [x] UI所有のRAF計測controllerを実装
- [x] bootstrap要素取得・event配線を追加
- [x] 設定ボタンとオーバーレイCSSを追加
- [x] focused unit/layout tests成功
- [x] `npm run typecheck` 成功
- [x] `npm run build:vite` 成功
- [x] 実ブラウザでON・更新・OFF・配置を確認
- [x] `git diff --check` とtask-owned diff確認
- [x] task-owned変更だけをコミット
