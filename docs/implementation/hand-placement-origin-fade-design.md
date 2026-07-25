# 手置き演出の手札起点・透明度フェード 設計

## 1. 文書の役割

この文書は、石を置く手の演出を画面端ではなく配置者の手札付近から開始し、出現・退場を透明度フェードで見せるための実装設計である。

- プレイヤー向け表示仕様の正本: `01-rulebook.md` と `正本/演出正本.md`
- 内部責務境界の正本: `docs/architecture-contracts.md`
- 実装対象: `place_hand_animation` を処理する DOM-owned の手演出
- 非対象: canonical game state、配置結果、`events[]` の順序、Pixi board writer、通常ドローやカード使用の軌道

## 2. 問題と望ましい結果

現状の `ui/animation-utils.ts#playHandAnimation` は、配置対象セルの横位置を保ったまま、下側なら盤面下端より下、上側なら盤面上端より上を開始・退避位置にしている。そのため、プレイヤーには手が画面端から突然出入りするように見え、手札から石を持ってきた感覚にならない。また、待機中のラッパーを開始直前に不透明、終了直後に透明へ即時切替しているため、手本体の出現・消失にフェードがない。

望ましい結果は次のとおり。

1. 手は配置者に対応する手札カード群の付近から盤面へ移動する。
2. 手札カードが0枚またはカード矩形を取得できない場合も、対応する手札コンテナ付近から移動する。
3. 手札コンテナも取得できない異常時だけ、現在の盤面端起点へ安全にフォールバックする。
4. 接近中に透明度0から1へフェードインし、退避中に1から0へフェードアウトする。
5. 石を置く接触タイミング、効果音、`spawn` / `flip` への引き渡し、busy解除、既存の約0.44秒テンポは変えない。

## 3. 現在の構造と根拠

- `ui/animation-hand-events.ts` が `place_hand_animation` を `playHandAnimation` へ渡す。
- `ui/animation-utils.ts` は `ui/hand-skin/runtime.ts` 系で解決済みの手画像を使い、`#handLayer` / `#handWrapper` 上でDOM演出を再生する。
- `ui/animation-utils.ts` には `_resolveHandElementByOwner` と `_isOwnerOnBottomSlot` があり、ネット対戦を含む表示slotと所有者の対応を既存のowner helper経由で解決できる。
- 盤面セル位置は `_resolveBoardCellClientRectForAnimationUtils` から取得し、Pixi/DOM compatibilityの別経路を増やさない。
- `docs/architecture-contracts.md` 7.3 と `ui/board-visual/effect-branch-inventory.ts` では、手札から盤面へ向かう `place_hand_animation` は盤面ピクセルを書かない `global-dom` のcross-surface trajectoryとして維持されている。

## 4. 選択肢

### A. 手札コンテナの中心だけを使う

実装は単純だが、横スクロールやカード枚数が少ないレイアウトでは、コンテナ中心と実カード群の中心が離れる場合がある。

### B. 表示中カード群の矩形を優先し、手札コンテナへフォールバックする

最大5枚の `.card-item` の表示矩形を合成し、その中心を起点にする。カードがない場合は手札コンテナ中心を使えるため、ユーザーが求める「だいたい手札のカードがある位置」に最も直接対応し、空手札にも耐えられる。

### C. 選択中カード1枚を起点にする

通常配置はカード選択と無関係であり、選択状態を演出起点のauthorityにすると責務が混ざるため採用しない。

採用案はBとする。

## 5. 設計

### 5.1 手札起点の解決

`ui/animation-utils.ts` 内に配置手専用の小さな座標解決ヘルパーを置く。

1. `_resolveHandElementByOwner(playerKey)` で配置者の手札要素を得る。
2. その配下の `.card-item` から、有限かつ幅・高さが正の表示矩形だけを集め、横スクロールで手札枠外にある部分は手札コンテナ矩形でclipする。
3. 画面内のカード部分が1枚以上あれば矩形のunion中心、なければ手札コンテナの有効な矩形中心を使う。
4. 手画像のtransform origin、上下slotごとの回転、既存scaleを考慮し、画像の見た目中心が手札中心へ重なるwrapper座標へ変換する。
5. 有効な手札矩形がなければ、現行の盤面上下端と対象セル横位置へフォールバックする。

対象セル側の `dropX` / `dropY`、上下slotの回転とscaleは変更しない。起点・退避点だけを同じ手札座標へ差し替える。

### 5.2 透明度フェード

- 演出準備中は従来どおりwrapperのinline opacityを0に保つ。
- 接近phaseのWeb Animations keyframeへ `opacity: 0` と `opacity: 1` を加える。
- bob phaseはopacity 1の見た目を維持する。
- 退避phaseのkeyframeへ `opacity: 1` と `opacity: 0` を加える。
- 完了・例外・reset時の既存cleanupでもwrapperをopacity 0へ戻し、残留Animationをcancelする。

inline opacityを演出中のliveness guardとして使う既存構造は維持する。keyframeが描画上のフェードを担当し、接触後の配置確定と後続phase開始時刻は変えない。

### 5.3 責務と互換性

