# Effect Resolution Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize card immediate-effect resolution so normal placement and `理論の化身` spawned effects share one deterministic PRNG/context path, especially when `救済神` rescue is triggered by destroy effects.

**Architecture:** Add characterization tests first, then introduce a shared headless immediate-effect dispatcher used by both normal placement and theory-spawn paths. Preserve existing card APIs through adapters while normalizing internal context to `randomSource`; only after that, simplify `game/logic/cards.ts` anchor-effect option handling in small passes.

**Tech Stack:** TypeScript, CommonJS runtime modules, Jest, existing headless turn pipeline, existing browser module registry build, Cloudflare Worker static mirror.

---

## Dirty Worktree Procedure

Current repository state includes unrelated dirty UI/spec/mirror files. Before executing any task:

- [ ] Run `git status --short`.
- [ ] If files from a task are already dirty, inspect `git diff -- <file>`.
- [ ] Do not touch unrelated dirty files.
- [ ] Do not run `npm run build:browser` or `npm run worker:prepare` while `public/module-registry.js` or `worker-public/*` contain unrelated dirty work.
- [ ] Commit only files intentionally changed for the current task.

If unrelated dirty files block module registry or worker mirror generation, stop and report the exact files instead of editing around them.

## File Map

- Create `test/game.immediate-effect-dispatcher.contract.test.ts`: fake-logic contract tests for dispatcher context and event mapping.
- Modify `test/game.theory-incarnation.test.ts`: retain the existing real regression and add the explicit event assertion in Task 3.
- Create `game/turn/immediate-effect-dispatcher.ts`: shared dispatcher and context normalization.
- Modify `game/turn/theory-spawn-immediate-effects.ts`: keep public export, delegate to shared dispatcher.
- Modify `game/turn/action-phase/placement-immediate-effects.ts`: replace duplicated immediate-effect branches with shared dispatcher calls.
- Modify `game/logic/cards.ts`: add small `normalizeAnchorEffectOptions()` helper in Task 5; migrate only affected anchor wrappers.
- Modify generated/browser files only through existing scripts after source changes: `npm run build:browser`, then `npm run worker:prepare` when mirror sync is safe.

## Task 1: Add Dispatcher Contract Tests

**Files:**
- Create: `test/game.immediate-effect-dispatcher.contract.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/game.immediate-effect-dispatcher.contract.test.ts` with this initial content:

```ts
import * as ImmediateEffectDispatcher from '../game/turn/immediate-effect-dispatcher';

function createPrng(value = 0) {
  return { random: () => value };
}

function createContext(overrides: any = {}) {
  const events: any[] = [];
  const calls: any[] = [];
  const CardLogic = {
    processUltimateDestroyGodEffectsAtAnchor: (...args: any[]) => {
      calls.push({ name: 'processUltimateDestroyGodEffectsAtAnchor', args });
      return { destroyed: [{ row: 3, col: 4 }] };
    },
    processDestroyDragonEffectsAtAnchor: (...args: any[]) => {
      calls.push({ name: 'processDestroyDragonEffectsAtAnchor', args });
      return { destroyed: [{ row: 4, col: 3 }], expired: [] };
    },
    processSniperWillEffectsAtTurnStartAnchor: (...args: any[]) => {
      calls.push({ name: 'processSniperWillEffectsAtTurnStartAnchor', args });
      return { destroyed: [{ row: 2, col: 3 }], expired: [] };
    }
  };
  const randomSource = createPrng(0.25);
  return {
    ctx: {
      CardLogic,
      cardState: {},
      gameState: { board: [] },
      playerKey: 'black',
      events,
      row: 3,
      col: 3,
      typeKey: 'ULTIMATE_DESTROY_GOD',
      randomSource,
      source: 'theory_spawn',
      ...overrides
    },
    calls,
    events,
    randomSource
  };
}

describe('ImmediateEffectDispatcher context contract', () => {
  test('passes randomSource to ULTIMATE_DESTROY_GOD immediate effects', () => {
    const { ctx, calls, events, randomSource } = createContext();

    ImmediateEffectDispatcher.resolveImmediateEffects(ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('processUltimateDestroyGodEffectsAtAnchor');
    expect(calls[0].args.slice(2, 5)).toEqual(['black', 3, 3]);
    expect(calls[0].args[5]).toMatchObject({
      decrementRemainingOwnerTurns: false,
      randomSource
    });
    expect(events).toContainEqual({
      type: 'udg_destroyed_immediate',
      details: [{ row: 3, col: 4 }]
    });
  });

  test('passes both random and randomSource to legacy option-shaped destroy effects', () => {
    const { ctx, calls, randomSource } = createContext({ typeKey: 'DESTROY_DRAGON' });

    ImmediateEffectDispatcher.resolveImmediateEffects(ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('processDestroyDragonEffectsAtAnchor');
    expect(calls[0].args[5]).toMatchObject({
      decrementRemainingOwnerTurns: false,
      random: randomSource,
      randomSource
    });
  });

  test('fails at dispatcher boundary when randomSource is missing', () => {
    const { ctx } = createContext({ randomSource: null });

    expect(() => ImmediateEffectDispatcher.resolveImmediateEffects(ctx)).toThrow(
      'ImmediateEffectDispatcher requires an injected deterministic PRNG.'
    );
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.immediate-effect-dispatcher.contract.test.ts --runInBand
```

