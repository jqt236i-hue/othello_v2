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

## Step 14: 戦況・敵アイコン仕様を正本へ追加する

- Outcome: スマホ縦画面の戦況入口、表示対象、閉じ方、敵アイコンの表示・操作条件がプレイヤー向け仕様で明確になる。
- Files: `01-rulebook.md`, `docs/implementation/mobile-command-surface-design.md`, 本計画
- Dependencies: 現行DOM、旧スマホ実装、参照画像の照合
- Verification: `git diff --check`、該当節と設計Self-reviewの目視確認
- Done: 戦況データを複製せず、既存panelを表示源にすることと、敵アイコンが既存敵表示へ追従することが規定される。

## Step 15: 戦況layerと敵キャラクターbridgeを実装する

- Outcome: 右上の戦況ボタンが既存の最後使用カード／顕現効果・盤上の石を開き、相手手札行に敵アイコンが表示される。
- Files: `ui/mobile-command-surface.ts`, `ui/mobile-command-surface/config.ts`, `ui/mobile-command-surface/state.ts`, `ui/mobile-command-surface/view.ts`, `ui/mobile-command-surface/status-bridge.ts`, `styles-mobile-command-surface.css`, `assets/images/cpu/face/*`
- Dependencies: Step 14
- Verification: focused Jest、`npm run typecheck`、source inspection
- Done: `status` が既存layerと排他的に動作し、panel nodeはclose/profile離脱/destroyで元位置へ戻り、敵アイコンはCPU・ネット相手表示へ追従する。

## Step 16: 参照画像比較とゲームUI QAを完了する

- Outcome: 主要スマホ幅で戦況の二パネルと敵アイコンを実画面上で確認し、操作・盤面・PC表示に回帰がない。
- Files: project root `design-qa.md`、比較用スクリーンショット
- Dependencies: Step 15、focused verification成功
- Verification:
  - 320x568、393x852、430x932で戦況ボタン、敵アイコン、横溢れ
  - 戦況openで `#manifest-effect-panel` → `#stone-info-panel` の順序
  - close、外側タップ、Escape、ブラウザ戻る、focus return
  - CPUレベル変更と敵画像同期
  - 1280x720で新UI非表示と既存敵キャラクター表示
  - 参照画像と同一状態の結合比較、console/page error確認
- Done: `design-qa.md` が `final result: passed` で、P0/P1/P2が残らない。

## Step 17: 配信物同期・最終監査・コミット

- Outcome: Classic/Vite/Worker mirrorが変更を配信し、タスク所有差分が一つの検証済みコミットになる。
- Files: 正規build/prepareが生成するbrowser出力とmirror
- Dependencies: Step 15〜16
- Verification: focused Jest、`npm run typecheck`、`npm run checkall`、`npm run build:browser`、`npm run build:vite`、`npm run worker:prepare`、`git diff --check`、task-only status/diff
- Done: 仕様・設計・実装・QA・生成物が一致し、コミット後の作業ツリーがクリーンになる。

## Step 18: PC由来の役割別カラートークンを仕様化する

- Outcome: スマホボタンの単色化を解消し、PC版の機能別カラーとアクセシビリティ条件を仕様・設計へ固定する。
- Files: `01-rulebook.md`, `docs/implementation/mobile-command-surface-design.md`, 本計画
- Dependencies: PC版左レール・クイック操作と現行スマホメニューの実画面比較
- Verification: PC/スマホ比較スクリーンショット、設計Self-review、`git diff --check`
- Done: 色の役割、適用対象、色だけへ依存しない条件、単一設定レジストリの所有が明記される。

## Step 19: 単一コマンド設定から役割色を描画する

- Outcome: 上部3入口、ドロワー項目、操作シート主要ボタンが機能別トーンで表示され、状態・代理操作・既存パネル挙動は変わらない。
- Files: `ui/mobile-command-surface/config.ts`, `ui/mobile-command-surface/view.ts`, `styles-mobile-command-surface.css`
- Dependencies: Step 18
- Verification: typed build、focused Jest、色コントラスト測定、スマホ実画面
- Done: `data-mobile-tone` が型付き設定から投影され、共通focus、active、disabled状態が全トーンで識別できる。

## Step 20: 色分けの視覚QAと配信同期を完了する

- Outcome: PC版を視覚基準に、スマホのメニュー・操作・閉状態で単色感が解消され、PC表示へ回帰がない。
- Files: `test/ui.mobile-command-surface.test.ts`, `test/ui.mobile-side-panel-widths.test.ts`, `design-qa.md`, 正規build/prepare生成物
- Dependencies: Step 19
- Verification:
  - 393x852で閉状態、メニュードロワー、操作シートのbefore/after比較
  - 320x568、430x932で横溢れ、タップ領域、文字欠け確認
  - 1280x800でPCレール・クイック操作とスマホsurface非表示を確認
  - console error、focused Jest、typecheck、checkall、browser/Vite build、Worker mirror同期
- Done: `design-qa.md` が結合比較を記録して `final result: passed` となり、検証済み差分がコミットされる。

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

