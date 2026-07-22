# 繁殖生成石の Pixi 表示修正 設計書

## 文書の役割

- 役割: 「繁殖の意志」で生成された石が繁殖石本体の画像になる表示不具合を、通常 Pixi 盤面の意味境界から修正するための実装設計
- プレイヤー向け仕様の正本: `01-rulebook.md`
- 演出の正本: `正本/演出正本.md`
- 内部契約の正本: `docs/architecture-contracts.md` 7.3
- 非目標: 繁殖の生成先、反転、持続ターン、繁殖起点、DOM compatibility の表示仕様、spawn の再生順の変更

## 問題と期待結果

`breedingSproutByOwner` は、次回の繁殖起点を追跡しつつ生成直後の石へ一時的な芽表示を付ける状態であり、繁殖石本体を示す `specialStone` / `BREEDING` marker ではない。

しかし `ui/pixi/stone-view.ts` は `breeding-sprout` marker だけでも石の `specialType` を `BREEDING` と推論する。このため、通常石である生成石が `BREEDING_WILL-<owner>.png` を使い、繁殖アンカーが複数存在するように見える。同じファイルには芽の procedural overlay があるが、石が存在しない場合にだけ描画する条件になっており、canonical な生成石では到達不能である。

期待結果は次のとおり。

- 繁殖石本体だけが `BREEDING` 特殊石画像と持続表示を使う。
- 繁殖で生成された石は所有者の通常石画像を保ち、その上に一時的な芽 overlay を表示する。
- 一時 marker が消えた後は通常石表示だけが残る。
- ゲーム状態、繁殖起点、DOM compatibility、playback settlement は変えない。

## リポジトリ上の根拠

- `01-rulebook.md:652-663`: 次に置く石だけを繁殖石（アンカー）とし、そこから自分の石を生成する。
- `正本/演出正本.md:71`: 生成石を順番に紫ハイライト付きで見せる。
- `ui/board-dom-compat/renderer.ts:68`: `breedingSprout` は「繁殖生成の1ターン草表示」。
- `ui/board-dom-compat/dom-patcher.ts:502-506`: 通常 disc に `breeding-sprout-icon` を重ねる。
- `ui/board-visual/model-builder.ts:512,700`: 占有セルの一時状態を独立した `breeding-sprout` marker に変換する。
- `ui/pixi/stone-view.ts:113-127`: marker から `specialType` を推論し、現状は `breeding-sprout` を `BREEDING` としている。
- `ui/pixi/stone-view.ts:460-476`: 芽 overlay は既に存在するが、石なし条件でのみ描画する。
- `test/ui.pixi-board-scene.test.ts:496-537`: 現在のテストが marker-only の非canonical fixture と誤った `BREEDING` 推論を固定している。

## 設計

### 選択肢

1. `breedingSproutByOwner` を canonical state から削除し、別の UI-only 状態を追加する。
   - 表示不具合に対してゲーム状態とネット契約まで変更するため、範囲が過大になる。
2. model builder で `breeding-sprout` marker を生成しない。
   - 誤った特殊石化は止まるが、本来の一時的な芽表示も失われ、DOM compatibility と意味がずれる。
3. Pixi stone view で `breeding-sprout` を「特殊石種」ではなく「通常石に重なる一時 marker」として扱う。
   - 現行 render model と Single Visual Writer を維持したまま、誤分類と到達不能な overlay 条件を同じ所有者で直せる。

### 採用案

選択肢3を採用する。

- marker から特殊石種を推論する処理では、`breeding-sprout` を明示的に非特殊石 marker として除外する。marker data に将来 `type` が追加されても、marker kind の意味を優先して特殊石へ昇格させない。
- `breeding-sprout` は occupied stone にだけ overlay を描画する。marker 単体の不整合状態では石や芽を描画せず、成功した盤面に見える fallback を作らない。
- 既存の Pixi procedural overlay と retained stone view を再利用する。別 canvas、DOM fallback、追加アニメーション時計、canonical state 変更は行わない。

### 表示データフロー

1. game state の `breedingSproutByOwner` を model builder が occupied cell の `breeding-sprout` marker に変換する。
2. stone view はセルの `stone.specialType` または本体/status marker から特殊石種を決めるが、`breeding-sprout` はこの推論に参加させない。
3. 通常石 texture を選択する。
4. 同じ retained stone view の overlay layer に芽を描く。
5. 次の所有者ターン開始で一時 marker が消えると、通常石 texture だけを再描画する。

## 互換性・失敗時の扱い

- `BREEDING` special marker を持つ繁殖アンカーの画像解決は変更しない。
- DOM compatibility は既に期待どおり通常石 + 芽アイコンなので変更しない。
- marker-only の不整合セルは表示対象にしない。canonical model は occupied cell にだけ marker を生成するため、通常動作への影響はない。
- ネット snapshot、Worker mirror、ゲーム結果、playback event の形は変更しない。

## テストと検証

- `test/ui.pixi-board-scene.test.ts` の sprout fixture を occupied normal stone に直す。
- `BREEDING` 専用 texture と通常石 texture を同時に渡し、通常石 texture が選ばれること、`specialType` が `null` のままであること、芽 overlay が描かれることを確認する。
- 繁殖アンカー fixture では従来どおり `BREEDING` 専用 texture が選ばれることも同じテストで固定する。
- focused Jest、`npm run typecheck`、`npm run build:browser`、`git diff --check` を実行する。
- Pixi browser check は `spawn / normal` を対象に、Vite lane と classic lane を個別実行する。全 lane・全 mode・全 scenario の網羅 suite は今回の局所修正に対して過大なため、focused scenario を完了条件とする。

## リスクと緩和

- marker 推論の変更で繁殖アンカー画像まで失うリスクは、アンカーが `stone.specialType = BREEDING` / `special` marker を通ることを専用 assertion で固定する。
- overlay が通常石の背面に描かれるリスクは、既存の `specialRing`（stone texture より後段の同一 retained view）を再利用し、描画 command をテストする。
- 表示修正が browser bundle に反映されないリスクは、focused checks 後に `npm run build:browser` を実行する。

## 完了条件

- 繁殖生成石が通常石 texture を使い、繁殖石画像を使わない。
- 繁殖生成石に芽 overlay が表示される。
- 繁殖アンカーは従来どおり繁殖石画像を使う。
- canonical/game/network/playback 契約を変更しない。
- focused Jest、typecheck、Vite/classic の focused Pixi browser check、browser build、diff check が成功する。
- task-owned 変更だけをコミットする。

## Self-review

- 初期の「mapping 1行削除」だけでは芽 overlay が到達不能のままになるため、特殊石種の分離と occupied stone overlay の両方を同じ修正単位に含めた。
- marker data の将来変更で再発しないよう、単なる map entry 削除ではなく marker kind 自体を非特殊石として扱う設計にした。
- marker-only fixture を成功表示する必要はなく、canonical builder が occupied cell に限定していることから fail-closed を選んだ。
- 変更は通常 Pixi writer 内の局所的な表示分類で、ゲームルール・複数runtime・公開契約を横断しない。既存の直接テストもあるため、独立 subagent review は不要と判断した。
- 実行時に網羅 browser suite がローカル制限内で完了しなかったため、同じ check runner の `spawn / normal` を Vite/classic の両 lane で実行する focused verification へ修正した。修正対象の spawn と両 browser delivery lane を直接覆い、無関係な全 scenario の長時間実行は完了条件から外した。
