# TypeScript移行残課題完全解消計画書

最終更新: 2026-05-07

## 1. 位置づけ

この文書は、`feat/typescript-migration-completion` で TypeScript 正本化を進めた後に残った4件の課題を、別作業として完全解消するための実行計画である。

対象はテスト基盤、テスト期待値、UI import 経路、Jest / ts-jest の module 解決である。ゲーム仕様やカード効果の仕様変更は目的にしない。プレイヤーに見えるルール、カード効果、UI 文言の正本は引き続き `01-rulebook.md` とする。

## 2. 一次情報

- `01-rulebook.md`: プレイヤーに見えるゲーム仕様、カード仕様、UI 表示仕様の正本。
- `docs/architecture-contracts.md`: `game/` / `ui/` / Worker / shared の境界、authority、DI、state 契約。
- `docs/plans/typescript-migration-completion-plan-2026-05-07.md`: TypeScript 移行完了計画と実行結果。
- `package.json`: Jest / ts-jest / build / check script の現在の実行契約。
- `tsconfig.json`, `tsconfig.test.json`: production source と test source の TypeScript 設定。

## 3. 非目標

- 新しいカード効果、ルール、UI 表示仕様を追加しない。
- `dist/` や `worker-public/` を正本として直接修正しない。
- すべての JS wrapper を一括削除しない。
- test 全体の strict 型対応を一度に完了条件にしない。今回の対象は、現在失敗している focused test と mock 注入問題の解消に限定する。
- unrelated な `.playwright-mcp/`, `AGENTS.md`, `.sisyphus/`, `.opencode/`, `__pycache__/` の未コミット差分はこの計画の対象にしない。

## 4. 現状サマリ

TypeScript 正本復元後、主要ゲートは通過している。

