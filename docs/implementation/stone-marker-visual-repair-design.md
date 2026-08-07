# 石マーカー表示修正 設計書

## 文書の役割

- 役割: 盤面上の石マーカーとルールヘルプの見本を、既存のプレイヤー向け表示仕様へ復旧するための実装設計
- プレイヤー向け仕様の正本: `01-rulebook.md`
- 演出補足の正本: `正本/演出正本.md`
- 内部契約の正本: `docs/architecture-contracts.md` 7.3
- 非目標: 石の効果、残り回数の計算、ターン進行、network authority、DOM compatibility fallbackの選択条件の変更

## 問題と期待結果

現状の通常Pixi盤面では、石マーカーの値はrender modelへ届いているが、表示種類の分類と描画形状が仕様からずれている。

- `REGEN` と `ZOMBIE` の再生回数がハートではなく裸の数字になる。
- `ZOMBIE` の感染猶予と `TIME_STOP` 系の解除猶予が、赤い三角のカウントダウンではなく緑の特殊石持続ターンになる。
- 破壊回避が左下の菱形ではなく右中央の裸の数字になる。
- ガード残りターンが青い五角形ではなく円になる。
- 毒残りターンが左上の紫三角ではなく右中央の裸の数字になる。
- ルールヘルプの石マーカー見本はDOM compatibility用CSSのrenderer scope外にあり、石面と各マーカーのCSSが適用されず裸の数字になる。
- `正本/演出正本.md` の再生回数位置だけが、一次情報と実装契約に反して「中央右側」と記載されている。

修正後は、通常Pixi盤面とヘルプ見本で同じ意味・形・配置を認識でき、DOM compatibility盤面も現在の表示を維持する。

## スコープ、前提、制約

- `01-rulebook.md` に定義済みの表示を復旧する。新しい効果や表示ルールは追加しない。
- 通常盤面の最終pixel writerは既存の `ui/pixi/stone-view.ts` のままとし、DOM要素、別canvas、別timelineを追加しない。
- カウントダウンか持続ターンかの判定には、既存の `shared/stone-status-snapshot.ts` が返す `timerClass` を使用する。特殊石typeの独自一覧をPixi側へ複製しない。
- CSSはactive Pixi盤面へ一致させない。DOM compatibility盤面と、盤面writerではないルールヘルプ見本だけを明示的にscopeする。
- 二桁以上の値でも文字を前面に保ち、形状の横幅を拡張して読めるようにする。
- root sourceを先に変更し、browser配信面とWorker mirrorは既存buildから生成する。

## リポジトリ上の根拠

- `01-rulebook.md`: 持続ターン、カウントダウン、反転回避、破壊回避、再生、反転無効の形・色・配置を定義している。
- `正本/演出正本.md`: 毒マーカーを左上の紫三角と定義する一方、再生位置の一文だけが一次情報より古い。
- `ui/board-visual/model-builder.ts`: canonicalな特殊石情報を `remainingOwnerTurns`、`regenRemaining`、`flipEvadeRemaining`、`destroyEvadeRemaining` としてmaterializeする。
- `shared/stone-status-snapshot.ts` / `shared/special-stone-registry.ts`: `ZOMBIE`、`TIME_STOP`、`TIME_STOP_DEITY` を `countdown-timer` と分類する既存の共有境界。
- `ui/pixi/stone-view.ts`: 通常盤面の石と静的石マーカーを描くSingle Visual Writer内の所有箇所。
- `ui/board-dom-compat/dom-patcher.ts` / `styles-board-dom-compat.css`: fallback盤面では既に正しいtimer classとマーカー形状を使用している。
- `index.html`: ルールヘルプの見本は `.rules-help-counter-demo` 内にあり、`#board[data-board-renderer]` の外に置かれている。
- `ui/board-visual/effect-branch-inventory.ts`: guard/protection、regen/zombie、poisonの静的marker branchをPixiとbrowser fixtureで検証する契約を持つ。

## 選択肢と採用案

### 1. 盤面をDOM compatibilityへ常時切り替える

既存CSSの見た目は再利用できるが、通常経路をPixiとするarchitecture contractに反し、performanceとSingle Visual Writerの前提を崩すため採用しない。

### 2. Pixi盤面上へHTMLマーカーを重ねる

CSSを直接再利用できる一方、盤面pixel writerがPixiとDOMに分裂し、座標同期・fallback・playback settlementが二重になるため採用しない。

### 3. 既存のPixi stone viewを仕様どおり描画し、ヘルプだけ同じCSS宣言へ明示scopeする

timerの意味は共有snapshotから取得し、形状と配置は既存Pixi Graphics内で描く。DOM compatibilityのmarker selectorへ `.rules-help-counter-demo` を併記し、active Pixi boardには一致させない。authorityとrenderer ownershipを変えず、最小の責務範囲で全症状を直せるため採用する。

## 詳細設計

### Pixiマーカー分類

`ui/pixi/stone-view.ts` のstatus label収集時に、特殊石snapshotの `timerClass` を参照する。

- `countdown-timer`: `countdown` として赤い上向き三角を下中央へ描く。
- その他の有効な特殊石残りターン: `special` として緑の角丸四角を下へ描く。
- `REGEN`: 持続ターンを追加せず、再生回数だけをピンクのハートで中央左へ描く。
- `ZOMBIE`: 感染カウントダウンと、紫の再生ハートを別々に描く。

snapshotを一度生成し、同じ結果をtimer分類と反転無効表示に用いる。これにより特殊石typeの判定がPixi内で二重化しない。

