# 石影安定化 / 単一影レイヤー化 実装計画書

> Superseded on 2026-03-20 by [stone-rim-shadow-render-refactor-plan-2026-03-20.md](stone-rim-shadow-render-refactor-plan-2026-03-20.md).
> この文書は「通常石輪郭の根因を asset 側とみなしていた」時点の計画であり、黒枠 / 白枠の主因が `.disc__face` 下地色との合成であると分かった後の正本ではない。

作成日: 2026-03-19
対象: docs / ui / game / test / worker-public
状態: Planned（調査完了、未実装）

## 0. この文書の位置づけ

- この文書は、通常石と特殊石の影表現を安定化するための実装計画書である。
- 一次仕様は `01-rulebook.md` とし、この文書は内部構造、phase、完了条件、検証束を定義する。
- 目的は「見た目を派手に変えること」ではない。**通常石 / 特殊石 / preload 成否に依存せず、石の影を同じ責務分離で再現できる構造へ置き換えること** が目的である。

## 0.1 結論

- 長期的に望ましい正本は、**石の root DOM を 1 つに固定し、その root だけが影を持つ構造**である。
- 現行の `.disc` は広く参照されているため、outer API としては残す。ただし `box-shadow` や `drop-shadow` の責務は `.disc` 自身へ集約し、通常石 / 特殊石の差分は内側レイヤーだけで表現する。
- 特殊石の見た目は `cssMethod: 'background' | 'pseudoElement'` の分岐ではなく、`renderMode`, `baseImage`, `overlayImage`, `scale` のような **render state** へ正規化するのが望ましい。
- preload 失敗時や paint timing 差異で fallback `<img>` を注入する現在の方式は、影の適用面を増やして再発要因になる。**fallback は「画像が出ないときも同じ DOM 骨格を保つ」方向へ寄せる**。

## 0.2 構造変更を選ぶ理由

- 現状の不具合は局所 CSS 修正ではなく、**影の責務が複数要素に分散している構造問題**に起因している。
- `styles-board.css` では通常石の `box-shadow` を消し、見た目を画像アセットへ移している一方、`styles-stone-shadows.css` は `.disc`, `.disc::after`, `.disc.special-stone::before`, `.special-stone-img` の複数面へ影を当てている。
- `ui/diff-renderer.js` は `.disc` を 1 個だけ生成するが、`ui/board-renderer.js` の `setDiscStoneImage()` は通常石の `--stone-image` しか扱わない。
- `game/visual-effects-map.js` は `cssMethod` で `background` / `pseudoElement` を分け、`ui/visual-effects-map.js` はさらに inline background と fallback `<img class="special-stone-img">` を注入する。
- このため、石の見た目と影が「どの要素で描かれるか」が effect ごとに変わり、CSS selector drift が再発しやすい。責務境界内の修正だけを重ねるより、**石の骨格と影の所有者を固定する方が再発防止として合理的**である。

## 1. 検証済みの事実

### 1.1 現在の shadow 契約

- `styles-board.css` の `.disc` は `box-shadow: none` で、通常石の見た目は画像アセット前提になっている。
- `styles-stone-shadows.css` は `html.stone-shadow-enabled .disc` に加えて、`.disc::after`, `.disc.special-stone::before`, `.disc.special-stone::after`, `.disc .special-stone-img` にも影を付与している。
- つまり shadow の所有者が 1 つに固定されていない。

### 1.2 現在の stone DOM / renderer 契約

- `ui/diff-renderer.js` は occupied cell ごとに `.disc` を生成し、通常石については `--stone-image` を設定する。
- `ui/board-renderer.js` の `setDiscStoneImage()` は、normal black / white の CSS var をセットする helper であり、特殊石の見た目には関与しない。
- timer, badge, overlay icon は `.disc` の子要素としてぶら下がる契約になっている。

### 1.3 現在の特殊石 visual 契約

- `game/visual-effects-map.js` は `STONE_VISUAL_EFFECTS` に `cssMethod: 'background' | 'pseudoElement'` を持つ。
- `ui/visual-effects-map.js` の `applyStoneVisualEffect()` は、effect ごとに `--special-stone-image`, inline `backgroundImage`, pseudo-element 前提 class, fallback `<img class="special-stone-img">` を使い分ける。
- preload / paint timing の差を吸収するため、数フレーム待って描画確認し、失敗時は別 DOM を追加する経路がある。

