# 盤理の観測者 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `盤理の観測者` (`observer_will_01`, `OBSERVER_WILL`) as a 0-cost special card that steals one opponent hand card immediately, reserves the next placed stone as a 5T absolute-protected observation stone, reveals the opponent hand while that stone exists, then starts nine turn-start repayments when the stone expires at its owner turn start.

**Architecture:** Reuse the existing hand-overlay pending selection shape from `HEAVEN_BLESSING` and `CONDEMN_WILL`, but add a dedicated `observerWillTargetIndex` action so steal semantics do not share destroy semantics. Keep authority in headless card/turn logic; UI only renders pending offers and snapshots. Extend the existing hand copy-id and RIBO repayment patterns rather than adding UI-only state.

**Tech Stack:** TypeScript/JavaScript, Jest, browser classic module registry, Cloudflare Worker mirror via `npm run worker:prepare`.

---

## File Structure

- Modify `01-rulebook.md`: player-visible card spec.
- Modify `cards/catalog.json`: source catalog entry for `observer_will_01`.
- Regenerate `cards/catalog.js`, `cards/catalog.ts`, `cards/catalog.generated.js` through `npm run generate:catalog`.
- Modify `cards/card-interaction-effects.ts`: card detail and help text.
- Modify `game/logic/cards-internal/state-factory.ts`: clone and normalize observer repayment and per-copy cost ledgers.
- Modify `game/logic/cards-internal/hand-manager.ts`: expose copy-id cost helpers and observer hand transfer helpers near existing hand copy-id helpers.
- Modify `game/logic/cards-internal/card-usage-prechecks.ts`: unlock `OBSERVER_WILL` only at 18+ turns and only when opponent hand has at least one card.
- Modify `game/cards/effect-resolver.ts`: pass `observerWillOffers` into pending effect state.
- Modify `game/logic/cards-internal/pending-selection-registry.ts`: add `OBSERVER_WILL` as a hand overlay selection.
- Modify `game/logic/card-resolution/hand-effects.ts`: implement `applyObserverWillChoice`.
- Modify `game/logic/cards.ts`: export observer helpers, cost helpers, and repayment processing through the canonical CardLogic facade.
- Modify `game/turn/action-phase/pre-placement-selection.ts`: resolve `observerWillTargetIndex` actions.
- Modify `game/turn/action-phase/place-resolution.ts`: convert the next placed own stone into `OBSERVER_WILL` when the reservation exists.
- Modify `game/turn/turn-start/marker-phase.ts` or the existing timer processing module used by `OBSERVER_WILL` markers: expire observation stones and activate repayment.
- Modify `game/logic/cards-internal/ribo-time-stop.ts`: extend repayment processing with `sourceType: 'OBSERVER_WILL'` entries and distinct events.
- Modify `game/turn/turn_pipeline_phases.ts`: emit `observer_will_repaid` and `observer_will_shortage` raw events from turn-start summaries.
- Modify `utils/match-authority.ts`: reveal opponent hand in projected snapshots only to an active observation stone owner.
- Modify `cards/card-interaction-overlay-selection.ts` and `cards/card-interaction-overlay-view.ts`: show and submit observer hand offers using existing overlay cards.
- Modify `game/card-effects/selection-flow.ts`: include `observerWillTargetIndex` in pending selection actions.
- Modify `game/turn-handlers/pending-target-selector.ts`, `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`, `game/ai/cpu-policy-card-profiles.ts`, `game/ai/cpu-policy-card-type-flags.ts`, and `game/ai/cpu-policy-core.ts` for CPU pending choice.
- Modify `workers/match-worker.ts`, `workers/match-worker-runtime-preload.ts`, and sanitize/publish helpers only where action payload allowlists require `observerWillTargetIndex`.
- Run `npm run worker:prepare` to mirror root changes into `worker-public/`.

## Implementation Notes

- Work in a clean branch or isolated worktree. The current repository has a large dirty tree; do not stage unrelated files.
- Use `observerWillTargetIndex` for player/CPU/network actions.
- Use `OBSERVER_WILL` for both card type and marker type.
- Use hand copy IDs for cost changes. Do not mutate catalog base costs.
- Keep hidden information canonical in Worker snapshots. Projection decides who sees real card IDs.
- Treat `remainingOwnerTurns` for `OBSERVER_WILL` the same way the current special marker timer system treats owner-turn durations.

---

### Task 1: Catalog, Rulebook, and Surface Text

**Files:**
- Modify: `01-rulebook.md`
- Modify: `cards/catalog.json`
- Modify: `cards/card-interaction-effects.ts`
- Modify generated: `cards/catalog.js`
- Modify generated: `cards/catalog.ts`
- Modify generated: `cards/catalog.generated.js`
- Test: `test/cards.catalog.test.ts`
- Test: `test/ui.card-detail-effect-tags.test.ts`

- [ ] **Step 1: Write the failing catalog test**

Add this test to `test/cards.catalog.test.ts` near the other card presence tests:

```ts
test('observer will special card is present with expected cost and type', () => {
  const card = catalog.find((entry) => entry && entry.id === 'observer_will_01');
  expect(card).toEqual(expect.objectContaining({
    id: 'observer_will_01',
    name_ja: '盤理の観測者',
    type: 'OBSERVER_WILL',
    cost: 0,
    display_type_ja: '観測'
  }));
  expect(card.desc_ja).toContain('18手以上');
  expect(card.desc_ja).toContain('相手手札');
  expect(card.desc_ja).toContain('観測石');
});
```

- [ ] **Step 2: Run the catalog test to verify it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/cards.catalog.test.ts
```

Expected: fail because `observer_will_01` is not yet in `cards/catalog.json`.

- [ ] **Step 3: Add the catalog entry**

Insert this object into `cards/catalog.json` near other observation cards:

```json
{
  "id": "observer_will_01",
  "name_ja": "盤理の観測者",
  "type": "OBSERVER_WILL",
  "cost": 0,
  "desc_ja": "18手以上経過後に使用可能。相手手札から1枚を選んで奪い0コスト化し、他の相手手札はコスト+5。次に置く自石は5T絶対保護の観測石になり、存在中は相手手札を常時公開。観測石消滅後、奪ったカードの元コスト20%を最大9回返済する。",
  "display_type_ja": "観測"
}
```

- [ ] **Step 4: Add card detail text**

Add these entries in `cards/card-interaction-effects.ts`:

```ts
OBSERVER_WILL: '相手手札を1枚奪い、次の石を観測石にする',
```

and detail text:

```ts
OBSERVER_WILL: '18手以上経過後に使用可能。\n使用時に相手手札を公開して1枚選ぶ。選んだカードは自分の手札に加わり0コストになる。\n選ばれなかった相手手札はコスト+5になる。\n次に置く自石は5T絶対保護の観測石になる。観測石がある間、相手手札は常に表表示。\n観測石消滅後、奪ったカードの元コスト20%を自ターン開始時に最大9回返済する。布石不足時は自石4個をランダム破壊する。',
```

- [ ] **Step 5: Update `01-rulebook.md`**

Add the same player-facing behavior under the card list using this wording:

```md
### 盤理の観測者 / 0C / 5T絶対保護

- 使用条件: 18手以上経過後。
- 使用時: 相手手札から1枚を選び、自分の手札に加える。加えたカードは0コスト扱いになる。
- 選ばれなかった相手手札は、それぞれコスト+5扱いになる。
- 選択後、次に置く自石は観測石になる。
- 観測石が盤面にある間、その所有者は相手手札を常に表表示で確認できる。
- 観測石は5T持続し、絶対保護。持続終了時に通常石へ戻る。
- 観測石が持続終了で消滅した所有者ターン開始時に、奪ったカードの元コスト20%分の初回返済も同時に発生する。その後も自ターン開始時に最大9回まで布石を失う。布石が足りない場合、その回は自石4個をランダム破壊する。
```

- [ ] **Step 6: Regenerate catalog projections**

Run:

```powershell
npm run generate:catalog
```

Expected: `cards/catalog.js`, `cards/catalog.ts`, and `cards/catalog.generated.js` update from `cards/catalog.json`.

- [ ] **Step 7: Run catalog and card detail tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/cards.catalog.test.ts test/ui.card-detail-effect-tags.test.ts
```

