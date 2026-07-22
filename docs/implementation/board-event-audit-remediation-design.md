# 盤面事象監査の根本修正 設計書

## 文書の役割

- 役割: 盤面上の全事象・カード横断監査で確認した表示欠落、再描画不全、検証資産の陳腐化を、既存のゲーム仕様と Single Visual Writer 契約を維持して修正する実装設計
- プレイヤー向け仕様の正本: `01-rulebook.md`
- 演出の正本: `正本/演出正本.md`、`正本/ターン進行正本.md`
- 内部契約の正本: `docs/architecture-contracts.md` 7.3
- 非目標: カード効果、生成先、ターン順、イベント順序、network authority、CPU 方針、通常 Pixi／DOM compatibility の選択条件の変更

## 確認した問題

### 1. 拡張マス上の繁殖生成石から芽表示が失われる

`ui/board-visual/model-builder.ts` は `breedingSproutByOwner` を表示 marker へ変換する際、通常盤面の範囲外を無条件に捨てる。拡張マスは同じ canonical topology 上の占有マスだが、通常盤面配列の範囲外であるため、そこに生成された石だけが「小さめ + 草デザイン」にならない。

仕様は生成石の位置による例外を定めていない。通常マスと拡張マスを同じ座標所有者問い合わせで検証し、所有者が一致する占有マスだけに芽 marker を残す必要がある。

### 2. `renderBoardFull()` が同一内容のフレームを再適用しない

`renderBoardFull()` は active backend の内部キャッシュを無効化してから新しいフレームを submit する。しかし controller は直前に settled したフレームと意味内容が同じ場合、backend apply を省略して presentation だけを commit する。このため、外部要因で欠落した DOM compatibility cell は再構築されず、Pixi backend でも invalidate 後の再描画保証が controller 契約として成立していない。

無効化は backend 固有の全描画入口を作るのではなく、controller が「次に受理するフレームは同一内容でも backend へ適用する」という一回限りの状態を所有する。

### 3. 現在の公開契約と検証資産が一致していない

CPU の事前解析、詳細カード効果 API、Vite host 設定、DOM compatibility の遅延ロード境界、石 marker 表示は既に正本実装で意図的に更新されている。一方、一部テスト fixture、公開 export inventory、CSS selector の抽出方法、Pixi 画像基準、Worker 静的 mirror が古い前提を保持している。

これらは production の挙動を古いテストへ戻さず、各テストの元の検証目的を維持した fixture／期待値へ更新し、画像と mirror は正規スクリプトから再生成する。

## 採用設計

### 座標所有者の一本化

- model builder 内で拡張セルを座標 key から owner へ引ける読み取り専用 map にする。
- 芽 marker の検証は、通常盤面内なら `gameState.board`、それ以外なら expansion owner を読む一つの helper を使う。
- 座標が存在しない、空、または記録 owner と実際の owner が不一致なら marker を作らない。
- `_expansionCells` の `breedingSprout` は通常セルと同じ `sproutMap` から決める。

この変更は canonical state を補正せず、表示モデルが既存 state を正しく投影するだけである。

### controller 所有の一回限り再適用

- controller に backend invalidation の保留状態を持たせる。
- `invalidate()` が backend の invalidate に成功した後、その状態を立てる。
- idle submit では保留中に equivalent-frame coalescing／commit を使わず、既存の `applyReadyFrame` を通す。
- backend apply または restore が成功した時だけ保留を解除する。失敗時は recovery が再適用できるよう保留を残す。
- playback 中の invalidation は writer を横取りせず、次の controller 所有 apply／restore まで保留する。

DOM renderer の global `forceFullRender()` を呼ぶ経路、第二 writer、backend ごとの settlement 経路は追加しない。

### テスト契約の更新

- CSS は selector 全体の完全一致ではなく、対象 selector が属する declaration block の形と赤色・三角形を検証する。
- CPU テストは現在の card usability seed と非同期 state identity を満たす fixture にし、debug global 非依存・エラー retry という元の目的を実際に通る経路で検証する。
- pending selection は現在の detailed swap result を明示して outcome contract を検証する。
- CPU action は合法なカード fixture を使い、架空の利用不能カードを成功扱いしない。
- export inventory と Vite host は現在の意図的な公開契約を exact に固定する。
- DOM isolation は遅延 loader 定義を normal execution graph と誤認しない範囲抽出に直し、default Pixi graph が compatibility module を評価しない保証は維持する。

### 生成資産

- Pixi画像基準は `npm run baseline:pixijs-playfield` で classic/Vite の同一 fixture を再取得する。
- browser bundle／registry は `npm run build:browser` またはそれを内包する正規スクリプトで生成する。
- `worker-public/` は最後に `npm run worker:prepare` で root source から同期する。
- 生成前後で focused test と静的／再生 browser check を行い、代表画像を目視する。

## 互換性と失敗時の扱い

- 繁殖アンカー、通常マスの生成石、spawn event、芽の寿命は変更しない。
- owner 不一致や topology に存在しない芽記録は表示しない fail-closed を維持する。
- invalidation 中も canonical frame と presentation ordering は controller が所有する。
- backend apply が失敗した場合は従来の recovery へ入り、無効化済み状態を成功扱いしない。
- テスト fixture の更新は production の validation を迂回せず、現行の必須入力を与える。

## 検証

- model builder と controller の直接回帰テスト
- DOM compatibility の欠落セル復元テスト
- 既知の stale test 9件を含む focused Jest
- `npm run typecheck`、`npm run checkall`、`npm run test:network:parity`
- Pixi static／playback／runtime fallback と board input E2E
- `npm run test:jest` の全 suite
- `npm run worker:prepare` 後の worker mirror check
- `git diff --check`、task-owned diff、生成物差分、代表スクリーンショットの目視

## 完了条件

- 拡張マス上の繁殖生成石にも通常マスと同じ芽 marker が付き、owner 不一致の記録は表示されない。
- `renderBoardFull()` が同一 canonical frame でも active backend を再適用し、欠落セルを復元する。
- 公開契約を正確に検証する全 Jest が成功する。
- classic/Vite の画像基準と Worker mirror が root source と一致する。
- board/card/network/browser の既存契約検証が成功し、task-owned 変更だけがコミットされる。

## Self-review

- DOM renderer だけに full-render flag を加える案は、controller が equivalent frame を省略する根因を残し Pixiにも同じ穴を残すため退けた。
- `lastSettled` を消す案は settled-frame subscriber や network visual digest の意味まで壊すため、再適用だけを要求する一回限りの状態に限定した。
- 拡張マスを base board 配列へコピーする案は authority 表現を重複させるため、読み取り時の owner resolver に限定した。
- stale test は assertion 削除ではなく、現在の production validation を通る fixture と exact inventory へ置き換える。
- 既存仕様への適合修正であり、`01-rulebook.md` と `正本/*.md` は現在の期待を既に表現しているため編集しない。

