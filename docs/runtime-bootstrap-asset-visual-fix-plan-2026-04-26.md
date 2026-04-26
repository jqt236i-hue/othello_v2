# runtime bootstrap / asset preload / visual check 修復計画

最終更新: 2026-04-26

## 位置づけ

この文書は、2026-04-26 の重大バグ探索で見つかった配備後ランタイム周辺の確定問題を、次の実行者がそのまま直せる粒度に落とした実装計画です。

対象は、ブラウザ classic script の bootstrap、asset manifest / preload、script 重複、visual regression runner です。ゲームルールやカード効果の仕様変更は扱いません。

## 一次情報

- ゲーム仕様の正本: `01-rulebook.md`
- 内部 bootstrap 契約: `docs/architecture-contracts.md` の `9. DI and bootstrap contracts`
- 作業ルール: `.github/copilot-instructions.md`, `AGENTS.md`, `.github/instructions/docs.instructions.md`
- 調査結果メモ: `/memories/repo/bug-hunt-2026-04-26-runtime-findings.md`
- 根拠ファイル:
  - `index.html`
  - `shared/ui-bootstrap-shared.js`
  - `ui/bootstrap.js`
  - `scripts/generate-asset-manifest.js`
  - `tests/visual-regression/run-visual-check.js`
  - `tests/visual-regression/baseline-board.png`

## 検証済み事実

1. 実ブラウザで `window.SharedUIBootstrap === false` だった。
2. `shared/ui-bootstrap-shared.js` は browser で `globalThis.SharedUIBootstrap` を公開できるが、`index.html` に script tag がない。
3. `index.html` で `shared/shared-board-utils.js` が 2 回読み込まれている。
4. `assets/asset-manifest.json` に `assets/images/Gacha/N/type-*.mp3` が含まれている。
5. `ui/bootstrap.js` の manifest preload は全 entry を `Image()` で読むため、mp3 entry が `reason: "error"` になり、毎回 asset fallback warning が出る。
6. `npm run test:visual` は `image size mismatch` で失敗した。確認時の寸法は `baseline-board.png = 581x584`, `current-board.png = 374x374`。
7. 次の確認は通過済み。
   - 配備 / script / asset 起動ガード: 6 suites / 34 tests
   - network parity: 18 suites / 224 tests
   - 手番 / 保留選択 / 終局 / 合法手: 8 suites / 76 tests
   - `npm run match:check`
   - `npx wrangler deploy --dry-run`
   - 実ブラウザで通常クリック数手、CPU カード使用、再生 lock 解消

## 非目標

- カード効果、CPU 判断、ネット対戦 authority の仕様変更はしない。
- `01-rulebook.md` の見た目仕様を変えない。
- `worker-public/` を正本化しない。root を直してから `npm run worker:prepare` で同期する。
- visual regression baseline を、根拠なく「現状に合わせて上書き」するだけで済ませない。

## 修復方針

局所修正で済むものは局所で直す。ただし、配備後 runtime の見落としを防ぐため、script load contract と preload contract はテストで固定する。

安定した契約を変える必要が出た場合だけ、`docs/architecture-contracts.md` を同じ差分で更新する。現時点では、既存契約に実装を合わせる修復なので、追加契約は不要見込み。

## Phase 0: 作業前の基準固定

### 目的

前回の背景 asset 復元差分と、今回の runtime 修復差分を混ぜて壊さないようにする。

### 作業

1. `git status --short` で未コミット差分を確認する。
2. 調査で生成された一時証跡を扱う方針を決める。
   - `.playwright-mcp/*`
   - `bug-hunt-browser-console.txt`
   - `bug-hunt-initial-load.png`
   - `tests/visual-regression/current-board.png`
3. 背景 asset 復元差分を触る必要がある場合は、root 側だけを編集し、最後に `npm run worker:prepare` で mirror を揃える。

### 完了条件

- 修復対象の差分と、一時証跡 / 生成物の差分が区別できている。
- 調査 artifact を残すか削除するかが決まっている。

## Phase 1: SharedUIBootstrap の browser load contract を直す

### 目的

`docs/architecture-contracts.md` の bootstrap 契約どおり、browser classic script でも `SharedUIBootstrap` を利用できるようにする。

### 主対象

- `index.html`
- `worker-public/index.html` は直接編集しない。`npm run worker:prepare` で同期する。
- 近接 test:
  - `test/index.card-module-scripts.test.js`
  - `test/index.local-script-paths.test.js`

### 作業

1. `index.html` の shared utility load 群に `shared/ui-bootstrap-shared.js` を追加する。
2. load order は、`ui/bootstrap.js` と `ui/handlers/init.js` より前にする。
3. `test/index.card-module-scripts.test.js` に、`shared/ui-bootstrap-shared.js` が存在し、script list に含まれることを固定する assertion を追加する。
4. 可能なら classic-script 実行テストまたは Playwright smoke で `window.SharedUIBootstrap === true` を確認する。

### 完了条件

- 実ブラウザで `window.SharedUIBootstrap === true`。
- `ui/handlers/init.js` と `ui/bootstrap.js` の fallback は残してよいが、通常 browser 経路は shared bridge を解決する。
- `test/index.card-module-scripts.test.js` と `test/index.local-script-paths.test.js` が pass する。

## Phase 2: shared-board-utils の二重ロードを消す

### 目的

classic script の重複実行をなくし、load order を読みやすくする。

### 主対象

- `index.html`
- `test/index.card-module-scripts.test.js`

### 作業

1. `index.html` の `shared/shared-board-utils.js` を 1 回だけ残す。
2. `shared/ui-bootstrap-shared.js` を追加する位置と合わせて、shared utility 群の順番を明確にする。
3. script list に同一 `src` が重複しないことを test で固定する。