Expected: both suites pass.

- [ ] **Step 8: Commit Task 1**

Run:

```powershell
git add -- 01-rulebook.md cards/catalog.json cards/catalog.js cards/catalog.ts cards/catalog.generated.js cards/card-interaction-effects.ts test/cards.catalog.test.ts test/ui.card-detail-effect-tags.test.ts
git commit -m "盤理の観測者のカタログを追加"
```

---

### Task 2: Card Copy Cost Ledger

**Files:**
- Modify: `game/logic/cards-internal/state-factory.ts`
- Modify: `game/logic/cards-internal/hand-manager.ts`
- Modify: `game/logic/cards.ts`
- Test: `test/game.observer-will-cost-ledger.test.ts`

- [ ] **Step 1: Write failing ledger tests**

Create `test/game.observer-will-cost-ledger.test.ts`:

```ts
const CardLogic = require('../game/logic/cards.js');

describe('OBSERVER_WILL card copy cost ledger', () => {
  test('stores a zero-cost override by card copy id', () => {
    const cardState = CardLogic.createInitialCardState({ black: [], white: [] });
    const added = CardLogic.addCardToHand(cardState, 'black', 'meteor_01');
    expect(added.cardCopyId).toBeGreaterThan(0);

    CardLogic.setCardCostOverrideForCopyId(cardState, added.cardCopyId, 0, 'OBSERVER_WILL');

    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'meteor_01', added.cardCopyId)).toBe(0);
  });

  test('stores additive +5 modifiers by card copy id', () => {
    const cardState = CardLogic.createInitialCardState({ black: [], white: [] });
    const added = CardLogic.addCardToHand(cardState, 'white', 'guard_01');
    const base = CardLogic.getCardCost('guard_01');

    CardLogic.addCardCostModifierForCopyId(cardState, added.cardCopyId, 5, 'OBSERVER_WILL');

    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'guard_01', added.cardCopyId)).toBe(base + 5);
  });

  test('cloneCardState preserves observer cost ledgers', () => {
    const cardState = CardLogic.createInitialCardState({ black: [], white: [] });
    const added = CardLogic.addCardToHand(cardState, 'black', 'gold_stone');
    CardLogic.setCardCostOverrideForCopyId(cardState, added.cardCopyId, 0, 'OBSERVER_WILL');
    CardLogic.addCardCostModifierForCopyId(cardState, added.cardCopyId, 5, 'OBSERVER_WILL');

    const cloned = CardLogic.cloneCardState(cardState);

    expect(cloned.cardCostOverridesByCopyId[String(added.cardCopyId)].cost).toBe(0);
    expect(cloned.cardCostModifiersByCopyId[String(added.cardCopyId)][0].delta).toBe(5);
  });
});
```

- [ ] **Step 2: Run the ledger test to verify it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.observer-will-cost-ledger.test.ts
```

Expected: fail because the new helpers and ledgers do not exist.

- [ ] **Step 3: Add state fields in `state-factory.ts`**

Add these defaults to the initial card state:

```ts
cardCostOverridesByCopyId: {},
cardCostModifiersByCopyId: {},
```

Add clone normalization:

```ts
cardCostOverridesByCopyId: cloneCardCostOverrides(cardState.cardCostOverridesByCopyId),
cardCostModifiersByCopyId: cloneCardCostModifiers(cardState.cardCostModifiersByCopyId),
```

Add helper functions near existing copy-id normalization helpers:

```ts
function cloneCardCostOverrides(raw: any): Record<string, { cost: number; sourceType: string }> {
  const out: Record<string, { cost: number; sourceType: string }> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [copyId, entry] of Object.entries(raw)) {
    const numericCopyId = Number(copyId);
    const numericCost = Number((entry as any).cost);
    if (!Number.isInteger(numericCopyId) || numericCopyId <= 0) continue;
    if (!Number.isFinite(numericCost)) continue;
    out[String(numericCopyId)] = {
      cost: Math.max(0, Math.floor(numericCost)),
      sourceType: String((entry as any).sourceType || 'UNKNOWN')
    };
  }
  return out;
}

function cloneCardCostModifiers(raw: any): Record<string, Array<{ delta: number; sourceType: string }>> {
  const out: Record<string, Array<{ delta: number; sourceType: string }>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [copyId, entries] of Object.entries(raw)) {
    const numericCopyId = Number(copyId);
    if (!Number.isInteger(numericCopyId) || numericCopyId <= 0 || !Array.isArray(entries)) continue;
    const normalized = entries
      .map((entry: any) => ({
        delta: Number.isFinite(Number(entry && entry.delta)) ? Math.floor(Number(entry.delta)) : 0,
        sourceType: String(entry && entry.sourceType ? entry.sourceType : 'UNKNOWN')
      }))
      .filter((entry) => entry.delta !== 0);
    if (normalized.length) out[String(numericCopyId)] = normalized;
  }
  return out;
}
```

- [ ] **Step 4: Add ledger helpers in `hand-manager.ts`**

Add these exports near hand copy-id helpers:

```ts
function ensureCardCostLedgers(cardState: any) {
  if (!cardState.cardCostOverridesByCopyId || typeof cardState.cardCostOverridesByCopyId !== 'object') {
    cardState.cardCostOverridesByCopyId = {};
  }
  if (!cardState.cardCostModifiersByCopyId || typeof cardState.cardCostModifiersByCopyId !== 'object') {
    cardState.cardCostModifiersByCopyId = {};
  }
  return {
    overrides: cardState.cardCostOverridesByCopyId,
    modifiers: cardState.cardCostModifiersByCopyId
  };
}

function setCardCostOverrideForCopyId(cardState: any, cardCopyId: any, cost: any, sourceType = 'UNKNOWN') {
  const copyId = Number(cardCopyId);
  const normalizedCost = Number(cost);
  if (!cardState || !Number.isInteger(copyId) || copyId <= 0 || !Number.isFinite(normalizedCost)) return false;
  const ledgers = ensureCardCostLedgers(cardState);
  ledgers.overrides[String(copyId)] = {
    cost: Math.max(0, Math.floor(normalizedCost)),
    sourceType: String(sourceType || 'UNKNOWN')
  };
  return true;
}

function addCardCostModifierForCopyId(cardState: any, cardCopyId: any, delta: any, sourceType = 'UNKNOWN') {
  const copyId = Number(cardCopyId);
  const normalizedDelta = Number(delta);
  if (!cardState || !Number.isInteger(copyId) || copyId <= 0 || !Number.isFinite(normalizedDelta)) return false;
  const ledgers = ensureCardCostLedgers(cardState);
  const key = String(copyId);
  if (!Array.isArray(ledgers.modifiers[key])) ledgers.modifiers[key] = [];
  ledgers.modifiers[key].push({
    delta: Math.floor(normalizedDelta),
    sourceType: String(sourceType || 'UNKNOWN')
  });
  return true;
}

