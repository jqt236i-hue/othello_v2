# 石輪郭除去・影正常化・描画整理 実装計画書

作成日: 2026-03-20
対象: docs / styles / ui / game / test / worker-public
状態: Planned
位置づけ: `01-rulebook.md` を一次仕様とし、この文書は実装境界、phase、完了条件、検証束を定義する。
備考: この文書は [stone-shadow-stability-plan-2026-03-19.md](stone-shadow-stability-plan-2026-03-19.md) のうち、通常石輪郭の根因認識と shadow ownership 方針を更新して置き換える。

## 0. 目的

この計画の目的は次の 3 点である。

- 通常石の周囲に見えている黒枠 / 白枠を根本原因からなくす。
- 通常石 / 特殊石 / 爆弾 / preload 成否に依存せず、盤面上に正しい影を表示する。
- 石描画まわりの重複経路、暫定 fallback、古い selector を整理し、保守しやすい構造へリファクタリングする。

## 1. 設計の前提

- すべての石の見た目は `assets/images/stones/` 配下の画像を正本にする。
- CSS は石アートを描き直さない。役割は配置、切り抜き、影、fallback、状態切り替えに限定する。
- `ui/` は表示経路を持つが、石アートの内容そのものは asset を参照する。
- root 正本を修正し、`worker-public/` は最後に `npm run worker:prepare` で同期する。

## 2. 検証済みの事実

### 2.1 asset 自体は「汚い画像」ではない

- `normal_stone-black.png` / `normal_stone-white.png` はエクスプローラの見え方どおり透過を持っている。
- 実測でも alpha bbox は次のとおりで、周囲に透明余白がある。
  - `normal_stone-black.png`: `(49,29)-(974,995)`
  - `normal_stone-white.png`: `(50,30)-(973,996)`

### 2.2 今見えている黒枠 / 白枠の主因は描画合成

- `styles-board.css` の `.disc__face` は `background-color: var(--disc-base-color, transparent)` を持つ。
- 同ファイルの `.disc.black` / `.disc.white` は `--disc-base-color` に owner 色を入れている。
- `.disc__base-image` はその上に PNG を重ねるが、PNG の透明余白ぶんだけ下地色が見える。
- その結果、黒石の周囲に黒い帯、白石の周囲に白い帯が出る。

### 2.3 Playwright で主因を切り分け済み

- 一時的に `.disc.black,.disc.white { --disc-base-color: transparent !important; }` を入れると、通常石の owner 色の輪郭は消えた。
- 比較画像:
  - [before-basecolor-transparent.png](C:/Users/quarr/Desktop/othello_v2/tmp/before-basecolor-transparent.png)
  - [after-basecolor-transparent.png](C:/Users/quarr/Desktop/othello_v2/tmp/after-basecolor-transparent.png)
- よって「asset が壊れている」のではなく、「透明余白の下に owner 色を敷いていた」のが根因である。

### 2.4 残る細いグレーの縁は asset 側の意匠

- owner 色の輪郭を消した後も、画像自身のベベルやハイライトは残る。
- これは今回の主不具合とは別であり、asset のデザイン調整を行わない限り残る。
- 今回の計画では、まず owner 色の偽輪郭を除去する。asset retouch は必要になった場合だけ別判断とする。

### 2.5 shadow 側は別の構造問題を持つ

- projected shadow と ambient shadow の責務が CSS selector と DOM 骨格に分散している。
- 通常石 / 特殊石 / preload fallback の経路が分かれているため、影の確認が難しい。
- 輪郭問題が影の見え方を覆い隠していたが、影自体の設計も再整理が必要である。

## 3. 根本原因

今回の黒枠 / 白枠の根本原因は次の 2 段階で整理する。

1. 通常石 PNG は透明余白を含む円形アートである。
2. その透明余白の下に `.disc__face` の owner 色が常時存在していた。

したがって、根本解決は「画像の透明部分に owner 色を見せない」ことである。  
単純な円クリップ、CSS での別造形、影の強化だけでは根本原因を外せない。

## 4. 望ましい方針

### 4.1 石アート方針

- 石アートは必ず `assets/images/stones/` の画像を使う。
- 通常石を CSS グラデーションで描き直さない。
- 石画像が正常にある場合、`.disc__face` の背景は透明でなければならない。
- owner 色の塗りは「画像未ロード / 画像欠落時の fallback」に限定する。

### 4.2 shadow 方針

- 盤面上へ落ちる影の主責務は「盤面接地面」が持つ。
- 実装上は `cell` 側の occupied-state shadow を正本にするのが最も安定する。
- stone art 自体の見え方は asset に任せ、projected shadow は art の透明余白や effect ごとの差分に影響されない位置へ出す。
- stone 側に影を残す場合も、effect ごとの pseudo-element や injected image に分散させない。

