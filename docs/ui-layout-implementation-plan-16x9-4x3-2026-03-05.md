# UIレイアウト実装計画・設計書（16:9系 / 4:3系プロファイル切替）

作成日: 2026-03-05
対象: カードオセロ UI（`index.html`, `ui/layout-stage.js`, `styles-*.css`, `test/ui.layout-responsive.aspect-ratio.test.js`）

## 1. 目的

- 目的は、**どの環境でも崩れにくい表示**を維持しつつ、16:9系と4:3系で配置ルールを明確に分離すること。
- 具体的には、以下を同時に満たす。
  - 盤面・ログ・右パネル・カード詳細・キャラ画像の重なりを防ぐ。
  - 16:9系では現行の視覚優先度（盤面中心、右下操作）を維持する。
  - 4:3系では情報密度を保ちつつ、余白不足で崩れる要素を別配置に切り替える。

## 2. 前提（現状）

- `ui/layout-stage.js` に以下の基盤がすでに存在する。
  - 仮想座標系（基準解像度）
  - `scale = min(viewport/base)` の Stage 投影
  - プロファイルクラス切替（`layout-profile-16x9`, `layout-profile-tablet-4x3`, `layout-profile-phone-portrait`）
  - `resize` / `orientationchange` / `visualViewport` 追従
- `styles-variables.css` に `--layout-anchor-*` と `--layout-stage-*` があり、主要UIの多くは Stage 座標で配置済み。
- `styles-responsive.css` はアスペクト別救済が増えており、同条件でも分岐読み解きが難しい箇所が残る。

## 3. 設計方針

### 3.1 方針A: 2プロファイル明示化

- 横画面は次の2系統を第一級として扱う。
  - 16:9系（16:10, 3:2 を含む）
  - 4:3系（5:4 を含む）
- 判定後は、**プロファイルごとのアンカーセット**を適用する。

### 3.2 方針B: 座標系は単一のまま

- 座標系は Stage 方式のまま維持し、レイアウト差分はアンカー値で吸収する。
- これにより、UIコンポーネント個別の `transform` 乱立を避ける。

### 3.3 方針C: 例外救済は最小化

- 例外（低高さ、極端な横長、スマホ縦）は残す。
- ただし通常ケースでの配置は `@media` ではなくプロファイル変数で決める。

## 4. 詳細設計

### 4.1 レイアウト判定

`ui/layout-stage.js` の `resolveLayoutProfile()` を基点に、次の運用ルールを固定する。

- `layout-profile-16x9`:
  - デスクトップ横
  - 16:10 / 3:2 の横表示
- `layout-profile-tablet-4x3`:
  - 4:3 近傍かつタッチ想定サイズ
  - `simAspect=4:3` / `simAspect=5:4`
- `layout-profile-phone-portrait`:
  - スマホ縦（既存維持）

補足: レイアウト判定条件は「プロファイルが揺れないこと」を優先し、境界値のヒステリシス（閾値に余白）を設ける。

### 4.2 アンカー変数の二重定義

`styles-variables.css` に次の構造を導入する。

- 共通キー名（利用側は固定）
  - `--layout-anchor-log-left`
  - `--layout-anchor-log-top`
  - `--layout-anchor-log-width`
  - `--layout-anchor-side-right`
  - `--layout-anchor-side-bottom`
  - `--layout-anchor-card-detail-width`
  - `--layout-anchor-card-detail-gap`
  - `--layout-anchor-cpu-*`, `--layout-anchor-hero-*`
- 値セット（プロファイルごと）
  - `html.layout-profile-16x9 { ... }`
  - `html.layout-profile-tablet-4x3 { ... }`

これにより、CSSセレクタ側は既存の `calc(var(--layout-anchor-...) * var(--layout-stage-scale))` を維持できる。

### 4.3 Safe Area と下端保護

- 既存の `safe-area-inset-left/right/bottom` と `--layout-stage-bottom-safe-shift` を維持。
- 4:3系では `#side-panel` と `#card-detail-panel` の下端が詰まりやすいため、`--layout-anchor-side-bottom` と `--layout-anchor-card-detail-gap` をプロファイル別に最適化する。

