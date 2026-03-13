# UI相対配置一貫化 計画書（1920x1080基準）

作成日: 2026-03-04

## 1. 結論（先に回答）

- 結論: **可能**。
- ただし「どの端末でも完全に同一ピクセル」は現実的ではないため、目標は「相対配置・距離感・優先度が同じ」に置く。
- 実現方法は、1920x1080（24inch開発環境）を**唯一の設計座標系**として固定し、他解像度はそこへのスケーリング投影で表示する。

---

## 2. 自前調査サマリ（現状コードの確認結果）

### 2.1 現状の配置方式

- 盤面: `#board` は `70vmin` + `max-width/max-height`（`styles-board.css`）。
- 周辺UI: `#side-panel` / `#log` / `#effect-live-panel` / キャラ画像は `fixed` + `px/vw/vh/clamp`（`styles-layout.css`）。
- カード詳細: `#card-detail-panel` は `translate + scale` の複合変形（`styles-cards.css`）。
- 補助ロジック: `--card-detail-landscape-bottom-reserve` を JS (`ResizeObserver`) で補正（`cards/card-interaction.js`, `ui/handlers/match-mode.js`）。

### 2.2 なぜ「同じ比率でもサイズ違いで崩れるか」

1. **座標系の混在**
   - 盤面は `vmin` 基準、周辺は `fixed + clamp(px/vw/vh)` 基準で、拡縮の基準が別々。
2. **しきい値分岐の重なり**
   - `max-aspect-ratio` と `max-width` / `max-height` が多段で重なり、同じ比率でも適用ルールが変わる。
3. **個別救済の蓄積**
   - `#card-detail-panel` のように単体補正を積み増した結果、全体の整合より局所回避が優先されやすい。
4. **基準画面が暗黙値**
   - 1920x1080の見え方をコード上の明示仕様として持っていないため、改修時に相対感覚が維持しにくい。

---

## 3. 目標定義

## 3.1 必須目標

- 1920x1080を基準に、以下の関係を他端末でも維持する。
  - 盤面中心と各固定UIの**相対距離**
  - 主要要素（盤面、右下操作、左右キャラ、ログ類）の**視覚優先順位**
  - 操作不能や可読不能を生む**重なりゼロ**

## 3.2 許容誤差（品質基準）

- 相対距離比率: 基準比に対して ±8% 以内
- 盤面占有率（画面内比率）: 基準比に対して ±6% 以内
- 主要UI同士の重なり: 0（必須）

## 3.3 非目標

- 縦画面最適化（仕様上サポート対象外）
- 端末固有フォント差まで含む完全ピクセル一致

---

## 4. 解決方針（設計）

## 4.1 単一基準座標（Stage座標）を導入

1920x1080 を設計座標 (`BASE_W=1920`, `BASE_H=1080`) とし、表示時は下記で射影する。

```text
scale = min(viewportW / BASE_W, viewportH / BASE_H)
stageW = BASE_W * scale
stageH = BASE_H * scale
offsetX = (viewportW - stageW) / 2
offsetY = (viewportH - stageH) / 2
```

- 盤面も固定UIも、この Stage の中で位置・サイズを決める。
- これにより「盤面だけ `vmin`、周辺だけ `fixed`」をやめ、同じ拡縮ルールに統一する。

## 4.2 トークン化（CSS変数）

- `:root` に座標トークン群を追加し、個別 `clamp` の乱立を削減。
  - 例: `--stage-scale`, `--stage-left`, `--stage-top`, `--anchor-right-panel-x`, `--anchor-log-x` など。
- 位置決めは「絶対値」ではなく「基準アンカー + オフセット」に統一。

## 4.3 レイアウト責務分離

- **基準レイヤ**: 1920x1080座標で位置定義（1か所）
- **端末適応レイヤ**: safe-area と低高さ救済だけ（最小限）
- 現在のような「比率メディアクエリ + 幅クエリ + 個別救済」を段階的に整理する。

## 4.4 カード詳細の再設計

- `#card-detail-panel` は複合 `transform` を縮退。
- `side-panel` と `cpu-character-panel` の実測結果を使った退避は残しつつ、
  - まず Stage で基本位置を決定
  - 衝突時のみ最小限の補正
  へ変更する。

