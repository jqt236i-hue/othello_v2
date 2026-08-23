# 盤上の石・マス一覧／詳細ポップアップ実装計画

## 1. 基礎設計

この計画は `docs/implementation/current-board-stone-catalog-design.md` に基づく。

## 2. 実装ステップ

### Step 1: プレイヤー向け仕様とHTML shellを更新する

- Outcome: 石情報の新しい操作、表示内容、レスポンシブ配置が正本とHTMLに反映される。
- Components:
  - `01-rulebook.md`
  - `index.classic.html`
  - 生成される `index.vite.html` / `index.html`
- Dependencies: なし
- Verification:
  - 該当仕様節の読み合わせ
  - HTML ID重複確認
  - `git diff --check`
- Done:
  - 盤面入力では詳細を開かず、一覧内の石で開く仕様が明記される。
  - `#left-info-stack` がゲームコンテナ内の盤面直後へ配置される。

### Step 2: settled frameから石一覧を投影する

- Outcome: 現在表示中の石種、画像、個数、代表座標が既存パネルへ描画される。
- Components:
  - `ui/presentation/stone-info-panel.ts`
  - `ui/presentation/stone-info-controller.ts`
  - `ui/board-renderer.ts`
- Dependencies: Step 1
- Verification:
  - 新規/更新focused Jest
  - 通常黒白、特殊石、空盤面、重複集約、隠し罠のsource inspection
- Done:
  - settled frame購読のたびに一覧が同期される。
  - 通常石スキン/特殊石画像が盤面appearanceと一致する。

### Step 3: 詳細をポップアップへ移す

- Outcome: 一覧項目だけが石詳細を開き、既存の説明と現在状態タグを利用できる。
- Components:
  - `ui/presentation/stone-info-controller.ts`
  - `styles-board.css`
- Dependencies: Step 2
- Verification:
  - 詳細開閉、背景、Escape、タグボタンのfocused Jest
  - 既存の石名/説明/状態タグテスト
- Done:
  - `#stone-info-detail-panel` が開閉できる。
  - 一覧パネルは詳細開閉にかかわらず表示を維持する。

### Step 4: 盤面入力から情報表示を除去する

- Outcome: 盤面ホバー/タップ/長押しが石情報を開かず、カード対象選択と競合しない。
- Components:
  - `ui/board-input-controller.ts`
  - `ui/board-dom-compat/input.ts`
  - `ui/board-dom-compat/renderer.ts` は既存未コミット差分があるため、既存の入力binderが旧capabilityを無視できることを確認し、ソース変更を避ける
  - 関連inputテスト
- Dependencies: Step 3
- Verification:
  - `test/ui.board-input-controller.test.ts`
  - `test/ui.board-dom-compat.input.test.ts`
  - `test/ui.board-dom-compat.long-press-info.test.ts`
- Done:
  - 情報表示用long-press timer/callbackがない。
  - 盤面クリックとhover previewは維持される。

### Step 5: phone/iPad縦画面へ同じ一覧を表示する

- Outcome: コンパクトな横スクロール一覧が盤面直後へ表示される。
- Components:
  - `styles-responsive.css`
  - `styles-board.css`
  - レスポンシブ契約テスト
- Dependencies: Step 1-3
- Verification:
  - `test/ui.layout-responsive.aspect-ratio.test.ts`
  - `test/ui.left-info-stack-layout-contract.test.ts`
  - ブラウザでdesktop/phone/iPad相当viewportを確認
- Done:
  - phone/iPad縦画面の非表示規則から石一覧が除外される。
  - 一覧が盤面や手札の横幅を押し広げない。

### Step 6: 生成・総合検証・コミット

- Outcome: ブラウザ生成物が同期し、タスク所有差分だけがコミットされる。
- Components:
  - browser/module registry/Vite生成物
  - 必要なWorker mirror
- Dependencies: Step 1-5
- Verification:
  - focused Jest bundle
  - `npm run typecheck`
  - `npm run build:browser`
  - Vite表示確認に必要なら `npm run build:vite`
  - `git diff --check`
  - 最終 `git status --short` とタスク差分
- Done:
  - 全完了条件が確認済み。
  - 既存未コミット変更を含めず、タスク所有差分をコミット済み。