### 4.4 4:3系での配置ルール（固定）

4:3系では次を優先する。

- 盤面中心は維持。
- 右サイド情報の縦積みを短縮（行間、余白、最小高さトークン調整）。
- カード詳細は「右下固定」を維持しつつ、必要時のみ上方向へ退避。
- 左側ログ・エフェクトは盤面に侵入しない最小幅を確保。

## 5. 実装フェーズ

## Phase 0: 計測固定（現状ベースライン）

- `?debug=1` 時のみ、主要要素矩形（board/log/effect/side/card-detail/hero/cpu）を取得する補助ログを有効化。
- 比較解像度:
  - 16:9: `1920x1080`, `1600x900`, `1366x768`
  - 16:10: `1920x1200`
  - 3:2: `2160x1440`
  - 4:3: `1366x1024`, `1600x1200`
  - 5:4: `1280x1024`

## Phase 1: 変数プロファイル化

- 変更対象: `styles-variables.css`
- 変更内容:
  - アンカー値を 16:9系 / 4:3系 に分離。
  - 利用側キー名は変えず、参照コード変更を最小化。

## Phase 2: 主要パネルの整列

- 変更対象: `styles-layout.css`, `styles-cards.css`
- 変更内容:
  - `#side-panel`, `#log`, `#effect-live-panel`, `#card-detail-panel` の位置・サイズをアンカー参照へ統一。
  - 4:3系専用の間隔トークンを適用し、個別 `@media` の緊急回避を削減。

## Phase 3: レスポンシブ分岐整理

- 変更対象: `styles-responsive.css`
- 変更内容:
  - 通常ケース: プロファイルクラス駆動に寄せる。
  - `@media` は救済用（低高さ/極小幅/スマホ縦）に限定。
  - `simAspect` テスト用クラスとの整合を確認。

## Phase 4: 判定ロジック安定化

- 変更対象: `ui/layout-stage.js`
- 変更内容:
  - 判定境界の揺れを抑止（閾値調整、必要なら簡易ヒステリシス）。
  - `visualViewport` / DPR 変化時の再計算を維持。

## Phase 5: テスト更新

- 変更対象: `test/ui.layout-responsive.aspect-ratio.test.js`
- 追加・更新:
  - 16:9系/4:3系プロファイルで期待アンカーが存在すること。
  - `simAspect=4:3` / `simAspect=5:4` で `layout-profile-tablet-4x3` の適用経路が残ること。
  - `#card-detail-panel` と `#side-panel` の4:3系衝突回避トークンが存在すること。

## 6. 受け入れ基準

- 16:9系/4:3系の主要解像度で、主要UI同士の重なりゼロ。
- 盤面中心位置が基準（1920x1080）から大きく逸脱しない。
- `simAspect` 強制時に同じ結果を再現できる。
- 既存 Jest テスト + 追加テストが通過する。

## 7. リスクと対策

- リスク: 4:3最適化で16:9が崩れる。
  - 対策: アンカー値分離のみ先に導入し、セレクタ変更は段階適用。
- リスク: 条件境界でプロファイルが頻繁に切り替わる。
  - 対策: 閾値のバッファを設け、再計算タイミングを `requestAnimationFrame` に集約。
- リスク: 局所修正の再増殖。
  - 対策: 例外規則を `styles-responsive.css` の「救済ブロック」に限定し、通常配置はアンカー変数のみで調整。

## 8. 実装順（最短）

1. Phase 1（アンカー分離）
2. Phase 2（主要4パネル整列）
3. Phase 3（`@media` 整理）
4. Phase 4（判定安定化）
5. Phase 5（テスト更新）

## 9. ロールバック方針

- プロファイル別アンカー導入後に不具合が出た場合、値セットのみを 16:9基準へ戻せるよう、キー名変更は行わない。
- 判定ロジック調整で問題が出た場合、`resolveLayoutProfile()` の判定差分だけを戻して旧挙動に復帰できる構造を維持する。

## 10. 仕様書更新方針

- 本ドキュメントは実装計画であり、この時点では挙動変更は未実施。
- 実装で見え方・操作導線が確定変更された段階で、`01-rulebook.md`（UI/演出仕様節）を同期更新する。
