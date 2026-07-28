# 極細盤面フレームスキン追加 設計

## 文書の役割

- 対象: 生成済みの極細盤面フレーム5案を、標準所持の盤面フレームスキンとして正式採用する。
- プレイヤー向け正本: `01-rulebook.md` の見た目設定・盤面フレーム規定。
- 内部構造の正本: `docs/architecture-contracts.md` §7.3 Single Visual Writer。
- 非目標: 盤面描画方式、スキン保存形式、ネットワーク共有仕様、カスタムスキン機能、既定スキンは変更しない。

## 問題と望ましい結果

`assets/images/board/frame-skin-candidates/` に、既存フレームより細い木製フレーム5案があるが、候補素材のままで `SKIN > 盤面フレーム` には表示されない。

完了後は次の5種類が初期所持の盤面フレームとして表示され、クリック選択、ローカル保存、次回起動時の復元、通常盤面への画像適用、特殊形状盤面への既存CSSプリセット適用を既存フレームと同じ経路で行える。

| ID | 表示名 | 素材 |
| --- | --- | --- |
| `thin-ebony-gold` | 黒檀金象嵌枠 | 黒檀 + 金象嵌 |
| `thin-walnut-brass` | 胡桃真鍮枠 | 胡桃 + 真鍮 |
| `thin-charred-cedar-copper` | 焼杉銅縁枠 | 焼杉 + 銅 |
| `thin-birch-gunmetal` | 白樺黒鉄枠 | 白樺 + 黒鉄 |
| `thin-mahogany-bronze` | 紅木古青銅枠 | マホガニー + 古青銅 |

## 現在の構造

- `ui/board-skin/catalog.ts` が標準盤面フレームのID、表示名、説明、画像パス、画像別レイアウト値の正本。
- `ui/board-skin/controller.ts` はカタログを列挙して選択UIを作り、既存selection層へ保存する。
- `ui/board-skin/runtime.ts` は選択した画像とレイアウト変数を `#board-frame` へ適用する。
- `ui/board-visual/frame-presenter.ts` が通常盤面と特殊形状盤面の双方についてフレーム状態を同期し、Single Visual Writer契約を維持する。
- `styles-layout.css` の既存 `#board-frame::before` がラスター画像を描画する。新しいキャンバス、DOM writer、アニメーション時計は不要。

## 選択肢

### A. 個人保存のカスタムスキンとして登録する

既存のカスタムスキン機能を利用できるが、初期所持にならず、ビルド済み標準素材として配布できないため不採用。

### B. 5種類専用のCSSや描画分岐を追加する

素材ごとの自由度は上がるが、既存のカタログ → runtime → frame presenter 経路を重複させ、Single Visual Writer周辺の保守範囲を不要に広げるため不採用。

### C. 既存盤面フレームカタログへ追加する

既存の選択、保存、通常盤面、特殊形状盤面、Pixi/DOM両バックエンドの共通経路を再利用できる。変更がカタログと検証へ局所化されるため採用する。

## 採用設計

### 素材の昇格

候補であることを示すディレクトリ名と `candidate` 接尾辞を外し、`assets/images/board/board-frame-thin-*-v1.png` へ移動する。root素材を正本とし、`worker-public/` は既存生成処理で同期する。

### カタログ登録

`BASE_BOARD_FRAME_SKINS` の末尾へ5件を追加する。既定ID `marsh-forged-iron` は変更しない。

各画像は1254x1254で、フレーム外側と中央が透過している。画像ごとの透過余白と木枠位置に合わせ、盤面本体サイズを変えずに次の対称paddingを設定する。

| ID | padding |
| --- | ---: |
| `thin-ebony-gold` | 18px |
| `thin-walnut-brass` | 22px |
| `thin-charred-cedar-copper` | 15px |
| `thin-birch-gunmetal` | 10px |
| `thin-mahogany-bronze` | 10px |

