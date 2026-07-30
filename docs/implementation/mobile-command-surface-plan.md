# スマホ縦画面コマンドサーフェス実装計画

Role: `docs/implementation/mobile-command-surface-design.md` の初回移植と、移植後レビューで特定した保守性・ライフサイクル問題を実装・検証・コミットまで進める実行計画。
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

## Step 8: 内部契約と単一設定レジストリを分離する

- Outcome: メニュー、既存パネル、代理コントロールの定義が型付きの単一正本になり、controller本体から定数重複がなくなる。
- Files: `ui/mobile-command-surface/config.ts`, `ui/mobile-command-surface.ts`
- Dependencies: 改訂・自己レビュー済み設計書
- Verification: TypeScript compile、設定から生成したメニューとパネル解決のfocused Jest
- Done: パネル追加に必要なID・trigger・label・DOM参照が1つのcommand定義へ集約される。

## Step 9: 表示状態、履歴、DOM変更scopeを分離する

- Outcome: 表示状態が排他的unionになり、履歴所有と既存DOM変更が専用controller/scopeで管理される。
- Files: `ui/mobile-command-surface/state.ts`, `ui/mobile-command-surface/history.ts`, `ui/mobile-command-surface/dom-mutations.ts`, `ui/mobile-command-surface.ts`
- Dependencies: Step 8
- Verification: 状態遷移、履歴、破棄復元のfocused Jest
- Done: 不正なlayer/panel組み合わせが型で表現できず、profile離脱とdestroyで既存DOMが元へ戻る。

## Step 10: ビューと代理コントロールを分離する

- Outcome: DOM生成とbutton/select/range同期がcontroller本体から分離され、対象群ごとの単一observerで同期する。
- Files: `ui/mobile-command-surface/view.ts`, `ui/mobile-command-surface/control-proxies.ts`, `ui/mobile-command-surface.ts`
- Dependencies: Step 8、Step 9
- Verification: 既存代理操作Jest、observer対象のソース確認、typecheck
- Done: controller本体が調停に集中し、代理操作の追加・破棄を局所的に変更できる。

## Step 11: スマホCSSの責務重複を解消する

- Outcome: 盤面、石情報、カード詳細のスマホ寸法はresponsive正本へ統合され、コマンドサーフェスCSSは操作surfaceと既存パネルpresentationだけを所有する。
- Files: `styles-responsive.css`, `styles-mobile-command-surface.css`, CSS契約test
- Dependencies: 改訂・自己レビュー済み設計書
- Verification: CSS契約Jest、computed layoutの実ブラウザ確認
- Done: 両CSS間に対象寸法の同一selector再定義がない。

## Step 12: ライフサイクル回帰を固定する

- Outcome: destroy→再初期化、profile離脱→再進入、外部起点パネル、戻る・Escape・focusの回帰がテストで検出できる。
- Files: `test/ui.mobile-command-surface.test.ts`、必要に応じて分離moduleのfocused test
- Dependencies: Step 9〜Step 11
- Verification: 対象Jestを `--runTestsByPath` で実行
- Done: 新しい回帰ケースを含むfocused suiteが成功する。

## Step 13: 生成・実ブラウザ・最終コミット

- Outcome: classic/Vite配信物が正本変更を反映し、主要phone/desktopサイズで非回帰を確認したタスク所有差分がコミットされる。
- Files: 正規buildが生成するbrowser出力とmirrorのうち、本タスクとして安全に分離できるもの
- Dependencies: Step 8〜Step 12
- Verification: `npm run typecheck`、focused Jest、`npm run build:browser`、`npm run build:vite`、必要なbrowser smoke、`git diff --check`、task-only diff/status
- Done: 検証成功、設計・計画同期、タスク所有差分のコミットまで完了する。共有checkoutの既存未コミット生成物と分離できない出力は、混入させず検証結果へ明記する。

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

### Refactoring completion checklist

- [x] メニューとパネル設定が単一レジストリになっている
- [x] 表示状態が排他的unionと純粋遷移で管理されている
- [x] 履歴所有がDOM controllerから分離されている
- [x] 既存DOM変更と注入node/listenerがscope単位で復元される
- [x] destroy→再初期化後もヘルプ絞り込みを含む操作が機能する
- [x] 外部起点パネルを閉じたときにスマホ入口へfocusを奪わない
- [x] 代理操作と監視が分離され、observer instanceが対象要素数に比例しない
- [x] 盤面・石情報・カード詳細のスマホ寸法がresponsive CSSだけにある
- [x] focused Jest、typecheck、browser build、必要な実ブラウザ確認が成功する
- [x] 設計・計画・実装・生成確認が一致し、タスク所有差分がコミット対象として分離されている

## Verification results

- focused Jest 5 suites / 22 tests: 成功
  - `test/ui.mobile-command-surface.test.ts`
  - `test/ui.mobile-command-surface-state.test.ts`
  - `test/ui.mobile-side-panel-widths.test.ts`
  - `test/ui.mobile-quick-controls-layout.test.ts`
  - `test/ui.left-rail-layout-contract.test.ts`
- `npm run typecheck`: 成功（root / training）
- `npm run check:dependency-boundaries`: 成功（4 tests）
- `npm run check:window`: 成功
- `npm run checkall`: 成功
- `npm run build:browser`: 成功（module registry 1064 modules）
- `npm run build:vite`: 成功（1449 modules、既知のchunk-size warningのみ）
- `npm run worker:prepare`: 成功（Worker mirror 948 files）
- 共有チェックアウトで別タスクのコミットが進行中に追加されたが、最終HEADを基準に本タスクのsource・生成物・mirrorだけを差分として分離した
- Chromium phone portrait:
  - 320x568、393x852、430x932の全サイズで `scrollWidth === innerWidth`
  - ドロワー、操作シート、ヘルプ、Escape、ブラウザ戻る、focus returnを確認
  - console error / page errorなし
  - 初回自動操作はdesktop pointer emulationのためphone profileが有効にならず再試行し、mobile/touch contextで全項目が成功
- Chromium 1280x720:
  - 新コマンドサーフェスは非表示
  - 既存アクションレールとクイックバーは表示
  - console error / page errorなし
- 393x852のメニュー、ヘルプ、操作シートと1280x720のデスクトップ表示をスクリーンショットで目視確認

## Self-review

- 正本更新を実装より先に配置した。
- controller、CSS、テスト、生成、実ブラウザ確認の依存順を分離した。
- 旧テストが横スクロールUIを固定しているため、意図的な期待更新を独立Stepにした。
- `build:browser`だけでなくVite生成と必要なWorker mirror判断を含めた。
- 各Stepの完了条件はファイル作成ではなく、観測可能な挙動または検証結果にした。
- リファクタリングを単なるファイル分割で完了扱いにしないよう、Step 9とStep 12に復元可能性と再初期化の観測条件を追加した。
- CSS変更は既存responsive正本を先に更新し、後勝ちoverrideを削除する順序にした。
- 共有checkoutで別タスクのHEAD更新があったため、最新HEADからの最終statusとdiffで本タスク所有差分だけであることを再確認する。
- プレイヤー向け仕様を変更しないため `01-rulebook.md` の追加更新は不要であり、既存12.11節との一致確認だけを行う。
