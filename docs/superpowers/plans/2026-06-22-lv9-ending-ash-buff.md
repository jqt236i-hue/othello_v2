# Lv9 Ending Ash Buff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Lv9: 終焉の冥灰` stronger by giving only that CPU profile an all-enabled-card starting deck, excluding disabled 3-chain/3-throw successors, and a permanent 2x multiplier for generated charge gains.

**Architecture:** Keep the change inside CPU startup options and headless charge accounting. Do not loosen normal custom-deck `deckCode` limits; Lv9 receives an explicit `initialDeckCardIdsByPlayer` list so user decks and network room decks remain 30-card contracts. Charge multiplication is stored on canonical `cardState` by player and applied only to generated gains, with transfer/steal/loss/cost paths explicitly excluded.

**Tech Stack:** TypeScript/CommonJS modules, shared deck helpers, headless card state factory, existing browser deck-builder controller, Jest focused tests, existing build and worker mirror scripts.

---

## Scope And Assumptions

- This is a behavior change for CPU startup/deck/charge economy, not a new card and not a CPU decision-policy rewrite.
- `Lv9: 終焉の冥灰` continues to use `decisionLevel: 6`, initial charge 99, and card use unlock from `turnNumber >= 6`.
- "全てのカードが入ってる(3連鎖や3連投石以降を除く)" maps to all enabled catalog cards. In the current catalog, the excluded successors are already `enabled: false`: `triple_chain_01`, `quad_chain_01`, `infinite_chain_01`, `triple_01`, `quad_01`, `infinite_01`.
- Keep the exclusion list explicit in the Lv9 deck helper anyway. This prevents future catalog enablement from silently adding the forbidden successors.
- "獲得布石常時2倍" applies to generated positive gains: normal flip gain, card/effect flip gain, number-cell gain, treasure/ribo/work income, round bonus, and similar non-transfer positive `addChargeWithTotal` paths.
- Do not double starting charge, card-use refunds, card-use costs, repayments/losses, or charge stolen/transferred from the opponent.
- Keep `CHARGE_MAX` at 99. The multiplier increases the requested gain; actual stored gain is still clamped by current room to 99.
- `01-rulebook.md` must be updated. `正本/` should be inspected, but no `正本/` update is expected unless an existing CPU/deck note would become stale.
- Existing unrelated dirty files must not be staged or edited. At plan creation time dirty files included `entry-browser.js`, `index.html`, `test/entry-browser.boot-table-sequence.test.ts`, and `test/entry-browser.bootstrap-contract.test.ts`.

## File Structure

- Modify `01-rulebook.md`: Update the Lv9 CPU bullet to say it uses all enabled cards except 3-chain/3-throw successors and generated charge gains are always 2x.
- Inspect `正本/カード仕様正本.md`, `正本/演出正本.md`, and `正本/正本差分監査.md`: Update only if an existing Lv9 CPU, deck, or charge-economy note conflicts.
- Modify `shared/deck-spec.ts`: Add a pure Lv9 deck-card-id helper and export it. Do not encode this deck as a normal deckCode.
- Modify `shared/cpu-opponent-profiles.ts`: Add Lv9 charge gain multiplier metadata and a getter.
- Modify `shared/cpu-opponent-startup-options.ts`: Add `deckCardIds` and `chargeGainMultiplier` to startup options.
- Modify `ui/deck-builder-controller.ts`: Pass Lv9 CPU `deckCardIds` through `initialDeckCardIdsByPlayer`, and pass the multiplier through `chargeGainMultiplierByPlayer`.
- Modify `game/logic/cards-internal/state-factory.ts`: Initialize and preserve `chargeGainMultiplierByPlayer`.
- Modify `game/logic/cards-internal/charge-ledger.ts`: Apply the multiplier for generated `addChargeWithTotal` gains unless disabled by meta.
- Modify `game/turn/board-charge.ts`: Apply the same multiplier in turn-board charge paths, and disable it for player-to-player transfers.
- Modify `game/logic/cards/work_will.ts`: Route work income through injected charge gain helper so Lv9 multiplier applies.
- Modify `game/logic/cards.ts`: Pass charge helper into Work module.
- Inspect `game/logic/card-resolution/trap.ts`; modify it only if the search in Task 7 finds a charge-steal path that uses a multiplier-eligible add helper.
- Test `test/shared.cpu-opponent-profiles.test.ts`: Startup options and Lv9 all-card deck helper.
- Test `test/ui.deck-builder-controller.test.ts`: Lv9 white/black startup uses raw deck ids and multiplier.
- Test `test/game.cards.reshuffle-cycle.test.ts`: Card state accepts over-30 Lv9 deck ids and stores multiplier.
- Test `test/game.cards.charge-multiplier.test.ts` or nearest focused card-state test: Multiplier behavior for generated gains and exclusions.
- Existing CPU tests to rerun: `test/cpu.turn-handler.programmed-card-policy.test.ts`, `test/cpu.decision.refactor.test.ts`.

---

### Task 1: Update Spec And Confirm Source-Of-Truth Notes

**Files:**
- Modify: `01-rulebook.md`
- Inspect: `正本/カード仕様正本.md`
- Inspect: `正本/演出正本.md`
- Inspect: `正本/正本差分監査.md`