上下左右に同じ値を使い、`artOffsetY` は0とする。既存の `--board-frame-art-overhang` を使い、新しいレイアウトフィールドは追加しない。ブラウザ確認で盤面との隙間や過剰な重なりが見つかった場合は、カタログ値だけを調整する。

### プレイヤー向け仕様

`01-rulebook.md` の初期所持フレーム一覧へ5つの表示名とIDを追加する。見た目選択は従来どおりローカルで保持し、ネット対戦相手へ共有しない。

### データと制御の流れ

```text
BASE_BOARD_FRAME_SKINS
  -> board-skin controller の選択肢
  -> selection のローカル保存
  -> board-skin runtime の画像・layout適用
  -> frame presenter が通常/特殊盤面へ同期
  -> active backend は従来どおり1つ
```

## 互換性と失敗時の扱い

- 保存済みの既存IDと既定IDは変更しないため移行処理は不要。
- 画像解決に失敗した場合は既存runtimeのPNG解決・フォールバック挙動を使う。
- 特殊形状盤面ではラスター画像を直接表示せず、既存どおり選択IDをCSS外周プリセットへ渡す。
- 追加素材はローカル見た目であり、ゲーム状態、ネットワークauthority、CPU、trainingへ影響しない。
- 5枚で約1.7MB増えるが、選択肢プレビューは既存どおりlazy loadingで、選択時だけ本表示へ適用される。

## 検証戦略

1. `test/ui.board-skin-controller.test.ts`
   - カタログ順、ID、表示名、画像パスを検証する。
   - 5種類すべてを選択し、保存値・data属性・CSS画像パスを検証する。
   - 各レイアウト変数を検証する。
   - PNG寸法と外周透過を検証する。
2. `npm run build:browser` と `npm run build:vite`
   - TypeScript、classic registry、Vite向けcosmetic bundle、cachebusterを再生成する。
3. ブラウザ実機確認
   - `SKIN > 盤面フレーム` に5件が表示される。
   - 5件を順に選び、盤面を過度に隠さず、画像欠けや外周色残りがない。
4. `npm run worker:prepare` とmirror確認
   - root正本から配布用mirrorを生成し、5画像とカタログを配布経路へ載せる。

## リスクと対策

- 画像ごとの透明余白差で、木枠が細すぎる、または盤面との隙間が出る可能性がある。
  - 対策: runtimeやCSSを分岐させず、既存の画像別layout値をブラウザ確認で調整する。
- 作業ツリーに別作業の未コミット変更と生成物がある。
  - 対策: 正本のクリーンなファイルを優先して変更し、`01-rulebook.md` と生成物は今回のhunkだけを部分ステージする。分離不能な生成物はコミットへ混ぜない。
- `worker-public/` はmirrorであり、直接編集すると正本とずれる。
  - 対策: 必ず既存の生成処理を使い、root素材とカタログを先に変更する。

## 完了条件

- 5種類が標準盤面フレームカタログに存在する。
- 5種類がUIから選択・保存・復元できる。
- 通常盤面で5画像が読み込まれ、盤面操作やSingle Visual Writer契約を変えない。
- `01-rulebook.md` の初期所持一覧が実装と一致する。
- focused test、browser build、実機確認、配布mirror確認が成功する。
- タスク所有差分だけがコミットされ、既存の別作業を含めない。

## Self-review

- 新しい描画分岐を作る案を退け、既存カタログ経路だけで要件を満たす設計へ局所化した。
- 当初は全素材へ同じpaddingを使う案も検討したが、生成画像の内側透過境界が約85〜147pxと異なるため、画像別layout値へ改めた。
- `artOverhang` の新規公開フィールド追加は不要と判断した。既存フィールドだけで調整し、必要性がブラウザ検証で実証された場合にのみ設計を再検討する。
- カタログ追加は描画authorityを増やさず、frame presenterとactive backendの既存所有関係を維持する。
- 独立subagentレビューは、変更が既存の単一カタログ経路に限定され、focused coverageが既にあるため不要と判断した。