### Step 7: マウスホイールで一覧を横移動できるようにする

- Outcome: PCでスクロールバーをドラッグしなくても、一覧上の通常ホイール操作で隠れた石種へ移動できる。
- Components:
  - `01-rulebook.md`
  - `ui/presentation/stone-info-panel.ts`
  - `test/ui.presentation.stone-info-panel.test.ts`
- Dependencies: Step 2、Step 5
- Verification:
  - 縦ホイールによる左右移動、横入力・ブラウザ拡大縮小入力の非変換、横溢れなし・左右端での既定縦スクロール維持をfocused Jestで確認
  - `npm run typecheck`
  - `npm run build:browser`
  - デスクトップ実画面で横移動とコンソールエラーの有無を確認
- Done:
  - 一覧に横溢れがある時、縦ホイールでスクロール位置が変わる。
  - 一覧の端ではホイールイベントを捕捉せず、親の縦スクロールを妨げない。
  - 同じ一覧DOMへイベントが重複登録されない。

### Step 8: 盤面マーカーを石一覧へ追加する

- Outcome: 一覧を `盤上の石・マス` に拡張し、封鎖・流星穴・凍結・種・毒・灼熱・治癒を石とは別の項目として確認できる。
- Components:
  - `01-rulebook.md`
  - `正本/共通ルール正本.md`
  - `正本/演出正本.md`
  - `ui/presentation/stone-info-panel.ts`
  - `ui/presentation/stone-info-controller.ts`
  - `ui/mobile-command-surface/view.ts`
  - `styles-board.css`
  - `index.classic.html` と生成されるbrowser entry
  - 関連focused Jest
- Dependencies: Step 2、Step 3、Step 5、Step 7
- Verification:
  - frame kind正規化とregistry分類で盤面マーカー全7種を表示
  - 石と特殊マスが同じセルにある場合も各項目の詳細を取り違えない
  - owner-turn/completed-turn/permanent timer、異なるtimerの別集約、timerのみのframe更新
  - 石状態・board bonus・theory numberを独立したマス項目にしない
  - 画像/CSSタイル、名称、個数、特殊マス・残りターンタグ
  - focused Jest、`npm run typecheck`、`npm run build:browser`、`npm run build:vite`
  - Vite/classic実画面、console error、HTTP 200、最終diff/status
- Done:
  - registry上の盤面マーカー全7種がsettled frameから表示される。
  - 一覧のbutton closureと詳細が同じsettled frame snapshotを使う。
  - 可視文言・アクセシビリティ文言・スマホ戦況文言が `石・マス` で同期する。
  - 独立レビューでP0〜P3の未解決指摘がない。

## 3. 完了チェックリスト

- [ ] `01-rulebook.md` が新しい表示/操作と一致する。
- [ ] 盤上の石・マス一覧がsettled frameから生成される。
- [ ] 通常黒/白、特殊石、個数、空状態を表示できる。
- [ ] 一覧クリック/タップで詳細ポップアップが開く。
- [ ] 効果タグとタグ意味ポップアップが維持される。
- [ ] 盤面ホバー/タップ/長押しから情報表示が除去される。
- [ ] PC/phone/iPadのレスポンシブ配置が成立する。
- [ ] 隠し罠とネットpresentation順を維持する。
- [ ] focused test、型検査、ブラウザビルドが成功する。
- [ ] 生成物と最終差分を確認する。
- [ ] タスク所有ファイルだけをコミットする。
- [x] PCで盤上の石・マス一覧をマウスホイール横スクロールでき、端では親の縦スクロールを維持する。
- [x] 盤面マーカー全7種を石とは別項目として表示できる。
- [x] 同一セルの石と特殊マスが各自のsettled-frame詳細を開く。
- [x] 特殊マスのtimer集約・表示・更新と永続穴が正しい。
- [x] 石状態や盤面マーカー外の装飾を独立項目にしない。
- [x] `盤上の石・マス` の可視文言・aria・スマホ戦況が同期する。

## 4. Self-review

