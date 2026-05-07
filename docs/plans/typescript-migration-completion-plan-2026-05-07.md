# TypeScript移行完了計画書

最終更新: 2026-05-07

## 1. 位置づけ

この文書は、JavaScript から TypeScript への移行後に残っている不完全箇所を是正し、「TypeScript 正本」として運用できる状態へ収束させるための実行計画である。

ゲーム仕様、カード効果、プレイヤーに見える UI 仕様は `01-rulebook.md` を正本とする。この計画は仕様変更を目的にしない。対象はビルド構成、型検査対象、JS wrapper、legacy JS 実装、dist / worker-public 生成物の扱いである。

## 2. 非目標

- カード効果やルールの挙動変更は行わない。
- `dist/` や `worker-public/` を正本として直さない。
- すべての互換 wrapper を一度に削除しない。ブラウザ起動、Jest、Worker、local server の互換性を保ちながら段階的に減らす。
- テストコード全体を一気に strict 型対応しない。まず production source の保証範囲を固める。

## 3. 現状サマリ

2026-05-07 時点の調査では、通常の移行ゲートは通るが、完全移行とは言えない。

| 項目 | 状態 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build:ts` | PASS |
| `npm run checkall` | PASS |
| critical `dist` module | 存在確認 PASS |
| `npx tsc -p tsconfig.test.json --noEmit` | FAIL |
| JS の型検査 | `checkJs: false` のため対象外 |
| production source の JS 残存 | 多数あり |
| TS と同名の JS wrapper | 多数あり |
| wrapper ではない JS 実装 | 中核経路に残存 |

主要ディレクトリの TS / JS 数は次の通り。

| Area | TS | JS |
| --- | ---: | ---: |
| `game/` | 163 | 148 |
| `ui/` | 100 | 99 |
| `shared/` | 24 | 25 |
| `scripts/` | 75 | 124 |
| `cards/` | 4 | 5 |
| `src/` | 13 | 17 |
| `test/` | 463 | 468 |

調査で確認した TS / JS 同名ペアのうち、`dist` wrapper と判定できたものは 271 件、`dist` wrapper ではないものは 80 件あった。特に次の JS は実コードまたは独自互換コードを持つため、単純な wrapper と見なしてはいけない。

- `game/move-executor.js`
- `game/cards/effect-resolver.js`
- `game/special-effects/hyperactive.js`
- `game/logic/cards/regen.js`
- `cards/catalog.js`
- `game/move-generator.js`
- `game/special-effects/dragons.js`
- `game/debug/debug-actions.js`

また、`entry-browser.js` の critical module に関係する root TS の一部が、現在の `tsconfig.json` の通常 `include` で直接カバーされていない。

- `game-events.ts`
- `sound-engine.ts`
- `ui.ts`
- `is-env-capable.ts`

`dist/` には対応 JS が存在するが、通常の `typecheck` がこれらの TS を検査している保証は弱い。

## 4. リスク

### 4.1 型検査外の実装が残る

`allowJs: true` かつ `checkJs: false` のため、JS 実装は型検査で壊れない。中核経路に legacy JS が残る限り、`npm run typecheck` が PASS しても移行完了の証明にはならない。

### 4.2 TS と JS の二重正本化

同名の `.ts` と `.js` が並ぶ箇所で、`.js` が wrapper ではなく実コードを持つ場合、修正先を誤る危険がある。`.ts` を直しても実行時に legacy `.js` が使われる、または逆に `.js` だけを直して `dist/` や Worker mirror とズレる可能性がある。

### 4.3 critical module の include 漏れ

`entry-browser.js` が起動時に直接要求する critical module の元 TS が通常 `tsconfig.json` に入っていないと、ブラウザ起動に必要な root module の型エラーや生成漏れを検出しにくい。

### 4.4 テスト TS は型健全ではない

Jest 実行と TypeScript の strict 型検査は別問題である。`tsconfig.test.json` は現時点で大量に失敗するため、テストコードの `.ts` 化は完了していても型移行完了とは言えない。

### 4.5 `checkall` が既存 debt を許容する

`npm run checkall` は PASS するが、`check-window-usage` は `game/*.js` の `globalThis` 参照を検出しつつ許容している。これは hard rule の最終状態ではなく、段階的削減対象である。

## 5. 方針

1. production source の TypeScript 正本性を先に固める。
2. `tsconfig.json` の対象範囲を実行時 critical module と一致させる。
3. JS ファイルを「dist wrapper」「generated browser catalog」「legacy implementation」「test compatibility」の4種類に分類する。
4. legacy implementation は、対応 TS がある場合は TS 正本へ統合し、JS は wrapper 化する。
5. 対応 TS がない JS は、実行経路と責務を確認してから TS 化する。
6. 各フェーズで `typecheck`、`build:ts`、focused test、必要に応じて `worker:prepare` を実行する。

## 6. フェーズ

### Phase 0: 棚卸しを機械化する

目的: JS 残存の判断を人手の印象に依存させない。

タスク:

- TS / JS 同名ペアを一覧化する script を追加または既存 script に統合する。
- JS を次の分類で出力する。
  - `dist-wrapper`
  - `generated`
  - `legacy-implementation`
  - `test-or-tooling`
  - `unknown`
- `legacy-implementation` と `unknown` はファイル行数、隣接 TS の有無、require/import 参照数を出す。
- 結果を `docs/plans/` または `docs/archive/` ではなく、必要なら `tmp/` か標準出力で扱う。恒久的な契約は `docs/architecture-contracts.md` にだけ置く。

完了条件:

- 調査コマンドが root から再実行できる。
- `game/move-executor.js` など実コード JS が `legacy-implementation` として検出される。
- `shared/deck-codec.js` のような薄い wrapper が `dist-wrapper` として検出される。

検証:

- `npm run typecheck`
- `npm run build:ts`
- 棚卸し script の dry run

### Phase 1: `tsconfig.json` の coverage を修正する

目的: production TS のうち実行時に重要なファイルを通常 `typecheck` / `build:ts` の対象へ入れる。

タスク:

- `tsconfig.json` の `include` に root critical TS を追加する。
  - `game-events.ts`
  - `sound-engine.ts`
  - `ui.ts`
  - `is-env-capable.ts`
  - 必要なら `analyze-trap-will.ts` など root TS の扱いも明示する。
- `entry-browser.js` の critical module リストと `tsconfig.json` の対象がズレないよう、`scripts/serve-with-fallback.ts` または check script で検出できるか検討する。
- `moduleResolution: bundler` と CommonJS 出力の組み合わせに問題がないか、現状維持の理由を短くコメントまたは計画メモに残す。

完了条件:

- `npx tsc --noEmit --listFilesOnly` に root critical TS が出る。
- `npm run build:ts` 後に critical `dist` module が更新される。
- `npm run serve` の起動前検証が critical module 欠落を検出できる。

検証:

- `npm run typecheck`
- `npm run build:ts`
- `npm run checkall`
- `npm run serve` の起動前検証

### Phase 2: JS wrapper 契約を固定する

目的: `.js` が残る理由を明確化し、誤編集を防ぐ。

タスク:

- 薄い wrapper の形式を統一する。
  - 原則: `module.exports = require("../dist/...")`
  - 必要な default / named export 互換がある場合だけ例外として明示する。
- wrapper ではない `.js` は、ファイル冒頭または棚卸し結果で `legacy-implementation` と分かるようにする。
- `scripts/test-shim-forwarding.js` の対象を増やし、代表的 wrapper が `dist` へ forward していることを確認する。
- 生成物の `.js`、特に `cards/catalog.js` / `cards/catalog.generated.js` / observation gacha catalog の扱いを generator 契約として分離する。

完了条件:

- wrapper と legacy implementation の判別が一貫する。
- wrapper を正本として編集しないルールが check または文書で追える。
- `npm run checkall` が wrapper forwarding を確認する。

検証:

- `npm run checkall`
- `npm run generate:catalog`
- `npm run worker:prepare`

### Phase 3: 中核 legacy JS を TS 正本へ統合する

目的: gameplay / UI 境界に残る実装 JS を減らす。

優先順位:

1. `game/move-executor.js`
2. `game/cards/effect-resolver.js`
3. `game/logic/cards/regen.js`
4. `game/special-effects/hyperactive.js`
5. `game/special-effects/dragons.js`
6. `game/move-generator.js`
7. `game/debug/debug-actions.js`

タスク:

- 対応する `.ts` が存在する場合、差分を比較して `.js` 側にしかない挙動を `.ts` へ統合する。
- `.ts` へ統合後、`.js` を wrapper 化する。
- `game/` の browser global 参照は、触った範囲では DI または UI bridge へ寄せる。
- 仕様差分が発生する場合は、実装前に `01-rulebook.md` を更新する。単なる移植なら更新しない。

完了条件:

- 対象 JS が wrapper 化されるか、TS 化できない理由が文書化される。
- focused Jest が通る。
- `check-window-usage` の `game/*.js` 検出件数が減る。

検証:

- `npm run typecheck`
- `npm run build:ts`
- `npm run check:window`
- 対象に近い focused Jest
- `npm run worker:prepare`

### Phase 4: import / require 経路を整理する

目的: TS から `.js` wrapper を参照する互換経路を、実行環境に応じて意図的なものだけにする。

タスク:

- production TS 内の `.js` 拡張子 import / require を棚卸しする。
- Worker など ESM 互換のため `.js` 拡張子が必要な箇所と、単に legacy 経路を読んでいる箇所を分ける。
- `game/logic/*` の authority path で runtime-dependent late lookup が残る場合、deps 注入または明示 import へ寄せる。
- `scripts/` の node entry wrapper は、`build:ts` 後の `dist/scripts/*` を読む方針を維持する。

完了条件:

- `.js` 参照が runtime compatibility か legacy debt か分類される。
- authority path で silent fallback により成功扱いになる経路が増えていない。

検証:

- `npm run typecheck`
- `npm run build:ts`
- `npm run test:network:parity`
- `npm run checkall`

### Phase 5: test TypeScript の扱いを決める

目的: テスト `.ts` を「実行できる」だけでなく、どこまで型検査するかを明確にする。

タスク:

- `tsconfig.test.json` の用途を決める。
  - strict 型検査対象にする。
  - あるいは Jest transform 用であり、strict typecheck 対象ではないと明示する。
- strict 対象にする場合は、テスト helper から段階的に型付けする。
- `globalThis` mock、DOM mock、`jsdom` 型、動的 import のエラーを共通 helper / d.ts で吸収する。
- production source の型検査と test source の型検査を別 npm script に分ける。

完了条件:

- `npm run typecheck` が production source の完了条件であることが明確になる。
- test strict check を導入する場合、少なくとも helpers と新規テストは対象になる。
- `tsconfig.test.json` が放置された失敗設定ではなくなる。

検証:

- `npm test`
- `npm run test:jest`
- test typecheck script を作る場合はその script

### Phase 6: 完了ゲートを CI 相当に固定する

目的: 今後 JS 実装が再増殖しないようにする。

タスク:

- `npm run checkall` に次のいずれかを追加する。
  - legacy JS allowlist check
  - JS wrapper shape check
  - root critical TS include check
- `AGENTS.md` と `.github/copilot-instructions.md` の完了条件に、必要なら新しい check 名を追加する。
- `docs/architecture-contracts.md` は、安定契約が変わる場合だけ更新する。

完了条件:

- 新規 legacy JS 実装が check なしに追加されない。
- root critical TS が `tsconfig.json` から外れたら check が落ちる。
- worker mirror 更新が必要な変更で `npm run worker:prepare` が実行される運用が維持される。

検証:

- `npm run typecheck`
- `npm run build:ts`
- `npm run checkall`
- `npm test`
- `npm run worker:prepare`

## 7. 最終完了定義

TypeScript 移行完了は、次をすべて満たす状態とする。

- production source の `.ts` 正本が `npm run typecheck` の対象に入っている。
- `entry-browser.js` の critical module の元 TS が `tsconfig.json` で検査される。
- `npm run build:ts` で critical `dist` module が生成される。
- production source に残る `.js` は、次のどれかに分類されている。
  - `dist` wrapper
  - generator output
  - runtime entry compatibility shim
  - 明示的に allowlist された legacy implementation
- allowlist された legacy implementation は削減計画と owner がある。
- `game/` の新規 browser global 依存が check で増えない。
- `npm run checkall` が JS wrapper / legacy JS / critical TS include の最低限を監視する。
- `npm test` または変更範囲に応じた focused test が通る。
- mirror 対象を触った場合は `npm run worker:prepare` が通る。

## 8. 推奨着手順

最初に Phase 1 を行う。理由は、critical root TS が通常 typecheck の対象外に見える状態では、後続の JS wrapper 化や `dist` 生成の正しさを判断しにくいためである。

次に Phase 0 / Phase 2 を行い、JS 残存を分類する。分類が固まってから `game/move-executor.js` などの中核 legacy JS を個別に TS 正本へ統合する。

## 9. 直近の最小作業単位

1. `tsconfig.json` に root critical TS を追加する。
2. `npm run typecheck` と `npm run build:ts` を実行する。
3. `npx tsc --noEmit --listFilesOnly` で対象に入ったことを確認する。
4. `npm run checkall` を実行する。
5. JS 分類 script または一時調査コマンドで、legacy JS 上位リストを確定する。
6. `game/move-executor.js` と `game/move-executor.ts` の差分を比較し、TS 正本へ統合できるか判断する。