### 戦況・敵アイコン追加 completion checklist

- [x] 右上に44px以上の `戦況` ボタンが表示される
- [x] 戦況内に既存の最後使用カード／顕現効果と盤上の石が参照画像の順で表示される
- [x] 戦況nodeがclose、profile離脱、destroyで元の親・順序へ戻る
- [x] 相手手札行の右端に現在の敵キャラクターアイコンが表示される
- [x] CPUレベル変更・ネット対戦相手表示・CPU設定の利用可否へ追従する
- [x] drawer、status、quick、native panelが相互排他で、履歴・Escape・focusが機能する
- [x] 320/393/430pxで横溢れと盤面操作の阻害がない
- [x] 1280pxで新要素が非表示になり、既存PC UIへ回帰がない
- [x] focused Jest、typecheck、checkall、browser/Vite build、Worker mirror同期が成功する
- [x] `design-qa.md` が参照画像との比較を記録し、`final result: passed` になる
- [x] 最終diffがタスク所有差分だけで、コミット後の作業ツリーがクリーンになる

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

### 戦況・敵アイコン追加 verification results

- focused Jest 5 suites / 25 tests: 成功
  - `test/ui.mobile-command-surface.test.ts`
  - `test/ui.mobile-command-surface-state.test.ts`
  - `test/ui.mobile-side-panel-widths.test.ts`
  - `test/ui.mobile-quick-controls-layout.test.ts`
  - `test/ui.left-rail-layout-contract.test.ts`
- `npm run typecheck`: 成功（`build:vite` / `worker:prepare` 内でもroot・trainingを再確認）
- `npm run build:browser`: 成功（module registry 1065 modules）
- `npm run build:vite`: 成功（1450 modules、既知のchunk-size warningのみ）
- `npm run worker:prepare`: 成功（Worker mirror 957 files）
- `npm run checkall`: Worker mirror同期前の初回は新規face asset不足を正しく検出。`worker:prepare` 後の再実行は成功
- Codex in-app Browser:
  - タッチ条件の320x568、393x852、430x932で戦況ボタン、敵アイコン、panel順序、横溢れなしを確認
  - close、Escape、ブラウザ戻る、focus return、profile離脱時の復元を確認
  - 敵アイコンからCPU設定を開き、クリック伝播と画面内配置の回帰を修正・再確認
  - 1280x720で新要素が非表示、既存敵キャラクターパネルが表示されることを確認
  - console errorなし
- `design-qa.md`: 添付画像と実装を同じ比較画像で確認し、`final result: passed`

## Self-review

- 正本更新を実装より先に配置した。
- controller、CSS、テスト、生成、実ブラウザ確認の依存順を分離した。
- 旧テストが横スクロールUIを固定しているため、意図的な期待更新を独立Stepにした。
- `build:browser`だけでなくVite生成と必要なWorker mirror判断を含めた。
- 各Stepの完了条件はファイル作成ではなく、観測可能な挙動または検証結果にした。
- リファクタリングを単なるファイル分割で完了扱いにしないよう、Step 9とStep 12に復元可能性と再初期化の観測条件を追加した。
- CSS変更は既存responsive正本を先に更新し、後勝ちoverrideを削除する順序にした。
- 共有checkoutで別タスクのHEAD更新があったため、最新HEADからの最終statusとdiffで本タスク所有差分だけであることを再確認する。
- 初回リファクタリングはプレイヤー向け挙動を変えなかったため既存12.11節との一致確認だけで完了したが、今回の戦況・敵アイコン追加は新しい表示仕様として正本更新が必要と判断した。
- 戦況・敵アイコン追加はプレイヤー向け仕様を変更するため、Step 14で `01-rulebook.md` をコードより先に更新する。
- 戦況内容のコピー実装を計画から除外し、既存panel nodeの一時配置と復元を独立したdone条件にした。
- 参照画像に含まれないターン／スコア用 `#effect-live-panel` は対象外とし、表示対象を `#manifest-effect-panel` と `#stone-info-panel` に限定した。
- 敵アイコンは旧版の実assetを再利用し、現在の敵表示とCPU設定入口だけへ同期するため、ゲーム／ネットワーク状態を新規所有しない。

### 役割別カラー completion checklist

- [x] 上部の `メニュー` / `戦況` / `操作` が金・緑・紫に分かれている
- [x] ドロワー11機能が型付きコマンド設定から役割色を受け取る
- [x] 操作シートのリセット・BGM・AUTO・ミュートがPC版由来の役割色を使う
- [x] ラベルと既存アイコンを維持し、色だけを識別手段にしていない
- [x] focus-visible、active、disabled状態が全トーンで識別できる
- [x] 320/393/430pxで横溢れと文字欠けがない
- [x] 1280pxのPC表示へスマホ色トークンが漏れない
- [x] `design-qa.md` がPC、before、afterの結合比較を記録して `final result: passed` になる
- [x] focused Jest、typecheck、checkall、browser/Vite build、Worker mirror同期が成功する

### 役割別カラー verification results