### 1.4 bootstrap / preload の現状

- `ui/bootstrap.js` は asset preload 成功時に `stone-images-loaded` と `stone-shadow-enabled` を付与する。
- preload 後に既存 `.disc.black, .disc.white` へ `--stone-image` を再設定するが、特殊石は同じ経路で統一されていない。

### 1.5 既存 test の土台

- `test/ui.disc-shadow.test.js` は shadow 変数と CSS selector の存在を固定している。
- `test/ui.stone-rendering.test.js` は `setDiscStoneImage()` と `diff-renderer` の stone DOM 契約を固定している。
- `test/ui.visual-effects-map.shared.test.js` は game / ui の visual-effects map 共有を固定している。
- `test/assets.preload.test.js` は preload 時の class 付与と通常石の CSS var 再設定を固定している。

## 2. 目的

- shadow の責務を 1 要素へ固定し、通常石 / 特殊石 / fallback の違いで shadow selector が増えない状態にする。
- stone visual の適用経路を 1 本化し、通常石と特殊石を同じ render state API で扱えるようにする。
- preload 成否や paint timing 差異があっても、石の影だけは構造的に壊れないようにする。
- 既存の `.disc` 契約、timer 表示、Single Visual Writer、root 正本 + `worker-public/` mirror を維持したまま移行する。

## 3. 非目標

- カード効果、marker schema、CPU 方針、turn pipeline の仕様変更
- 石アート全体の作り直し
- 金銀石や特殊石のデザイン刷新
- `worker-public/` の直編集
- 1 phase で CSS / JS / assets / tests を無分別に一括置換すること

## 4. 残す契約

- `.disc` は引き続き「盤面上の石 root 要素」として残す。
- timer, badge, HUD 系要素は引き続き `.disc` 配下に描画する。
- 通常石の owner (`black` / `white`) と特殊石の effectKey 解決契約は残す。
- `game/` は UI DOM を直接知らず、見た目差分は `ui/` 側の公開 API / DI から適用する。
- root を正本にし、`worker-public/` は最後に `npm run worker:prepare` で同期する。

## 5. 置換する契約

- shadow を `.disc::after` や `.disc.special-stone::before` にも分散所有させる契約
- `cssMethod: 'background' | 'pseudoElement'` による描画分岐
- paint 成否を見て `special-stone-img` を追加注入する契約
- 通常石だけ `setDiscStoneImage()`、特殊石だけ `applyStoneVisualEffect()` で別経路に乗る契約

## 6. 目標構造

最終形では、各石は次の DOM 骨格に統一する。

```html
<div class="disc black" data-effect="normal" data-render-mode="base-only">
  <div class="disc__face">
    <img class="disc__base-image" alt="" aria-hidden="true">
    <img class="disc__overlay-image" alt="" aria-hidden="true">
  </div>
  <div class="disc__hud"></div>
</div>
```

### 6.1 役割分担

- `.disc`
  - 位置、サイズ、z-index、shadow の所有者
  - timer / HUD の親
- `.disc::before`
  - 影専用。通常石 / 特殊石 / fallback を問わず同じジオメトリを使う
- `.disc__face`
  - 円形 clipping 専用
- `.disc__base-image`
  - 通常黒石 / 通常白石の base 画像
- `.disc__overlay-image`
  - 特殊石画像。normal stone では非表示
- `.disc__hud`
  - timer や badge の配置面

### 6.2 目標 render state

石見た目の入力は、最終的に次の形へ正規化する。

```js
{
  owner: 'black' | 'white',
  renderMode: 'base-only' | 'replace' | 'overlay',
  baseImage: 'assets/images/stone-skin/default/black.png',
  overlayImage: null,
  scale: 1.0,
  shadowProfile: 'default'
}
```

### 6.3 この形にする理由

- shadow が root 1 箇所に固定される。
- normal / special / preload fallback の違いが「内部画像差し替え」だけに閉じる。
- `background`, `pseudoElement`, injected `<img>` の三重分岐が消える。
- `.disc` 契約と timer 契約を保ったまま段階移行できる。

## 7. 主対象ファイル

### 7.1 DOM / CSS

- `styles-board.css`
- `styles-stone-shadows.css`
- `styles-variables.css`
- `styles-responsive.css`

### 7.2 UI renderer / visual adapter

- `ui/diff-renderer.js`
- `ui/board-renderer.js`
- `ui/stone-visuals.js`
- `ui/visual-effects-map.js`
- `ui/bootstrap.js`

