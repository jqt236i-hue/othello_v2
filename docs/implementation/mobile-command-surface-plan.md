# スマホ縦画面コマンドサーフェス実装計画

Role: `docs/implementation/mobile-command-surface-design.md` を実装・検証・コミットまで進める実行計画。
Target: `layout-profile-phone-portrait` のブラウザUI。
Source of truth: `01-rulebook.md`、`docs/architecture-contracts.md`、上記設計書。
Non-goals: ゲームルール、盤面描画、ネットワーク契約、PC/iPad横画面の再設計。

## Step 1: プレイヤー向け仕様を更新する

- Outcome: スマホ縦画面のメニュー、操作シート、全画面パネル、アクセシビリティ挙動を仕様正本へ追加する。
- Files: `01-rulebook.md`
- Dependencies: レビュー済み設計書
- Verification: `git diff --check`、該当節の目視確認
- Done: 実装予定の全プレイヤー可視挙動が12.11節に記載され、既存レイアウト記述と矛盾しない。

## Step 2: スマホ操作コントローラーを実装する

- Outcome: 既存UIを状態源とするドロワー、操作シート、代理操作、フォーカス、履歴、既存パネル連携が動く。
- Files: `ui/mobile-command-surface.ts`, `ui/bootstrap/init-events.ts`
- Dependencies: Step 1
- Verification: 新規focused Jest、`npm run typecheck`
- Done: controllerが冪等に初期化され、ゲーム/盤面/ネットワークへ依存せず、対象操作を既存DOMへ委譲する。

## Step 3: スマホ専用スタイルを実装する

- Outcome: スマホ縦画面だけで既存トレイを隠し、新入口、ドロワー、シート、全画面パネルを表示する。
- Files: `styles-mobile-command-surface.css`, `index.classic.html`
- Dependencies: Step 2
- Verification: CSS契約Jest、320/393/430px幅でのソース・ブラウザ確認
- Done: safe area、44pxタップ領域、focus、reduced motion、横溢れ防止が実装され、PC表示には適用されない。

## Step 4: 既存テスト契約を新仕様へ更新する

- Outcome: 横スクロール式トレイを正とした古いテストを、新コマンドサーフェスを正とする契約へ置き換える。
- Files: `test/ui.mobile-command-surface.test.ts`, `test/ui.mobile-quick-controls-layout.test.ts`, `test/ui.mobile-side-panel-widths.test.ts`, 必要に応じて既存レスポンシブ契約テスト
- Dependencies: Step 2, Step 3
- Verification: 対象Jestを `--runTestsByPath` で実行
- Done: 新しい操作・スタイル契約を直接検証し、意図的に変更した旧期待だけが更新される。

## Step 5: ブラウザ生成物を更新する

- Outcome: TypeScript、module registry、Vite entry/bundle、cachebusterへ変更を反映する。
- Files: 既存スクリプトが生成する `dist/`, `public/`, `index.html`, `vite-dist/` と必要なmirror
- Dependencies: focused tests成功
- Verification: `npm run build:browser`、`npm run build:vite`、必要なら `npm run worker:prepare`
- Done: classic/Vite両レーンで新モジュールとCSSが配信され、生成物を手編集していない。

## Step 6: 実ブラウザでレスポンシブ・操作検証する

- Outcome: スマホ主要サイズとデスクトップで表示、操作、フォーカス、横溢れ、盤面非回帰を確認する。
- Files: 変更なし（不具合発見時はStep 2〜4へ戻る）
- Dependencies: Step 5
- Verification:
  - 320x568、393x852、430x932でメニュー/操作/対象パネル
  - 1280x720で既存レール/クイックバーと新UI非表示
  - `documentElement.scrollWidth <= innerWidth`
  - Escape、外側タップ、戻る、画面サイズ変更
- Done: 全完了条件を満たし、スクリーンショットまたは測定結果で確認できる。

## Step 7: 最終確認とコミット

- Outcome: タスク所有差分だけを整合した状態でコミットする。
- Files: 上記タスク所有ファイルと必要な生成物
- Dependencies: Step 1〜6成功
- Verification: `git diff --check`、focused Jest、`npm run typecheck`、最終 `git status --short`、関連diff目視
- Done: 意図しない変更がなく、検証結果を添えて小さく具体的なコミットを作成する。

## Completion checklist

- [x] `01-rulebook.md` が新しいスマホ挙動を規定している
- [x] 新controllerが既存UIを状態源としている
- [x] Single Visual WriterとUI/game/network境界を維持している
- [x] ドロワー、操作シート、全画面パネルが実装されている
- [x] focus、safe area、44px、reduced motion、戻る操作を満たす
- [x] 320/393/430pxで横溢れがない
- [x] PC/iPad/横画面に回帰がない
- [x] focused tests、typecheck、browser build、実ブラウザ検証が成功している
- [x] 生成物とmirrorの要否を確認し、正規スクリプトで同期している
- [x] 最終diffとstatusを確認し、タスク所有差分をコミットしている

## Verification results

- `npm run typecheck`: 成功（実装初回の型不一致を修正後に再実行）
- task-only分離環境のfocused Jest 5 suites / 33 tests: 成功
- task-only分離環境の`npm run build:vite`: 成功
- task-only分離環境の`node scripts/prepare-worker-assets.js`: 成功（Worker mirror 944 files、新CSSのコピーを含む）
- 共有チェックアウトでは途中から別タスクのカード実装が同時進行したため、生成物はHEAD＋本タスク差分だけの分離環境で作成し、別タスクの内容を混入させていない
- Chromium phone portrait:
  - 320x568、393x852、430x932の全サイズで `scrollWidth === innerWidth`
  - ドロワー、操作シート、ヘルプ、設定、Escape、ブラウザ戻る、focus returnを確認
  - console error / page errorなし
- Chromium 1280x720:
  - 新コマンドサーフェスは非表示
  - 既存アクションレールとクイックバーは表示
  - console error / page errorなし
- Chromium iPad相当 1024x768、768x1024:
  - 新コマンドサーフェスは非表示
  - 横溢れ、console error、page errorなし

## Self-review

- 正本更新を実装より先に配置した。
- controller、CSS、テスト、生成、実ブラウザ確認の依存順を分離した。
- 旧テストが横スクロールUIを固定しているため、意図的な期待更新を独立Stepにした。
- `build:browser`だけでなくVite生成と必要なWorker mirror判断を含めた。
- 各Stepの完了条件はファイル作成ではなく、観測可能な挙動または検証結果にした。
