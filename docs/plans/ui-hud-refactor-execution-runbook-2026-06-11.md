# UI HUD Refactor Execution Runbook - 2026-06-11

## 目的

手札カードの使用可能発光、布石 UI、盤面フレーム周辺のレイヤーと影の調整で増えた UI 実装を、挙動を変えずに整理する。

この手順書の対象は、現時点で断言してリファクタリングした方がよい箇所に限定する。

1. 布石 UI と盤面/手札の重なり順、位置、z-index、offset の数値を CSS 変数化する。
2. 布石 UI 関連の CSS を `styles-layout.css` から分離する。
3. 布石 UI レイヤー、位置、差分バッジ、影なし指定を1つの過密テストから分割する。
4. 必要なら `ui/stone-visuals.ts` の布石差分バッジの DOM anchor 解決を小さく整理する。

## 前提

- これは見た目を変更する作業ではなく、既存の見た目と挙動を保つリファクタリングである。
- `worker-public/` は mirror なので直接編集しない。必要な場合だけ root 側を修正したあと `npm run worker:prepare` で同期する。
- ユーザーが UI 目視確認を行う。Codex は反映、静的検証、対象テストの実行までで止める。
- 作業中に発光範囲、布石 UI の位置、カードの明暗を調整しない。調整が必要になった場合はリファクタリングを止め、別タスクとして扱う。

## 対象ファイル

主に触るファイル:

- `styles-variables.css`
- `styles-layout.css`
- `index.html`
- `ui/stone-visuals.ts`
- `test/ui.board-hud-layout-contract.test.ts`

新規作成候補:

- `styles-charge-hud.css`
- `test/ui.charge-hud-layering-contract.test.ts`
- `test/ui.charge-hud-position-contract.test.ts`
- `test/ui.charge-delta-style-contract.test.ts`

触らないファイル:

- `worker-public/*`
- `dist/*`
- カード仕様、カード効果、ゲーム進行ロジック
- `01-rulebook.md` と `正本/*.md`

この作業は内部整理であり、プレイヤー向け仕様変更ではないため、通常は仕様書更新を行わない。

## Phase 0: 作業開始前の確認

1. dirty tree を確認する。

```powershell
git status --short
```

2. 既存変更を分類する。

- UI HUD リファクタリング対象の変更
- 無関係なユーザー作業または別 Codex 作業
- generated / mirror 出力
- 不明な変更

3. 無関係な dirty file が大量にある場合は、今回触るファイルを限定する。

この状態では `git add -A` を使わない。コミットも、今回の差分だけを安全に分離できる場合に限る。

## Phase 1: 現状の固定

目的は「リファクタリング前の期待挙動」をテストで固定すること。

実行する。

```powershell
npx jest test/ui.board-hud-layout-contract.test.ts --runInBand
npx jest test/ui.charge-delta-queue.test.ts --runInBand
npx jest test/ui.board-frame.custom-size.test.ts --runInBand
npx jest test/ui.layout-responsive.aspect-ratio.test.ts --runInBand
npm run build:browser
```

必要なら build 出力の存在確認も行う。

```powershell
node scripts/check-browser-build-up-to-date.js
```

ここで失敗した場合はリファクタリングを開始しない。失敗原因が既存 dirty change 由来か、今回対象の UI HUD 由来かを切り分ける。

## Phase 2: CSS 変数化

目的は、布石 UI と盤面/手札レイヤーの関係を magic number から名前付き contract に変えること。

1. `styles-variables.css` に HUD 用の変数を追加する。

候補:

```css
:root {
  --layout-board-stack-offset-y: calc(-18px * var(--layout-stage-scale));
  --layout-charge-own-offset: calc(11px * var(--layout-stage-scale));
  --layout-charge-opponent-offset: calc(11px * var(--layout-stage-scale));
  --layout-z-board-frame: 10;
  --layout-z-player-area: 20;
  --layout-z-charge-hud: 30;
  --layout-z-charge-display: 1010;
}
```

