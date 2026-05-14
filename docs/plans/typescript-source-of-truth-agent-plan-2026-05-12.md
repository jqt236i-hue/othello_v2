# TypeScript正本化 AIエージェント実行計画書

> **Status**: Active plan
> **作成日**: 2026-05-12
> **対象**: production source の TypeScript 正本化、残存 JavaScript の排除または外殻化
> **目的**: 手編集すべき実装本体を `.ts` に統一し、`.js` を正本にしない状態へ収束させる

## 1. 位置づけ

この文書は、AI エージェントに TypeScript 正本化を実行させるための計画書である。

この計画は既存の TypeScript 移行計画を前提知識として参照してよいが、既存計画の完了宣言や許容リストを無批判には採用しない。実際のファイル内容、実行経路、check / test の結果を基準に判断する。

この計画でいう TypeScript 正本化とは、次の状態を指す。

- production 実装の修正先が `.ts` で一意に決まる。
- `.js` は wrapper、adapter、generated artifact、または明示的な runtime projection だけである。
- `.ts` と `.js` の両方に同じ実装本体が存在しない。
- gate がこの状態を継続的に検出できる。

## 2. 一次情報

- `01-rulebook.md`: プレイヤーに見えるゲーム仕様、カード仕様、UI 表示仕様の正本。
- `.github/copilot-instructions.md`: repo 全体の hard rule と完了条件。
- `docs/architecture-contracts.md`: `game/`, `ui/`, `workers/`, `shared/` の責務境界、authority、DI、runtime 契約。
- `AGENTS.md`: 読む順、調べる順、直す順、確認順。
- `package.json`, `tsconfig.json`, `tsconfig.build.json`: build / typecheck / Jest / check の実行契約。
- `scripts/inventory-js-legacy.ts`: 残存 `.js` の棚卸し gate。ただし現状が正しいとは限らないため、最初に検証対象とする。

## 3. 非目標

- ゲーム仕様、カード効果、UI 表示仕様を変更しない。
- `dist/` や `worker-public/` を正本として直接修正しない。
- 互換 wrapper を一括削除しない。
- ブラウザ classic runtime を一度に廃止しない。
- 長時間の selfplay / training を実行しない。
- unrelated な未コミット差分を revert / 整理しない。

## 4. 前版計画の客観評価

判定: 前版は実行可能な骨子としては有用だが、TypeScript 正本化の計画としては緩い。

良い点:

- phase、完了条件、検証コマンドがあり、AI エージェントが作業単位を切りやすい。
- `dist/` と `worker-public/` を正本にしない方針を明示している。
- `game/logic/cards/breeding.js` や `sniper.js` など、実装を持つ `.js` を優先対象にしている。

問題点:

- `runtime-artifact` と `legacy-implementation` の境界が曖昧で、手書き `.js` を残す逃げ道になりやすい。
- 既存 allowlist を修正することが先に来ており、現状追認になりやすい。
- `scripts/inventory-js-legacy.ts` の対象範囲が十分か検証する前に、gate の PASS を完了条件にしている。
- root 直下、`public/`, `cpu/`, `tests/` など、production 実行に影響する可能性のある `.js` の扱いが弱い。
- `allowJs: false` 化の前提条件が曖昧で、いつ移行完了と呼べるかが弱い。
- 各 phase の「中止条件」がなく、AI エージェントが失敗を隠して進みやすい。

修正方針:

- まず現状を検証し、gate 自体を正す。
- 残存 `.js` の許容カテゴリを狭く定義する。
- `legacy-implementation` は原則 0 件を最終条件にする。
- runtime 用 `.js` は「生成物」または「wrapper」に寄せ、手書き実装として残さない。
- 各 phase に中止条件を置く。

## 5. 最終状態

production source で許容される `.js` は次だけとする。

| 分類 | 許容 | 条件 |
| --- | --- | --- |
| `dist-wrapper` | 許可 | 対応 `.ts` が正本。`.js` は `dist/` を読むだけ。 |
| `node-cli-adapter` | 許可 | Node entrypoint として `dist/scripts/*` を読むだけ。実装は `.ts`。 |
| `generated` | 許可 | generator と生成元が明確。手編集禁止。 |
| `runtime-projection` | 一時許可 | classic browser / Worker 用の projection。生成元 `.ts` または generator が必須。手書き実装は不可。 |
| `test-fixture` | 条件付き許可 | production 実行経路に入らない。新規は `.ts` 推奨。 |
| `legacy-implementation` | 禁止 | 移行対象。最終状態では 0 件。 |
| `unknown` | 禁止 | gate failure。 |