| 項目 | 状態 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build:ts` | PASS |
| `npm run checkall` | PASS |
| `npm run worker:prepare` | PASS |
| `effect-resolver.ts` / `card-interaction-effects.ts` の stub 回帰 | 解消済み |

一方で、次の4件が別対応として残っている。

| ID | 残課題 | 種別 |
| --- | --- | --- |
| R1 | `game.guard-will` の deterministic PRNG 注入型エラー | テスト基盤 / DI |
| R2 | `game.position-swap-will` の `permaProtectedStones` 期待値不一致 | テスト期待値 |
| R3 | `ui/` 下の source-sibling `.js` 拡張子付き `require` 27件 | import 経路整理 |
| R4 | Jest が `.ts` を優先解決し、dist wrapper 経由の global mock 注入が効かない | Jest / ts-jest 設計 |

## 5. 全体方針

1. まず R4 を調査し、Jest の module 解決と mock 注入の正しい契約を決める。
2. R1 は、乱数を `globalThis` や wrapper 側の副作用で差し替えるのではなく、既存 DI 入口またはテスト helper から明示注入できる形へ寄せる。
3. R2 は、実装復元後の正しい保護状態を前提に、テスト期待値とテスト名を更新する。
4. R3 は UI の `.js` require を機械的に置換せず、runtime 互換が必要なものと legacy source-sibling 参照を分類してから直す。
5. 各フェーズで focused test を通し、最後に `typecheck`、`build:ts`、`checkall`、`worker:prepare` を通す。

## 6. Phase 0: 事前棚卸しと再現固定

目的: 4件の課題を現在の HEAD で再現し、修正前後の差分を測れる状態にする。

タスク:

- 現在のブランチと対象コミットを記録する。
- unrelated な unstaged / untracked 差分を確認し、この作業で触らないことを明示する。
- focused test を個別に実行し、失敗箇所と stack trace を記録する。
- UI の `.js` 拡張子付き `require` / `import` を一覧化する。
- Jest の `moduleFileExtensions`, `transform`, `moduleNameMapper`, `testEnvironment`, `setupFiles` の現在値を確認する。

推奨コマンド:

```powershell
git status --short
git log --oneline -5
npx jest --runInBand --runTestsByPath test/game.guard-will.test.js
npx jest --runInBand --runTestsByPath test/game.position-swap-will.test.js
rg "require\\([^\\n]*\\.js['\\\"]|from ['\\\"][^'\\\"]*\\.js['\\\"]" ui -n
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.jest,null,2))"
```

完了条件:

- R1 / R2 の失敗が単独で再現できる。
- R3 の対象ファイル一覧が確定している。
- R4 の現行 Jest 解決順序が説明できる。

検証:

- このフェーズは調査のみ。コード変更はしない。

## 7. Phase 1: Jest / ts-jest module 解決契約を修正する

対象: R4

目的: テストが `.ts` 正本を読む場合でも、mock 注入が偶然の dist wrapper 経由に依存しないようにする。

調査観点:

- `moduleFileExtensions` が `ts` を `js` より優先しているか。
- `require('../game/foo.js')` が Jest 上で root `.js` wrapper、`dist/*.js`、または `.ts` のどれへ解決されているか。
- 対象テストが `globalThis` に mock を置き、production module の late lookup に依存しているか。
- mock すべき対象が DI で渡せるのに、wrapper 経由の副作用で差し替えていないか。

推奨方針:

- production module の動作差し替えは、可能な限り明示 DI または exported test helper で行う。
- `globalThis` mock が必要な既存契約は、共通 helper に閉じ込める。
- Jest の global な解決順序を `js` 優先に戻して TS 正本を避ける対応は最終手段とする。TypeScript 正本化の目的に逆行しやすいため。
- wrapper 経由でだけ動くテストは、テスト対象を root TS 正本または `dist` のどちらにするかをテスト名・helper で明示する。

タスク:

- mock 注入に失敗しているテストを `rg "globalThis|jest\\.mock|require\\(" test tests` で分類する。
- `test/helpers/` または既存 helper に、乱数・カード状態・UI global mock の設定 / 後片付け helper を集約する。
- 必要なら `tsconfig.test.json` に test helper 用の型宣言を追加する。
- Jest 設定を変える場合は、変更理由と影響範囲を `package.json` 近辺のコメントではなく、この計画の実行記録または commit message に残す。

完了条件:

- `.ts` が優先解決されても focused test の mock が効く。
- wrapper 経由の副作用に依存する新規テストを増やさない。
- `npm test` の pretest で `checkall` が引き続き通る。

検証:

```powershell
npm run checkall
npx jest --runInBand --runTestsByPath test/game.guard-will.test.js
npx jest --runInBand --runTestsByPath test/game.position-swap-will.test.js
```

## 8. Phase 2: `game.guard-will` の deterministic PRNG 注入を修正する

対象: R1

目的: `守る意志` のテストで、決定的乱数を TypeScript 実装へ正しく注入できるようにする。

想定原因:

- テストが JS wrapper / dist 経由で差し替えていた乱数 mock が、ts-jest の `.ts` 優先解決により production TS へ届いていない。
- `random-source.ts` の型が、テストで渡す deterministic PRNG と一致していない。
- module import 時に乱数関数が閉じ込められ、後から `globalThis` を差し替えても反映されない。

タスク:

- `random-source.ts` の公開 API と、`守る意志` 実装が使う乱数入口を確認する。
- 乱数の DI 入口が既にある場合は、テストをその入口へ移行する。
- DI 入口が不足している場合は、`game/` の headless 境界を壊さない最小の注入口を追加する。
- テスト後に乱数状態を必ず復元する helper を用意する。
- 型は `() => number` などの曖昧な関数型だけで済ませず、既存の `RandomSource` / PRNG 型があるならそれに合わせる。

完了条件:

- `test/game.guard-will.test.js` が全件 PASS する。
- テストが実行順に依存しない。
- production 実装に browser global 依存を追加していない。
- `check-window-usage` の `game/` 検出件数を増やしていない。

検証:

```powershell
npx jest --runInBand --runTestsByPath test/game.guard-will.test.js
npm run check:window
npm run typecheck
```

## 9. Phase 3: `game.position-swap-will` の期待値を復元後仕様に合わせる

対象: R2

目的: `入替の意志` の交換候補テストを、復元後の `permaProtectedStones` を正しく反映した期待値へ更新する。

判断基準:

- `GUARD` / `GLUTTONOUS` が `permaProtectedStones` に入ることが `01-rulebook.md` と復元実装に一致するなら、実装ではなくテストを直す。
- もし `01-rulebook.md` と実装が矛盾する場合は、テスト修正前に仕様を確認し、必要なら `01-rulebook.md` を同じ差分で更新する。

タスク:

- 失敗している assertion の交換候補一覧を確認する。
- `getCardContext` が返す `permaProtectedStones` と `protectedStones` の内訳をテスト内で明示的に検証する。
- 古い期待値が「保護対象も候補に出る」前提なら、候補から除外される期待値へ更新する。
- テスト名や説明文が古い挙動を示している場合は、合わせて修正する。

完了条件:

- `test/game.position-swap-will.test.js` が全件 PASS する。
- 保護対象が交換候補に出ないことを直接検証している。
- `守る意志`、`暴食`、`入替の意志` の相互作用が仕様名で読める。

検証:

```powershell
npx jest --runInBand --runTestsByPath test/game.position-swap-will.test.js
npx jest --runInBand --runTestsByPath test/game.guard-will.test.js test/game.position-swap-will.test.js
```

## 10. Phase 4: UI source-sibling `.js` import を整理する

対象: R3

目的: `ui/` 配下の TypeScript / JavaScript が、隣接 source `.js` を偶然読む状態を解消し、TypeScript 正本または明示 wrapper 経由に揃える。

分類:

| 分類 | 対応 |
| --- | --- |
| TypeScript 正本が存在する source-sibling `.js` 参照 | `.ts` 側の import へ変更するか、拡張子なし import にする |
| root / dist wrapper を意図的に読む互換参照 | wrapper 参照であることを棚卸しに残す |
| browser runtime が `.js` URL を必要とする参照 | build output / `dist` / public asset の契約として明示する |
| legacy JS 実装を直接読む参照 | TS 正本へ移植するか allowlist 化する |

タスク:

- 27件の `.js` 拡張子付き `require` / `import` をファイル単位で分類する。
- 既存 TS 正本があるものは、拡張子なし import または正しい公開入口へ寄せる。
- CommonJS wrapper が必要な箇所は `module.exports = require("../dist/...")` 契約に合っているか確認する。
- 変更後に `npm run build:ts` で生成される `dist/ui/**` の require path が実行可能であることを確認する。
- ブラウザ起動に関わる場合は `npm run serve` の起動前検証を通す。

完了条件:

- `ui/` 下の source-sibling `.js` 参照がゼロ、または allowlist 付きの runtime 互換参照だけになる。
- `rg` による棚卸し結果が説明可能な件数まで減る。
- UI の bootstrap / handler / skin module が `dist` 生成後に解決できる。

検証:

```powershell
rg "require\\([^\\n]*\\.js['\\\"]|from ['\\\"][^'\\\"]*\\.js['\\\"]" ui -n
npm run typecheck
npm run build:ts
npm run checkall
npm run serve
```

## 11. Phase 5: 統合検証と mirror 同期

目的: 4件の修正を統合し、main へ入れられる状態を確認する。

検証束:

```powershell
npm run typecheck
npm run build:ts
npm run checkall
npm run worker:prepare
npx jest --runInBand --runTestsByPath test/game.guard-will.test.js test/game.position-swap-will.test.js
```

追加で、Phase 1 の調査で mock 注入問題の影響を受ける focused tests が見つかった場合は、同じ束に加える。

完了条件:

- R1 から R4 がすべて解消している。
- `effect-resolver.ts` と `card-interaction-effects.ts` の復元済み機能が回帰していない。
- mirror 対象パスを触った場合、`worker-public/` が `npm run worker:prepare` で同期されている。
- unrelated な未コミット差分を混ぜていない。

## 12. 最終完了定義

この計画は、次をすべて満たした時点で完了とする。

- `game.guard-will` が全件 PASS。
- `game.position-swap-will` が全件 PASS。
- `ui/` 下の source-sibling `.js` import が、解消済みまたは明示 allowlist 済み。
- Jest / ts-jest で `.ts` 正本を読んでも、global mock / DI mock が安定して効く。
- `npm run typecheck` PASS。
- `npm run build:ts` PASS。
- `npm run checkall` PASS。
- `npm run worker:prepare` PASS。
- 仕様変更が発生した場合は `01-rulebook.md` が同じ差分で更新されている。仕様変更がない場合は、完了報告で更新不要だった理由を明記する。

## 13. 推奨コミット分割

1. `test(ts-migration): stabilize jest mock injection for ts sources`
2. `fix(game): inject deterministic random source in guard will tests`
3. `test(game): update position swap protected target expectations`
4. `refactor(ui): remove source-sibling js imports`
5. `chore(ts-migration): update residual verification notes`

## 14. 実行時の注意

- `game/` に DOM、`window`、`document`、UI import を追加しない。
- `ui/` から `game/` の内部実装を深く直接読む変更は避け、公開 API / event / DI 経由を優先する。
- `dist/` と `worker-public/` は生成物として扱い、正本修正は root 側の `.ts` に行う。
- 既存の unrelated な unstaged 差分は上書き・削除しない。
- focused test が通った後でも、最後に必ず `typecheck`、`build:ts`、`checkall`、`worker:prepare` を実行する。