- [ ] **Step 1: Inspect current Lv9 and charge references**

Run:

```powershell
rg -n "Lv9|終焉の冥灰|獲得布石|布石.*2倍|三連鎖|三連投石" 01-rulebook.md 正本 docs -g "*.md"
```

Expected: Find the Lv9 CPU bullet in `01-rulebook.md`; no `正本/` Lv9-specific note is expected.

- [ ] **Step 2: Update the Lv9 rulebook bullet**

Replace the existing `Lv9: 終焉の冥灰` bullet in `01-rulebook.md` with:

```markdown
- CPU対戦で黒または白に `Lv9: 終焉の冥灰` を選んだ場合、CPU思考ロジックは `Lv6: 盤理の観測者` と同じものを使う。その側の初期所持布石は99とし、`turnNumber >= 6` になるまでカード使用を行わず通常の石配置だけを行う。その側はデフォルトデッキの代わりに、使用可能カード全種から `三連鎖の意志` / `四連鎖の意志` / `無限連鎖の意志` / `三連投石` / `四連投石` / `無限投石` を除いた専用デッキを使う。その側が対局中に生成・反転・数字マス・カード効果・ラウンドボーナスなどで獲得する布石は常時2倍になる。ただし初期所持布石、カード使用コスト、返金、返済、損失、相手から奪取・移動した布石は2倍にしない。布石上限は通常どおり99とする
```

- [ ] **Step 3: Decide whether `正本/` needs edits**

If the Step 1 search finds a stale Lv9 CPU/deck/charge note in `正本/`, update only that sentence. If it does not, record in the final report:

```text
正本/: Lv9 CPU専用デッキ/布石倍率の詳細ノートは見つからず、カード挙動・演出・音の変更でもないため未更新。
```

- [ ] **Step 4: Verify spec diff**

Run:

```powershell
git diff -- 01-rulebook.md 正本
git diff --check -- 01-rulebook.md 正本
```

Expected: Only the Lv9 CPU spec changes. `git diff --check` has no whitespace errors.

- [ ] **Step 5: Do not commit yet if implementation will follow immediately**

If this plan is executed as one implementation session, keep the spec change uncommitted until the first verified implementation unit can commit it together with tests. If executing in parallel worktrees, follow the repo instruction instead: commit the spec-only change on main first.

---

### Task 2: Add Lv9 Deck And Startup Option Tests

**Files:**
- Modify: `test/shared.cpu-opponent-profiles.test.ts`

- [ ] **Step 1: Add helper expectations for the Lv9 all-card deck**

Append this test after `keeps Lv9 ending ash on the configured fixed deck code` or replace that fixed-code Lv9 test if the old 30-card deck is no longer used by CPU startup:

```js
test('builds Lv9 ending ash deck from every enabled card except forbidden successors', () => {
  const deckCardIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();
  const enabledIds = DeckSpecHelpers.getEnabledCardIds();
  const forbidden = [
    'triple_chain_01',
    'quad_chain_01',
    'infinite_chain_01',
    'triple_01',
    'quad_01',
    'infinite_01'
  ];

  expect(deckCardIds.length).toBeGreaterThan(30);
  expect(new Set(deckCardIds).size).toBe(deckCardIds.length);
  expect(deckCardIds).toEqual(enabledIds.filter((cardId) => !forbidden.includes(cardId)));
  expect(deckCardIds).toContain('double_chain_01');
  expect(deckCardIds).toContain('double_01');
  for (const cardId of forbidden) {
    expect(deckCardIds).not.toContain(cardId);
  }
});
```

- [ ] **Step 2: Update Lv9 profile expectation**

In `keeps ending ash as a Lv9 opponent profile...`, extend the expected object:

```js
expect(CpuOpponentProfiles.getCpuOpponentProfile('9-ending-ash')).toEqual(expect.objectContaining({
  id: '9-ending-ash',
  level: 9,
  decisionLevel: 6,
  name: '終焉の冥灰',
  portraitSrc: 'assets/images/special-cards/characters/終焉の冥灰.png',
  deckProfile: 'lv9-ending-ash-all-enabled',
  initialCharge: 99,
  initialChargeByPlayer: { black: 99, white: 99 },
  chargeGainMultiplier: 2,
  cardUseUnlockTurnNumber: 6
}));
expect(CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer('9-ending-ash', 'white')).toBe(2);
expect(CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer('9-ending-ash', 'black')).toBe(2);
expect(CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer('8-theory-incarnation', 'white')).toBe(1);
```

- [ ] **Step 3: Update startup deck-code expectation**

Change the dedicated CPU deck-code test so Lv9 no longer expects a 30-card deckCode:

```js
expect(CpuOpponentStartupOptions.getCpuOpponentDeckCode('9-ending-ash')).toBeNull();
```

- [ ] **Step 4: Add startup option expectation for raw deck ids and multiplier**

Replace the current Lv9 startup option expectations with:

```js
const lv9DeckCardIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();

expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('9-ending-ash', 'black')).toEqual({
  profileId: '9-ending-ash',
  deckCode: null,
  deckCardIds: lv9DeckCardIds,
  initialCharge: 99,
  chargeGainMultiplier: 2,
  cardUseUnlockTurnNumber: 6,
  hasStartupOptions: true
});

expect(CpuOpponentStartupOptions.getCpuOpponentStartupOptions('9-ending-ash', 'white')).toEqual({
  profileId: '9-ending-ash',
  deckCode: null,
  deckCardIds: lv9DeckCardIds,
  initialCharge: 99,
  chargeGainMultiplier: 2,
  cardUseUnlockTurnNumber: 6,
  hasStartupOptions: true
});
```

- [ ] **Step 5: Run tests to confirm they fail before implementation**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/shared.cpu-opponent-profiles.test.ts
```

Expected before implementation: FAIL because `getCpuLv9EndingAshDeckCardIds` and `getCpuOpponentChargeGainMultiplierForPlayer` do not exist or Lv9 still returns the old deckCode/profile.

---

### Task 3: Implement Shared Lv9 Profile And Startup Helpers

**Files:**
- Modify: `shared/deck-spec.ts`
- Modify: `shared/cpu-opponent-profiles.ts`
- Modify: `shared/cpu-opponent-startup-options.ts`

- [ ] **Step 1: Add Lv9 deck helper to `shared/deck-spec.ts`**

Add this near the CPU deck constants:

```ts
const CPU_LV9_ENDING_ASH_FORBIDDEN_CARD_IDS = Object.freeze([
    'triple_chain_01',
    'quad_chain_01',
    'infinite_chain_01',
    'triple_01',
    'quad_01',
    'infinite_01'
]);
const CPU_LV9_ENDING_ASH_FORBIDDEN_CARD_ID_SET: ReadonlySet<string> = new Set(CPU_LV9_ENDING_ASH_FORBIDDEN_CARD_IDS);
```

Add this after `getCpuLv8EndingAshDeckCode()`:

```ts
function getCpuLv9EndingAshDeckCardIds(): string[] {
    return getEnabledCardIds().filter((cardId) => !CPU_LV9_ENDING_ASH_FORBIDDEN_CARD_ID_SET.has(cardId));
}
```

Export these in the returned object:

```ts
CPU_LV9_ENDING_ASH_FORBIDDEN_CARD_IDS,
getCpuLv9EndingAshDeckCardIds,
```

Keep `CPU_LV8_ENDING_ASH_DECK_CODE` and `getCpuLv8EndingAshDeckCode()` exported for compatibility unless a separate cleanup is requested.

- [ ] **Step 2: Extend CPU profile types and Lv9 metadata**

In `shared/cpu-opponent-profiles.ts`, change the profile type:

```ts
deckProfile: 'default' | 'lv6-default' | 'lv6-board-executor' | 'lv7-theory-incarnation' | 'lv8-ending-ash' | 'lv9-ending-ash-all-enabled';
chargeGainMultiplier?: number;
chargeGainMultiplierByPlayer?: { black?: number; white?: number };
```

Change the Lv9 profile block to:

```ts
{
    id: '9-ending-ash',
    level: 9,
    decisionLevel: 6,
    name: '終焉の冥灰',
    menuLabel: 'Lv9: 終焉の冥灰',
    portraitSrc: 'assets/images/special-cards/characters/終焉の冥灰.png',
    deckProfile: 'lv9-ending-ash-all-enabled',
    initialCharge: 99,
    initialChargeByPlayer: { black: 99, white: 99 },
    chargeGainMultiplier: 2,
    cardUseUnlockTurnNumber: 6
}
```

The field name must be `cardUseUnlockTurnNumber`; do not add a second unlock-turn field.

- [ ] **Step 3: Add charge multiplier getter**

Add this function in `shared/cpu-opponent-profiles.ts`:

```ts
function getCpuOpponentChargeGainMultiplierForPlayer(value: unknown, playerKey: unknown): number {
    const profile = getCpuOpponentProfile(value);
    const normalizedPlayerKey = playerKey === 'black' || playerKey === 'white' ? playerKey : null;
    const byPlayer = profile.chargeGainMultiplierByPlayer && typeof profile.chargeGainMultiplierByPlayer === 'object'
        ? profile.chargeGainMultiplierByPlayer
        : {};
    const raw = normalizedPlayerKey && Number.isFinite(Number(byPlayer[normalizedPlayerKey]))
        ? Number(byPlayer[normalizedPlayerKey])
        : Number(profile.chargeGainMultiplier);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.max(1, Math.floor(raw));
}
```

Export it:

```ts
getCpuOpponentChargeGainMultiplierForPlayer,
```

- [ ] **Step 4: Extend startup option shape**

In `shared/cpu-opponent-startup-options.ts`, change the interface to:

```ts
interface CpuOpponentStartupOptions {
    profileId: string;
    deckCode: string | null;
    deckCardIds: string[] | null;
    initialCharge: number | null;
    chargeGainMultiplier: number | null;
    cardUseUnlockTurnNumber: number | null;
    hasStartupOptions: boolean;
}
```

Add this helper:

```ts
function getCpuOpponentDeckCardIds(profileValue: unknown): string[] | null {
    const profile = CpuOpponentProfiles.getCpuOpponentProfile(profileValue);
    if (!profile || profile.deckProfile !== 'lv9-ending-ash-all-enabled') return null;
    if (typeof DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds !== 'function') return null;
    const cardIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();
    return Array.isArray(cardIds) && cardIds.length > 0 ? cardIds.slice() : null;
}
```

In `getCpuOpponentStartupOptions`, compute:

```ts
const deckCardIds = getCpuOpponentDeckCardIds(profileId);
const rawChargeGainMultiplier = normalizedPlayerKey
    && typeof CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer === 'function'
    ? CpuOpponentProfiles.getCpuOpponentChargeGainMultiplierForPlayer(profileId, normalizedPlayerKey)
    : 1;