### Pixi形状と配置

すべて既存の `specialRing` Graphicsと `statusLabelsRoot` Textへ描く。

| 意味 | 形・色 | 位置 |
| --- | --- | --- |
| 特殊石持続 | 緑の角丸四角 | 下 |
| カウントダウン | 赤い上向き三角 | 下中央 |
| 反転回避 | 紫の円。二桁時は横長に拡張 | 右上 |
| 破壊回避 | 赤系の菱形。二桁時は横長に拡張 | 左下 |
| ガード | 青い五角形。二桁時は横長に拡張 | 上 |
| 再生 | `REGEN` はピンク、`ZOMBIE` は紫のハート | 中央左 |
| 毒 | 紫の上向き三角 | 左上 |
| 反転無効 | 灰色の五角形と `反` | 中央右 |

文字は各背景shapeの後に描画し、二桁時はfont sizeとshape widthを調整する。既存の反転無効描画、stone texture、aura、animation orderは変更しない。

### ルールヘルプ見本

- `.rules-help-counter-demo` 内だけで石のface、base image、HUDを成立させる最小の構造CSSを `styles-layout-info.css` へ追加する。
- markerの形・色・配置宣言は `styles-board-dom-compat.css` の既存selectorへ `.rules-help-counter-demo` scopeを併記して共有する。
- `.rules-help-counter-demo` は盤面writerではなく静的説明UIであり、selectorはactive `#board[data-board-renderer="pixi"]` へ一致しない。
- HELPのHTML文言・class構造は既に仕様どおりのため変更しない。

### 正本同期

`正本/演出正本.md` の再生回数位置を「石の中央左側」へ修正する。一次情報 `01-rulebook.md` の挙動変更ではないため、`01-rulebook.md` は変更しない。

## 互換性・性能・失敗時挙動

- canonical state、events、snapshot、CPU/headless、network publishは変更しない。
- markerはframe update時の既存Graphics再描画だけで完結し、tickerやanimation clockを増やさない。
- DOM compatibility selectorは引き続き `[data-board-renderer="dom"]` へ限定され、追加scopeはヘルプ見本だけである。
- textureが見つからない場合でもprocedural stoneとmarkerは従来どおり表示できる。
- snapshot APIが利用できない異常時は従来の持続表示へ安全に退避するが、通常buildでは共有APIを必須の型契約として扱う。

## テストと検証

- `test/ui.pixi-board-scene.test.ts` で `REGEN`、`ZOMBIE`、`TIME_STOP`、guard、flip evade、destroy evade、poisonのlabel kind、位置、背景shapeを検証する。
- `test/ui.rules-help-panel.test.ts` でHELP見本のstone構造CSSと各marker selector scopeを検証する。
- browser fixtureを実在する `REGEN`、`ZOMBIE`、`TIME_STOP`、destroy evadeを含む状態へ拡張し、診断値とスクリーンショットで確認する。
- focused Jest、typecheck、Pixi browser check、fallback checkを実行する。
- player-visible root変更後に `npm run build:browser` と `npm run build:vite` を実行し、配信bundleを同期する。
- 実ブラウザで通常盤面とHELPのスクリーンショットを取得し、UIの起動・操作問題とmarker renderingを分けて確認する。
- `git diff --check`、task-owned diff、最終statusを確認する。

## リスクと緩和

- マーカーが同時に多数付く石では重なり得る。仕様の固定slotを守り、毒と破壊回避を現在の右中央から別slotへ移して既知の衝突を解消する。
- 二桁値が円・三角・菱形からはみ出す可能性がある。桁数から横幅を拡張し、foreground textを最後に描く。
- HELPへcompatibility CSSを広げる際にactive Pixi盤面へ漏れる可能性がある。全追加selectorを `.rules-help-counter-demo` でscopeし、browserでrendererとcomputed styleを確認する。
- browser生成物は開始時点ですでに別作業の差分を含む。buildは検証のため実行するが、task-owned sourceと分離できない生成差分はcommitへ含めない。

## 完了条件

- 通常Pixi盤面で全対象マーカーの意味・形・色・配置が正本と一致する。
- `ZOMBIE` と `TIME_STOP` の値がカウントダウンとして表示され、`REGEN` に不要な持続ターンが出ない。
- HELP見本で石と全marker badgeが裸の数字ではなく完成形として表示される。
- DOM compatibility、Single Visual Writer、game/network authorityを変えない。
- focused tests、typecheck、browser build、Pixi/fallback check、実ブラウザ確認、diff checkが成功する。
- 分離可能なtask-owned変更だけをコミットする。

## Self-review

- 症状ごとの場当たり的なtype分岐ではなく、既存snapshotの `timerClass` をtimer意味の唯一の入力にした。
- CSSをglobal化せず、DOM fallbackとHELP見本の二つだけへscopeすることでactive Pixi盤面への第二writer化を避けた。
- 一次情報はすでに正しいため書き換えず、明確に古い演出補足だけを同期対象にした。
- 値だけでなくshape・slot・二桁表示までテスト対象にし、既存テストが裸の数字を見逃した穴を塞いだ。
- presentation-onlyの局所修正でauthorityやruntime契約の判断分岐がないため、独立subagent reviewは不要と判断した。
- 最初のbrowser fixtureでは通常の多動石へ破壊回避値を与えていたが、modelが仕様どおり無効値を除外した。破壊回避を実際に持つ究極多動石へfixtureを直し、架空の組合せで描画を通さない形にした。