function getEffectiveCardCostForCopy(cardState: any, cardId: any, cardCopyId: any, getBaseCost: any) {
  const baseCost = typeof getBaseCost === 'function' ? Number(getBaseCost(cardId)) || 0 : 0;
  const copyId = Number(cardCopyId);
  if (!cardState || !Number.isInteger(copyId) || copyId <= 0) return Math.max(0, Math.floor(baseCost));
  const ledgers = ensureCardCostLedgers(cardState);
  const override = ledgers.overrides[String(copyId)];
  if (override && Number.isFinite(Number(override.cost))) {
    return Math.max(0, Math.floor(Number(override.cost)));
  }
  const modifiers = Array.isArray(ledgers.modifiers[String(copyId)]) ? ledgers.modifiers[String(copyId)] : [];
  const delta = modifiers.reduce((sum: number, entry: any) => sum + (Number(entry && entry.delta) || 0), 0);
  return Math.max(0, Math.floor(baseCost + delta));
}
```

- [ ] **Step 5: Export helpers from `game/logic/cards.ts`**

Add CardLogic facade methods:

```ts
setCardCostOverrideForCopyId,
addCardCostModifierForCopyId,
getEffectiveCardCostForCopy: (cardState: any, cardId: any, cardCopyId: any) =>
  HandManager.getEffectiveCardCostForCopy(cardState, cardId, cardCopyId, getCardCost),
```

Use the actual local module object name already used for hand-manager exports in `game/logic/cards.ts`.

- [ ] **Step 6: Run the ledger test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.observer-will-cost-ledger.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add -- game/logic/cards-internal/state-factory.ts game/logic/cards-internal/hand-manager.ts game/logic/cards.ts test/game.observer-will-cost-ledger.test.ts
git commit -m "観測者用のカードコスト台帳を追加"
```

---

### Task 3: Observer Pending Selection and Hand Steal

**Files:**
- Modify: `game/logic/cards-internal/card-usage-prechecks.ts`
- Modify: `game/cards/effect-resolver.ts`
- Modify: `game/logic/cards-internal/pending-selection-registry.ts`
- Modify: `game/logic/card-resolution/hand-effects.ts`
- Modify: `game/logic/cards.ts`
- Modify: `game/turn/action-phase/pre-placement-selection.ts`
- Test: `test/game.observer-will-selection.test.ts`

- [ ] **Step 1: Write failing selection tests**

Create `test/game.observer-will-selection.test.ts`:

```ts
const CardLogic = require('../game/logic/cards.js');
const TurnPipeline = require('../game/turn/turn_pipeline_phases.js');

function createState(turnNumber = 18) {
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1,
    turnNumber
  };
  const cardState = CardLogic.createInitialCardState({
    black: ['observer_will_01'],
    white: ['meteor_01', 'guard_01', 'gold_stone']
  });
  cardState.charge.black = 0;
  cardState.charge.white = 0;
  return { gameState, cardState };
}

describe('OBSERVER_WILL pending selection', () => {
  test('cannot be used before 18 turns', () => {
    const { gameState, cardState } = createState(17);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01')).toBe(false);
  });

  test('creates opponent hand offers at 18 turns', () => {
    const { gameState, cardState } = createState(18);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01')).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'OBSERVER_WILL',
      stage: 'selectTarget',
      cardId: 'observer_will_01'
    }));
    expect(cardState.pendingEffectByPlayer.black.offers).toEqual([
      expect.objectContaining({ handIndex: 0, cardId: 'meteor_01' }),
      expect.objectContaining({ handIndex: 1, cardId: 'guard_01' }),
      expect.objectContaining({ handIndex: 2, cardId: 'gold_stone' })
    ]);
  });

  test('selection steals one card, modifies costs, and reserves observation stone', () => {
    const { gameState, cardState } = createState(18);
    CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01');

    const res = CardLogic.applyObserverWillChoice(cardState, gameState, 'black', 1);

    expect(res.applied).toBe(true);
    expect(cardState.hands.black).toContain('guard_01');
    expect(cardState.hands.white).toEqual(['meteor_01', 'gold_stone']);
    expect(cardState.nextObserverWillStoneByPlayer.black).toEqual(expect.objectContaining({
      sourceType: 'OBSERVER_WILL',
      stolenCardId: 'guard_01'
    }));
    expect(cardState.observerWillRepaymentsByPlayer.black[0]).toEqual(expect.objectContaining({
      sourceType: 'OBSERVER_WILL',
      status: 'waiting_for_marker_expire',
      stolenCardId: 'guard_01',
      remainingOwnerTurns: 9,
      shortageDestroyCount: 4
    }));
  });
});
```

- [ ] **Step 2: Run the selection test to verify it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.observer-will-selection.test.ts
```

Expected: fail because `OBSERVER_WILL` catalog and selection handlers are not wired yet.

- [ ] **Step 3: Add usage precheck result fields**

In `game/logic/cards-internal/card-usage-prechecks.ts`, extend the result type with `observerWillOffers` and initialize it:

```ts
observerWillOffers: any[] | null;
```

```ts
return { ok: false, heavenOffers: null, condemnOffers: null, observerWillOffers: null };
```

Add the `OBSERVER_WILL` case:

```ts
if (cardType === 'OBSERVER_WILL') {
  const turnNumber = Number(context.gameState && context.gameState.turnNumber);
  if (!Number.isFinite(turnNumber) || turnNumber < 18) return buildFailureResult();
  const offers = context.buildObserverWillOffers(context.cardState, context.playerKey);
  if (!Array.isArray(offers) || offers.length <= 0) return buildFailureResult();
  result.observerWillOffers = offers;
}
```

- [ ] **Step 4: Add offer builder in `hand-manager.ts` or `cards.ts`**

Add:

```ts
function buildObserverWillOffers(cardState: any, playerKey: string) {
  const opponentKey = playerKey === 'black' ? 'white' : 'black';
  const hand = cardState && cardState.hands && Array.isArray(cardState.hands[opponentKey])
    ? cardState.hands[opponentKey]
    : [];
  return hand.map((cardId: any, handIndex: number) => ({ handIndex, cardId }));
}
```

Export it through `game/logic/cards.ts`.

- [ ] **Step 5: Pass observer offers through `effect-resolver.ts`**

Add:

```ts
const observerWillOffers = Array.isArray(usagePrecheck.observerWillOffers) ? usagePrecheck.observerWillOffers : null;
const pendingOffers = heavenOffers || condemnOffers || observerWillOffers || undefined;
```

Also add `buildObserverWillOffers` to the precheck context object.

- [ ] **Step 6: Add pending selection registry entry**

In `game/logic/cards-internal/pending-selection-registry.ts`, add:

```ts
OBSERVER_WILL: {
  kind: 'hand_overlay',
  turnOutcome: 'continue_turn',
  deferNetworkPublish: true,
  waitForPlaybackIdle: true,
  needsTargetSelection: true,
  dispatchKey: 'observer_will',
  cpuHandlerNames: ['cpuSelectObserverWillWithPolicy']
}
```

- [ ] **Step 7: Implement `applyObserverWillChoice`**

In `game/logic/card-resolution/hand-effects.ts`, add:

```ts
function applyObserverWillChoice(cardState: any, gameState: any, playerKey: string, targetIndex: number, deps: any): Record<string, any> {
  const pending = deps.readCardPendingEffect(cardState, playerKey);
  if (!pending || pending.type !== 'OBSERVER_WILL' || pending.stage !== 'selectTarget') {
    return { applied: false, reason: 'pending_not_found' };
  }
  const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
  const offer = offers.find((entry: any) => entry && entry.handIndex === targetIndex);
  if (!offer) return { applied: false, reason: 'invalid_target' };

  const opponentKey = playerKey === 'black' ? 'white' : 'black';
  const removed = deps.removeHandCardAt(cardState, opponentKey, targetIndex);
  if (!removed || !removed.cardId) return { applied: false, reason: 'invalid_target' };

  const originalCost = deps.getCardCost(removed.cardId);
  const added = deps.addCardToHand(cardState, playerKey, removed.cardId, { cardCopyId: removed.cardCopyId });
  if (!added) {
    deps.addCardToHand(cardState, opponentKey, removed.cardId, { insertIndex: targetIndex, cardCopyId: removed.cardCopyId, ignoreHandLimit: true });
    return { applied: false, reason: 'hand_full' };
  }

  deps.setCardCostOverrideForCopyId(cardState, added.cardCopyId, 0, 'OBSERVER_WILL');
  const remainingCopyIds = deps.getHandCopyIds(cardState, opponentKey);
  for (const copyId of remainingCopyIds) {
    deps.addCardCostModifierForCopyId(cardState, copyId, 5, 'OBSERVER_WILL');
  }

  const repaymentAmount = Math.max(0, Math.ceil((Number(originalCost) || 0) * 0.2));
  deps.reserveNextObserverWillStone(cardState, playerKey, {
    stolenCardId: removed.cardId,
    stolenCardCopyId: added.cardCopyId,
    originalCost,
    repaymentAmount
  });
  deps.reserveObserverWillRepayment(cardState, playerKey, {
    stolenCardId: removed.cardId,
    stolenCardCopyId: added.cardCopyId,
    originalCost,
    repaymentAmount
  });
  deps.clearCardPendingEffect(cardState, playerKey);

  return {
    applied: true,
    opponentKey,
    targetIndex,
    stolenCardId: removed.cardId,
    stolenCardCopyId: added.cardCopyId,
    originalCost,
    repaymentAmount,
    boostedCount: remainingCopyIds.length
  };
}
```

Use the local `addCardToHand` signature from `hand-manager.ts`; if its current arguments differ, add a small wrapper in the deps object rather than changing existing callers.

- [ ] **Step 8: Resolve observer selection in action phase**

In `game/turn/action-phase/pre-placement-selection.ts`, add before other board target selections:

```ts
if (pending && pending.type === 'OBSERVER_WILL' && action.observerWillTargetIndex != null) {
  const res = opts.CardLogic.applyObserverWillChoice(
    opts.cardState,
    opts.gameState,
    opts.playerKey,
    action.observerWillTargetIndex
  );
  opts.events.push({
    type: 'observer_will_selected',
    player: opts.playerKey,
    observerWillTargetIndex: action.observerWillTargetIndex,
    applied: !!(res && res.applied),
    stolenCardId: res && res.stolenCardId ? res.stolenCardId : null,
    boostedCount: Number(res && res.boostedCount) || 0
  });
  if (res && res.applied) {
    opts.emitHandRemovePresentation({
      player: res.opponentKey,
      count: 1,
      reason: 'observer_will',
      cardId: res.stolenCardId,
      cardIds: [res.stolenCardId]
    });
  }
  return true;
} else if (pending && pending.type === 'OBSERVER_WILL' && action.observerWillTargetIndex == null) {
  throw new Error('OBSERVER_WILL requires observerWillTargetIndex before placement');
}
```

- [ ] **Step 9: Run the selection test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.observer-will-selection.test.ts
```