const chargeGainMultiplier = Number.isFinite(Number(rawChargeGainMultiplier)) && Number(rawChargeGainMultiplier) > 1
    ? Math.floor(Number(rawChargeGainMultiplier))
    : null;
```

Return:

```ts
return {
    profileId,
    deckCode,
    deckCardIds,
    initialCharge,
    chargeGainMultiplier,
    cardUseUnlockTurnNumber,
    hasStartupOptions: !!deckCode || !!deckCardIds || initialCharge !== null || chargeGainMultiplier !== null
};
```

Export `getCpuOpponentDeckCardIds` with the existing exports.

- [ ] **Step 5: Run shared tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/shared.cpu-opponent-profiles.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit shared profile unit if worktree allows**

Only stage files touched in Tasks 1-3:

```powershell
git add 01-rulebook.md shared/deck-spec.ts shared/cpu-opponent-profiles.ts shared/cpu-opponent-startup-options.ts test/shared.cpu-opponent-profiles.test.ts
git commit -m "Buff Lv9 CPU startup profile"
```

Skip this commit if unrelated dirty changes make isolated staging unsafe; report the blocker instead.

---

### Task 4: Wire Lv9 Raw Deck And Multiplier Into Browser Startup

**Files:**
- Modify: `test/ui.deck-builder-controller.test.ts`
- Modify: `ui/deck-builder-controller.ts`

- [ ] **Step 1: Update UI startup tests for Lv9 white CPU**

In `CPU Lv9終焉の冥灰対戦では白CPUへ冥灰専用デッキと初期布石99を入れる`, replace the `initialDeckSpecByPlayer` assertions with:

```js
const DeckSpecHelpers = require('../shared/deck-spec.js');
const expectedDeck = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();

expect(options.initialDeckCardIdsByPlayer.white).toEqual(expectedDeck);
expect(options.initialDeckCardIdsByPlayer.white.length).toBeGreaterThan(30);
expect(options.initialDeckCardIdsByPlayer.white).toContain('observer_will_01');
expect(options.initialDeckCardIdsByPlayer.white).toContain('theory_incarnation_01');
expect(options.initialDeckCardIdsByPlayer.white).toContain('board_executor_01');
expect(options.initialDeckCardIdsByPlayer.white).toContain('double_chain_01');
expect(options.initialDeckCardIdsByPlayer.white).toContain('double_01');
expect(options.initialDeckCardIdsByPlayer.white).not.toContain('triple_chain_01');
expect(options.initialDeckCardIdsByPlayer.white).not.toContain('triple_01');
expect(options.initialChargeByPlayer).toEqual({ white: 99 });
expect(options.chargeGainMultiplierByPlayer).toEqual({ white: 2 });
```

- [ ] **Step 2: Update UI startup tests for Lv9 black CPU**

In `CPU Lv9終焉の冥灰を黒に選ぶと黒CPUへ冥灰専用デッキと初期布石99を入れる`, replace the deck assertions with:

```js
const DeckSpecHelpers = require('../shared/deck-spec.js');
const expectedDeck = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();

expect(options.initialDeckCardIdsByPlayer.black).toEqual(expectedDeck);
expect(options.initialDeckCardIdsByPlayer.black.length).toBeGreaterThan(30);
expect(options.initialDeckCardIdsByPlayer.black).toContain('observer_will_01');
expect(options.initialDeckCardIdsByPlayer.black).toContain('theory_incarnation_01');
expect(options.initialDeckCardIdsByPlayer.black).toContain('board_executor_01');
expect(options.initialDeckCardIdsByPlayer.black).toContain('double_chain_01');
expect(options.initialDeckCardIdsByPlayer.black).toContain('double_01');
expect(options.initialDeckCardIdsByPlayer.black).not.toContain('triple_chain_01');
expect(options.initialDeckCardIdsByPlayer.black).not.toContain('triple_01');
expect(options.initialDeckCardIdsByPlayer.white).toBeUndefined();
expect(options.initialChargeByPlayer).toEqual({ black: 99 });
expect(options.chargeGainMultiplierByPlayer).toEqual({ black: 2 });
```

- [ ] **Step 3: Run UI startup tests to confirm failure**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.deck-builder-controller.test.ts
```

Expected before implementation: FAIL because `buildCardInitOptions()` still returns `initialDeckSpecByPlayer` for Lv9 and no `chargeGainMultiplierByPlayer`.

- [ ] **Step 4: Add raw deck and multiplier handling in `ui/deck-builder-controller.ts`**