### 7.3 shared visual definition

- `game/visual-effects-map.js`

### 7.4 test / verification

- `test/ui.disc-shadow.test.js`
- `test/ui.stone-rendering.test.js`
- `test/ui.visual-effects-map.shared.test.js`
- `test/assets.preload.test.js`
- `test/game.special-stone-visual-rule.test.js`
- `test/game.special-stone-browser-order.test.js`
- `test/visual-regression.test.js`

### 7.5 mirror

- `worker-public/*`

## 8. 段階計画

## Phase 0: Baseline 固定と契約棚卸し

### 目的

- 現行 stone/shadow の壊れやすい境界を test で固定し、以後の phase で崩れた面をすぐ検出できるようにする。

### 作業

1. 影の責務を持つ selector を棚卸しする。
   - `.disc`
   - `.disc::after`
   - `.disc.special-stone::before`
   - `.special-stone-img`
2. stone DOM の契約を棚卸しする。
   - `.disc` root
   - timer / HUD 子要素
   - 通常石 `--stone-image`
3. visual effect の描画分岐を棚卸しする。
   - `background`
   - `pseudoElement`
   - injected `<img>`
4. 既存 test を整理し、phase gate に使う test 束を決める。
5. 必要なら以下の回帰 test を追加する。
   - `.disc` root が常に存在すること
   - stone skeleton が normal / special で同形であること
   - shadow selector が複数 ownership を持っている現状をベースライン記録すること

### 完了条件

- 影の責務分散箇所が「CSS」「renderer」「effect applier」「fallback」に分類されている。
- phase gate とする test 束が決まっている。
- `.disc` を残すべき public 契約と、捨ててよい内部契約が分離されている。

### 検証束

```powershell
npm run test:jest -- test/ui.disc-shadow.test.js test/ui.stone-rendering.test.js test/ui.visual-effects-map.shared.test.js test/assets.preload.test.js
```

---

## Phase 1: stone skeleton の導入と shadow ownership の単一化

### 目的

- `.disc` の内側に固定 skeleton を導入し、影の ownership を `.disc` だけへ寄せる準備をする。
- この phase では見た目変更を最小にし、土台だけを作る。

### 作業

1. `.disc` の child skeleton を導入する。
   - `.disc__face`
   - `.disc__base-image`
   - `.disc__overlay-image`
   - `.disc__hud`
2. `ui/diff-renderer.js` の `.disc` 生成経路を helper 化する。
   - `ensureDiscSkeleton(disc)`
   - `getDiscHudRoot(disc)`
3. timer / badge の append 先を `.disc` 直下 or `.disc__hud` に揃える。
4. shadow CSS を `.disc::before` へ寄せる。
   - ただしこの phase では旧 selector をまだ消さず、compatibility で並走させてよい。
5. `.disc::after` は shadow 専用ではなく「不要なら縮退候補」に落とす。

### 完了条件

- normal stone も special stone も同じ stone skeleton を持つ。
- `.disc` root だけで shadow を表現できる足場ができている。
- timer / badge が skeleton 導入後も位置崩れしない。

### 検証束

```powershell
npm run test:jest -- test/ui.stone-rendering.test.js test/ui.stone-timer-position.test.js test/ui.disc-shadow.test.js
```

---

## Phase 2: render state API の導入

### 目的

- 通常石と特殊石の見た目更新を 1 本化し、`setDiscStoneImage()` と `applyStoneVisualEffect()` の役割重複を解消する。

### 作業

1. `ui/board-renderer.js` の `setDiscStoneImage()` を、互換 wrapper を残しつつ `applyDiscRenderState()` へ寄せる。
2. `ui/diff-renderer.js` は normal stone でも special stone でも `computeDiscRenderState()` → `applyDiscRenderState()` の形へ揃える。
3. `game/visual-effects-map.js` の stone visual 定義を次の形へ寄せる。
   - `renderMode`
   - `imagePath` / `imagePathByOwner`
   - `scale`
   - `shadowProfile`（必要なら）
4. `cssMethod: 'background' | 'pseudoElement'` は compatibility 読み取りを残してもよいが、新規利用を止める。
5. `ui/visual-effects-map.js` は class 付与だけでなく render state を返す / 適用する責務へ変更する。

### 完了条件

