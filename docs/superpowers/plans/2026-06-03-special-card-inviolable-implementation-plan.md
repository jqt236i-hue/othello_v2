# Special Card Inviolable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three unique special cards inviolable so opponent effects cannot steal, destroy, randomly discard, or otherwise remove them from hand.

**Architecture:** Add one shared special-card registry and route every opponent-hand target path through it. Do not scatter `observer_will_01`, `board_executor_01`, or `theory_incarnation_01` checks across individual card effects. Preserve normal self-use and self-initiated discard behavior unless the rulebook is changed separately.

**Tech Stack:** TypeScript, Jest, existing headless `game/logic/cards.ts` facade, `game/logic/card-resolution/hand-effects.ts`, `game/logic/cards-internal/*`, `shared/*`, generated browser module registry, worker mirror via `npm run worker:prepare`.

---

## Design Summary

Special cards are defined by card ID, not by display name or current hand copy. The canonical IDs are:

```ts
const INVIOLABLE_SPECIAL_CARD_IDS = [
  'theory_incarnation_01',
  'board_executor_01',
  'observer_will_01'
];
```

The intended rule is:

- Opponent effects cannot include these cards in target offers.
- Random opponent-hand destruction skips these cards.
- Direct hand destruction helpers reject these cards when the destruction is caused by an opponent effect.
- The owner can still play the card normally.
- The owner can still discard/sell/destroy their own card through existing self-controlled actions if those flows exist.
- Hidden hand projection must not let clients bypass this. Worker authority must re-check after publish.

This plan intentionally does not add a board-level "only one special stone" limit. That becomes unnecessary if special cards cannot be stolen or destroyed by opponent effects and deck rules keep them unique.

## Files

- Create: `shared/special-card-registry.ts`
- Modify: `shared/deck-spec.ts`
- Modify: `game/logic/cards-internal/offer-builders.ts`
- Modify: `game/logic/cards-internal/hand-manager.ts`
- Modify: `game/logic/cards-internal/hand-access.ts`
- Modify: `game/logic/card-resolution/hand-effects.ts`
- Modify: `game/logic/cards.ts`
- Modify: `01-rulebook.md`
- Test: `test/shared.special-card-registry.test.ts`
- Test: `test/game.special-card-inviolable.test.ts`
- Test: `test/workers.match-pending-effect-id.test.ts`
- Generated after implementation: `public/module-registry.js`, `worker-public/public/module-registry.js`

## Task 1: Shared Registry

**Files:**
- Create: `shared/special-card-registry.ts`
- Modify: `shared/deck-spec.ts`
- Test: `test/shared.special-card-registry.test.ts`

- [ ] **Step 1: Write the failing registry test**

Create `test/shared.special-card-registry.test.ts`:

```ts
const SpecialCardRegistry = require('../shared/special-card-registry.ts');
const DeckSpecHelpers = require('../shared/deck-spec.ts');

describe('special card registry', () => {
  test('classifies the three unique special cards as inviolable', () => {
    expect(SpecialCardRegistry.isInviolableSpecialCardId('theory_incarnation_01')).toBe(true);
    expect(SpecialCardRegistry.isInviolableSpecialCardId('board_executor_01')).toBe(true);
    expect(SpecialCardRegistry.isInviolableSpecialCardId('observer_will_01')).toBe(true);
    expect(SpecialCardRegistry.isInviolableSpecialCardId('gold_stone')).toBe(false);
  });

  test('exports the same card id list used by deck special-card constraints', () => {
    expect(SpecialCardRegistry.getInviolableSpecialCardIds()).toEqual([
      'theory_incarnation_01',
      'board_executor_01',
      'observer_will_01'
    ]);
    expect(DeckSpecHelpers.getSpecialFoundationCardIds()).toEqual(
      SpecialCardRegistry.getInviolableSpecialCardIds()
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/shared.special-card-registry.test.ts
```

Expected: FAIL because `shared/special-card-registry.ts` does not exist or does not export the required functions.

- [ ] **Step 3: Add the registry**

Create `shared/special-card-registry.ts`:

```ts
(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.SpecialCardRegistry = factory();
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function () {
    'use strict';

    const INVIOLABLE_SPECIAL_CARD_IDS = Object.freeze([
        'theory_incarnation_01',
        'board_executor_01',
        'observer_will_01'
    ]);
    const INVIOLABLE_SPECIAL_CARD_ID_SET: ReadonlySet<string> = new Set(INVIOLABLE_SPECIAL_CARD_IDS);

    function normalizeCardId(cardId: unknown): string {
        return typeof cardId === 'string' ? cardId.trim() : '';
    }

    function getInviolableSpecialCardIds(): string[] {
        return INVIOLABLE_SPECIAL_CARD_IDS.slice();
    }

    function isInviolableSpecialCardId(cardId: unknown): boolean {
        const normalized = normalizeCardId(cardId);
        return !!normalized && INVIOLABLE_SPECIAL_CARD_ID_SET.has(normalized);
    }

    return Object.freeze({
        getInviolableSpecialCardIds,
        isInviolableSpecialCardId
    });
}));
```

- [ ] **Step 4: Replace deck-spec local special ID source**

Modify `shared/deck-spec.ts` near the current `SPECIAL_FOUNDATION_CARD_IDS` definition.

Add module resolution near the factory body:

```ts
    const SpecialCardRegistry = (function resolveSpecialCardRegistry() {
        if (typeof module !== 'undefined' && module.exports) {
            try {
                return require('./special-card-registry');
            } catch (e) { /* ignore */ }
        }
        if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).SpecialCardRegistry) {
            return (globalThis as Record<string, unknown>).SpecialCardRegistry;
        }
        if (typeof self !== 'undefined' && (self as Record<string, unknown>).SpecialCardRegistry) {
            return (self as Record<string, unknown>).SpecialCardRegistry;
        }
        return null;
    }());
```

Replace:

```ts
    const SPECIAL_FOUNDATION_CARD_IDS = Object.freeze([
        'theory_incarnation_01',
        'board_executor_01',
        'observer_will_01'
    ]);
```

with:

```ts
    const SPECIAL_FOUNDATION_CARD_IDS = Object.freeze(
        SpecialCardRegistry && typeof SpecialCardRegistry.getInviolableSpecialCardIds === 'function'
            ? SpecialCardRegistry.getInviolableSpecialCardIds()
            : [
                'theory_incarnation_01',
                'board_executor_01',
                'observer_will_01'
            ]
    );
```

- [ ] **Step 5: Run the registry test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/shared.special-card-registry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the registry pass**

Stage only these files:

```powershell
git add shared/special-card-registry.ts shared/deck-spec.ts test/shared.special-card-registry.test.ts
git commit -m "特殊カード不可侵の共通判定を追加"
```

If the working tree contains unrelated dirty files, do not use `git add -A`.

## Task 2: Filter Opponent-Hand Offers

**Files:**
- Modify: `game/logic/cards-internal/offer-builders.ts`
- Modify: `game/logic/cards.ts`
- Test: `test/game.special-card-inviolable.test.ts`

- [ ] **Step 1: Write failing offer tests**

Create `test/game.special-card-inviolable.test.ts`:

```ts
const CardLogic = require('../game/logic/cards.js');

function prng() {
  return { shuffle: (arr) => arr, random: () => 0 };
}

function createState(turnNumber = 20) {
  const cardState = CardLogic.createCardState(prng(), { plainReversi: true });
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1,
    turnNumber
  };
  cardState.turnIndex = turnNumber;
  cardState.charge.black = 99;
  cardState.charge.white = 99;
  return { cardState, gameState };
}

describe('inviolable special cards in opponent hand', () => {
  test('CONDEMN_WILL offers exclude opponent special cards', () => {
    const { cardState, gameState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'condemn_01');
    CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');
    CardLogic.addCardToHand(cardState, 'white', 'gold_stone');

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'condemn_01')).toBe(true);

    expect(cardState.pendingEffectByPlayer.black.offers).toEqual([
      expect.objectContaining({ handIndex: 1, cardId: 'gold_stone' })
    ]);
  });

  test('OBSERVER_WILL offers exclude opponent special cards', () => {
    const { cardState, gameState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'observer_will_01');
    CardLogic.addCardToHand(cardState, 'white', 'board_executor_01');
    CardLogic.addCardToHand(cardState, 'white', 'silver_stone');

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01')).toBe(true);

    expect(cardState.pendingEffectByPlayer.black.offers).toEqual([
      expect.objectContaining({ handIndex: 1, cardId: 'silver_stone' })
    ]);
  });

  test('hand-target cards are not usable when opponent hand has only special cards', () => {
    const { cardState, gameState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'condemn_01');
    CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'condemn_01')).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.special-card-inviolable.test.ts
```