Add helpers near `resolveCpuDeckSpec`:

```ts
function resolveCpuDeckCardIds(startupOptions: any) {
    const cardIds = startupOptions && Array.isArray(startupOptions.deckCardIds)
        ? startupOptions.deckCardIds
        : null;
    return cardIds && cardIds.length > 0
        ? cardIds.map((cardId: any) => String(cardId || '').trim()).filter(Boolean)
        : null;
}

function resolveCpuChargeGainMultiplier(startupOptions: any) {
    const value = startupOptions && startupOptions.chargeGainMultiplier;
    if (Number.isFinite(Number(value)) && Number(value) > 1) return Math.floor(Number(value));
    return null;
}
```

Update `buildCpuDeckInitOptions` so raw deck ids take precedence over deck specs:

```ts
const blackDeckCardIds = resolveCpuDeckCardIds(blackStartupOptions);
const whiteDeckCardIds = resolveCpuDeckCardIds(whiteStartupOptions);
const initialDeckCardIdsByPlayer: any = {};
if (blackDeckCardIds) initialDeckCardIdsByPlayer.black = blackDeckCardIds;
if (whiteDeckCardIds) initialDeckCardIdsByPlayer.white = whiteDeckCardIds;

const initialDeckSpecByPlayer: any = {};
if (!blackDeckCardIds && profileBlackDeckSpec) initialDeckSpecByPlayer.black = profileBlackDeckSpec;
else if (!blackDeckCardIds && blackDeckSpec) initialDeckSpecByPlayer.black = blackDeckSpec;
if (!whiteDeckCardIds && whiteDeckSpec) initialDeckSpecByPlayer.white = whiteDeckSpec;

const chargeGainMultiplierByPlayer: any = {};
const blackChargeGainMultiplier = resolveCpuChargeGainMultiplier(blackStartupOptions);
const whiteChargeGainMultiplier = resolveCpuChargeGainMultiplier(whiteStartupOptions);
if (blackChargeGainMultiplier !== null) chargeGainMultiplierByPlayer.black = blackChargeGainMultiplier;
if (whiteChargeGainMultiplier !== null) chargeGainMultiplierByPlayer.white = whiteChargeGainMultiplier;

const options: any = {};
if (Object.keys(initialDeckCardIdsByPlayer).length > 0) options.initialDeckCardIdsByPlayer = initialDeckCardIdsByPlayer;
if (Object.keys(initialDeckSpecByPlayer).length > 0) options.initialDeckSpecByPlayer = initialDeckSpecByPlayer;
if (Object.keys(initialChargeByPlayer).length > 0) options.initialChargeByPlayer = initialChargeByPlayer;
if (Object.keys(chargeGainMultiplierByPlayer).length > 0) options.chargeGainMultiplierByPlayer = chargeGainMultiplierByPlayer;
return options;
```

- [ ] **Step 5: Run UI startup tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.deck-builder-controller.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit browser startup unit if isolated**

```powershell
git add ui/deck-builder-controller.ts test/ui.deck-builder-controller.test.ts
git commit -m "Route Lv9 CPU startup deck ids"
```

---

### Task 5: Store Charge Gain Multiplier In Card State

**Files:**
- Modify: `test/game.cards.reshuffle-cycle.test.ts`
- Modify: `game/logic/cards-internal/state-factory.ts`

- [ ] **Step 1: Add card-state initialization test**

Append this test to `test/game.cards.reshuffle-cycle.test.ts`:

```js
test('chargeGainMultiplierByPlayer initializes and preserves Lv9 gain multiplier', () => {
  const deckIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();
  const prng = { shuffle: (arr) => arr, random: () => 0.5 };
  const cardState = CardLogic.createCardState(prng, {
    initialDeckCardIdsByPlayer: {
      white: deckIds
    },
    chargeGainMultiplierByPlayer: {
      white: 2
    }
  });

  expect(cardState.decks.white).toEqual(deckIds);
  expect(cardState.initialDeckSizeByPlayer.white).toBe(deckIds.length);
  expect(cardState.initialDeckSizeByPlayer.white).toBeGreaterThan(30);
  expect(cardState.chargeGainMultiplierByPlayer).toEqual({ black: 1, white: 2 });

  const copied = CardLogic.copyCardState(cardState);
  expect(copied.chargeGainMultiplierByPlayer).toEqual({ black: 1, white: 2 });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.reshuffle-cycle.test.ts
```

Expected before implementation: FAIL because `chargeGainMultiplierByPlayer` is not initialized or copied.

- [ ] **Step 3: Add multiplier normalization in state factory**

In `game/logic/cards-internal/state-factory.ts`, add:

```ts
function normalizeChargeGainMultiplierByPlayer(options: any): Record<string, number> {
    const source = options && options.chargeGainMultiplierByPlayer && typeof options.chargeGainMultiplierByPlayer === 'object'
        ? options.chargeGainMultiplierByPlayer
        : {};
    const normalize = (value: any) => {
        const n = Number(value);
        return Number.isFinite(n) && n > 1 ? Math.floor(n) : 1;
    };
    return {
        black: normalize(source.black),
        white: normalize(source.white)
    };
}
```