2. `styles-layout.css` の該当箇所を変数参照に置き換える。

置き換え対象:

- `#board-frame` の `translateY(calc(-18px * var(--layout-stage-scale)))`
- `#charge-hud-layer` の同じ `translateY`
- `#charge-black` / `#charge-white` の `11px` offset
- `#board-frame`, `.player-area-*`, `#charge-hud-layer`, `.charge-display` の z-index

3. `test/ui.board-hud-layout-contract.test.ts` を、数値リテラルではなく変数 contract を確認する形へ更新する。

4. 検証する。

```powershell
npx jest test/ui.board-hud-layout-contract.test.ts --runInBand
npx jest test/ui.charge-delta-queue.test.ts --runInBand
npm run build:browser
```

5. 差分確認する。

```powershell
git diff -- styles-variables.css styles-layout.css test/ui.board-hud-layout-contract.test.ts
git diff --check -- styles-variables.css styles-layout.css test/ui.board-hud-layout-contract.test.ts
```

この Phase は単独コミット可能な最小単位にする。

## Phase 3: テスト分割

目的は、布石 UI の contract を読みやすくし、次の CSS 分離で壊した場所を特定しやすくすること。

1. 現在の `test/ui.board-hud-layout-contract.test.ts` の責務を分ける。

分割案:

- `test/ui.charge-hud-layering-contract.test.ts`
  - `#board-stack`
  - `#board-frame`
  - `#charge-hud-layer`
  - `.player-area-top` / `.player-area-bottom`
  - z-index と DOM 階層
- `test/ui.charge-hud-position-contract.test.ts`
  - `#charge-black`
  - `#charge-white`
  - offset 変数
  - board stack transform
- `test/ui.charge-delta-style-contract.test.ts`
  - `.charge-delta`
  - 差分バッジの anchor
  - pointer-events
  - shadow / text-shadow の有無

2. `test/ui.board-hud-layout-contract.test.ts` は、盤面 HUD 全体の入口テストとして残すか、責務が空になるなら削除する。

削除する場合も、同等の assertion が新しいテストに移動済みであることを diff で確認する。

3. 検証する。

```powershell
npx jest test/ui.charge-hud-layering-contract.test.ts --runInBand
npx jest test/ui.charge-hud-position-contract.test.ts --runInBand
npx jest test/ui.charge-delta-style-contract.test.ts --runInBand
npx jest test/ui.charge-delta-queue.test.ts --runInBand
```

4. 全 UI HUD 周辺をまとめて確認する。

```powershell
npx jest test/ui.board-frame.custom-size.test.ts --runInBand
npx jest test/ui.layout-responsive.aspect-ratio.test.ts --runInBand
npm run build:browser
```

この Phase は「テスト整理だけ」で止める。CSS の移動は次 Phase に分ける。

## Phase 4: 布石 UI CSS の分離

目的は、`styles-layout.css` の責務を軽くし、布石 UI の見た目とレイヤー contract を専用ファイルに閉じること。

1. `styles-charge-hud.css` を作成する。

移動候補:

- `#charge-hud-layer`
- `.charge-display`
- `.charge-display::before`
- `.charge-display::after`
- `.charge-label`
- `.charge-current`
- `.charge-separator`
- `.charge-max`
- `#charge-black`
- `#charge-white`
- `.charge-delta`
- `.charge-delta::before`
- `.charge-delta.charge-delta-positive`
- `.charge-delta.charge-delta-negative`

2. `index.html` の CSS 読み込み順を更新する。

推奨順:

```html
<link rel="stylesheet" href="styles-layout.css" />
<link rel="stylesheet" href="styles-charge-hud.css" />
```

`styles-charge-hud.css` は `styles-layout.css` の後に置く。布石 UI は layout 変数を参照するため、変数定義より前に置かない。

3. テスト helper を確認する。

`test/ui.board-hud-layout-contract.test.ts` や分割後のテストが CSS を直接読む場合、`styles-layout.css` だけを読む helper のままだと新ファイルの assertion が落ちる。

確認対象:

```powershell
rg -n "styles-layout|read.*Css|charge-hud|charge-display|charge-delta" test tests
```

必要に応じて、テスト側で `styles-charge-hud.css` を読む helper を追加する。

4. 検証する。

```powershell
npx jest test/ui.charge-hud-layering-contract.test.ts --runInBand
npx jest test/ui.charge-hud-position-contract.test.ts --runInBand
npx jest test/ui.charge-delta-style-contract.test.ts --runInBand
npx jest test/ui.charge-delta-queue.test.ts --runInBand
npm run build:browser
node scripts/check-browser-build-up-to-date.js
```

5. CSS 移動による見た目変更がないことをユーザー確認に回す。

この Phase の終了報告では、Codex は「反映済み、目視確認待ち」とだけ伝える。発光範囲や位置の追加調整はしない。

## Phase 5: `ui/stone-visuals.ts` の小整理

この Phase は任意。CSS とテストの分離後にまだ読みにくい場合だけ実施する。

目的は、布石差分バッジの anchor 解決を局所的に読みやすくすること。

1. private constant を追加する。

候補:

```ts
const CHARGE_HUD_LAYER_ID = 'charge-hud-layer';
const BOARD_FRAME_ID = 'board-frame';
```

2. `_resolveChargeDeltaAnchorRoot` の fallback 順を維持する。

現在の意味:

1. `#charge-hud-layer` があればそこへ差分バッジを出す。
2. なければ `#board-frame` に fallback する。
3. それもなければ既存の fallback に従う。

この順番は変えない。

3. public API を増やさない。

4. 検証する。

```powershell
npx jest test/ui.charge-delta-queue.test.ts --runInBand
npx jest test/ui.charge-hud-layering-contract.test.ts --runInBand
npm run build:browser
```

## Phase 6: 最終検証

すべての Phase が終わったら、次を実行する。

```powershell
npx jest test/ui.charge-hud-layering-contract.test.ts --runInBand
npx jest test/ui.charge-hud-position-contract.test.ts --runInBand
npx jest test/ui.charge-delta-style-contract.test.ts --runInBand
npx jest test/ui.charge-delta-queue.test.ts --runInBand
npx jest test/ui.board-frame.custom-size.test.ts --runInBand
npx jest test/ui.layout-responsive.aspect-ratio.test.ts --runInBand
npm run build:browser
node scripts/check-browser-build-up-to-date.js
git diff --check -- styles-variables.css styles-layout.css styles-charge-hud.css index.html ui/stone-visuals.ts test
git status --short
```

`worker-public/` の同期が必要な場合だけ、root 側の差分が確定してから実行する。

```powershell
npm run worker:prepare
```

ただし、無関係な dirty file が多く、mirror 差分を安全に分離できない場合は実行しない。

## コミット単位

安全に分離できる場合の推奨コミット単位:

1. `Extract charge HUD layout variables`
2. `Split charge HUD layout tests`
3. `Split charge HUD styles`
4. `Tidy charge delta anchor lookup`

大量の無関係 dirty file が残っている場合は、自動コミットしない。今回の差分だけを安全に stage できる状態になるまで止める。

## 中止条件

次のどれかが起きたら、リファクタリングを中止して報告する。

- テスト分割後に assertion が減って、既存 contract を保持できない。
- CSS 分離後に読み込み順の問題で layout が変わる。
- `styles-charge-hud.css` の追加が build または worker mirror に正しく入らない。
- 布石 UI の位置、発光、盤面影など、見た目の調整が必要になる。
- 無関係な dirty file と今回差分を安全に分離できない。

## 完了条件

完了条件:

- 布石 UI の数値と z-index が名前付き変数で表現されている。
- 布石 UI CSS が専用ファイルに分離されている。
- レイヤー、位置、差分バッジ、影なし指定のテストが責務別に分かれている。
- `ui/stone-visuals.ts` の anchor fallback が維持されている。
- 対象 Jest と browser build が通っている。
- ユーザーの目視確認に回せる状態で止まっている。