### 完了条件

- `index.html` 内の `shared/shared-board-utils.js` は 1 回だけ。
- script duplicate guard が pass する。
- `npx jest --runInBand --runTestsByPath test/index.card-module-scripts.test.js test/index.local-script-paths.test.js` が pass する。

## Phase 3: asset manifest と preload の型を分離する

### 目的

画像 preload と音声 asset の存在管理を混ぜず、正常な mp3 を `Image()` error として扱わない。

### 主対象

- `scripts/generate-asset-manifest.js`
- `ui/bootstrap.js`
- `test/assets.manifest.test.js`
- `test/assets.preload.test.js`
- 必要に応じて `test/asset.manifest.apply.test.js`

### 推奨設計

次のどちらかを選ぶ。

1. manifest は全 asset を保持し、preload 側で image extension だけを `Image()` に渡す。
2. manifest 生成時に `kind: "image" | "audio" | "other"` を付け、preload 側は `kind === "image"` だけを画像 preload する。

推奨は 2。将来、音声 preload や existence check を分けやすい。

### 作業

1. `scripts/generate-asset-manifest.js` に extension 判定を追加する。
   - `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg` => `image`
   - `.mp3`, `.ogg`, `.wav` => `audio`
   - その他 => `other`
2. `assets/asset-manifest.json` の entries に `kind` を出す。
3. `ui/bootstrap.js` の `preloadAssets()` は `kind` または extension で画像だけを `preloadImageList()` に渡す。
4. mp3 は manifest に残す。観測ガチャの配置音 catalog から消さない。
5. `test/assets.preload.test.js` に、mp3 entry が preload failure にならない case を追加する。
6. `test/assets.manifest.test.js` に、mp3 が manifest に残り、画像ではない kind を持つことを追加する。

### 完了条件

- 実ブラウザ初期化で `asset preloading incomplete` が通常時に出ない。
- `assets/asset-manifest.json` と `worker-public/assets/asset-manifest.json` が同じ契約を持つ。
- 観測ガチャの配置音は catalog / UI / sound engine で引き続き参照できる。

## Phase 4: visual regression の寸法契約を固定する

### 目的

`npm run test:visual` を、実際の UI 崩れ検出として信頼できる状態に戻す。

### 主対象

- `tests/visual-regression/run-visual-check.js`
- `tests/visual-regression/baseline-board.png`
- `tests/visual-regression/current-board.png` は生成物として扱う

### 作業

1. `run-visual-check.js` が撮影する `#board` の期待寸法を明示する。
2. baseline と current の寸法差が出た時に、実際の DOM rect と viewport をログに出す。
3. どちらが正しい寸法かを確認する。
   - `01-rulebook.md` や CSS に固定寸法があるならそれに合わせる。
   - 固定寸法がないなら、現行 responsive layout の安定寸法をテスト契約として明示する。
4. 正しい寸法に合わせて baseline を更新する。
5. 更新理由を commit message または作業報告に残す。

### 完了条件

- `npm run test:visual` が pass する。
- baseline 更新が必要な場合、寸法変更の理由が説明できる。
- visual check が失敗した時に、少なくとも current / baseline 寸法と board DOM rect が分かる。

## Phase 5: mirror 同期と配備前検証

### 目的

root 正本の修復を `worker-public/` へ反映し、配備後 runtime まで確認する。

### 作業

1. `npm run worker:prepare` を実行する。
2. `worker-public/index.html`, `worker-public/ui/bootstrap.js`, `worker-public/assets/asset-manifest.json` が root と同期していることを確認する。
3. 次の検証束を実行する。

### 検証束

必須:

```powershell
npx jest --runInBand --runTestsByPath test/index.card-module-scripts.test.js test/index.local-script-paths.test.js
npx jest --runInBand --runTestsByPath test/assets.manifest.test.js test/assets.preload.test.js test/asset.manifest.apply.test.js
npm run test:visual
npm run checkall
npm run match:check
npx wrangler deploy --dry-run
```

ブラウザ smoke:

1. `npm run serve` または `serve-local` task を起動する。
2. `http://127.0.0.1:8000/index.html?debug=1` を開く。
3. console で次を確認する。
   - `window.SharedUIBootstrap === true`
   - `window.CardLogic === true`
   - `window.NetworkMatchClient === true`
   - 通常時に `asset preloading incomplete` が出ない
4. 黒の合法マスを 1 回クリックし、CPU 応答後に次を確認する。
   - `window.isProcessing === false`
   - `window.isCardAnimating === false`
   - `window.VisualPlaybackActive !== true`

### 完了条件

- 必須検証束が pass する。
- 実ブラウザ smoke が pass する。
- `worker-public/` は `npm run worker:prepare` で同期済み。
- 実デプロイする場合は、dry-run pass 後にユーザー合意を得て `npm run worker:deploy` を実行する。

## 仕様更新の扱い

この計画は、既存仕様どおりにランタイムと検証を直すものなので、現時点では `01-rulebook.md` 更新は不要。

ただし、visual regression の正しい board 寸法を仕様として外部に見せる必要が出た場合は、実装修正より先に `01-rulebook.md` の該当 UI / 見た目節を更新する。

## 最終完了条件

1. `SharedUIBootstrap` が browser classic script で公開される。
2. `shared/shared-board-utils.js` の二重ロードがない。
3. 音声 asset が画像 preload 失敗として扱われない。
4. `npm run test:visual` が信頼できる寸法契約で pass する。
5. `npm run worker:prepare` 後の `worker-public/` が root と同期している。
6. 配備前検証束と実ブラウザ smoke が pass する。