重要: `runtime-projection` は「手書き JS を残してよい」という意味ではない。最終的には `.ts` から生成するか、薄い wrapper にする。

## 6. AIエージェント実行ルール

作業開始時に必ず実行する。

```powershell
git status --short
Get-Content AGENTS.md -TotalCount 220
Get-Content .github/copilot-instructions.md -TotalCount 220
Get-Content docs/architecture-contracts.md -TotalCount 260
Get-Content docs/plans/typescript-source-of-truth-agent-plan-2026-05-12.md -TotalCount 260
```

全 phase 共通ルール:

- `.ts` と `.js` の二重実装を残さない。
- TS 化した `.js` は同じ作業単位で wrapper 化する。
- `game/` に DOM / `window` / sound / browser timer 依存を追加しない。
- `ui/` は `game/` の公開 API / event / DI だけを使う。
- `dist/`, `worker-public/`, `public/module-registry.js` は正本として直さない。
- `worker-public/` 同期が必要な場合は root 修正後に `npm run worker:prepare` を実行する。
- broad catch、無言 return、success-shaped fallback を増やさない。
- 仕様変更がない限り `01-rulebook.md` は更新しない。最終報告で更新不要理由を書く。

中止条件:

- 仕様変更が必要になった。
- `.js` 実装と `.ts` 実装のどちらが実行されるか判定できない。
- focused test が存在せず、代替検証も設計できない。
- root ではなく `worker-public/` だけを直す必要が出た。
- unrelated な既存差分と衝突し、作業範囲を分離できない。

中止時は実装を進めず、調査結果と未解決点を報告する。

## 7. Phase 0: 現状を再計測する

目的: 既存 allowlist や過去の完了宣言ではなく、現在の作業ツリーを基準にする。

タスク:

- `git status --short` で未コミット差分を確認し、この作業で触るファイルを限定する。
- `rg --files -g "*.js" -g "!node_modules" -g "!dist" -g "!worker-public"` で全 `.js` を一覧化する。
- `scripts/inventory-js-legacy.ts` の対象ディレクトリを確認し、root 直下、`public/`, `cpu/`, `tests/` などの扱いが妥当か評価する。
- `npm run build:ts` 後に `node dist/scripts/inventory-js-legacy.js` を実行し、現状の failure を記録する。
- `docs/typescript-migration-js-allowlist.json` が存在する場合、tracked か untracked かを確認する。

完了条件:

- 現在の `.js` 総数、gate 対象数、gate 対象外数が説明できる。
- `legacy-implementation`, `unknown`, `runtime-projection` 候補の一覧がある。
- gate が見落としている production-relevant `.js` があれば記録している。

検証:

```powershell
npm run build:ts
node dist/scripts/inventory-js-legacy.js
rg --files -g "*.js" -g "!node_modules" -g "!dist" -g "!worker-public"
```

## 8. Phase 1: 棚卸し gate を正す

目的: TypeScript 正本化の合否を機械的に判定できるようにする。

タスク:

- `scripts/inventory-js-legacy.ts` の分類を最終状態の分類に合わせる。
- `scripts/local-match-server.js` のような `dist/scripts/*` adapter を `node-cli-adapter` として分類する。
- `legacy-implementation` は allowlist で無期限許容しない。残す場合は期限付き例外として理由を明示する。
- `runtime-projection` は生成元 `.ts` または generator の存在を必須にする。
- gate 対象外の `.js` が production 実行に関係する場合は、対象範囲へ追加する。
- allowlist JSON を使う場合は tracked file とし、分類名と gate 実装を一致させる。

完了条件:

- `unknown` が 0 件。
- `legacy-implementation` が 0 件、または期限付き例外として明示されている。
- `node-cli-adapter` と `dist-wrapper` が誤って `legacy-implementation` にならない。
- gate 対象外 `.js` の扱いが説明できる。

検証:

```powershell
npm run build:ts
node dist/scripts/inventory-js-legacy.js
npm run checkall
```

## 9. Phase 2: 移行優先順位を決める

目的: 実行経路とリスクに基づいて、TS 正本化する順番を固定する。

優先順位:

1. `game/`, `shared/`, `utils/` の production 実装。
2. network authority / Worker parity に関係する実装。
3. browser runtime に関係する `ui/` 実装。
4. active な `scripts/` 実装。
5. test fixture。