Inside `createCardState`, after `initialChargeByPlayer`:

```ts
const chargeGainMultiplierByPlayer = normalizeChargeGainMultiplierByPlayer(options);
```

Inside the returned `cardState` object near `chargeGainedTotal`:

```ts
chargeGainMultiplierByPlayer,
```

In `copyCardState`, add:

```ts
const chargeGainMultiplierByPlayer = normalizeChargeGainMultiplierByPlayer({
    chargeGainMultiplierByPlayer: cardState.chargeGainMultiplierByPlayer
});
```

And include in `nextState`:

```ts
chargeGainMultiplierByPlayer,
```

- [ ] **Step 4: Run state tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.reshuffle-cycle.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit state unit if isolated**

```powershell
git add game/logic/cards-internal/state-factory.ts test/game.cards.reshuffle-cycle.test.ts
git commit -m "Store CPU charge gain multipliers"
```

---

### Task 6: Apply Multiplier To Generated Charge Gains

**Files:**
- Create: `test/game.cards.charge-multiplier.test.ts`
- Modify: `game/logic/cards-internal/charge-ledger.ts`
- Modify: `game/turn/board-charge.ts`

- [ ] **Step 1: Add focused charge-ledger tests**

Create `test/game.cards.charge-multiplier.test.ts`:

```ts
import * as CardChargeLedger from '../game/logic/cards-internal/charge-ledger.js';
import * as TurnBoardCharge from '../game/turn/board-charge.js';

function createCardState(overrides: any = {}) {
  return {
    charge: { black: 0, white: 0 },
    chargeGainedTotal: { black: 0, white: 0 },
    chargeDeltaEvents: [],
    _nextChargeDeltaSeq: 1,
    chargeGainMultiplierByPlayer: { black: 1, white: 2 },
    ...overrides
  };
}

describe('charge gain multiplier', () => {
  test('card charge ledger doubles generated positive gains for the multiplier player', () => {
    const cardState = createCardState({ charge: { black: 0, white: 10 } });

    const gained = CardChargeLedger.addChargeWithTotal(cardState, 'white', 4, {
      helpers: { chargeMax: 99 }
    }, { sourceType: 'placement_flip_gain' });

    expect(gained).toBe(8);
    expect(cardState.charge.white).toBe(18);
    expect(cardState.chargeGainedTotal.white).toBe(8);
  });

  test('card charge ledger does not double disabled transfer gains', () => {
    const cardState = createCardState({ charge: { black: 0, white: 10 } });

    const gained = CardChargeLedger.addChargeWithTotal(cardState, 'white', 4, {
      helpers: { chargeMax: 99 }
    }, { disableChargeGainMultiplier: true, sourceType: 'transfer_gain' });

    expect(gained).toBe(4);
    expect(cardState.charge.white).toBe(14);
    expect(cardState.chargeGainedTotal.white).toBe(4);
  });

  test('multiplied gains still clamp to charge max and report actual added charge', () => {
    const cardState = createCardState({ charge: { black: 0, white: 96 } });

    const gained = CardChargeLedger.addChargeWithTotal(cardState, 'white', 4, {
      helpers: { chargeMax: 99 }
    }, { sourceType: 'treasure_box_gain' });

    expect(gained).toBe(3);
    expect(cardState.charge.white).toBe(99);
    expect(cardState.chargeGainedTotal.white).toBe(3);
  });

  test('turn board charge doubles generated board gains', () => {
    const cardState = createCardState({ charge: { black: 0, white: 10 } });
    const gained = TurnBoardCharge.addChargeWithTotal(cardState, 'white', 3, {
      reason: 'board_bonus_gain',
      popupKind: 'board',
      anchorRow: 2,
      anchorCol: 3
    }, {
      chargeMax: 99,
      CardUtilsModule: {
        addChargeWithDelta(target: any, playerKey: string, amount: number) {
          const before = target.charge[playerKey] || 0;
          const after = Math.max(0, Math.min(99, before + amount));
          target.charge[playerKey] = after;
          return { changed: after !== before, before, after, delta: after - before };
        }
      }
    });

    expect(gained).toBe(6);
    expect(cardState.charge.white).toBe(16);
    expect(cardState.chargeGainedTotal.white).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.charge-multiplier.test.ts
```

Expected before implementation: FAIL because no multiplier is applied.

- [ ] **Step 3: Add multiplier resolver to `charge-ledger.ts`**

Add:

```ts
function resolveChargeGainMultiplier(cardState: any, playerKey: string, amount: number, meta?: any): number {
    if (!(Number(amount) > 0)) return 1;
    if (meta && meta.disableChargeGainMultiplier === true) return 1;
    const source = cardState && cardState.chargeGainMultiplierByPlayer && typeof cardState.chargeGainMultiplierByPlayer === 'object'
        ? cardState.chargeGainMultiplierByPlayer
        : {};
    const raw = Number(source[playerKey]);
    if (!Number.isFinite(raw) || raw <= 1) return 1;
    return Math.max(1, Math.floor(raw));
}

function applyChargeGainMultiplier(cardState: any, playerKey: string, amount: number, meta?: any): number {
    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount)) return 0;
    const multiplier = resolveChargeGainMultiplier(cardState, playerKey, safeAmount, meta);
    return safeAmount > 0 ? safeAmount * multiplier : safeAmount;
}
```