Expected result:

```text
FAIL test/game.immediate-effect-dispatcher.contract.test.ts
Cannot find module '../game/turn/immediate-effect-dispatcher'
```

- [ ] **Step 3: Commit only the failing test if the repo policy allows test-first commits**

Do not commit if the team does not want red-test commits. If not committing, keep this staged only after Task 2 turns it green.

## Task 2: Create Shared Immediate Effect Dispatcher

**Files:**
- Create: `game/turn/immediate-effect-dispatcher.ts`
- Test: `test/game.immediate-effect-dispatcher.contract.test.ts`

- [ ] **Step 1: Implement the dispatcher**

Create `game/turn/immediate-effect-dispatcher.ts`:

```ts
type RandomSource = { random(): number };

type ImmediateEffectContext = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    row: number;
    col: number;
    typeKey: string;
    randomSource: RandomSource | null | undefined;
    source?: 'placement' | 'theory_spawn';
    awardBoardChargeGain?: (CardLogic: any, cardState: any, playerKey: any, amount: any, payload: any) => void;
};

function requireRandomSource(source: any): RandomSource {
    if (source && typeof source.random === 'function') return source;
    throw new Error('ImmediateEffectDispatcher requires an injected deterministic PRNG.');
}

function normalizeTypeKey(value: any): string {
    return String(value || '').trim().toUpperCase();
}

function pushDetailsEvent(events: any[], type: string, details: any): void {
    if (!Array.isArray(events) || !Array.isArray(details) || details.length <= 0) return;
    events.push({ type, details });
}

function awardCharge(ctx: ImmediateEffectContext, amount: any, payload: any): void {
    if (typeof ctx.awardBoardChargeGain !== 'function') return;
    ctx.awardBoardChargeGain(ctx.CardLogic, ctx.cardState, ctx.playerKey, amount, payload);
}

function buildImmediateOptions(randomSource: RandomSource, extra: any = {}): any {
    return Object.assign({
        decrementRemainingOwnerTurns: false,
        random: randomSource,
        randomSource
    }, extra || {});
}

function resolveImmediateEffects(context: ImmediateEffectContext): void {
    const ctx = (context && typeof context === 'object') ? context : ({} as ImmediateEffectContext);
    const row = Number(ctx.row);
    const col = Number(ctx.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    const typeKey = normalizeTypeKey(ctx.typeKey);
    if (!typeKey) return;
    const randomSource = requireRandomSource(ctx.randomSource);

    if (typeKey === 'DRAGON' && typeof ctx.CardLogic.processDragonEffectsAtAnchor === 'function') {
        const dragonNow = ctx.CardLogic.processDragonEffectsAtAnchor(ctx.cardState, ctx.gameState, ctx.playerKey, row, col, {
            randomSource
        });
        if (dragonNow && dragonNow.converted && dragonNow.converted.length) {
            awardCharge(ctx, dragonNow.converted.length, {
                anchorRow: row,
                anchorCol: col,
                moved: dragonNow.moved,
                sourceType: 'dragon_immediate'
            });
            ctx.events.push({ type: 'dragon_converted_immediate', details: dragonNow.converted });
        }
        return;
    }

    if (typeKey === 'BREEDING' && typeof ctx.CardLogic.processBreedingEffectsAtAnchor === 'function') {
        const breedingNow = ctx.CardLogic.processBreedingEffectsAtAnchor(ctx.cardState, ctx.gameState, ctx.playerKey, row, col, randomSource);
        pushDetailsEvent(ctx.events, 'breeding_spawned_immediate', breedingNow && breedingNow.spawned);
        if (breedingNow && breedingNow.flipped && breedingNow.flipped.length) {
            awardCharge(ctx, breedingNow.flipped.length, {
                anchorRow: row,
                anchorCol: col,
                sourceType: 'breeding_immediate'
            });
            ctx.events.push({ type: 'breeding_flipped_immediate', details: breedingNow.flipped });
        }
        return;
    }

    if (typeKey === 'ULTIMATE_DESTROY_GOD' && typeof ctx.CardLogic.processUltimateDestroyGodEffectsAtAnchor === 'function') {
        const udgNow = ctx.CardLogic.processUltimateDestroyGodEffectsAtAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'udg_destroyed_immediate', udgNow && udgNow.destroyed);
        return;
    }

    if (typeKey === 'DESTROY_DRAGON' && typeof ctx.CardLogic.processDestroyDragonEffectsAtAnchor === 'function') {
        const destroyDragonNow = ctx.CardLogic.processDestroyDragonEffectsAtAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'destroy_dragon_destroyed_immediate', destroyDragonNow && destroyDragonNow.destroyed);
        pushDetailsEvent(ctx.events, 'destroy_dragon_expired_immediate', destroyDragonNow && destroyDragonNow.expired);
        return;
    }

    if (typeKey === 'SNIPER' && typeof ctx.CardLogic.processSniperWillEffectsAtTurnStartAnchor === 'function') {
        const sniperNow = ctx.CardLogic.processSniperWillEffectsAtTurnStartAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'sniper_destroyed_immediate', sniperNow && sniperNow.destroyed);
        pushDetailsEvent(ctx.events, 'sniper_expired_immediate', sniperNow && sniperNow.expired);
        return;
    }

    if (typeKey === 'LIGHTNING' && typeof ctx.CardLogic.processLightningWillEffectsAtTurnStartAnchor === 'function') {
        const lightningNow = ctx.CardLogic.processLightningWillEffectsAtTurnStartAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'lightning_destroyed_immediate', lightningNow && lightningNow.destroyed);
        pushDetailsEvent(ctx.events, 'lightning_expired_immediate', lightningNow && lightningNow.expired);
        return;
    }

    if (typeKey === 'METEOR_GOD' && typeof ctx.CardLogic.processMeteorGodEffectsAtTurnStartAnchor === 'function') {
        const meteorGodNow = ctx.CardLogic.processMeteorGodEffectsAtTurnStartAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'meteor_god_destroyed_immediate', meteorGodNow && meteorGodNow.destroyed);
        pushDetailsEvent(ctx.events, 'meteor_god_expired_immediate', meteorGodNow && meteorGodNow.expired);
        return;
    }

    if (typeKey === 'WILL_HUNTER_KING' && typeof ctx.CardLogic.processWillHunterKingEffectsAtTurnStartAnchor === 'function') {
        const willHunterKingNow = ctx.CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'will_hunter_king_destroyed_immediate', willHunterKingNow && willHunterKingNow.destroyed);
        pushDetailsEvent(ctx.events, 'will_hunter_king_moved_immediate', willHunterKingNow && willHunterKingNow.moved);
        pushDetailsEvent(ctx.events, 'will_hunter_king_expired_immediate', willHunterKingNow && willHunterKingNow.expired);
    }
}

export = {
    resolveImmediateEffects
};
```