- focused Jest 5 suites / 26 tests: 成功
  - `test/ui.mobile-command-surface.test.ts`
  - `test/ui.mobile-command-surface-state.test.ts`
  - `test/ui.mobile-side-panel-widths.test.ts`
  - `test/ui.mobile-quick-controls-layout.test.ts`
  - `test/ui.left-rail-layout-contract.test.ts`
- `npm run typecheck`: 成功（root / training）
- `npm run checkall`: 成功
- `npm run build:browser`: 成功（module registry 1065 modules）
- `npm run build:vite`: 成功（1450 modules、既知のchunk-size warningのみ）
- `npm run worker:prepare`: 成功（Worker mirror 957 files）
- 役割別文字色のコントラスト: 暗背景に対して16.64:1〜18.36:1

## 追加要望: 相手手札上のコンパクト戦況

### Step 17: 仕様・設計の更新

- [x] `01-rulebook.md` にスマホのコンパクト戦況常設と「盤上の石」の通常非表示を追加する
- [x] `mobile-command-surface-design.md` に既存 `#effect-live-panel` の移設・復元契約を追加する
- done: 実装前にプレイヤー向け仕様とpresentation境界を確定する

### Step 18: 既存戦況DOMのスマホ投影

- [x] 相手手札上の専用hostを `view.ts` で生成する
- [x] スマホprofile中だけ `#effect-live-panel` をhostへ移し、profile離脱・destroyで元の親と順序へ戻す
- [x] ROUND・黒白ラベル付き石数・現在手番を二段のコンパクトHUDとして表示する
- [x] 通常画面の `#stone-info-panel` を非表示にし、戦況ポップアップ内では表示を維持する
- done: 状態や数値を複製せず、既存status更新経路だけで双方の表示が更新される

### Step 19: 検証と完了

- [x] DOM復元、戦況ポップアップ順序、スマホCSS契約のfocused testを更新して成功させる
- [x] `typecheck`、`checkall`、`build:browser`、`build:vite`、`worker:prepare`を成功させる
- [x] 320x568、393x852、430x932で常設戦況、盤上の石の非表示、横溢れなしを確認する
- [x] 1280px PC表示で戦況panelが左情報stackへ復帰することを確認する
- [x] 添付参照と実装を同じ比較画像で確認し、`design-qa.md` を `final result: passed` にする
- [x] タスク所有差分だけをコミットする

### 相手手札上のコンパクト戦況 verification results

- focused Jest 5 suites / 36 tests: 成功
  - `test/ui.mobile-command-surface.test.ts`
  - `test/ui.battle-status-panel.test.ts`
  - `test/ui.layout-responsive.aspect-ratio.test.ts`
  - `test/ui.left-info-stack-layout-contract.test.ts`
  - `test/ui.mobile-side-panel-widths.test.ts`
- `npm run typecheck`: 成功（root / training）
- `npm run checkall`: 成功
- `npm run build:browser`: 成功（module registry 1065 modules）
- `npm run build:vite`: 初回はWindowsの一時的な `index.html` 書き込み競合で失敗し、即時再実行で成功（1450 modules、既知のchunk-size warningのみ）
- `npm run worker:prepare`: 成功（Worker mirror 957 files）
- Codex in-app Browser:
  - 320x568、393x852、430x932でコンパクト戦況が相手手札上に常設され、`#stone-info-panel` は通常画面で非表示
  - 393x852で `戦況` を開くと `#manifest-effect-panel` → `#stone-info-panel` の順で表示
  - close後もコンパクト戦況はhostに残り、focusは `戦況` へ復帰
  - 1280x800で `#effect-live-panel` と `#stone-info-panel` が左情報stackへ復帰
  - 全確認サイズで横溢れなし、console errorなし
- 添付参照の対象部分188x37pxと実装を同じ188x37pxへ正規化して比較し、P0/P1/P2なし
- Codex in-app Browser:
  - 393x852で閉状態、ドロワー、操作シートをbefore/after比較
  - 320x568でドロワー幅275.1875px、最小項目高51px、横溢れなし
  - 430x932でドロワー幅360px、最小項目高51px、横溢れなし
  - 1280x800のPC入力条件で `layout-profile-16x9`、スマホsurface非表示、既存レール/クイック操作表示
  - console errorなし
- `design-qa.md`: PC版、旧スマホ、更新後スマホを同じ比較画像で確認し、P0/P1/P2なし、`final result: passed`

### 役割別カラー Self-review

- 任意の虹色化ではなく、PC版の既存トーンとクイック操作の意味をスマホへ投影した。
- コマンドIDごとのCSS列挙を避け、既存の単一レジストリへ `tone` を持たせたため、機能追加時に挙動と配色が別正本へ分裂しない。
- 彩色面積を左レール、枠、弱い光、アイコンへ限定し、暗いsurface、文字、フォーカスリングを共通化した。
- BGMとミュートはPC版どおり同じ青を共有するが、文言、pressed状態、配置で識別できるため色だけに依存しない。
- `プロフィール` と `ヘルプ` のPC未定義色は、個人識別のローズと補助情報のセージへ割り当て、設定とラベルに明示した。