### 4.3 renderer / state 方針

- 通常石と特殊石の見た目適用は 1 本の render state API へ寄せる。
- preload 成功 / 失敗、normal / special / bomb の違いは state で吸収し、DOM 骨格は固定する。
- `setDiscStoneImage()` と `applyStoneVisualEffect()` と bootstrap fallback が別々に base 色や画像変数を触る状態をやめる。

## 5. 非目標

- 石デザインの全面刷新
- `assets/images/stones/` の一括描き直し
- カード効果やゲームルールの変更
- `worker-public/` の直編集
- 単なる CSS 応急処置だけで終えること

## 6. 目標構造

```html
<div class="cell has-disc">
  <div class="disc black" data-render-mode="base-only" data-image-state="loaded">
    <div class="disc__face">
      <div class="disc__base-image"></div>
      <div class="disc__overlay-image"></div>
    </div>
    <div class="disc__hud"></div>
  </div>
</div>
```

### 6.1 役割

- `.cell.has-disc::before`
  - projected shadow の正本
- `.disc`
  - stone root、位置、HUD 親
- `.disc__face`
  - 円形クリップ面
  - 画像正常時は透明
  - fallback 時だけ owner 色または代替色を許可
- `.disc__base-image`
  - 通常石 base 画像
- `.disc__overlay-image`
  - 特殊石 / 爆弾の追加または置換画像
- `.disc__hud`
  - timer や badge

### 6.2 正規化する render state

```js
{
  owner: 'black' | 'white',
  renderMode: 'base-only' | 'replace' | 'overlay',
  baseImage: 'var(--normal-stone-black-image)',
  overlayImage: null,
  imageState: 'loaded' | 'fallback',
  baseFallbackColor: 'transparent' | '#050505' | '#ffffff',
  shadowProfile: 'default'
}
```

### 6.3 この形にする理由

- 黒枠 / 白枠の発生条件を `imageState=fallback` のときだけに閉じ込められる。
- asset 正本と CSS fallback の責務が分離できる。
- normal / special / bomb / preload failure の分岐を同じ骨格で扱える。
- projected shadow が石画像の透明余白に影響されなくなる。

## 7. 対象ファイル

### 7.1 仕様 / plan

- `01-rulebook.md`
- `docs/stone-shadow-stability-plan-2026-03-19.md`
- `docs/stone-rim-shadow-render-refactor-plan-2026-03-20.md`

### 7.2 CSS

- `styles-board.css`
- `styles-stone-shadows.css`
- `styles-variables.css`

### 7.3 UI / render path

- `ui/board-renderer.js`
- `ui/diff-renderer.js`
- `ui/visual-effects-map.js`
- `ui/stone-visuals.js`
- `ui/bootstrap.js`

### 7.4 shared definition

- `game/visual-effects-map.js`

### 7.5 test / visual

- `test/ui.disc-shadow.test.js`
- `test/ui.stone-rendering.test.js`
- `test/ui.visual-effects-map.shared.test.js`
- `test/assets.preload.test.js`
- `tests/visual-regression/run-visual-check.js`
- `test/visual-regression.test.js`

## 8. Phase 計画

## Phase 0: 仕様補正と root cause 固定

### 目的

- current spec と今回の root cause を揃える。
- 実装者が「asset が悪いのか、合成が悪いのか」で迷わない状態を作る。

### 作業

1. `01-rulebook.md` に次を明記する。
   - 石アートは `assets/images/stones/` を正本にする。
   - 石画像が正常表示される場合、owner 色の下地で輪郭を出してはならない。
   - projected shadow は盤面接地面で安定表示する。
2. この文書を一次 plan として固定する。
3. 2026-03-19 の旧 shadow plan は superseded と明記する。

### 完了条件

- root cause が「transparent margin + owner 色下地の合成」と明記されている。
- rulebook 側に今回の設計意図が反映されている。

### 検証束

- `01-rulebook.md` と本計画書に仕様矛盾がないことを読む。

---

## Phase 1: 黒枠 / 白枠の根本除去

### 目的

- 通常石の owner 色輪郭を、asset を変えずに除去する。

### 作業

1. `.disc__face` の下地色を常時表示しない設計へ変える。
2. per-disc の `imageState` / `baseFallbackColor` を導入する。
3. 画像が正常に設定された stone は `baseFallbackColor=transparent` にする。
4. preload failure、missing image、読み込み未完了 stone だけ fallback 色を許可する。
5. 通常 stone / special stone / bomb stone が同じ判定規則で fallback を使うよう揃える。
6. Playwright で通常石の輪郭除去を確認する。

### 完了条件

- 通常石の周囲に owner 色の白枠 / 黒枠が出ない。
- asset の造形自体は変わらない。
- preload failure 時だけ fallback が残る。