- [ ] **Step 2: Run the contract test and verify GREEN**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.immediate-effect-dispatcher.contract.test.ts --runInBand
```

Expected:

```text
PASS test/game.immediate-effect-dispatcher.contract.test.ts
```

- [ ] **Step 3: Run typecheck for the new module**

Run:

```powershell
npm run typecheck
```

Expected:

```text
Exit code 0
```

- [ ] **Step 4: Commit**

Run:

```powershell
git add game/turn/immediate-effect-dispatcher.ts test/game.immediate-effect-dispatcher.contract.test.ts
git commit -m "Add immediate effect dispatcher contract"
```

## Task 3: Route Theory Spawn Through Shared Dispatcher

**Files:**
- Modify: `game/turn/theory-spawn-immediate-effects.ts`
- Modify: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Update the existing theory regression to assert the shared dispatcher path**

In `test/game.theory-incarnation.test.ts`, keep the existing `理論召喚で出た破壊神の即時破壊は救済神復活に渡されたPRNGを使う` test. Add this assertion after the SPAWN assertion:

```ts
    expect(events.map((event: any) => event && event.type)).toContain('udg_destroyed_immediate');
```

- [ ] **Step 2: Run theory test before code change**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts --runInBand
```

Expected:

```text
PASS test/game.theory-incarnation.test.ts
```