Expected: FAIL because special cards still appear in offers.

- [ ] **Step 3: Add inviolable filtering to offer builders**

Modify `game/logic/cards-internal/offer-builders.ts`.

Update the deps type:

```ts
type OfferBuildersDeps = {
    cardDefs?: any[];
    heavenBlessingOfferCount?: number;
    isInviolableSpecialCardId?: (cardId: unknown) => boolean;
};
```

Inside `createOfferBuilders`, add:

```ts
    const isInviolableSpecialCardId = typeof deps?.isInviolableSpecialCardId === 'function'
        ? deps.isInviolableSpecialCardId
        : () => false;
```

Replace `buildCondemnOffers` body with:

```ts
    function buildCondemnOffers(cardState: any, playerKey: any) {
        if (!cardState || !cardState.hands) return [];
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const hand = Array.isArray(cardState.hands[opponentKey]) ? cardState.hands[opponentKey] : [];
        return hand
            .map((cardId: any, handIndex: any) => ({ handIndex, cardId }))
            .filter((offer: any) => !isInviolableSpecialCardId(offer.cardId));
    }
```

- [ ] **Step 4: Wire registry into cards.ts offer builder context**

Modify `game/logic/cards.ts`.

Add module resolution with the other shared modules:

```ts
const SpecialCardRegistry = resolveCardLogicModuleOrGlobal('../../shared/special-card-registry', 'SpecialCardRegistry');
```

Where `CardOfferBuildersModule.createOfferBuilders` is called, pass:

```ts
isInviolableSpecialCardId: (cardId: unknown) => (
    SpecialCardRegistry &&
    typeof SpecialCardRegistry.isInviolableSpecialCardId === 'function' &&
    SpecialCardRegistry.isInviolableSpecialCardId(cardId)
)
```

Update `buildObserverWillOffers` in `game/logic/cards.ts`:

```ts
    function buildObserverWillOffers(cardState: any, playerKey: any) {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const opponentHand = cardState && cardState.hands && Array.isArray(cardState.hands[opponentKey])
            ? cardState.hands[opponentKey]
            : [];
        return opponentHand
            .map((cardId: any, handIndex: number) => ({
                handIndex,
                cardId,
                cardCopyId: getHandCopyIdAt(cardState, opponentKey, handIndex)
            }))
            .filter((offer: any) => !(
                SpecialCardRegistry &&
                typeof SpecialCardRegistry.isInviolableSpecialCardId === 'function' &&
                SpecialCardRegistry.isInviolableSpecialCardId(offer.cardId)
            ));
    }
```

- [ ] **Step 5: Run offer tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.special-card-inviolable.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit offer filtering**

```powershell
git add game/logic/cards-internal/offer-builders.ts game/logic/cards.ts test/game.special-card-inviolable.test.ts
git commit -m "特殊カードを相手手札候補から除外"
```

## Task 3: Protect Random and Direct Hand Destruction

**Files:**
- Modify: `game/logic/cards-internal/hand-manager.ts`
- Modify: `game/logic/cards-internal/hand-access.ts`
- Modify: `game/logic/card-resolution/hand-effects.ts`
- Modify: `game/logic/cards.ts`
- Test: `test/game.special-card-inviolable.test.ts`

- [ ] **Step 1: Add failing destruction tests**

Append to `test/game.special-card-inviolable.test.ts`:

```ts
test('EXECUTION_WILL skips opponent special cards during random destruction', () => {
  const { cardState, gameState } = createState();
  CardLogic.addCardToHand(cardState, 'black', 'execution_01');
  CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');
  CardLogic.addCardToHand(cardState, 'white', 'gold_stone');

  expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'execution_01')).toBe(true);
  const result = CardLogic.applyExecutionWill(cardState, 'black', prng());

  expect(result.applied).toBe(true);
  expect(result.destroyedCardIds).toEqual(['gold_stone']);
  expect(cardState.hands.white).toEqual(['observer_will_01']);
  expect(cardState.discard).toEqual(expect.arrayContaining(['gold_stone']));
  expect(cardState.discard).not.toEqual(expect.arrayContaining(['observer_will_01']));
});

test('destroyHandCard rejects opponent-caused destruction of a special card', () => {
  const { cardState } = createState();
  CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');

  const result = CardLogic.destroyHandCard(cardState, 'white', 'observer_will_01', {
    sourcePlayerKey: 'black',
    reason: 'test_opponent_destroy'
  });

  expect(result).toEqual(expect.objectContaining({
    applied: false,
    reason: 'inviolable_special_card'
  }));
  expect(cardState.hands.white).toEqual(['observer_will_01']);
});

test('destroyHandCard still allows owner-controlled destruction of own special card', () => {
  const { cardState } = createState();
  CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');

  const result = CardLogic.destroyHandCard(cardState, 'white', 'observer_will_01', {
    sourcePlayerKey: 'white',
    reason: 'self_discard'
  });

  expect(result.applied).toBe(true);
  expect(cardState.hands.white).toEqual([]);
  expect(cardState.discard).toEqual(expect.arrayContaining(['observer_will_01']));
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.special-card-inviolable.test.ts
```