### 検証束

```powershell
npm run test:jest -- test/ui.stone-rendering.test.js test/assets.preload.test.js
```

Playwright:

- 通常黒石 / 通常白石を表示
- `imageState=loaded` で owner 色輪郭が消えていること
- preload failure 模擬時のみ fallback が出ること

---

## Phase 2: shadow の正規化

### 目的

- 盤面に落ちる影を、石アートや effect ごとの差分から独立させる。

### 作業

1. projected shadow の正本を `cell.has-disc::before` に寄せる。
2. `.disc::before` や effect-specific shadow selector の役割を棚卸しし、不要分を削る。
3. normal / special / bomb / fallback で同じ shadow geometry と変数を使う。
4. 影の強さ、位置、blur を `styles-variables.css` の単一ソースにまとめる。
5. Playwright で「石の周囲の枠」ではなく「盤面に落ちる影」が見えるか確認する。

### 完了条件

- 通常石 / 特殊石 / 爆弾のすべてで、盤面に同じ shadow が見える。
- shadow の責務が effect ごとに分散していない。
- 影の確認が computed style とスクリーンショットの両方で可能である。

### 検証束

```powershell
npm run test:jest -- test/ui.disc-shadow.test.js
```

Playwright:

- debug 盤面で normal / protected / dragon / bomb を並べる
- board screenshot で下方向の影が確認できる

---

## Phase 3: 描画経路の整理と重複削除

### 目的

- 輪郭問題と影問題の近辺にある重複経路を削除し、今後の修正点を減らす。

### 作業

1. stone 見た目適用の canonical API を `applyDiscRenderState()` に一本化する。
2. `setDiscStoneImage()`、`applyStoneVisualEffect()`、bootstrap preload fallback の責務重複を整理する。
3. 旧互換だけの CSS var と selector を見直す。
   - `--stone-image`
   - `--disc-base-image`
   - legacy pseudo-element 依存
   - dead fallback selector
4. injected image fallback や到達しない compat code を削除する。
5. HUD append 先と skeleton helper を 1 箇所に揃える。

### 完了条件

- stone visual の入口が実質 1 本に整理されている。
- 通常石 / 特殊石 / 爆弾の差分が render state のみで表現される。
- 使われない fallback selector / 重複 helper / 到達しない compat code が削除されている。

### 検証束

```powershell
npm run test:jest -- test/ui.stone-rendering.test.js test/ui.visual-effects-map.shared.test.js test/game.special-stone-visual-rule.test.js test/game.special-stone-browser-order.test.js
```

---

## Phase 4: 回帰防止と mirror 同期

### 目的

- 今回の修正が見た目回帰と複製コード再発を防げる状態で閉じる。

### 作業

1. visual regression と Playwright 確認を更新する。
2. owner 色輪郭が再発しない assertion を test へ追加する。
3. shadow visibility の assertion を追加する。
4. `rg` で古い selector / fallback 経路の残骸を確認する。
5. `npm run worker:prepare` で mirror を同期する。

### 完了条件

- normal stone の owner 色輪郭再発を test で検出できる。
- shadow 回帰を visual check で検出できる。
- `worker-public/` が root 正本と同期されている。

### 検証束

```powershell
npm run test:jest -- test/ui.disc-shadow.test.js test/ui.stone-rendering.test.js test/ui.visual-effects-map.shared.test.js test/assets.preload.test.js test/game.special-stone-visual-rule.test.js test/game.special-stone-browser-order.test.js
npm run test:visual
npm run test:jest -- test/visual-regression.test.js
npm run worker:prepare
```

## 9. 全体完了条件

- 通常石の owner 色輪郭が loaded state で消えている。
- 石アートは引き続き `assets/images/stones/` を使う。
- projected shadow が通常石 / 特殊石 / 爆弾で同じように見える。
- preload failure 時だけ fallback 色が使われる。
- 重複した visual path と不要 selector が整理されている。
- tests、Playwright、visual regression、worker mirror 同期まで完了している。

## 10. リスク / open questions

- owner 色輪郭を除去した後に残る灰色ベベルを「不要」と判断するなら、それは asset retouch の別判断になる。
- `01-rulebook.md` にある「石 root 1 個が影責務を持つ」という表現は、projected shadow を cell 側へ寄せる方針と衝突する可能性がある。Phase 0 で補正が必要。
- preload failure の再現はテストと Playwright の両方で確認しないと見落としやすい。

## 11. 専門用語を避けた短い説明

今回の問題は「石画像が悪い」より、「透けている部分の下に白や黒を塗っていた」ことが原因で起きている。  
計画としては、まずその下地色を必要な時だけに限定し、次に影を石の絵から切り離して盤面側で安定して出し、最後に石描画の回り道を減らして再発しにくい形へ整理する。