- 設計のsettled frame方針を全実装ステップへ反映し、canonical stateの別走査を計画から除外した。
- HTMLの正本は `index.classic.html`、Vite entryとproduction `index.html` は既存スクリプト生成という順序を明記した。
- 既存の `ui/board-dom-compat/renderer.ts` にユーザー由来の未コミット差分があるため、同ファイルを変更せずに成立する入力binder側の整理を採用した。
- レスポンシブ表示はCSSだけでなくブラウザ実表示も確認するよう補強した。
- ホイール追加では単純に全入力を捕捉せず、横方向入力が優勢な場合と左右端では既定動作を維持する計画へ修正した。
- Step 8は独立設計レビューを先に行い、kind正規化、subject/type付きframe snapshot、`type + duration` 集約、CSSタイルshell、`特殊マス` タグ、全surface文言同期を必須条件として反映した。

## 5. Step 7 実施結果

- `npx jest --runInBand --runTestsByPath test/ui.presentation.stone-info-panel.test.ts`: 4 tests passed。横移動、重複登録防止、横優勢入力、`Ctrl` 付き入力、左右端、横溢れなしを確認。
- `npm run typecheck`: 成功。
- `npm run build:browser`: 成功。classic registryとcachebusterを更新。
- `npm run build:vite`: 成功。標準Vite bundle、entry、startup versionを更新。
- 実ブラウザ:
  - `http://127.0.0.1:8000/`（Vite、Pixi）でイベント登録属性が1、console warning/errorなし。
  - `http://127.0.0.1:8000/index.classic.html`（classic、Pixi）でもイベント登録属性が1、console warning/errorなし。
  - 初期盤面は2項目で横溢れしないため、実際の移動量と左右端はfocused Jestの横溢れ再現で確認した。
- `git diff --check`: 成功。
- `http://127.0.0.1:8000/`: HTTP 200。PID 33120の本repository向け`http-server`が継続稼働中。

## 6. Final independent review

- Reviewer: 読み取り専用の独立subagent。
- 初回設計レビューでは、ブラウザ拡大縮小用の`Ctrl` / `Command`付きホイールを捕捉しない条件が必要との指摘があり、実装・テスト・設計へ反映した。
- 最終実装レビュー: P0〜P3の指摘なし。縦優勢判定、overflow/端判定、重複登録防止、テスト、仕様同期を確認済み。
- Vite生成後のbounded recheck: `index.html`、`index.vite.html`、Vite bundle、classic registryの同期に問題なし。追加修正なし。

## 7. Step 8 実施結果

- registry上の盤面マーカー全7種（封鎖、流星穴、凍結、種、毒、灼熱、治癒）を、settled frameから石とは別項目として投影する実装へ拡張した。
- 同じセルに石と特殊マスが重なっても各項目が自身の詳細を開き、同種でも残りターンが異なる場合は別項目として集約することをfocused Jestで確認した。
- 毒・灼熱など石に付く状態は独立マスにせず、石の詳細へ状態名と残りターンを表示する。board bonusとtheory numberも一覧対象外のまま維持した。
- `npx jest --runInBand --runTestsByPath test/ui.presentation.stone-info-panel.test.ts test/ui.mobile-command-surface.test.ts test/ui.board-dom-compat.long-press-info.test.ts test/ui.layout-responsive.aspect-ratio.test.ts test/ui.left-info-stack-layout-contract.test.ts test/ui.board-render-projection.test.ts`: 6 suites / 65 tests passed。
- `npm run typecheck`: 成功。
- `npm run build:browser`: 成功。classic registryとcachebusterを更新。
- `npm run build:vite`: 成功。標準Vite bundle、entry、startup versionを更新。
- 実ブラウザ:
  - `http://127.0.0.1:8000/`（Vite、Pixi）で見出し・案内文・ariaが `盤上の石・マス` に同期し、初期盤面2項目、Pixi canvas 1、DOM compatibility cell 0、console warning/errorなし。
  - `http://127.0.0.1:8000/index.classic.html`（classic、Pixi）でも同じ表示とbackend構成を確認し、console warning/errorなし。
- 独立実装レビューで指摘された、石の毒・灼熱状態名の明示と石専用aria表現を修正し、状態timer更新とタグ説明を回帰テストへ追加した。
- 修正後の独立bounded recheckではP0〜P3の未解決指摘なし。reviewer側でもfocused Jest 2 suites / 17 tests passedと`git diff --check`成功を再確認した。
