# TypeScript 正本化完了レポート

> **Status**: Merge readiness review / completion report  
> **作成日**: 2026-05-12  
> **対象ブランチ**: `typescript-source-of-truth`  
> **対象**: production source の TypeScript 正本化、残存 JavaScript の wrapper / generated / runtime projection 分類  
> **一次情報**: `01-rulebook.md`, `.github/copilot-instructions.md`, `docs/architecture-contracts.md`, `docs/plans/typescript-source-of-truth-agent-plan-2026-05-12.md`

## 位置づけ

この文書は、`docs/plans/typescript-source-of-truth-agent-plan-2026-05-12.md` に基づいて今回実行した TypeScript 正本化作業の完了報告である。

ゲーム仕様、カード効果、UI 表示仕様を変更する文書ではない。今回の作業は「手編集すべき production 実装本体を `.ts` に寄せ、`.js` を正本にしない」ための構造変更と検証である。

## 非目標

- `01-rulebook.md` にあるゲーム仕様・カード仕様・UI 表示仕様は変更しない。
- `worker-public/` を正本として直接修正しない。
- classic browser runtime を一括廃止しない。
- 長時間 selfplay / training は実行しない。
- 既存の unrelated dirty worktree を revert / 整理しない。

## 実施内容

### TypeScript 正本化

次の実装本体を TypeScript 側へ寄せ、対応する JavaScript は dist wrapper / runtime projection として扱う形に整理した。

- `utils/owner-helpers.ts`
- `game/logic/cards/breeding.ts`
- `game/logic/cards/sniper.ts`
- `game/debug/debug-actions.ts`

対応する `.js` は、手編集する正本ではなく `dist/` 出力を読む外殻として整理した。

- `utils/owner-helpers.js`
- `game/logic/cards/breeding.js`
- `game/logic/cards/sniper.js`
- `game/debug/debug-actions.js`

### JavaScript 棚卸し gate の強化

`scripts/inventory-js-legacy.ts` を厳密化し、残存 `.js` を以下の分類で扱う前提にした。

- `dist-wrapper`
- `node-cli-adapter`
- `generated`
- `runtime-projection`
- `test-fixture`
- `legacy-implementation`
- `unknown`

あわせて `docs/typescript-migration-js-allowlist.json` を追加・更新し、残存 `.js` が無分類で増えた場合に検出できるようにした。

### TypeScript 対象範囲の更新

`cpu/**/*.ts` を TypeScript チェック対象に含めるため、次を更新した。

- `tsconfig.json`
- `tsconfig.build.json`

### visual effects runtime の browser global 整理

`game/visual-effects-map.runtime.js` は当面 `runtime-projection` として扱う。

`scripts/check-window-usage.js` の gate に合わせ、`window.` 直参照をやめ、`globalThis['window']` 経由の `browserGlobal` 代入へ変更した。

`ui/visual-effects-map.ts` では既存 browser / test API 互換のため、次の global export を維持した。

- `window.GameVisualEffectsMap`
- `window.STONE_VISUAL_EFFECTS`
- `window.PENDING_TYPE_TO_EFFECT_KEY`
- `window.SPECIAL_TYPE_TO_EFFECT_KEY`
- `window.applyStoneVisualEffect`

### browser module registry の再生成

実ブラウザ QA 中に、stale な `public/module-registry.js` が `game/debug/debug-actions` entry に `process.cwd()` を埋め込み、DEBUG ON 時に `ReferenceError: process is not defined` を起こす問題を発見した。

修正として root 側の module registry を再生成し、worker mirror を同期した。

- `public/module-registry.js`
- `worker-public/public/module-registry.js`

### verification blocker の解消

full Jest を阻害していた追加の移行差分を解消した。