Expected: pass.

- [ ] **Step 10: Commit Task 3**

Run:

```powershell
git add -- game/logic/cards-internal/card-usage-prechecks.ts game/cards/effect-resolver.ts game/logic/cards-internal/pending-selection-registry.ts game/logic/card-resolution/hand-effects.ts game/logic/cards.ts game/turn/action-phase/pre-placement-selection.ts test/game.observer-will-selection.test.ts
git commit -m "盤理の観測者の手札選択を追加"
```

---

### Task 4: Observation Stone Reservation and Expiry

**Files:**
- Modify: `game/logic/cards-internal/state-factory.ts`
- Modify: `game/logic/cards/markers.ts`
- Modify: `game/logic/cards.ts`
- Modify: `game/turn/action-phase/place-resolution.ts`
- Modify: `game/turn/turn-start/marker-phase.ts`
- Test: `test/game.observer-will-marker.test.ts`

- [ ] **Step 1: Write failing marker tests**

Create `test/game.observer-will-marker.test.ts`:

```ts
const CardLogic = require('../game/logic/cards.js');
const PlaceResolution = require('../game/turn/action-phase/place-resolution.js');

describe('OBSERVER_WILL observation stone', () => {
  test('next placement consumes reservation and creates an absolute protected marker', () => {
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1, turnNumber: 18 };
    const cardState = CardLogic.createInitialCardState({ black: [], white: [] });
    CardLogic.reserveNextObserverWillStone(cardState, 'black', {
      stolenCardId: 'meteor_01',
      stolenCardCopyId: 10,
      originalCost: 12,
      repaymentAmount: 3
    });

    gameState.board[2][3] = 1;
    CardLogic.applyObserverWillMarkerForPlacedStone(cardState, gameState, 'black', 2, 3);

    const marker = cardState.markers.find((entry) => entry && entry.row === 2 && entry.col === 3 && entry.data && entry.data.type === 'OBSERVER_WILL');
    expect(marker).toEqual(expect.objectContaining({
      kind: 'specialStone',
      owner: 'black'
    }));
    expect(marker.data.remainingOwnerTurns).toBe(5);
    expect(CardLogic.isAbsoluteProtectedCell(cardState, 2, 3)).toBe(true);
    expect(cardState.nextObserverWillStoneByPlayer.black).toBeNull();
  });

  test('duration end reverts the marker and activates repayment', () => {
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1, turnNumber: 22 };
    const cardState = CardLogic.createInitialCardState({ black: [], white: [] });
    gameState.board[2][3] = 1;
    CardLogic.reserveNextObserverWillStone(cardState, 'black', {
      stolenCardId: 'meteor_01',
      stolenCardCopyId: 10,
      originalCost: 12,
      repaymentAmount: 3
    });
    const marker = CardLogic.applyObserverWillMarkerForPlacedStone(cardState, gameState, 'black', 2, 3).marker;
    cardState.observerWillRepaymentsByPlayer.black = [{
      sourceType: 'OBSERVER_WILL',
      status: 'waiting_for_marker_expire',
      markerId: marker.id,
      stolenCardId: 'meteor_01',
      stolenCardCopyId: 10,
      originalCost: 12,
      repaymentAmount: 3,
      remainingOwnerTurns: 9,
      shortageDestroyCount: 4
    }];
    marker.data.remainingOwnerTurns = 1;

    const summary = CardLogic.processObserverWillMarkerTurnStart(cardState, gameState, 'black');

    expect(summary.expired).toHaveLength(1);
    expect(cardState.markers.some((entry) => entry && entry.data && entry.data.type === 'OBSERVER_WILL')).toBe(false);
    expect(cardState.observerWillRepaymentsByPlayer.black[0].status).toBe('active');
  });
});
```

- [ ] **Step 2: Run marker tests to verify they fail**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.observer-will-marker.test.ts
```

Expected: fail because reservation and marker application helpers do not exist.

- [ ] **Step 3: Add reservation state**

In `state-factory.ts`, add:

```ts
nextObserverWillStoneByPlayer: { black: null, white: null },
observerWillRepaymentsByPlayer: { black: [], white: [] },
```

Clone these fields with explicit normalization:

```ts
nextObserverWillStoneByPlayer: cloneNextObserverWillStoneByPlayer(cardState.nextObserverWillStoneByPlayer),
observerWillRepaymentsByPlayer: cloneObserverWillRepaymentsByPlayer(cardState.observerWillRepaymentsByPlayer),
```

Use `status` values `'waiting_for_marker_expire'` and `'active'` only.

- [ ] **Step 4: Add marker helpers**

In `game/logic/cards/markers.ts`, add:

```ts
function reserveNextObserverWillStone(cardState: any, playerKey: string, payload: any) {
  if (!cardState.nextObserverWillStoneByPlayer || typeof cardState.nextObserverWillStoneByPlayer !== 'object') {
    cardState.nextObserverWillStoneByPlayer = { black: null, white: null };
  }
  cardState.nextObserverWillStoneByPlayer[playerKey] = {
    sourceType: 'OBSERVER_WILL',
    stolenCardId: payload.stolenCardId,
    stolenCardCopyId: Number(payload.stolenCardCopyId) || null,
    originalCost: Math.max(0, Math.floor(Number(payload.originalCost) || 0)),
    repaymentAmount: Math.max(0, Math.ceil(Number(payload.repaymentAmount) || 0))
  };
  return cardState.nextObserverWillStoneByPlayer[playerKey];
}