- 変更はDOM presentationに限定し、game/headless/network payloadへ座標や透明度状態を追加しない。
- 手札位置は表示時点のgeometryとして読むだけで、canonical gameplay stateにしない。
- Pixi board writerやboard-local phaseを増やさない。
- 下側・上側、ローカル・CPU・ネットseatの所有者解決は既存helperを共有する。
- `NOANIM`、ユーザー設定で手演出OFF、セルgeometry欠落時の即時完了経路は変更しない。
- 追加の依存関係、永続state、migrationは不要。

## 6. 性能・失敗時の考慮

- 読むカード矩形は手札上限の最大5枚であり、演出開始時に1回だけ解決する。
- 座標取得後にframeごとのDOM読み取りは行わず、Web Animationsへ固定keyframeを渡す。
- 不正な矩形や非表示カードは除外する。全候補が無効でも手札コンテナ、さらに盤面端へ段階的にフォールバックして演出・ターン進行を止めない。
- cleanupは既存のqueue、timeout、busy解除を維持し、フェード失敗をゲーム進行失敗へ昇格させない。

## 7. 検証戦略

1. focused Jestで、下側と上側の配置手について最初のkeyframeが実カード群中心から算出され、盤面端起点ではないことを確認する。
2. 同テストで接近が `opacity: 0→1`、退避が `1→0` であることを確認する。
3. 既存のphase時間208ms / 78ms / 156ms、接触callback、終了時opacity 0、Animation cancel、disabled/no-animation経路のテストを通す。
4. TypeScript typecheckと、表示変更に必須の `npm run build:browser` を通す。
5. 最終diffで正本、実装、テスト、生成browser出力の整合と、既存 `worker-public/` 差分の非混入を確認する。

## 8. リスクと対策

- レスポンシブで手札コンテナが横スクロールする: 実カード矩形を手札コンテナでclipしたunionを優先し、現在見えているカード部分の位置を使う。
- 上側は180度回転するためwrapper座標と見た目中心がずれる: transform originとscaleを含めた上下別の中心offsetをテストで固定する。
- keyframe opacity追加で既存active判定が偽になる: active判定はinline styleの `'1'` を維持し、描画opacityだけをWeb Animations keyframeへ任せる。
- 既存性能改善を損なう: layer/wrapperのmount再利用、`will-change`、Animation cancel、actor画像再利用は変更しない。

## 9. 完了条件

1. 下側・上側のどちらも、実カード群または対応手札枠の中心付近から手が出る。
2. 正常な手札geometryがある場合、盤面の上下端を開始位置に使わない。
3. 出現は透明度0→1、退場は1→0で描画され、完了後はopacity 0へ戻る。
4. 配置接触時の石確定、効果音、後続 `spawn` / `flip`、総phase時間は変更されない。
5. NOANIM、演出OFF、geometry欠落時の進行とcleanupが既存どおり成立する。
6. `01-rulebook.md` と `正本/演出正本.md` が最終挙動を記述する。
7. focused Jest、typecheck、browser build、diff checkが成功する。

## 10. Self-review

- 根本原因である盤面端固定の開始座標と即時opacity切替の両方を対象にした。
- 既存のowner/slot helperとboard geometry経路を再利用し、新しいauthorityやboard writerを作らない設計へ修正した。
- 手札が空・非表示・geometry取得失敗の場合を明示し、通常進行が止まらない段階的フォールバックを追加した。
- 上側回転時の見た目中心補正を当初案へ追加し、単純なcontainer center代入による位置ずれを防いだ。
- プレイヤー向け表示変更なので、コードだけでなく一次仕様と演出正本の更新、browser buildを完了条件へ含めた。
- 変更は単一のDOM演出経路に閉じ、authority・複数runtime・security・concurrencyの高リスク変更ではないため、独立subagent reviewは不要と判断した。

## 11. 実装後の検証結果

- 配置者の手札内に表示されている `.card-item` のunion中心を起点にし、横スクロールで手札枠外にある部分は枠矩形でclipした。表示カードがない場合は手札コンテナ中心、geometryがない場合だけ従来の盤面端へフォールバックする。
- wrapperの実レイアウト寸法、上下slotの回転、既存scaleを使って見た目中心を手札付近へ合わせた。対象セル側の位置、回転、scale、208ms / 78ms / 156msのphase時間は変更していない。
- 接近keyframeへopacity 0→1、退避keyframeへ1→0を追加し、Web Animationsがないtransition fallbackでも同じkeyframeを使う。完了後はinline/computed opacity 0、保持石非表示、active actor 0へ戻る。
- focused Jestは `test/ui.animation-utils.hand-fallback.test.ts` の52件、NOANIM playbackは `test/ui.animation-engine.test.ts` の18件が通過した。
- `npm run typecheck` と `npm run build:browser` が成功し、`index.classic.html` のcachebusterと `public/module-registry.js` を既存generatorで更新した。
- 実ブラウザのPixi通常対局で、下段手札付近の透明な開始位置、盤面への配置、CPU応答、手札側への退避後cleanupを確認した。最終状態はwrapper opacity 0、保持石非表示、active actor 0で、ブラウザerror logは0件だった。