- `src/engine/selfplay-runner.ts`: invalid action retry を rejected clone ではなく pre-action baseline の deep clone から再実行するようにし、selfplay の state drift を防止した。
- `game/cpu-turn-handler.ts`: CPU commentary runtime を lazy / global-first に解決し、通常実行・presentation runtime・Jest mock のいずれでも同じ commentary 経路を使うようにした。成功 move commit 後の processing lock も解放する。
- `ui/presentation-handler.ts`: local `CARD_USED` では hero commentary を優先し、同じカード使用で enemy commentary を二重発火しないようにした。
- `ui/move-executor-visuals.ts`: Jest / browser wrapper 経由で `stone-visuals` / `animation-utils` を解決し、instant hyperactive placement の placed-cell sync が move animation より前に走ることを確認できるようにした。
- `test/selfplay.runner.test.ts`, `test/cpu.turn-handler.commentary.test.ts`: 上記 runtime 契約に合わせ、clean baseline retry と commentary mock isolation を明示した。

### worker-public mirror 同期

root 側を正本として扱い、`npm run worker:prepare` で `worker-public/` を同期した。

確認結果:

- `[worker-prepare] mirror-verified files=497`

## 検証結果

### PASS

- `npm run typecheck`
- `npm run build:ts`
- `node dist/scripts/inventory-js-legacy.js`
- `npm run checkall`
- `npm run worker:prepare`
- `npm run test:network:parity`
- `npm run match:check`
- `npm run test:jest -- --runInBand --silent --json --outputFile=".sisyphus/jest-last.json"` (`410` suites PASS, `3000` tests PASS, skipped suites unchanged)

### Focused Jest PASS

- `test/utils.owner-helpers.network-seat.test.ts`
- `test/ui.network-client.seat-normalization.test.ts`
- `test/game.debug-actions.fill-hand.test.ts`
- `test/game.sniper-will.test.ts`
- `test/game.breeding-frontier.test.ts`
- `test/cards.breeding-will-surfaces.test.ts`
- `test/ui.visual-effects-map.shared.test.ts`
- `test/game.network-turn-handoff.test.ts`
- `test/ui.match-mode.network-button.test.ts`
- `test/ui.match-mode.leaderboard-limit.test.ts`

module registry 再生成後にも、次を再実行して PASS を確認した。

- `test/game.debug-actions.fill-hand.test.ts`
- `test/ui.visual-effects-map.shared.test.ts`
- `test/game.network-turn-handoff.test.ts`

full Jest blocker 解消時に、次を追加で再実行して PASS を確認した。

- `test/selfplay.runner.test.ts`
- `test/presentation.schedule.cpu.test.ts`
- `test/game.cpu-turn-handler.presentation-runtime.test.ts`
- `test/cpu.turn-handler.commentary.test.ts`
- `test/ui.move-executor-visuals.instant-hyperactive.test.ts`
- `test/e2e/reset_click.e2e.test.ts`

### Playwright 実ブラウザ QA PASS

`http://127.0.0.1:8000/?qa=registry-fix` を実ブラウザで開き、次を確認した。

- title が `カードオセロ`。
- 初期盤面が 8x8 で表示される。
- `DEBUG` ボタン押下後に `DEBUG: ON` になる。
- `window.DebugActions` が存在する。
- `DebugActions.fillDebugHand` と `DebugActions.applyVisualTestBoard` が存在する。
- `window.OwnerHelpers` が存在する。
- visual global が存在する。
- `window.PENDING_TYPE_TO_EFFECT_KEY.BREEDING_WILL === "breedingStone"`。
- `window.NetworkMatchClient` が存在する。
- 合法手クリック後に `moveCount: 1` へ進む。
- console errors / warnings は 0。

追加確認として `http://127.0.0.1:8002/` を通常 URL で開き、次を確認した。

- 通常起動時に `window.gameState` / `window.cardState` が準備済み、8x8 board / legal cell 4 件。
- 通常起動時は `window.DebugActions` が `undefined` で、debug helper は露出しない。
- 合法手クリック後、白 CPU 応答まで収束し、`turnNumber: 2`、disc 数 6、processing / playback lock は false。
- UI の `DEBUG: OFF` ボタン押下後に `DEBUG: ON` となり、`window.DebugActions`, `window.CardLogic`, `window.useSelectedCard` が利用可能になる。
- Playwright console error は 0。