function applyObserverWillMarkerForPlacedStone(cardState: any, gameState: any, playerKey: string, row: number, col: number) {
  const reservation = cardState.nextObserverWillStoneByPlayer && cardState.nextObserverWillStoneByPlayer[playerKey];
  if (!reservation) return { applied: false, marker: null };
  const marker = addSpecialStoneMarker(cardState, row, col, playerKey, {
    type: 'OBSERVER_WILL',
    remainingOwnerTurns: 5,
    absoluteProtected: true,
    visualEffectKey: 'observerWillStone',
    stolenCardId: reservation.stolenCardId,
    stolenCardCopyId: reservation.stolenCardCopyId,
    originalCost: reservation.originalCost,
    repaymentAmount: reservation.repaymentAmount
  });
  if (cardState.nextObserverWillStoneByPlayer) cardState.nextObserverWillStoneByPlayer[playerKey] = null;
  linkObserverWillRepaymentToMarker(cardState, playerKey, reservation.stolenCardCopyId, marker && marker.id);
  return { applied: true, marker };
}
```

Use the existing marker creation helper name in this module. If the existing helper is named differently, wrap it without changing public behavior of other marker types.

- [ ] **Step 5: Call marker helper from placement**

In `game/turn/action-phase/place-resolution.ts`, after the placed stone is canonical and before final presentation events are emitted, add:

```ts
if (opts.CardLogic && typeof opts.CardLogic.applyObserverWillMarkerForPlacedStone === 'function') {
  const observerRes = opts.CardLogic.applyObserverWillMarkerForPlacedStone(
    opts.cardState,
    opts.gameState,
    opts.playerKey,
    action.row,
    action.col
  );
  if (observerRes && observerRes.applied) {
    opts.events.push({
      type: 'observer_will_marker_applied',
      player: opts.playerKey,
      row: action.row,
      col: action.col
    });
  }
}
```

- [ ] **Step 6: Add expiry processing**

Add `processObserverWillMarkerTurnStart(cardState, gameState, playerKey)` to marker logic. It must:

```ts
return {
  expired: [{ row, col, owner: playerKey, markerId }],
  activeCount
};
```

On expiry:

```ts
revertSpecialStoneWithPresentation(cardState, gameState, row, col, 'OBSERVER_WILL', playerKey, 'OBSERVER_WILL', 'duration_end', { owner: playerKey, timer: 0 });
activateObserverWillRepaymentForMarker(cardState, playerKey, marker.id);
```

- [ ] **Step 7: Export helper methods from `game/logic/cards.ts`**

Export:

```ts
reserveNextObserverWillStone,
applyObserverWillMarkerForPlacedStone,
processObserverWillMarkerTurnStart,
reserveObserverWillRepayment,
activateObserverWillRepaymentForMarker,
linkObserverWillRepaymentToMarker
```

- [ ] **Step 8: Run marker tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.observer-will-marker.test.ts test/special-card-foundation.test.ts
```

Expected: both suites pass.

- [ ] **Step 9: Commit Task 4**

Run:

```powershell
git add -- game/logic/cards-internal/state-factory.ts game/logic/cards/markers.ts game/logic/cards.ts game/turn/action-phase/place-resolution.ts game/turn/turn-start/marker-phase.ts test/game.observer-will-marker.test.ts
git commit -m "観測石の予約と持続処理を追加"
```

---

### Task 5: Observer Repayment Processing

**Files:**
- Modify: `game/logic/cards-internal/ribo-time-stop.ts`
- Modify: `game/logic/cards.ts`
- Modify: `game/turn/turn_pipeline_phases.ts`
- Test: `test/game.observer-will-repayment.test.ts`

- [ ] **Step 1: Write failing repayment tests**

Create `test/game.observer-will-repayment.test.ts`:

```ts
const CardLogic = require('../game/logic/cards.js');

function boardWithBlackStones() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(0));
  board[0][0] = 1;
  board[0][1] = 1;
  board[0][2] = 1;
  board[0][3] = 1;
  board[0][4] = 1;
  return board;
}

describe('OBSERVER_WILL repayment', () => {
  test('active repayment subtracts charge for nine owner turns', () => {
    const cardState = CardLogic.createInitialCardState({ black: [], white: [] });
    const gameState = { board: boardWithBlackStones(), currentPlayer: 1, turnNumber: 30 };
    cardState.charge.black = 30;
    cardState.observerWillRepaymentsByPlayer.black = [{
      sourceType: 'OBSERVER_WILL',
      status: 'active',
      markerId: 1,
      stolenCardId: 'meteor_01',
      stolenCardCopyId: 9,
      originalCost: 12,
      repaymentAmount: 3,
      remainingOwnerTurns: 9,
      shortageDestroyCount: 4
    }];

    const summary = CardLogic.processObserverWillRepaymentsAtTurnStart(cardState, gameState, 'black', { random: () => 0 });

    expect(summary.entries[0]).toEqual(expect.objectContaining({
      repaid: 3,
      remainingOwnerTurnsAfter: 8,
      shortage: false
    }));
    expect(cardState.charge.black).toBe(27);
  });

  test('shortage destroys four own stones instead of subtracting charge', () => {
    const cardState = CardLogic.createInitialCardState({ black: [], white: [] });
    const gameState = { board: boardWithBlackStones(), currentPlayer: 1, turnNumber: 30 };
    cardState.charge.black = 1;
    cardState.observerWillRepaymentsByPlayer.black = [{
      sourceType: 'OBSERVER_WILL',
      status: 'active',
      markerId: 1,
      stolenCardId: 'meteor_01',
      stolenCardCopyId: 9,
      originalCost: 12,
      repaymentAmount: 3,
      remainingOwnerTurns: 9,
      shortageDestroyCount: 4
    }];

    const summary = CardLogic.processObserverWillRepaymentsAtTurnStart(cardState, gameState, 'black', { random: () => 0 });

    expect(summary.entries[0].shortage).toBe(true);
    expect(summary.entries[0].destroyedCount).toBe(4);
    expect(cardState.charge.black).toBe(1);
  });
});
```