This is a characterization step; it confirms the existing behavior before the delegation refactor.

- [ ] **Step 3: Replace duplicated theory dispatcher branches with delegation**

Change `game/turn/theory-spawn-immediate-effects.ts` to:

```ts
const ImmediateEffectDispatcher = require('./immediate-effect-dispatcher');

type ResolveTheorySpawnImmediateEffectsOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    spawned: any;
    prng: any;
    awardBoardChargeGain?: (CardLogic: any, cardState: any, playerKey: any, amount: any, payload: any) => void;
};

function resolveTheorySpawnImmediateEffects(options: ResolveTheorySpawnImmediateEffectsOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolveTheorySpawnImmediateEffectsOptions);
    const spawned = opts.spawned || null;
    const row = Number(spawned && spawned.row);
    const col = Number(spawned && spawned.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    const typeKey = String(spawned.type || '').trim().toUpperCase();
    if (!typeKey) return;
    if (!ImmediateEffectDispatcher || typeof ImmediateEffectDispatcher.resolveImmediateEffects !== 'function') {
        throw new Error('ImmediateEffectDispatcher.resolveImmediateEffects is unavailable');
    }
    ImmediateEffectDispatcher.resolveImmediateEffects({
        CardLogic: opts.CardLogic,
        cardState: opts.cardState,
        gameState: opts.gameState,
        playerKey: opts.playerKey,
        events: opts.events,
        row,
        col,
        typeKey,
        randomSource: opts.prng,
        source: 'theory_spawn',
        awardBoardChargeGain: opts.awardBoardChargeGain
    });
}

export = {
    resolveTheorySpawnImmediateEffects
};
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.immediate-effect-dispatcher.contract.test.ts test/game.theory-incarnation.test.ts --runInBand
```

Expected:

```text
PASS test/game.immediate-effect-dispatcher.contract.test.ts
PASS test/game.theory-incarnation.test.ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add game/turn/theory-spawn-immediate-effects.ts test/game.theory-incarnation.test.ts
git commit -m "Route theory immediate effects through dispatcher"
```

## Task 4: Route Normal Placement Through Shared Dispatcher

**Files:**
- Modify: `game/turn/action-phase/placement-immediate-effects.ts`
- Create or modify: `test/game.placement-immediate-effect-context.test.ts`

- [ ] **Step 1: Add normal-placement rescue PRNG regression**

Create `test/game.placement-immediate-effect-context.test.ts`:

```ts
import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';

function createPrng(value = 0) {
  return {
    shuffle: (arr: any[]) => arr,
    random: () => value
  };
}

function createGameState() {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  } as any;
}

describe('placement immediate effect context', () => {
  test('placed ULTIMATE_DESTROY_GOD carries phase PRNG into salvation god rescue', () => {
    const prng = createPrng(0);
    const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
    delete cardState._defaultRandomSource;
    const gameState = createGameState();
    gameState.board[0][0] = Shared.BLACK;
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][4] = Shared.WHITE;
    gameState.currentPlayer = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = { type: 'ULTIMATE_DESTROY_GOD', cardId: 'udg_01', stage: 'awaitPlace' };
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 12 }
    });

    expect(() => {
      TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 3, col: 3 }, prng, { skipTurnStart: true });
    }).not.toThrow();

    const revive = (cardState.presentationEvents || []).find((event: any) => (
      event &&
      event.type === 'SPAWN' &&
      event.reason === 'stone_salvation_god_revive'
    ));
    expect(revive).toEqual(expect.objectContaining({
      ownerAfter: 'black',
      cause: 'STONE_SALVATION_GOD'
    }));
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.placement-immediate-effect-context.test.ts --runInBand
```

Expected before routing:

```text
FAIL test/game.placement-immediate-effect-context.test.ts
BoardOps requires an injected deterministic PRNG.
```

If the test already passes because active action context supplies the PRNG, keep it as characterization and proceed with the refactor.

- [ ] **Step 3: Replace immediate-effect branches in placement module**

In `game/turn/action-phase/placement-immediate-effects.ts`, add:

```ts
const ImmediateEffectDispatcher = require('../immediate-effect-dispatcher');
```

Replace the repeated `dragonPlaced`, `breedingPlaced`, `ultimateDestroyGodPlaced`, `destroyDragonPlaced`, `sniperPlaced`, `lightningPlaced`, `meteorGodPlaced`, and `willHunterKingPlaced` branches with a local dispatch list:

```ts
    const immediateTypes = [
        effects && effects.dragonPlaced ? 'DRAGON' : null,
        effects && effects.breedingPlaced ? 'BREEDING' : null,
        effects && effects.ultimateDestroyGodPlaced ? 'ULTIMATE_DESTROY_GOD' : null,
        effects && effects.destroyDragonPlaced ? 'DESTROY_DRAGON' : null,
        effects && effects.sniperPlaced ? 'SNIPER' : null,
        effects && effects.lightningPlaced ? 'LIGHTNING' : null,
        effects && effects.meteorGodPlaced ? 'METEOR_GOD' : null,
        effects && effects.willHunterKingPlaced ? 'WILL_HUNTER_KING' : null
    ].filter(Boolean);

    for (const typeKey of immediateTypes) {
        ImmediateEffectDispatcher.resolveImmediateEffects({
            CardLogic: opts.CardLogic,
            cardState: opts.cardState,
            gameState: opts.gameState,
            playerKey: opts.playerKey,
            events: opts.events,
            row: action.row,
            col: action.col,
            typeKey,
            randomSource: p,
            source: 'placement',
            awardBoardChargeGain: opts.awardBoardChargeGain
        });
    }
```

Keep `workPlaced`, `instantHyperactivePlaced`, `trap`, and post-flip follow-up logic unchanged in this task.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.immediate-effect-dispatcher.contract.test.ts test/game.placement-immediate-effect-context.test.ts test/game.theory-incarnation.test.ts --runInBand
```

Expected:

```text
PASS test/game.immediate-effect-dispatcher.contract.test.ts
PASS test/game.placement-immediate-effect-context.test.ts
PASS test/game.theory-incarnation.test.ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add game/turn/action-phase/placement-immediate-effects.ts test/game.placement-immediate-effect-context.test.ts
git commit -m "Unify placement immediate effect dispatch"
```

## Task 5: Normalize Anchor Effect Options In CardLogic

**Files:**
- Modify: `game/logic/cards.ts`
- Test: `test/game.immediate-effect-dispatcher.contract.test.ts`
- Test: `test/game.theory-incarnation.test.ts`
- Test: `test/game.placement-immediate-effect-context.test.ts`

- [ ] **Step 1: Add option normalization helper near `hasTurnStartRandomOptionOverrides`**

In `game/logic/cards.ts`, add:

```ts
    function normalizeAnchorEffectOptions(prngOrOpts: any, extraKeys: string[], defaults: any, label: string) {
        const hasOptionShape = hasTurnStartRandomOptionOverrides(prngOrOpts, extraKeys);
        const sourceOptions = hasOptionShape ? (prngOrOpts || {}) : {};
        const randomCandidate = hasOptionShape && Object.prototype.hasOwnProperty.call(sourceOptions, 'randomSource')
            ? sourceOptions.randomSource
            : (hasOptionShape && Object.prototype.hasOwnProperty.call(sourceOptions, 'random')
                ? sourceOptions.random
                : prngOrOpts);
        const randomSource = resolveDeterministicRandomSource(
            randomCandidate,
            sourceOptions.random || sourceOptions.randomSource || defaults.random || defaultPrng,
            label
        );
        return Object.assign({}, defaults || {}, sourceOptions, {
            random: randomSource,
            randomSource
        });
    }
```

- [ ] **Step 2: Migrate only anchor wrappers touched by dispatcher**

Use `normalizeAnchorEffectOptions()` in:

- `processUltimateDestroyGodEffectsAtAnchor`
- `processUltimateDestroyGodEffectsAtTurnStartAnchor`
- `processSniperWillEffectsAtTurnStartAnchor`
- `processLightningWillEffectsAtAnchor`
- `processMeteorGodEffectsAtAnchor`
- `processWillHunterKingEffectsAtTurnStartAnchor`
- `processDestroyDragonEffectsAtAnchor`

Keep public function signatures unchanged.

- [ ] **Step 3: Run focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.immediate-effect-dispatcher.contract.test.ts test/game.theory-incarnation.test.ts test/game.placement-immediate-effect-context.test.ts test/game.udg-duration.test.ts test/game.stone-salvation-god.test.ts --runInBand
```

Expected:

```text
PASS for dispatcher, theory, placement, and UDG duration tests
```

Known possible unrelated failure:

```text
test/game.stone-salvation-god.test.ts may fail if the expected effect tags omit the current 12ターン持続 tag.
```