- normal stone と special stone が同じ API で描画される。
- stone visual 定義の一次情報が `cssMethod` ではなく render state へ移っている。
- `setDiscStoneImage()` が normal-only helper ではなくなっている。

### 検証束

```powershell
npm run test:jest -- test/ui.stone-rendering.test.js test/ui.visual-effects-map.shared.test.js test/ui.stonevisuals-delegation.test.js test/game.visualeffects.registration.test.js
```

---

## Phase 3: background / pseudoElement / injected img 分岐の撤去

### 目的

- 特殊石描画の複数分岐をやめ、shadow を壊す主要因である paint-probing と `special-stone-img` 注入を撤去する。

### 作業

1. `ui/visual-effects-map.js` の `applyStoneVisualEffect()` から以下を段階的に撤去する。
   - paint 成否 probing
   - inline `backgroundImage` 直接操作
   - `special-stone-img` 注入
2. 特殊石は `.disc__overlay-image` の `src` 差し替えで表現する。
3. `replace` 系特殊石は base image を隠すだけにし、root `.disc` の shadow には触れない。
4. `styles-stone-shadows.css` から shadow の multi-selector 契約を縮退する。
   - 目標は `.disc` / `.disc::before` のみ
5. preload 失敗時は「画像なしでも skeleton と shadow は残る」fallback にする。

### 完了条件

- `special-stone-img` を runtime で追加しない。
- shadow CSS が `.disc::after` や `.disc.special-stone::before` に依存しない。
- preload failure 時も stone root と shadow は維持される。

### 検証束

```powershell
npm run test:jest -- test/ui.disc-shadow.test.js test/assets.preload.test.js test/ui.visual-effects-map.shared.test.js test/game.special-stone-visual-rule.test.js test/game.special-stone-browser-order.test.js
```

---

## Phase 4: cleanup / mirror 同期 / visual regression 固定

### 目的

- 旧契約を削除し、`worker-public/` mirror と visual regression の基準を最終形へ揃える。

### 作業

1. 不要になった selector / helper / compatibility 分岐を削除する。
   - `cssMethod` 依存分岐
   - `special-stone-img`
   - shadow multi-selector の残骸
2. 既存 test を最終形へ更新する。
   - `ui.disc-shadow.test.js` は「root single-owner shadow」を直接固定する。
   - `ui.stone-rendering.test.js` は skeleton 契約を直接固定する。
3. 必要なら visual regression baseline を更新する。
4. `npm run worker:prepare` で mirror を同期する。
5. exact visual contract を変更する場合は、この phase 着手前に `01-rulebook.md` を先に更新する。

### 完了条件

- root から旧描画分岐が消えている。
- `worker-public/` が root と一致している。
- 主要 stone visual 回帰 test と visual regression が pass する。

### 検証束

```powershell
npm run test:jest -- test/ui.disc-shadow.test.js test/ui.stone-rendering.test.js test/ui.visual-effects-map.shared.test.js test/assets.preload.test.js test/game.special-stone-visual-rule.test.js test/game.special-stone-browser-order.test.js
npm run worker:prepare
npm run test:visual
```

## 9. 全体完了条件

1. 盤面上の全石が `.disc` root を持ち、shadow の所有者が `.disc` だけで説明できる。
2. 通常石と特殊石が同じ stone skeleton / render state API で描画される。
3. `cssMethod: 'background' | 'pseudoElement'` 依存が新規経路から消えている。
4. runtime の `special-stone-img` 注入が消えている。
5. preload 成否に関わらず stone shadow が構造的に残る。
6. 主要 regression test と visual regression が pass している。
7. `worker-public/` が root 正本から同期されている。

## 10. 実装順の要点

- 先に shadow CSS だけを消しに行かない。まず stone skeleton と render state API を作る。
- `.disc` 契約を壊さずに内側レイヤーを足し、その後に旧 selector を削る。
- `game/visual-effects-map.js` の data model を先に整理してから、`ui/visual-effects-map.js` の DOM 実装を削る。
- root を先に直し、`worker-public/` は最後に同期する。

## 11. 止まる条件

- 特定特殊石が「通常石 base + overlay」では表現できず、画像仕様変更が必要だと分かった場合
- rulebook に exact visual contract が既にあり、今回の最終見た目がそれと衝突する場合
- `.disc` 契約を壊さずに timer / HUD / animation を保持できないことが分かった場合
- 同一ファイルに未承認の競合差分が入り、上書きリスクが高い場合

