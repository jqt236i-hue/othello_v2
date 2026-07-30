# ゲーム全体カード比率短縮 実装計画

## 文書の役割

- 設計正本: `docs/implementation/global-card-aspect-ratio-design.md`
- プレイヤー向け仕様正本: `01-rulebook.md`
- 対象: ゲームカード面の高さ、端末別カード高、デッキ構築の追加操作reserve、検証、生成mirror、コミット
- 非対象: ゲームルール、カード効果、カード詳細本文パネル、カード以外の「card」名称UI

## Step 1: 仕様と寸法契約を確定する

- Outcome: 横幅を維持し、高さだけを横4:縦5前後へ揃える寸法表を正本化する。
- Files: `01-rulebook.md`, `docs/implementation/global-card-aspect-ratio-design.md`, 本計画
- Dependencies: 現行CSS・実ブラウザ採寸
- Verification: 設計Self-review、全直接カード高selectorの検索
- Done: 標準、large、tablet、スマホ、iPad縦、小型横画面、デッキ構築の扱いが明記される。

## Step 2: 共通カード高と端末別overrideを変更する

- Outcome: 対局、演出、選択候補、天の恵み、デッキ構築が新しいカード比率を共有する。
- Files: `styles-variables.css`, `styles-responsive.css`, `styles-feature-deck-builder.css`
- Dependencies: Step 1
- Verification: 新規CSS contract test、既存のhand/deck・responsive・overlay・deck builder focused tests
- Done: 横幅・文字・バッジを変えず、設計表の全カード高がroot CSSに反映される。

## Step 3: ブラウザ配信物とWorker mirrorを生成する

- Outcome: Classic/Vite/Worker配信がroot CSSの新比率を提供する。
- Files: `index*.html`, `public/module-registry.js`, `worker-public/*`, `worker-public/vite-dist/*`
- Dependencies: Step 2のfocused tests成功
- Verification: `npm run build:browser`, `npm run worker:prepare`, `npm run checkall`
- Done: generated/mirrorを手編集せず、既存生成経路で同期・検証される。

## Step 4: PC・スマホ・デッキ構築を実画面検証する

- Outcome: カードが少し短くなり、正方形ではなく縦長を保ち、内容と操作が欠けない。
- Files: `artifacts/design-qa/global-card-aspect-ratio/*`, `design-qa.md`
- Dependencies: Step 3
- Verification:
  - 1280x720 PC
  - 393x852固定スマホプレビュー
  - デッキ構築候補カード
  - 実矩形比率、文字・バッジ、横溢れ、console error
- Done: before/afterと実測値を記録し、P0/P1/P2の未解決不具合がない。

## Step 5: 最終確認とコミット

- Outcome: 仕様・設計・計画・実装・生成物が一致した検証済みコミットを作る。
- Files: 全タスク所有差分
- Dependencies: Steps 1–4
- Verification: `git diff --check`, task-only diff/status, commit後clean status
- Done: focused/all checksとQA結果を記録し、タスク所有差分だけをコミットする。

## Completion checklist

- [x] 標準カード91x114、largeカード114x143
- [x] tablet large 112x140
- [x] スマホ相手61x76、自分92x115
- [x] iPad縦88x110、小型横画面96x120
- [x] デッキ構築の最小高が共通カード高+20pxへ追従
- [x] 横幅、文字、バッジ、操作仕様は不変
- [x] focused tests、typecheck、checkall、browser build、Worker mirrorが成功
- [x] PC・スマホ・デッキ構築の実ブラウザQAが成功
- [x] `design-qa.md` にbefore/after、実測、`final result: passed` を記録
- [x] 最終diff確認、コミット、clean statusが完了

## Self-review

- canonical CSSを先に変更し、生成物を後から同期する順序にした。
- 数値変更だけで終えず、直接overrideとデッキ構築の旧高依存を同じStepへ含めた。
- 検証はCSS文字列だけでなく、実ブラウザの描画矩形と内容欠けをdone条件にした。
- カード詳細パネルやネット対戦room entryまで「card」という名称だけで縮めないよう、対象を実カード面に限定した。