If that unrelated tag failure appears, do not change tag behavior in this task. Record the failure and continue with the narrower passing tests.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected:

```text
Exit code 0
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add game/logic/cards.ts
git commit -m "Normalize anchor effect random options"
```

## Task 6: Browser Runtime Build And Module Registry

**Files:**
- Generated: `dist/**/*`
- Generated: `public/module-registry.js`
- Generated/mirror after worker prepare: `worker-public/**/*`

- [ ] **Step 1: Confirm generated files are safe to update**

Run:

```powershell
git status --short public/module-registry.js worker-public
```

Expected safe state:

```text
no unrelated modifications in public/module-registry.js or worker-public/*
```

If unrelated modifications exist, stop and ask for cleanup or approval before continuing.

- [ ] **Step 2: Run browser build**

Run:

```powershell
npm run build:browser
```

Expected:

```text
Exit code 0
```

- [ ] **Step 3: Run worker mirror sync**

Run:

```powershell
npm run worker:prepare
```

Expected:

```text
Exit code 0
```

- [ ] **Step 4: Inspect generated diff**

Run:

```powershell
git diff --stat -- public/module-registry.js worker-public
git diff -- public/module-registry.js worker-public/public/module-registry.js
```

Expected:

```text
module registry includes game/turn/immediate-effect-dispatcher.js
worker-public mirrors the root generated assets
```

- [ ] **Step 5: Commit generated sync**

Run:

```powershell
git add public/module-registry.js worker-public
git commit -m "Sync immediate effect dispatcher browser assets"
```

## Task 7: Broad Validation

**Files:**
- No source edits

- [ ] **Step 1: Run focused game logic bundle**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.immediate-effect-dispatcher.contract.test.ts test/game.placement-immediate-effect-context.test.ts test/game.theory-incarnation.test.ts test/game.udg-duration.test.ts test/game.stone-salvation-god.test.ts --runInBand
```

Expected:

```text
All tests pass, except any pre-existing effect-tag expectation mismatch explicitly documented before this work.
```

- [ ] **Step 2: Run build**

Run:

```powershell
npm run build:ts
```

Expected:

```text
Exit code 0
```

- [ ] **Step 3: Run boundary check**

Run:

```powershell
npm run check:window
```

Expected:

```text
Exit code 0
```

- [ ] **Step 4: Run network parity only if generated worker mirror was synced**

Run:

```powershell
npm run test:network:parity
```

Expected:

```text
Exit code 0
```

If network parity fails, classify whether the failure involves immediate effects, worker asset sync, or unrelated pre-existing network debt before making changes.

- [ ] **Step 5: Final audit searches**

Run:

```powershell
rg -n "resolveTheorySpawnImmediateEffects|process.*Immediate|decrementRemainingOwnerTurns: false" game/turn --glob "*.ts"
rg -n "random: p|randomSource: p|_defaultRandomSource" game/turn game/logic/cards.ts --glob "*.ts"
```

Expected:

```text
Immediate effect branching is centralized in game/turn/immediate-effect-dispatcher.ts.
Remaining _defaultRandomSource references are initialization or compatibility fallback paths, not primary phase handoff.
```

- [ ] **Step 6: Commit validation notes only if a documentation update was required**

If validation reveals a stable new architecture contract, update `docs/architecture-contracts.md` with a short section under effect-resolution contracts and commit:

```powershell
git add docs/architecture-contracts.md
git commit -m "Document immediate effect context contract"
```

Do not update architecture docs for transient investigation notes.

## Rollback Procedure

Rollback one task at a time:

```powershell
git revert <commit>
```

Preferred rollback order:

1. Generated sync commit
2. CardLogic option normalization commit
3. Placement dispatcher commit
4. Theory dispatcher commit
5. Dispatcher module commit
6. Contract test commit

Do not use `git reset --hard` in this repository unless explicitly requested.

## Completion Checklist

- [ ] Normal placement and theory-spawn paths both call `ImmediateEffectDispatcher.resolveImmediateEffects`.
- [ ] Dispatcher tests verify `randomSource` and legacy `random` propagation.
- [ ] Real regression tests run with `_defaultRandomSource` removed.
- [ ] `BoardOps` deterministic PRNG fail-fast remains intact.
- [ ] No DOM/window/network dependency was added to `game/` or `shared/`.
- [ ] `npm run build:ts` passes.
- [ ] Browser registry and worker mirror are synced if a new runtime module was added.
- [ ] Final status shows only unrelated pre-existing dirty files, or a clean tree if those were resolved before execution.
