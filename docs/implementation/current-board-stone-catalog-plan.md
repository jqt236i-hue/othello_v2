# 盤上の石一覧・詳細ポップアップ実装計画

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

## 3. 完了チェックリスト

- [ ] `01-rulebook.md` が新しい表示/操作と一致する。
- [ ] 盤上の石一覧がsettled frameから生成される。
- [ ] 通常黒/白、特殊石、個数、空状態を表示できる。
- [ ] 一覧クリック/タップで詳細ポップアップが開く。
- [ ] 効果タグとタグ意味ポップアップが維持される。
- [ ] 盤面ホバー/タップ/長押しから情報表示が除去される。
- [ ] PC/phone/iPadのレスポンシブ配置が成立する。
- [ ] 隠し罠とネットpresentation順を維持する。
- [ ] focused test、型検査、ブラウザビルドが成功する。
- [ ] 生成物と最終差分を確認する。
- [ ] タスク所有ファイルだけをコミットする。

## 4. Self-review

- 設計のsettled frame方針を全実装ステップへ反映し、canonical stateの別走査を計画から除外した。
- HTMLの正本は `index.classic.html`、Vite entryとproduction `index.html` は既存スクリプト生成という順序を明記した。
- 既存の `ui/board-dom-compat/renderer.ts` にユーザー由来の未コミット差分があるため、同ファイルを変更せずに成立する入力binder側の整理を採用した。
- レスポンシブ表示はCSSだけでなくブラウザ実表示も確認するよう補強した。