In `addChargeWithTotal`, before `addChargeValue`:

```ts
const requestedAmount = applyChargeGainMultiplier(cardState, playerKey, amount, meta);
const deltaRes = addChargeValue(cardState, playerKey, requestedAmount, 'placement_or_effect_gain', context, meta);
```

Use `requestedAmount` instead of `amount` for the add call.

Export the resolver so the focused test can assert the multiplier decision without reaching into private state:

```ts
resolveChargeGainMultiplier,
```

- [ ] **Step 4: Add same multiplier logic to `turn/board-charge.ts`**

Add:

```ts
function resolveChargeGainMultiplier(cardState: any, playerKey: any, amount: any, opts: any): number {
    if (!(Number(amount) > 0)) return 1;
    if (opts && opts.disableChargeGainMultiplier === true) return 1;
    const source = cardState && cardState.chargeGainMultiplierByPlayer && typeof cardState.chargeGainMultiplierByPlayer === 'object'
        ? cardState.chargeGainMultiplierByPlayer
        : {};
    const raw = Number(source[playerKey]);
    if (!Number.isFinite(raw) || raw <= 1) return 1;
    return Math.max(1, Math.floor(raw));
}
```

In `addChargeWithTotal`, after `opts` is computed:

```ts
const requestedAmount = Number(amount) > 0
    ? Number(amount) * resolveChargeGainMultiplier(cardState, playerKey, amount, opts)
    : Number(amount);
```

Use `requestedAmount` in `CardUtilsModule.addChargeWithDelta` and fallback `before + requestedAmount`.

In `transferChargeBetweenPlayers`, pass multiplier-disabled meta:

```ts
const gained = addChargeWithTotal(cardState, toPlayerKey, movable, { disableChargeGainMultiplier: true }, deps);
```