Expected: FAIL because random/direct destruction still removes special cards.

- [ ] **Step 3: Add hand-manager protection**

Modify `game/logic/cards-internal/hand-manager.ts`.

Update `destroyHandCard` to read options:

```ts
function destroyHandCard(cardState: any, playerKey: string, cardId: string, opts: any = {}): HandResult {
    ensureCardCopyState(cardState);
    const hands = ensureHands(cardState);
    const hand = Array.isArray(hands[playerKey]) ? hands[playerKey] : [];
    const isInviolableSpecialCardId = typeof opts.isInviolableSpecialCardId === 'function'
        ? opts.isInviolableSpecialCardId
        : () => false;
    const sourcePlayerKey = opts.sourcePlayerKey === 'white' ? 'white' : (opts.sourcePlayerKey === 'black' ? 'black' : null);
    const opponentCaused = sourcePlayerKey && sourcePlayerKey !== playerKey;

    const index = hand.findIndex((candidate: string) => candidate === cardId);
    if (index < 0) return { applied: false, reason: 'not_found' };
    if (opponentCaused && isInviolableSpecialCardId(cardId)) {
        return { applied: false, reason: 'inviolable_special_card' };
    }

    const removed = removeHandCardAt(cardState, playerKey, index);
    if (!removed) return { applied: false, reason: 'not_found' };
    addCardToDiscard(cardState, removed.cardId, removed.cardCopyId);
    return { applied: true, destroyedCardId: removed.cardId, cardCopyId: removed.cardCopyId };
}
```

Keep the existing return field names if the current implementation already has more fields. Add only `reason: 'inviolable_special_card'` for the protected branch.

- [ ] **Step 4: Pass registry through hand-access and cards.ts**

Modify `game/logic/cards-internal/hand-access.ts` so `destroyHandCard` forwards `opts` unchanged to `hand-manager.ts`.

Modify `game/logic/cards.ts` wrapper:

```ts
    function destroyHandCard(cardState: any, playerKey: any, cardId: any, opts: any = {}) {
        return requireCardHandAccess().destroyHandCard(cardState, playerKey, cardId, {
            ...(opts || {}),
            isInviolableSpecialCardId: (candidateCardId: unknown) => (
                SpecialCardRegistry &&
                typeof SpecialCardRegistry.isInviolableSpecialCardId === 'function' &&
                SpecialCardRegistry.isInviolableSpecialCardId(candidateCardId)
            )
        });
    }
```

- [ ] **Step 5: Update EXECUTION_WILL to destroy only eligible cards**

Modify `game/logic/card-resolution/hand-effects.ts`.

Inside `applyExecutionWill`, add:

```ts
    const isInviolableSpecialCardId = typeof deps.isInviolableSpecialCardId === 'function'
        ? deps.isInviolableSpecialCardId
        : () => false;
```

Replace the random destruction loop with index selection over eligible hand indexes:

```ts
    const destroyedCardIds: string[] = [];
    for (let destroyIndex = 0; destroyIndex < requestedCount; destroyIndex += 1) {
        const eligibleIndexes = opponentHand
            .map((cardId: any, handIndex: number) => ({ cardId, handIndex }))
            .filter((entry: any) => !isInviolableSpecialCardId(entry.cardId))
            .map((entry: any) => entry.handIndex);
        if (eligibleIndexes.length <= 0) break;
        const pickedIndexInEligible = resolveDeterministicRandomIndex(
            eligibleIndexes.length,
            prng,
            null,
            'CardHandEffects.applyExecutionWill'
        );
        const handIndex = eligibleIndexes[pickedIndexInEligible];
        const removed = removeHandCardAt(cardState, opponentKey, handIndex);
        if (!removed || !removed.cardId) break;
        addCardToDiscard(cardState, removed.cardId, removed.cardCopyId);
        destroyedCardIds.push(removed.cardId);
    }
```