- [ ] **Step 2: Run repayment tests to verify they fail**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.observer-will-repayment.test.ts
```

Expected: fail because repayment processing does not exist.

- [ ] **Step 3: Add repayment processing**

In `game/logic/cards-internal/ribo-time-stop.ts`, add `processObserverWillRepaymentsAtTurnStart`. Reuse `collectRiboDestroyableOwnStonePositions`, `sampleRandomPositions`, `addChargeValue`, and `runBoardOpsDestroyBlock`.

Use this result shape:

```ts
const summary = {
  entries: [],
  totalRepaid: 0,
  totalDestroyed: 0,
  completedCount: 0
};
```

For each active entry:

```ts
const remainingAfter = Math.max(0, remainingOwnerTurns - 1);
if (chargeBefore >= repaymentAmount) {
  const deltaRes = deps.addChargeValue(cardState, playerKey, -repaymentAmount, 'observer_will_repayment');
  entry.repaid = Math.max(0, -(Number(deltaRes && deltaRes.delta) || 0));
} else {
  entry.shortage = true;
  const targets = deps.sampleRandomPositions(
    collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey, deps),
    shortageDestroyCount,
    prng
  );
  deps.runBoardOpsDestroyBlock(cardState, gameState, () => {
    for (const target of targets) {
      const destroyRes = deps.BoardOpsModule.destroyAt(
        cardState,
        gameState,
        target.row,
        target.col,
        'OBSERVER_WILL',
        'observer_will_repayment_shortage',
        { owner: playerKey }
      );
      if (destroyRes && destroyRes.destroyed) entry.destroyed.push({ row: target.row, col: target.col });
    }
  }, { randomSource: prng });
}
```

Keep waiting entries in the array without decrementing them.

- [ ] **Step 4: Include observer repayment in `CardLogic.onTurnStart`**

In `game/logic/cards.ts`, call the new function from the same turn-start path that calls `processRiboWillTurnStartEffects`, returning:

```ts
observerWillRepayments: observerRepaymentSummary
```

- [ ] **Step 5: Emit observer raw events**

In `game/turn/turn_pipeline_phases.ts`, after RIBO event emission, add:

```ts
if (turnStartSummary && turnStartSummary.observerWillRepayments && Array.isArray(turnStartSummary.observerWillRepayments.entries)) {
  for (const entry of turnStartSummary.observerWillRepayments.entries) {
    if (!entry) continue;
    if (entry.shortage) {
      events.push({
        type: 'observer_will_shortage',
        player: playerKey,
        destroyed: Array.isArray(entry.destroyed) ? entry.destroyed.slice() : [],
        destroyedCount: Number(entry.destroyedCount) || 0,
        remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
        completed: entry.completed === true
      });
    } else {
      events.push({
        type: 'observer_will_repaid',
        player: playerKey,
        repaid: Number(entry.repaid) || 0,
        remainingOwnerTurns: Number(entry.remainingOwnerTurnsAfter) || 0,
        completed: entry.completed === true
      });
    }
  }
}
```

- [ ] **Step 6: Run repayment tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.observer-will-repayment.test.ts test/game.ribo-will.test.ts
```

Expected: both suites pass.

- [ ] **Step 7: Commit Task 5**

Run:

```powershell
git add -- game/logic/cards-internal/ribo-time-stop.ts game/logic/cards.ts game/turn/turn_pipeline_phases.ts test/game.observer-will-repayment.test.ts
git commit -m "観測者の返済処理を追加"
```

---

### Task 6: Snapshot Projection for Constant Hand Reveal

**Files:**
- Modify: `utils/match-authority.ts`
- Modify: `utils/owner-helpers.ts` if local projection helper parity requires it.
- Test: `test/utils.match-authority.public-snapshot.test.ts`
- Test: `test/workers.match-reveal-hand-visibility.test.ts`

- [ ] **Step 1: Write failing projection test**

Add this test to `test/utils.match-authority.public-snapshot.test.ts`:

```ts
test('projectSnapshotForViewer reveals opponent hand to active observer will marker owner only', () => {
  const snapshot = createSnapshot();
  snapshot.cardState.hands.black = ['own_card'];
  snapshot.cardState.hands.white = ['meteor_01', 'guard_01'];
  snapshot.cardState.markers = [{
    id: 'obs-1',
    kind: 'specialStone',
    row: 2,
    col: 3,
    owner: 'black',
    data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
  }];

  const blackView = MatchAuthority.projectSnapshotForViewer(snapshot, 'black');
  const whiteView = MatchAuthority.projectSnapshotForViewer(snapshot, 'white');
  const observerView = MatchAuthority.projectSnapshotForViewer(snapshot, null);

  expect(blackView.cardState.hands.white).toEqual(['meteor_01', 'guard_01']);
  expect(whiteView.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
  expect(observerView.cardState.hands.white).toEqual(['__hidden_hand__:white:0', '__hidden_hand__:white:1']);
});
```