- [ ] **Step 5: Run multiplier tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.charge-multiplier.test.ts
```

Expected: PASS.

---

### Task 7: Exclude Steal/Transfer Paths And Route Work Income

**Files:**
- Modify: `game/logic/cards-internal/effect-timing.ts`
- Modify: `game/logic/cards/work_will.ts`
- Modify: `game/logic/cards.ts`
- Inspect and conditionally modify: `game/logic/card-resolution/trap.ts`
- Modify: `test/game.cards.charge-multiplier.test.ts`

- [ ] **Step 1: Add transfer and work regression tests**

Append to `test/game.cards.charge-multiplier.test.ts`:

```ts
test('disabled transfer gains are not multiplied when added separately', () => {
  const cardState = createCardState({ charge: { black: 20, white: 10 } });

  const generated = CardChargeLedger.addChargeWithTotal(cardState, 'white', 2, {
    helpers: { chargeMax: 99 }
  }, { sourceType: 'placement_flip_gain' });
  const stolen = CardChargeLedger.addChargeWithTotal(cardState, 'white', 2, {
    helpers: { chargeMax: 99 }
  }, { disableChargeGainMultiplier: true, sourceType: 'transfer_gain' });

  expect(generated).toBe(4);
  expect(stolen).toBe(2);
  expect(cardState.charge.white).toBe(16);
  expect(cardState.chargeGainedTotal.white).toBe(6);
});
```

If there is already a focused work-will test, add this there instead. Otherwise add to this file:

```ts
test('work income can use an injected multiplied charge helper', () => {
  const CardWork = require('../game/logic/cards/work_will.js');
  const cardState = createCardState({
    markers: [{
      id: 1,
      row: 2,
      col: 2,
      kind: 'specialStone',
      owner: 'white',
      data: { type: 'WORK', ownerColor: 'white', workStage: 1, remainingOwnerTurns: 4 }
    }],
    workAnchorPosByPlayer: { black: null, white: { row: 2, col: 2 } },
    charge: { black: 0, white: 10 }
  });
  const gameState = { board: [[0,0,0],[0,0,0],[0,0,-1]] };

  const result = CardWork.processWorkEffects(cardState, gameState, 'white', {
    addChargeWithTotal(target: any, playerKey: string, amount: number) {
      return CardChargeLedger.addChargeWithTotal(target, playerKey, amount, {
        helpers: { chargeMax: 99 }
      }, { sourceType: 'work_income' });
    }
  });

  expect(result.gained).toBe(4);
  expect(cardState.charge.white).toBe(14);
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.charge-multiplier.test.ts
```

Expected before implementation: work test fails because `processWorkEffects` does not accept the injected charge helper.

- [ ] **Step 3: Update Work module to accept injected add helper**

In `game/logic/cards/work_will.ts`, extend `WorkDeps`:

```ts
addChargeWithTotal?: (cardState: CardState, playerKey: PlayerKey, amount: number, meta?: any) => number;
```

Change `processWorkEffects` signature:

```ts
function processWorkEffects(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps: WorkDeps = {}): {
```

Replace:

```ts
addChargeWithTotal(cardState, playerKey, gain);
```

with:

```ts
const added = typeof deps.addChargeWithTotal === 'function'
  ? deps.addChargeWithTotal(cardState, playerKey, gain, { sourceType: 'work_income' })
  : addChargeWithTotal(cardState, playerKey, gain);
```

Return actual added gain:

```ts
return { gained: added, removed, row, col, removedReason: removed ? 'duration_end' : null, incomeStep: stage + 1 };
```

- [ ] **Step 5: Pass charge helper into Work processing**

In `game/logic/cards-internal/effect-timing.ts`, change:

```ts
const res = workMod.processWorkEffects(cardState, gameState, playerKey);
```

to:

```ts
const res = workMod.processWorkEffects(cardState, gameState, playerKey, {
    addChargeWithTotal: helpers.addChargeWithTotal
});
```

- [ ] **Step 6: Inspect trap charge theft**

Run:

```powershell
rg -n "addChargeWithTotal\\(|stolen|steal|trap|奪" game/logic/card-resolution game/logic/cards game/turn -g "*.ts"
```

If `game/logic/card-resolution/trap.ts` uses `addChargeWithTotal(cardState, ownerKey, stolenCharge)`, change it to pass multiplier-disabled meta:

```ts
addChargeWithTotal(cardState, ownerKey, stolenCharge, {
    disableChargeGainMultiplier: true,
    sourceType: 'trap_charge_steal'
});
```

If its helper signature does not accept meta, extend that helper locally rather than using global state.

- [ ] **Step 7: Run focused multiplier tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.charge-multiplier.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit multiplier unit if isolated**

```powershell
git add game/logic/cards-internal/charge-ledger.ts game/turn/board-charge.ts game/logic/cards-internal/effect-timing.ts game/logic/cards/work_will.ts game/logic/cards.ts game/logic/card-resolution/trap.ts test/game.cards.charge-multiplier.test.ts
git commit -m "Apply Lv9 charge gain multiplier"
```

Only include `game/logic/card-resolution/trap.ts` if it changed.

---

### Task 8: Run CPU And Startup Regression Tests

**Files:**
- No source edits expected unless tests expose a real issue.

- [ ] **Step 1: Run focused CPU/startup tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/shared.cpu-opponent-profiles.test.ts test/ui.deck-builder-controller.test.ts test/game.cards.reshuffle-cycle.test.ts test/game.cards.charge-multiplier.test.ts test/cpu.turn-handler.programmed-card-policy.test.ts test/cpu.decision.refactor.test.ts
```

Expected: PASS.

- [ ] **Step 2: If CPU tests fail because Lv9 hand/deck assumptions changed, update only Lv9-specific expectations**

For `test/cpu.turn-handler.programmed-card-policy.test.ts`, keep these invariant expectations:

```js
expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase('9-ending-ash', 5)).toBe(true);
expect(CpuOpponentProfiles.shouldSkipCpuOpponentCardPhase('9-ending-ash', 6)).toBe(false);
expect(CpuOpponentProfiles.getCpuOpponentDecisionLevel('9-ending-ash')).toBe(6);
```

Do not change Lv6 shared decision expectations.

- [ ] **Step 3: Run typecheck/build for browser-loaded module changes**

Run:

```powershell
npm run typecheck
npm run build:browser
```

Expected: PASS. `build:browser` may update `dist/` and `public/module-registry.js`; treat these as generated outputs from the command, not source edits.

- [ ] **Step 4: Prepare worker/public mirror if deploy surface changed**

Run:

```powershell
npm run worker:prepare
```

Expected: PASS. Include generated/mirror changes only if the script produces them and they are needed for deploy parity.

- [ ] **Step 5: Run final diff checks**

Run:

```powershell
git diff --check
git status --short
```

Expected: No whitespace errors. Status contains only intentional Lv9 buff changes plus any pre-existing unrelated dirty files that must remain unstaged.

---

## Completion Criteria

- `01-rulebook.md` documents the new Lv9 all-enabled-card deck and generated charge gain 2x behavior.
- Lv9 CPU startup passes raw deck ids through `initialDeckCardIdsByPlayer`, with more than 30 cards and without the six forbidden successor cards.
- Normal custom deck `deckCode` behavior remains 30-card constrained.
- Lv9 startup sets `chargeGainMultiplierByPlayer` to `2` only for the selected Lv9 CPU side.
- Generated positive gains are doubled and clamped to 99.
- Costs, refunds, repayments, losses, initial charge, and stolen/transferred opponent charge are not doubled.
- Lv9 still uses decision level 6 and still skips card use before turn 6.
- Focused Jest, typecheck, browser build, and worker prepare complete successfully.
- No unrelated dirty work is staged, committed, reverted, or overwritten.

## Self-Review

- Spec coverage: The plan covers deck contents, forbidden successor exclusions, startup charge, charge-gain multiplier, non-doubled exclusions, cap behavior, CPU decision reuse, tests, generated browser output, and worker mirror sync.
- Placeholder scan: No task uses TBD/TODO/fill-later language; each implementation task includes concrete code snippets and commands.
- Type consistency: `deckCardIds`, `chargeGainMultiplier`, `chargeGainMultiplierByPlayer`, and `disableChargeGainMultiplier` are used consistently across startup options, UI init options, card state, and charge helpers.