Change `requestedCount` to count eligible cards:

```ts
    const eligibleCount = opponentHand.filter((cardId: any) => !isInviolableSpecialCardId(cardId)).length;
    const requestedCount = Math.min(3, eligibleCount);
```

Modify `game/logic/cards.ts` `applyExecutionWill` deps:

```ts
isInviolableSpecialCardId: (cardId: unknown) => (
    SpecialCardRegistry &&
    typeof SpecialCardRegistry.isInviolableSpecialCardId === 'function' &&
    SpecialCardRegistry.isInviolableSpecialCardId(cardId)
)
```

- [ ] **Step 6: Run destruction tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.special-card-inviolable.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit destruction protection**

```powershell
git add game/logic/cards-internal/hand-manager.ts game/logic/cards-internal/hand-access.ts game/logic/card-resolution/hand-effects.ts game/logic/cards.ts test/game.special-card-inviolable.test.ts
git commit -m "特殊カードを相手手札破壊から保護"
```

## Task 4: Worker Authority and Network Regression

**Files:**
- Modify: `test/workers.match-pending-effect-id.test.ts`
- Modify only if tests reveal a gap: `workers/match-worker.ts`, `utils/match-authority.ts`

- [ ] **Step 1: Add worker regression for Observer Will follow-up**

In `test/workers.match-pending-effect-id.test.ts`, add a scenario near the existing observer hand follow-up test:

```ts
test('observer will worker follow-up cannot steal inviolable special cards', () => {
  const result = runHandFollowupScenario({
    kind: 'observer',
    whiteHand: ['observer_will_01', 'supply_01'],
    whiteCopyIds: [101, 102],
    observerWillTargetIndex: 0
  });

  expect(result.status).toBe(400);
  expect(result.payload.ok).toBe(false);
  expect(result.internalCardState.hands.white).toEqual(['observer_will_01', 'supply_01']);
});
```

If `runHandFollowupScenario` does not accept these parameters yet, extend only the test helper inside the same test file to override hand fixtures. Do not change production code for test fixture convenience.

- [ ] **Step 2: Run the worker regression**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/workers.match-pending-effect-id.test.ts -t "observer will worker follow-up cannot steal inviolable special cards"
```

Expected: PASS if server authority already uses `applyObserverWillChoice` after offer filtering. If it fails, inspect whether the worker accepts client-authored `observerWillTargetIndex` without re-validating current offers.

- [ ] **Step 3: Fix authority only if needed**

If the worker regression fails because the server accepts index `0` even though it points at `observer_will_01`, fix the canonical path, not the UI path. The expected production fix is to make `applyObserverWillChoice` reject a target if its current hand card is inviolable:

```ts
    const isInviolableSpecialCardId = typeof deps.isInviolableSpecialCardId === 'function'
        ? deps.isInviolableSpecialCardId
        : () => false;

    if (isInviolableSpecialCardId(opponentHand[targetIndex])) {
        return { applied: false, reason: 'inviolable_special_card' };
    }
```

Then pass `isInviolableSpecialCardId` from `game/logic/cards.ts` into `applyObserverWillChoice` deps.

- [ ] **Step 4: Run network-focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/workers.match-pending-effect-id.test.ts test/network.playback-event-assembly.contract.test.ts test/utils.match-authority.public-snapshot.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit worker authority coverage**

```powershell
git add test/workers.match-pending-effect-id.test.ts game/logic/card-resolution/hand-effects.ts game/logic/cards.ts
git commit -m "特殊カード不可侵をworker権威で検証"
```

Only stage production files if Step 3 required production changes.

## Task 5: Rulebook and Help Text

**Files:**
- Modify: `01-rulebook.md`
- Modify if present: `正本/カード仕様正本.md`
- Modify if visible effect text changes: `cards/card-interaction-effects.ts`
- Test: `test/ui.card-detail-effect-tags.test.ts` only if visible card text/tags change

- [ ] **Step 1: Update rulebook**

Add a short rule near special card or hand-effect rules in `01-rulebook.md`:

```md
### 特殊カードの不可侵