初期候補:

- `game/logic/cards/breeding.js`
- `game/logic/cards/sniper.js`
- `game/network-turn-handoff.runtime.js`
- `game/visual-effects-map.runtime.js`
- `utils/owner-helpers.js`
- `ui/handlers/match-mode.js`
- `game/debug/debug-actions.js`

タスク:

- 各候補について、対応 `.ts`、実行 runtime、参照元、focused test を記録する。
- 1 task で触る責務領域を 1 つに絞る。
- network / Worker に影響する候補は parity 検証を必須にする。

完了条件:

- 各 legacy candidate に「TS 化」「生成化」「削除」「期限付き例外」の判断がある。
- focused test または代替検証が候補ごとに決まっている。

検証:

```powershell
rg -n "require\\([^\\n]*\\.js['\\\"]|from ['\\\"][^'\\\"]*\\.js['\\\"]" game ui shared utils workers scripts cards src
node dist/scripts/inventory-js-legacy.js
```

## 10. Phase 3: game / shared / utils の実装 JS を TS 化する

目的: headless game logic と shared helper の正本を `.ts` に統一する。

対象例:

- `game/logic/cards/breeding.js` / `game/logic/cards/breeding.ts`
- `game/logic/cards/sniper.js` / `game/logic/cards/sniper.ts`
- `utils/owner-helpers.js` / `utils/owner-helpers.ts`
- `game/debug/debug-actions.js` / `game/debug/debug-actions.ts`

タスク:

- `.js` の公開 API を列挙する。
- `.ts` が `.js` を読み込んでいる場合、その依存を断つ。
- 実装本体を `.ts` へ移す。
- `.js` は `dist/` wrapper または必要最小限の compatibility shell にする。
- owner / player normalization は既存 helper と重複させない。
- `game/` に UI / DOM 依存を追加しない。

完了条件:

- 対象 `.js` に実装本体が残っていない。
- 対象 `.ts` が唯一の実装修正先である。
- focused test が PASS する。
- `npm run checkall` が PASS する。

検証:

```powershell
npm run typecheck
npm run build:ts
npm run checkall
```

候補別 focused test:

```powershell
npx jest --runInBand --runTestsByPath test/game.breeding-frontier.test.ts test/cards.breeding-will-surfaces.test.ts
npx jest --runInBand --runTestsByPath test/game.sniper-will.test.ts test/index.sniper-module-load.test.ts
npx jest --runInBand --runTestsByPath test/utils.owner-helpers.network-seat.test.ts test/ui.network-client.seat-normalization.test.ts
```

## 11. Phase 4: runtime projection を生成物または wrapper にする

目的: `.runtime.js` を手編集実装として残さない。

対象例:

- `game/network-turn-handoff.runtime.js`
- `game/network-turn-handoff.ts`
- `game/visual-effects-map.runtime.js`
- `game/visual-effects-map.ts`

タスク:

- `.runtime.js` がどの runtime で必要か確認する。
- 生成元 `.ts` から出せるなら generator または build step に寄せる。
- 生成できない場合は、`.runtime.js` を薄い wrapper / projection に縮小する。
- network snapshot / playback / authority の runtime 差分を作らない。

完了条件:

- `.runtime.js` が `legacy-implementation` ではない。
- 手編集すべき判断・ロジックは `.ts` 側にある。
- network 関連では parity tests が PASS する。

検証:

```powershell
npm run typecheck
npm run build:ts
npx jest --runInBand --runTestsByPath test/game.network-turn-handoff.test.ts test/ui.visual-effects-map.shared.test.ts
npm run test:network:parity
npm run checkall
```

## 12. Phase 5: UI の実装 JS を TS 化する

目的: UI production 実装の修正先を `.ts` に統一する。

対象例:

- `ui/handlers/match-mode.js` / `ui/handlers/match-mode.ts`
- `ui/network-client.js` / `ui/network-client.ts`
- `ui/layout-stage.js` / `ui/layout-stage.ts`

タスク:

- `.js` が wrapper、global compatibility shell、実装本体のどれかを判定する。
- 実装本体は `.ts` へ移す。
- global export 互換は wrapper に最小限だけ残す。
- Single Visual Writer と playback ordering を壊さない。
- normal play に debug side effect を追加しない。

完了条件:

- UI 実装の正本が `.ts` である。
- `.js` は wrapper / compatibility shell として説明できる。
- focused UI tests が PASS する。

検証:

```powershell
npm run typecheck
npm run build:ts
npx jest --runInBand --runTestsByPath test/ui.match-mode.network-button.test.ts test/ui.network-client.server-url.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts
npm run checkall
```

## 13. Phase 6: scripts を TS 実装 + JS adapter に統一する

目的: active script の実装本体を `.ts` に統一する。

タスク:

- `package.json` から npm script entry を一覧化する。
- active script は `.ts` 実装 + `.js` adapter に統一する。
- migration-era debug script は削除、または期限付き例外にする。
- adapter は `dist/scripts/*` を読むだけにする。
- `npm run build:ts` 前提が必要な script は error message を明確にする。

完了条件:

- active `scripts/*.js` に実装本体が残っていない。
- stale debug script の扱いが決まっている。
- `scripts/` の新規 `legacy-implementation` が gate failure になる。

検証:

```powershell
npm run build:ts
npm run checkall
npx jest --runInBand --runTestsByPath test/scripts.prepare-worker-assets.test.ts test/serve-with-fallback.test.ts
```

## 14. Phase 7: tsconfig で正本化を強制する

目的: TypeScript 正本化を運用ルールだけでなく compiler 設定でも支える。

タスク:

- production build の input が `.ts` 中心になっていることを確認する。
- `allowJs: true` が必要な理由を洗い出す。
- 可能なら production 用 tsconfig で `allowJs: false` にする。
- test / tooling の JS 互換が必要な場合は production typecheck から分離する。
- `checkJs: false` によって隠れている production 実装がないことを確認する。

完了条件:

- production typecheck が JS 実装を正本として扱わない。
- `allowJs: true` を残す場合、残す理由と対象が文書化されている。
- `npm run typecheck`, `npm run build:ts`, `npm run checkall` が PASS する。

検証:

```powershell
npm run typecheck
npm run build:ts
npm run checkall
npm run test:jest
```

## 15. Phase 8: Worker mirror と browser runtime を同期する

目的: root TS 正本化後に mirror / browser runtime が stale にならないようにする。

タスク:

- root production source 変更後に `npm run worker:prepare` を実行する。
- `worker-public/` 差分が root 由来の mirror 更新だけであることを確認する。
- `public/module-registry.js` は generator 由来として扱う。
- browser boot に影響する場合は smoke / visual test を選ぶ。

完了条件:

- Worker mirror が root と同期している。
- `worker-public/` だけを直接直した差分がない。
- network publish / snapshot / reconnect に関わる変更では parity tests が PASS する。

検証:

```powershell
npm run build:ts
npm run worker:prepare
npm run test:network:parity
npm run match:check
```

## 16. 最終完了条件

全体完了条件:

- `node dist/scripts/inventory-js-legacy.js` が PASS。
- `legacy-implementation` が 0 件。
- `unknown` が 0 件。
- 手編集すべき production 実装の正本が `.ts`。
- `.js` は `dist-wrapper`, `node-cli-adapter`, `generated`, `runtime-projection`, `test-fixture` のいずれか。
- `runtime-projection` は生成元または TS 正本が明確。
- `.ts` と `.js` の二重実装がない。
- `dist/`, `worker-public/`, `public/module-registry.js` を正本として直していない。
- `01-rulebook.md` の更新要否を最終報告に含めている。

最終検証束:

```powershell
npm run typecheck
npm run build:ts
node dist/scripts/inventory-js-legacy.js
npm run checkall
npm run test:jest
npm run worker:prepare
npm run test:network:parity
npm run match:check
```

## 17. AIエージェント報告テンプレート

```text
変更概要:
- ...

TS正本化:
- 正本化した .ts:
- wrapper / adapter 化した .js:
- generated / runtime projection として残した .js:
- 削除した stale .js:

gate:
- legacy-implementation: 0 / 残件あり
- unknown: 0 / 残件あり
- inventory 対象外で確認した .js:

検証:
- npm run typecheck: PASS/FAIL
- npm run build:ts: PASS/FAIL
- node dist/scripts/inventory-js-legacy.js: PASS/FAIL
- npm run checkall: PASS/FAIL
- focused tests: PASS/FAIL

01-rulebook.md:
- 更新なし。理由: 仕様・表示挙動を変更していないため。

worker-public:
- 同期なし / npm run worker:prepare 実行済み。

残課題:
- ...
```