---

## 5. 実施フェーズ

## Phase 0: 計測基盤（現状可視化）

- 1920x1080を基準スクリーンショットとして固定。
- 比較対象を定義:
  - 16:9: `1366x768`, `1600x900`, `2560x1440`
  - 16:10: `1920x1200`
  - 3:2: `2160x1440`
  - 4:3: `1024x768`, `1366x1024`, `1600x1200`
  - 5:4: `1280x1024`
  - iPad横: `1024x768`, `1180x820`, `1366x1024`
- 要素矩形（board/log/effect/side/card-detail/hero/cpu）を収集する簡易デバッグ出力を用意（`?debug=1` 時のみ）。

## Phase 1: 座標系統一の土台

- `styles-variables.css` に Stage 変数群を追加。
- `ui` 側で viewport 変更時に Stage 変数を更新（`resize` / `orientationchange` / `visualViewport` 対応）。
- 既存 `simAspect` は維持しつつ、内部計算の入力にも反映できる形に拡張。

## Phase 2: 主要固定UIを Stage アンカーへ移行

- 対象: `#side-panel`, `#log`, `#effect-live-panel`, `#info-panel`, `#cpu-character-panel`, `#hero-character-panel`, `#card-detail-panel`。
- 手順:
  1. 位置を Stage アンカー参照へ変更
  2. サイズを `clamp(px,vw,...)` から「基準値 × `--stage-scale`」へ寄せる
  3. 衝突回避ロジックは衝突時のみ発動するよう整理

## Phase 3: メディアクエリ整理

- `styles-responsive.css` の重複分岐を削減し、
  - 低アスペクト救済
  - 小幅（<=900）救済
  - 低高さ救済
  の3軸に再編する。
- `html.sim-aspect-*` 強制モードでも同じ規則で再現される状態にする。

## Phase 4: 検証と固定化

- 自動テスト:
  - 既存 `test/ui.layout-responsive.aspect-ratio.test.js` を維持
  - Stage 変数の存在・更新・衝突ゼロ条件を追加
- 目視テスト:
  - 基準との比較表を作成し、誤差基準（±8% / ±6%）を満たすか確認
- 仕様反映:
  - 挙動変更が確定した時点で `01-rulebook.md` の 12.11 を更新

---

## 6. 変更対象（予定）

- `styles-variables.css`: Stage 変数の定義
- `styles-layout.css`: 固定UIの座標・サイズ式を Stage 基準へ移行
- `styles-responsive.css`: 救済クエリの再編
- `styles-cards.css`: `#card-detail-panel` の配置方式を整理
- `cards/card-interaction.js`: カード詳細の reserve 補正を Stage 前提へ更新
- `ui/handlers/match-mode.js`: control panel 高さ連動補正の統合
- `test/ui.layout-responsive.aspect-ratio.test.js`: 新ルールのガード追加
- （必要に応じて）`worker-public/` 側の対応ファイル

---

## 7. リスクと回避策

- リスク: 一括移行で重なりバグが増える
  - 回避: Phase 2 を要素単位で段階導入し、毎回スクショ比較
- リスク: iPad向けの個別救済が効かなくなる
  - 回避: 低高さ救済条件を残し、Stage基準に再マップ
- リスク: 既存 `simAspect` 検証がずれる
  - 回避: `simAspect` 時の Stage 入力を固定化して回帰テスト化

---

## 8. 完了条件

- 1920x1080基準と比較して、対応解像度で「相対配置・距離感」の誤差が許容範囲内
- 主要UIの重なりがゼロ
- 既存レイアウト回帰テスト + 追加テストが通過
- `01-rulebook.md`（12.11 / 12.12）の記述と実装が一致

---

## 9. 実装着手時の最短順序

1. Phase 0（計測）
2. Phase 1（Stage変数の導入）
3. Phase 2（`#side-panel` / `#log` / `#effect-live-panel` から先に移行）
4. Phase 2（キャラ + `#card-detail-panel`）
5. Phase 3（メディアクエリ整理）
6. Phase 4（テスト拡張と仕様更新）