- `理論の化身` / `盤界の執行者` / `盤理の観測者` は特殊カードとして扱う。
- 特殊カードは相手効果による手札奪取・手札破壊・ランダム破棄・手札交換の対象にならない。
- 特殊カードの所有者は、通常の使用条件を満たす場合にそのカードを使用できる。
- 所有者自身の任意破棄・売却・自分効果による消費は、個別カードや画面仕様が禁止していない限り通常どおり行える。
```

- [ ] **Step 2: Decide whether card text needs changing**

If the current `盤理の観測者` detail text says "相手手札から1枚を選ぶ", leave it if UI offers already exclude special cards. If user-facing precision is desired, update the detail text to:

```ts
OBSERVER_WILL: '18手以上経過後に使用可能。\n使用時に相手手札の特殊カード以外から1枚選ぶ。選んだカードは自分の手札に加わり0コストになる。\n選ばれなかった相手手札はコスト+5になる。\n次に置く自石は5T絶対保護の観測石になる。観測石がある間、相手手札は常に表表示。\n観測石が持続終了で消滅した所有者ターン開始時から、奪ったカードの元コスト20%を最大9回返済する。布石不足時は自石4個をランダム破壊する。'
```

- [ ] **Step 3: Run docs/text tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.card-detail-effect-tags.test.ts test/cards.catalog.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit rulebook/text update**

```powershell
git add 01-rulebook.md cards/card-interaction-effects.ts test/ui.card-detail-effect-tags.test.ts
git commit -m "特殊カード不可侵ルールを明文化"
```

Only stage `cards/card-interaction-effects.ts` and tag tests if Step 2 changed visible text.

## Task 6: Generated Assets and Full Focused Validation

**Files:**
- Generated: `public/module-registry.js`
- Generated mirror: `worker-public/public/module-registry.js`
- Worker mirror changes from `npm run worker:prepare`

- [ ] **Step 1: Build TypeScript**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both pass.

- [ ] **Step 2: Run focused Jest bundle**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/shared.special-card-registry.test.ts test/game.special-card-inviolable.test.ts test/game.observer-will-selection.test.ts test/game.observer-will-repayment.test.ts test/workers.match-pending-effect-id.test.ts test/cards.catalog.test.ts
```

Expected: PASS.

- [ ] **Step 3: Sync browser and worker mirrors**

Run:

```powershell
npm run worker:prepare
```

Expected: `mirror-verified` appears and command exits 0.

- [ ] **Step 4: Run broad static checks**

Run:

```powershell
npm run checkall
```

Expected: PASS unless unrelated existing `tmp-live-network-*.js` files remain in repo root. If it fails only on those files, report the failure as unrelated and do not delete them unless explicitly approved.

- [ ] **Step 5: Final diff review**

Run:

```powershell
git diff --check
git status --short
```

Expected:

- `git diff --check` has no whitespace errors.
- Only files intentionally touched for special-card inviolability are staged.
- Unrelated dirty files remain unstaged.

- [ ] **Step 6: Final commit**

If all required focused checks pass and unrelated files can be excluded safely:

```powershell
git add shared/special-card-registry.ts shared/deck-spec.ts game/logic/cards-internal/offer-builders.ts game/logic/cards-internal/hand-manager.ts game/logic/cards-internal/hand-access.ts game/logic/card-resolution/hand-effects.ts game/logic/cards.ts 01-rulebook.md test/shared.special-card-registry.test.ts test/game.special-card-inviolable.test.ts test/workers.match-pending-effect-id.test.ts public/module-registry.js worker-public/public/module-registry.js
git commit -m "特殊カードを相手効果から不可侵にする"
```

Do not include unrelated generated files, audio assets, Unity docs, or existing dirty files.

## Self-Review

- Spec coverage: The plan covers shared classification, deck constraint reuse, offer filtering, random destruction, direct destruction, worker authority, rulebook text, generated browser registry, and worker mirror.
- Placeholder scan: No placeholder markers remain. Optional branches are explicit and include exact code or exact skip conditions.
- Type consistency: The shared helper is consistently named `isInviolableSpecialCardId`; the exported list helper is `getInviolableSpecialCardIds`; the protected failure reason is `inviolable_special_card`.
- Scope check: This plan does not implement board-level special-stone count limits. That is intentionally separate because card inviolability plus deck uniqueness addresses the duplicate-card problem.