### FAIL / 未解決

なし。`npm run test:jest` は PASS した。

## マージ可否

検証上はマージ可能な状態まで到達した。

注意点:

- `git diff --stat` で `1459 files changed, 8019 insertions(+), 360668 deletions(-)` の大規模未コミット差分がある。
- `typescript-source-of-truth` ブランチには upstream が設定されていない。
- `.sisyphus/` evidence、スクリーンショット、tmp asset manifest、音声ファイルなど、マージ対象に含めるべきか判断が必要な未追跡ファイルが残っている。

マージ前に最低限必要な整理:

- 未追跡の証跡・スクリーンショット・tmp ファイルを commit 対象から除外する。
- `worker-public/` mirror 差分が root 正本から生成されたものだけであることを最終確認する。
- 変更を論理単位ごとに commit する。

## `01-rulebook.md` 更新要否

更新不要。

理由: 今回の作業は TypeScript 正本化、runtime wrapper / generated artifact 整理、module registry 再生成、検証であり、プレイヤーに見えるゲーム仕様・カード仕様・UI 表示仕様を変更していないため。

## 変更ファイル一覧

このレポート作成時点の working tree は 1459 files changed の大規模差分である。ここでは今回の TypeScript 正本化・検証で直接確認した主要変更ファイルと、マージ前に注意すべき差分カテゴリを列挙する。

### 主要 source / config / docs

- `docs/plans/typescript-source-of-truth-agent-plan-2026-05-12.md`
- `docs/plans/typescript-source-of-truth-completion-report-2026-05-12.md`
- `docs/typescript-migration-js-allowlist.json`
- `scripts/inventory-js-legacy.ts`
- `tsconfig.json`
- `tsconfig.build.json`
- `utils/owner-helpers.ts`
- `utils/owner-helpers.js`
- `game/logic/cards/breeding.ts`
- `game/logic/cards/breeding.js`
- `game/logic/cards/sniper.ts`
- `game/logic/cards/sniper.js`
- `game/debug/debug-actions.ts`
- `game/debug/debug-actions.js`
- `game/visual-effects-map.runtime.js`
- `ui/visual-effects-map.ts`
- `ui/handlers/match-mode.js`
- `public/module-registry.js`
- `worker-public/public/module-registry.js`

### 検証で使った / 関連するテスト

- `test/utils.owner-helpers.network-seat.test.ts`
- `test/ui.network-client.seat-normalization.test.ts`
- `test/game.debug-actions.fill-hand.test.ts`
- `test/game.sniper-will.test.ts`
- `test/game.breeding-frontier.test.ts`
- `test/cards.breeding-will-surfaces.test.ts`
- `test/ui.visual-effects-map.shared.test.ts`
- `test/game.network-turn-handoff.test.ts`
- `test/ui.match-mode.network-button.test.ts`
- `test/ui.match-mode.leaderboard-limit.test.ts`

### 生成 / mirror 差分

- `worker-public/`
- `worker-public/assets/asset-manifest.json`
- `worker-public/cards/catalog.generated.js`
- `worker-public/shared/gacha-hand-catalog.generated.js`
- `worker-public/shared/observation-gacha-catalog.generated.js`
- `worker-public/public/module-registry.js`

### マージ対象から除外検討が必要な未追跡証跡

- `.sisyphus/evidence/*`
- `.sisyphus/jest-last*.json`
- `.sisyphus/module-registry-log.txt`
- `chrome-game-after-click.png`
- `chrome-game-after-fix.png`
- `chrome-game-after-fix2.png`
- `chrome-game-after-move.png`
- `story-tutorial-removal-manual-qa.png`
- `assets/asset-manifest.json.tmp-*`
- `worker-public/assets/asset-manifest.json.tmp-*`