- [ ] **Step 2: Run projection test to verify it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/utils.match-authority.public-snapshot.test.ts
```

Expected: fail because active observer marker does not affect projection.

- [ ] **Step 3: Add marker-owner projection helper**

In `utils/match-authority.ts`, add:

```ts
function hasActiveObserverWillReveal(snapshot: MatchAuthorityPublicSnapshot, viewer: PlayerKey | null, ownerKey: PlayerKey): boolean {
  if (!viewer || viewer === ownerKey) return false;
  const cardState = snapshot && snapshot.cardState && typeof snapshot.cardState === 'object'
    ? asRecord(snapshot.cardState)
    : null;
  const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
  return markers.some((marker: unknown) => {
    const entry = asRecord(marker);
    const data = asRecord(entry.data);
    if (entry.owner !== viewer) return false;
    if (String(data.type || '').toUpperCase() !== 'OBSERVER_WILL') return false;
    const remaining = Number(data.remainingOwnerTurns);
    return !Number.isFinite(remaining) || remaining > 0;
  });
}
```

Then change the hand projection branch:

```ts
if (canViewerInspectOwnerHand(shot, viewer, ownerKey) || hasActiveObserverWillReveal(shot, viewer, ownerKey)) {
  projectedHands[ownerKey] = ownerHand.slice();
  continue;
}
```

- [ ] **Step 4: Add Worker visibility regression**

Add a worker-side test mirroring `test/workers.match-reveal-hand-visibility.test.ts`, using a snapshot containing `OBSERVER_WILL` marker and asserting the owner seat sees real opponent hand IDs while the other seat receives hidden tokens.

Use this expected assertion:

```ts
expect(projectedForOwner.cardState.hands.white).toEqual(['meteor_01', 'guard_01']);
expect(projectedForOpponent.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
```

- [ ] **Step 5: Run projection tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/utils.match-authority.public-snapshot.test.ts test/workers.match-reveal-hand-visibility.test.ts
```

Expected: both suites pass.

- [ ] **Step 6: Commit Task 6**

Run:

```powershell
git add -- utils/match-authority.ts utils/owner-helpers.ts test/utils.match-authority.public-snapshot.test.ts test/workers.match-reveal-hand-visibility.test.ts
git commit -m "観測石による手札公開投影を追加"
```

---

### Task 7: Overlay UI and Pending Action Payload

**Files:**
- Modify: `cards/card-interaction-overlay-selection.ts`
- Modify: `cards/card-interaction-overlay-view.ts`
- Modify: `game/card-effects/selection-flow.ts`
- Modify: `cards/card-interaction-detail-actions.ts`
- Test: `test/ui.heaven-blessing-overlay.test.ts`
- Test: `test/game.card-effects.selection-flow.test.ts`

- [ ] **Step 1: Write failing overlay action test**

Add to `test/game.card-effects.selection-flow.test.ts`:

```ts
test('createPendingSelectionAction maps OBSERVER_WILL payload to observerWillTargetIndex', () => {
  const cardState = {
    pendingEffectByPlayer: {
      black: {
        type: 'OBSERVER_WILL',
        stage: 'selectTarget',
        cardId: 'observer_will_01',
        pendingEffectId: 'pending_observer_1'
      }
    }
  };

  const action = selectionFlow.createPendingSelectionAction(
    'black',
    'OBSERVER_WILL',
    { observerWillTargetIndex: 2 },
    { cardState }
  );

  expect(action).toEqual(expect.objectContaining({
    type: 'place',
    player: 'black',
    observerWillTargetIndex: 2,
    useCardId: 'observer_will_01',
    useCardOwnerKey: 'black'
  }));
  expect(action.pendingSelectionState).toEqual(expect.objectContaining({
    type: 'OBSERVER_WILL',
    pendingEffectId: 'pending_observer_1'
  }));
});
```

- [ ] **Step 2: Run action test to verify it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.card-effects.selection-flow.test.ts
```

Expected: fail because `observerWillTargetIndex` is not mapped.

- [ ] **Step 3: Add pending selection action mapping**

In `game/card-effects/selection-flow.ts`, add `observerWillTargetIndex` to the payload extraction:

```ts
if (pendingType === 'OBSERVER_WILL' && Number.isInteger(Number(payload.observerWillTargetIndex))) {
  action.observerWillTargetIndex = Number(payload.observerWillTargetIndex);
}
```

- [ ] **Step 4: Add overlay click mapping**

In `cards/card-interaction-overlay-selection.ts`, add:

```ts
function handleObserverWillSelection(playerKey: any, targetIndex: any, deps: OverlaySelectionDeps) {
  const action = createPendingSelectionAction(playerKey, 'OBSERVER_WILL', {
    observerWillTargetIndex: Number(targetIndex)
  }, deps);
  return deps.dispatchPendingSelectionAction(action);
}
```

Wire this branch where `HEAVEN_BLESSING` and `CONDEMN_WILL` branches are selected:

```ts
if (pending.type === 'OBSERVER_WILL') {
  return handleObserverWillSelection(playerKey, offer.handIndex, deps);
}
```

- [ ] **Step 5: Ensure overlay labels are clear**

In `cards/card-interaction-detail-actions.ts`, add prompt text:

```ts
OBSERVER_WILL: '奪う相手手札を選んでください',
```

- [ ] **Step 6: Add UI overlay test**

Add to `test/ui.heaven-blessing-overlay.test.ts`:

```ts
test('OBSERVER_WILL sends selected opponent hand index', () => {
  const actions: any[] = [];
  renderOverlay({
    pending: {
      type: 'OBSERVER_WILL',
      stage: 'selectTarget',
      cardId: 'observer_will_01',
      offers: [
        { handIndex: 0, cardId: 'meteor_01' },
        { handIndex: 2, cardId: 'guard_01' }
      ]
    },
    playerKey: 'black',
    dispatchAction: (action: any) => actions.push(action)
  });

  const offers = document.querySelectorAll('.heaven-offer-card');
  expect(offers).toHaveLength(2);
  (offers[1] as HTMLElement).click();

  expect(actions[0]).toEqual(expect.objectContaining({
    observerWillTargetIndex: 2
  }));
});
```

Use the existing helper names in that file for rendering; keep the assertion shape exactly as above.

- [ ] **Step 7: Run overlay tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.card-effects.selection-flow.test.ts test/ui.heaven-blessing-overlay.test.ts
```

Expected: both suites pass.

- [ ] **Step 8: Commit Task 7**

Run:

```powershell
git add -- cards/card-interaction-overlay-selection.ts cards/card-interaction-overlay-view.ts game/card-effects/selection-flow.ts cards/card-interaction-detail-actions.ts test/ui.heaven-blessing-overlay.test.ts test/game.card-effects.selection-flow.test.ts
git commit -m "観測者の選択オーバーレイを接続"
```

---

### Task 8: CPU Selection and Card Use Policy

**Files:**
- Modify: `game/turn-handlers/pending-target-selector.ts`
- Modify: `game/cpu-decision.ts`
- Modify: `game/cpu-turn-handler.ts`
- Modify: `game/ai/cpu-policy-card-profiles.ts`
- Modify: `game/ai/cpu-policy-card-type-flags.ts`
- Modify: `game/ai/cpu-policy-core.ts`
- Test: `test/game.pending-target-selector.test.ts`
- Test: `test/cpu.turn-handler.pending.test.ts`
- Test: `test/cpu.decision.refactor.test.ts`

- [ ] **Step 1: Write failing CPU pending selector test**

Add to `test/game.pending-target-selector.test.ts`:

```ts
test('OBSERVER_WILL chooses the highest value opponent hand offer', () => {
  const action = PendingTargetSelector.buildPendingSelectionAction({
    playerKey: 'black',
    pending: {
      type: 'OBSERVER_WILL',
      stage: 'selectTarget',
      offers: [
        { handIndex: 0, cardId: 'guard_01' },
        { handIndex: 1, cardId: 'meteor_01' }
      ]
    },
    cardLogic: {
      getCardCost: (cardId: string) => cardId === 'meteor_01' ? 12 : 3,
      getCardDef: (cardId: string) => ({ id: cardId, type: cardId === 'meteor_01' ? 'METEOR_WILL' : 'GUARD_WILL' })
    }
  });

  expect(action).toEqual({ type: 'place', observerWillTargetIndex: 1 });
});
```

Use the existing exported selector function name in `pending-target-selector.ts`; if that file exports a different public entry, add the assertion to the nearest existing pending action test.

- [ ] **Step 2: Run CPU selector test to verify it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.pending-target-selector.test.ts
```

Expected: fail because `OBSERVER_WILL` is not handled.

- [ ] **Step 3: Add CPU target selection**

In `game/turn-handlers/pending-target-selector.ts`, add:

```ts
function buildObserverWillAction(context: any) {
  const offers = context.pending && Array.isArray(context.pending.offers) ? context.pending.offers : [];
  if (!offers.length || !context.cardLogic) return createCancelCardAction();
  let best = offers[0];
  let bestScore = -Infinity;
  for (const offer of offers) {
    const cost = typeof context.cardLogic.getCardCost === 'function' ? Number(context.cardLogic.getCardCost(offer.cardId)) || 0 : 0;
    const score = cost + (String(offer.cardId || '').includes('will') ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = offer;
    }
  }
  return { type: 'place', observerWillTargetIndex: best.handIndex };
}
```

Add:

```ts
case 'OBSERVER_WILL': return buildObserverWillAction(context);
```

- [ ] **Step 4: Add CPU handler names**

In `game/cpu-turn-handler.ts`, add handling for `cpuSelectObserverWillWithPolicy` following the `CONDEMN_WILL` pattern and returning an action containing `observerWillTargetIndex`.

In `game/cpu-decision.ts`, add:

```ts
function cpuSelectObserverWillWithPolicy(cardState: any, playerKey: string) {
  const pending = readPendingEffect(cardState, playerKey);
  const offers = pending && Array.isArray(pending.offers) ? pending.offers : [];
  if (!offers.length) return null;
  let target = offers[0];
  let bestScore = -Infinity;
  for (const offer of offers) {
    const cost = typeof CardLogic.getCardCost === 'function' ? Number(CardLogic.getCardCost(offer.cardId)) || 0 : 0;
    if (cost > bestScore) {
      bestScore = cost;
      target = offer;
    }
  }
  return createPendingSelectionAction(playerKey, 'OBSERVER_WILL', { observerWillTargetIndex: target.handIndex });
}
```

Export it through the same public object that exports `cpuSelectCondemnWillWithPolicy`.

- [ ] **Step 5: Add policy profile entries**

Add `OBSERVER_WILL` to CPU card type flags and profiles with a mid-late bias:

```ts
OBSERVER_WILL: { openingBias: -6, midLateBias: 6, endgameBias: -2, handPressureBias: 4, trailingBias: 3 }
```

Set its category to hand interaction/economy cycle near `CONDEMN_WILL`.

- [ ] **Step 6: Run CPU tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.pending-target-selector.test.ts test/cpu.turn-handler.pending.test.ts test/cpu.decision.refactor.test.ts
```

Expected: all three suites pass.

- [ ] **Step 7: Commit Task 8**

Run:

```powershell
git add -- game/turn-handlers/pending-target-selector.ts game/cpu-decision.ts game/cpu-turn-handler.ts game/ai/cpu-policy-card-profiles.ts game/ai/cpu-policy-card-type-flags.ts game/ai/cpu-policy-core.ts test/game.pending-target-selector.test.ts test/cpu.turn-handler.pending.test.ts test/cpu.decision.refactor.test.ts
git commit -m "CPUに盤理の観測者選択を追加"
```

---

### Task 9: Network Payload, Worker Parity, and Playback

**Files:**
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-runtime-preload.ts`
- Modify: `utils/match-authority.ts`
- Modify: `shared/playback-event-helpers.ts`
- Modify: `game/turn/pipeline-ui/sound-cues.ts` if sound cue mapping is required by existing event contracts.
- Test: `test/workers.match-pending-effect-id.test.ts`
- Test: `test/workers.match-publish-sanitize.test.ts`
- Test: `test/network.playback-event-assembly.contract.test.ts`

- [ ] **Step 1: Write failing worker action test**

Add a scenario to `test/workers.match-pending-effect-id.test.ts` that publishes a pending `OBSERVER_WILL` selection:

```ts
test('observer will follow-up steals selected opponent hand card without leaking hidden token', () => {
  const result = runHandFollowupScenario({ kind: 'observer_will' });

  expect(result.status).toBe(200);
  expect(result.payload.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
  expect(result.internalCardState.hands.black).toEqual(expect.arrayContaining(['guard_01']));
  expect(result.internalCardState.hands.white).not.toEqual(expect.arrayContaining(['guard_01']));
  expect(result.internalCardState.hands.black).not.toEqual(expect.arrayContaining(['__hidden_hand__:white:1']));
});
```

Extend the local `runHandFollowupScenario` fixture with:

```ts
observer_will: {
  pending: {
    type: 'OBSERVER_WILL',
    stage: 'selectTarget',
    cardId: 'observer_will_01',
    sourceHandIndex: 0,
    pendingEffectId: 'pending_hand_1',
    offers: [{ handIndex: 0, cardId: 'meteor_01' }, { handIndex: 1, cardId: 'guard_01' }]
  },
  action: {
    observerWillTargetIndex: 1,
    pendingSelectionState: {
      type: 'OBSERVER_WILL',
      stage: 'selectTarget',
      cardId: 'observer_will_01',
      pendingEffectId: 'pending_hand_1'
    },
    useCardId: 'observer_will_01',
    useCardOwnerKey: 'black'
  }
}
```

- [ ] **Step 2: Run worker pending test to verify it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-pending-effect-id.test.ts
```

Expected: fail because `observerWillTargetIndex` is not accepted or not resolved.

- [ ] **Step 3: Add action allowlist and sanitize support**

In Worker publish action validation, add `observerWillTargetIndex` anywhere `condemnTargetIndex` is accepted for pending follow-up actions:

```ts
observerWillTargetIndex: Number.isInteger(Number(action.observerWillTargetIndex))
  ? Number(action.observerWillTargetIndex)
  : undefined
```

Ensure sanitize code keeps only numeric indices and never accepts a client-provided real `cardId` as the selected target.

- [ ] **Step 4: Add playback mapping**

In `shared/playback-event-helpers.ts`, map `observer_will_selected` to:

```ts
{ type: 'hand_remove', targets: [{ player: opponentKey, cardId: stolenCardId, reason: 'observer_will' }] }
{ type: 'hand_add', targets: [{ player: playerKey, cardId: stolenCardId, reason: 'observer_will' }] }
```

Keep the board visual event for `observer_will_marker_applied` as a normal status/special-stone application event if the existing marker presentation mapper already handles it.

- [ ] **Step 5: Add playback contract test**

Add to `test/network.playback-event-assembly.contract.test.ts`:

```ts
{
  label: 'observer will hand steal',
  cardId: 'observer_will_01',
  pendingType: 'OBSERVER_WILL',
  pendingExtra: { offers: [{ handIndex: 0, cardId: 'meteor_01' }, { handIndex: 1, cardId: 'guard_01' }] },
  actionPayload: { observerWillTargetIndex: 1 },
  expectedHandRemove: { player: 'white', cardId: 'guard_01', reason: 'observer_will' },
  expectedHandAdd: { player: 'black', cardId: 'guard_01', reason: 'observer_will' }
}
```

Use the fixture format already used in that file.

- [ ] **Step 6: Run network tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-pending-effect-id.test.ts test/workers.match-publish-sanitize.test.ts test/network.playback-event-assembly.contract.test.ts
```

Expected: all three suites pass.

- [ ] **Step 7: Commit Task 9**

Run:

```powershell
git add -- workers/match-worker.ts workers/match-worker-runtime-preload.ts utils/match-authority.ts shared/playback-event-helpers.ts game/turn/pipeline-ui/sound-cues.ts test/workers.match-pending-effect-id.test.ts test/workers.match-publish-sanitize.test.ts test/network.playback-event-assembly.contract.test.ts
git commit -m "観測者のネットワーク選択を追加"
```

---

### Task 10: End-to-End Verification and Worker Mirror

**Files:**
- Modify generated mirror: `worker-public/**`
- Modify generated: `public/module-registry.js`
- Test: focused suites listed below

- [ ] **Step 1: Run focused observer test bundle**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.observer-will-cost-ledger.test.ts test/game.observer-will-selection.test.ts test/game.observer-will-marker.test.ts test/game.observer-will-repayment.test.ts test/utils.match-authority.public-snapshot.test.ts test/ui.heaven-blessing-overlay.test.ts test/game.card-effects.selection-flow.test.ts test/game.pending-target-selector.test.ts test/workers.match-pending-effect-id.test.ts test/network.playback-event-assembly.contract.test.ts
```

Expected: all listed suites pass.

- [ ] **Step 2: Run catalog and special foundation regression**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/cards.catalog.test.ts test/assets.manifest.test.ts test/special-card-foundation.test.ts test/shared.special-stone-registry.test.ts test/ui.visual-effects-map.shared.test.ts
```

Expected: all listed suites pass.

- [ ] **Step 3: Run TypeScript checks**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 4: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: command exits 0 and prints `mirror-verified`.

- [ ] **Step 5: Inspect final status**

Run:

```powershell
git status --short
git diff --name-only
```

Expected: changed files are only files intentionally touched by this plan plus generated `worker-public/**` and `public/module-registry.js`. Existing unrelated dirty files must remain unstaged.

- [ ] **Step 6: Commit Task 10**

Run:

```powershell
git add -- public/module-registry.js worker-public cards/catalog.js cards/catalog.ts cards/catalog.generated.js
git commit -m "盤理の観測者のworker mirrorを更新"
```

Only run this commit if the generated mirror changes are separable from unrelated pre-existing worker-public changes. If not separable, leave generated files unstaged and report the exact overlapping paths.

---

## Final Acceptance Checklist

- [ ] `observer_will_01` exists in the catalog and is visible only as intended by deck rules.
- [ ] Card use is rejected before turn 18 and accepted at turn 18+ with opponent hand offers.
- [ ] Selection uses `observerWillTargetIndex`.
- [ ] Selected opponent card moves to the user hand and becomes 0-cost by copy ID.
- [ ] Non-selected opponent hand cards get +5 cost by copy ID.
- [ ] Next own placement creates a 5T absolute-protected `OBSERVER_WILL` marker.
- [ ] Active marker reveals the opponent hand only to marker owner in projected snapshots.
- [ ] Expired marker reverts to a normal stone and activates repayment.
- [ ] Repayment runs on owner turn start up to nine times.
- [ ] Repayment shortage destroys four own stones.
- [ ] CPU can select and resolve observer pending choices.
- [ ] Worker publish/sanitize/projection paths do not leak hidden hand tokens.
- [ ] `npm run worker:prepare` passes or overlapping generated dirty files are reported.
