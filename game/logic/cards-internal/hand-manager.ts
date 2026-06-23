/**
 * @file hand-manager.ts
 * @description Card hand management shared between Browser and Headless.
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const CardMarkersModule = safeRequire('../cards/markers');
const ManifestStoneRegistryModule = safeRequire('../../../shared/manifest-stone-registry');
const SpecialCardRegistryModule = safeRequire('../../../shared/special-card-registry');
const BoardExecutorResolutionModule = safeRequire('../card-resolution/board-executor');
const CardUsagePrechecksModule = safeRequire('./card-usage-prechecks');

interface Context {
    constants?: any;
    helpers?: any;
    modules?: any;
}

interface Constants {
    CARD_DEFS: any[];
    CARD_TYPE_BY_ID: Record<string, string>;
    MAX_HAND_SIZE: number;
    RIBO_WILL_UNLOCK_TURN_INDEX: number;
}

interface HandResult {
    cardId?: string;
    cardCopyId?: number;
    handIndex?: number;
    discardIndex?: number;
    destroyedCards?: string[];
    destroyedCopyIds?: number[];
    keptCards?: string[];
    keptCopyIds?: number[];
}

interface DestroyResult {
    applied: boolean;
    reason?: string;
    destroyedCardId?: string;
    destroyedCardCopyId?: number;
}

function getConstants(context: Context): Constants {
    const constants = (context && context.constants) || {};
    return {
        CARD_DEFS: Array.isArray(constants.CARD_DEFS) ? constants.CARD_DEFS : [],
        CARD_TYPE_BY_ID: (constants.CARD_TYPE_BY_ID && typeof constants.CARD_TYPE_BY_ID === 'object') ? constants.CARD_TYPE_BY_ID : {},
        MAX_HAND_SIZE: Number.isFinite(Number(constants.MAX_HAND_SIZE))
            ? Math.max(0, Math.trunc(Number(constants.MAX_HAND_SIZE)))
            : 5,
        RIBO_WILL_UNLOCK_TURN_INDEX: Number.isFinite(Number(constants.RIBO_WILL_UNLOCK_TURN_INDEX))
            ? Math.trunc(Number(constants.RIBO_WILL_UNLOCK_TURN_INDEX))
            : 19
    };
}

function getHelpers(context: Context): any {
    return (context && context.helpers) || {};
}

function isManifestStoneType(rawType: any): boolean {
    if (ManifestStoneRegistryModule && typeof ManifestStoneRegistryModule.isManifestStoneType === 'function') {
        return ManifestStoneRegistryModule.isManifestStoneType(rawType) === true;
    }
    const type = String(rawType || '').trim().toUpperCase();
    return type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL';
}

function getModules(context: Context): any {
    return (context && context.modules) || {};
}

function getCardDefsModule(context: Context): any {
    const modules = getModules(context);
    return modules.CardDefsModule || modules.cardDefsModule || null;
}

function getCardCostsModule(context: Context): any {
    const modules = getModules(context);
    return modules.CardCostsModule || modules.cardCostsModule || null;
}

function getBoardExecutorResolutionModule(context: Context): any {
    const modules = getModules(context);
    return modules.CardBoardExecutorResolutionModule
        || modules.BoardExecutorResolutionModule
        || BoardExecutorResolutionModule
        || null;
}

function getCardSelectorsModule(context: Context): any {
    const modules = getModules(context);
    return modules.CardSelectorsModule || modules.cardSelectorsModule || null;
}

function normalizestring(playerKey: string): string {
    return playerKey === 'white' ? 'white' : 'black';
}

function ensureHands(cardState: any): Record<string, string[]> {
    if (!cardState || typeof cardState !== 'object') return { black: [], white: [] };
    if (!cardState.hands || typeof cardState.hands !== 'object') {
        (cardState as any).hands = { black: [], white: [] };
        return (cardState as any).hands;
    }
    if (!Array.isArray(cardState.hands.black)) (cardState as any).hands.black = [];
    if (!Array.isArray(cardState.hands.white)) (cardState as any).hands.white = [];
    return cardState.hands as Record<string, string[]>;
}

function ensureDecks(cardState: any): Record<string, string[]> {
    if (!cardState || typeof cardState !== 'object') return { black: [], white: [] };
    if (!cardState.decks || typeof cardState.decks !== 'object') {
        (cardState as any).decks = {
            black: Array.isArray((cardState as any).deck) ? (cardState as any).deck.slice() : [],
            white: []
        };
        return (cardState as any).decks;
    }
    if (!Array.isArray(cardState.decks.black)) {
        (cardState as any).decks.black = Array.isArray((cardState as any).deck) ? (cardState as any).deck.slice() : [];
    }
    if (!Array.isArray(cardState.decks.white)) (cardState as any).decks.white = [];
    return cardState.decks as Record<string, string[]>;
}

function ensureDiscard(cardState: any): string[] {
    if (!cardState || typeof cardState !== 'object') return [];
    if (!Array.isArray(cardState.discard)) (cardState as any).discard = [];
    return cardState.discard as string[];
}

function ensureCopySeq(cardState: any): number {
    if (!cardState || typeof cardState !== 'object') return 1;
    const existing = Number((cardState as any)._nextCardCopySeq);
    const next = Number.isInteger(existing) && existing > 0 ? existing : 1;
    (cardState as any)._nextCardCopySeq = next;
    return next;
}

function allocateNextCardCopyId(cardState: any): number {
    const next = ensureCopySeq(cardState);
    (cardState as any)._nextCardCopySeq = next + 1;
    return next;
}

function normalizeSingleCopyId(cardState: any, value: any): number {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric > 0) return numeric;
    return allocateNextCardCopyId(cardState);
}

function ensurePlayerCopyIdBuckets(cardState: any, fieldName: string): Record<string, number[]> {
    if (!cardState || typeof cardState !== 'object') {
        return { black: [], white: [] };
    }
    if (!(cardState as any)[fieldName] || typeof (cardState as any)[fieldName] !== 'object') {
        (cardState as any)[fieldName] = { black: [], white: [] };
        return (cardState as any)[fieldName];
    }
    if (!Array.isArray((cardState as any)[fieldName].black)) (cardState as any)[fieldName].black = [];
    if (!Array.isArray((cardState as any)[fieldName].white)) (cardState as any)[fieldName].white = [];
    return (cardState as any)[fieldName];
}

function normalizeCopyIdArray(cardState: any, source: any[], targetLength: number): number[] {
    const length = Number.isFinite(Number(targetLength))
        ? Math.max(0, Math.trunc(Number(targetLength)))
        : 0;
    const next = Array.isArray(source) ? source.slice(0, length) : [];
    for (let index = 0; index < length; index += 1) {
        next[index] = normalizeSingleCopyId(cardState, next[index]);
    }
    return next;
}

function normalizeRevealCopyIdList(source: any[]): number[] {
    const next: number[] = [];
    const seen = new Set<number>();
    const values = Array.isArray(source) ? source : [];
    for (const rawValue of values) {
        const numeric = Number(rawValue);
        if (!Number.isInteger(numeric) || numeric <= 0 || seen.has(numeric)) continue;
        seen.add(numeric);
        next.push(numeric);
    }
    return next;
}

function ensureCardCostOverrideLedger(cardState: any): Record<string, any> {
    if (!cardState || typeof cardState !== 'object') return {};
    if (!(cardState as any).cardCostOverridesByCopyId || typeof (cardState as any).cardCostOverridesByCopyId !== 'object') {
        (cardState as any).cardCostOverridesByCopyId = {};
    }
    return (cardState as any).cardCostOverridesByCopyId;
}

function ensureCardCostModifierLedger(cardState: any): Record<string, any[]> {
    if (!cardState || typeof cardState !== 'object') return {};
    if (!(cardState as any).cardCostModifiersByCopyId || typeof (cardState as any).cardCostModifiersByCopyId !== 'object') {
        (cardState as any).cardCostModifiersByCopyId = {};
    }
    return (cardState as any).cardCostModifiersByCopyId;
}

function normalizePositiveCopyId(cardCopyId: any): number | null {
    const numeric = Number(cardCopyId);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;
    return numeric;
}

function syncNextCardCopySeq(cardState: any, buckets: any[][]): number {
    if (!cardState || typeof cardState !== 'object') return 1;
    let maxCopyId = 0;
    const sources = Array.isArray(buckets) ? buckets : [];
    for (const bucket of sources) {
        if (!Array.isArray(bucket)) continue;
        for (const rawValue of bucket) {
            const numeric = Number(rawValue);
            if (Number.isInteger(numeric) && numeric > maxCopyId) {
                maxCopyId = numeric;
            }
        }
    }
    const next = ensureCopySeq(cardState);
    if (maxCopyId >= next) {
        (cardState as any)._nextCardCopySeq = maxCopyId + 1;
    }
    return (cardState as any)._nextCardCopySeq;
}

function ensureCardCopyState(cardState: any): any {
    if (!cardState || typeof cardState !== 'object') return null;
    ensureCopySeq(cardState);
    const hands = ensureHands(cardState);
    const decks = ensureDecks(cardState);
    const discard = ensureDiscard(cardState);

    const handCopyIdsByPlayer = ensurePlayerCopyIdBuckets(cardState, '_handCopyIdsByPlayer');
    handCopyIdsByPlayer.black = normalizeCopyIdArray(cardState, handCopyIdsByPlayer.black, hands.black.length);
    handCopyIdsByPlayer.white = normalizeCopyIdArray(cardState, handCopyIdsByPlayer.white, hands.white.length);

    const deckCopyIdsByPlayer = ensurePlayerCopyIdBuckets(cardState, '_deckCopyIdsByPlayer');
    deckCopyIdsByPlayer.black = normalizeCopyIdArray(cardState, deckCopyIdsByPlayer.black, decks.black.length);
    deckCopyIdsByPlayer.white = normalizeCopyIdArray(cardState, deckCopyIdsByPlayer.white, decks.white.length);

    (cardState as any)._discardCopyIds = normalizeCopyIdArray(cardState, (cardState as any)._discardCopyIds, discard.length);

    const revealedHandCopyIdsByViewer = ensurePlayerCopyIdBuckets(cardState, '_revealedHandCopyIdsByViewer');
    revealedHandCopyIdsByViewer.black = normalizeRevealCopyIdList(revealedHandCopyIdsByViewer.black);
    revealedHandCopyIdsByViewer.white = normalizeRevealCopyIdList(revealedHandCopyIdsByViewer.white);
    ensureCardCostOverrideLedger(cardState);
    ensureCardCostModifierLedger(cardState);

    syncNextCardCopySeq(cardState, [
        handCopyIdsByPlayer.black,
        handCopyIdsByPlayer.white,
        deckCopyIdsByPlayer.black,
        deckCopyIdsByPlayer.white,
        (cardState as any)._discardCopyIds,
        revealedHandCopyIdsByViewer.black,
        revealedHandCopyIdsByViewer.white
    ]);

    return {
        handCopyIdsByPlayer,
        deckCopyIdsByPlayer,
        discardCopyIds: (cardState as any)._discardCopyIds,
        revealedHandCopyIdsByViewer
    };
}

function setCardCostOverrideForCopyId(cardState: any, cardCopyId: number, cost: number, sourceType?: string): boolean {
    const copyId = normalizePositiveCopyId(cardCopyId);
    const numericCost = Number(cost);
    if (!copyId || !Number.isFinite(numericCost)) return false;
    const overrides = ensureCardCostOverrideLedger(cardState);
    overrides[String(copyId)] = {
        cost: numericCost,
        sourceType: typeof sourceType === 'string' ? sourceType : null
    };
    return true;
}

function addCardCostModifierForCopyId(cardState: any, cardCopyId: number, delta: number, sourceType?: string): boolean {
    const copyId = normalizePositiveCopyId(cardCopyId);
    const numericDelta = Number(delta);
    if (!copyId || !Number.isFinite(numericDelta)) return false;
    const modifiers = ensureCardCostModifierLedger(cardState);
    const key = String(copyId);
    if (!Array.isArray(modifiers[key])) modifiers[key] = [];
    modifiers[key].push({
        delta: numericDelta,
        sourceType: typeof sourceType === 'string' ? sourceType : null
    });
    return true;
}

function getEffectiveCardCostForCopy(cardState: any, cardId: string, cardCopyId: number, context: Context): number {
    const baseCost = getCardCost(cardId, context);
    const copyId = normalizePositiveCopyId(cardCopyId);
    if (!copyId) return baseCost;
    const key = String(copyId);
    const overrides = ensureCardCostOverrideLedger(cardState);
    const override = overrides[key];
    const overrideCost = Number(override && override.cost);
    const startCost = Number.isFinite(overrideCost) ? overrideCost : baseCost;
    const modifiers = ensureCardCostModifierLedger(cardState);
    const entries = Array.isArray(modifiers[key]) ? modifiers[key] : [];
    const totalDelta = entries.reduce((sum, entry) => {
        const delta = Number(entry && entry.delta);
        return Number.isFinite(delta) ? sum + delta : sum;
    }, 0);
    return startCost + totalDelta;
}

function getHandCopyIdAt(cardState: any, playerKey: string, handIndex: number): number | null {
    const copyState = ensureCardCopyState(cardState);
    const ownerKey = normalizestring(playerKey);
    if (!copyState || !Number.isInteger(handIndex) || handIndex < 0) return null;
    const copyIds = copyState.handCopyIdsByPlayer[ownerKey];
    if (!Array.isArray(copyIds) || handIndex >= copyIds.length) return null;
    return copyIds[handIndex] || null;
}

function getHandCopyIds(cardState: any, playerKey: string): number[] {
    const copyState = ensureCardCopyState(cardState);
    const ownerKey = normalizestring(playerKey);
    if (!copyState) return [];
    return Array.isArray(copyState.handCopyIdsByPlayer[ownerKey])
        ? copyState.handCopyIdsByPlayer[ownerKey].slice()
        : [];
}

function isCardCopyIdRevealedToViewer(cardState: any, viewerKey: string, cardCopyId: number): boolean {
    const copyState = ensureCardCopyState(cardState);
    const viewer = normalizestring(viewerKey);
    const numeric = Number(cardCopyId);
    if (!copyState || !Number.isInteger(numeric) || numeric <= 0) return false;
    const revealed = copyState.revealedHandCopyIdsByViewer[viewer];
    return Array.isArray(revealed) && revealed.includes(numeric);
}

function revealCurrentHandToViewer(cardState: any, viewerKey: string, ownerKey: string): number[] {
    const copyState = ensureCardCopyState(cardState);
    if (!copyState) return [];
    const viewer = normalizestring(viewerKey);
    const owner = normalizestring(ownerKey);
    const handCopyIds = Array.isArray(copyState.handCopyIdsByPlayer[owner])
        ? copyState.handCopyIdsByPlayer[owner]
        : [];
    if (!handCopyIds.length) return [];
    const revealLedger = copyState.revealedHandCopyIdsByViewer[viewer];
    const seen = new Set(revealLedger);
    for (const copyId of handCopyIds) {
        if (!Number.isInteger(copyId) || copyId <= 0 || seen.has(copyId)) continue;
        revealLedger.push(copyId);
        seen.add(copyId);
    }
    return handCopyIds.slice();
}

function addCardToHand(cardState: any, playerKey: string, cardId: string, context: Context, opts?: any): HandResult | null {
    const { MAX_HAND_SIZE } = getConstants(context);
    const ownerKey = normalizestring(playerKey);
    const hands = ensureHands(cardState);
    const copyState = ensureCardCopyState(cardState);
    const hand = hands[ownerKey];
    const options = (opts && typeof opts === 'object') ? opts : {};
    if (!Array.isArray(hand)) return null;
    if (!options.ignoreHandLimit && hand.length >= MAX_HAND_SIZE) return null;
    const cardCopyId = normalizeSingleCopyId(cardState, options.cardCopyId);
    const requestedInsertIndex = Number(options.insertIndex);
    const insertIndex = Number.isInteger(requestedInsertIndex)
        ? Math.max(0, Math.min(hand.length, requestedInsertIndex))
        : hand.length;
    hand.splice(insertIndex, 0, cardId);
    copyState.handCopyIdsByPlayer[ownerKey].splice(insertIndex, 0, cardCopyId);
    return {
        cardId,
        cardCopyId,
        handIndex: insertIndex
    };
}

function addCardToDiscard(cardState: any, cardId: string, cardCopyId: number): HandResult {
    const discard = ensureDiscard(cardState);
    const copyState = ensureCardCopyState(cardState);
    const normalizedCopyId = normalizeSingleCopyId(cardState, cardCopyId);
    discard.push(cardId);
    copyState.discardCopyIds.push(normalizedCopyId);
    return {
        cardId,
        cardCopyId: normalizedCopyId,
        discardIndex: discard.length - 1
    };
}

function popDeckCard(cardState: any, playerKey: string): HandResult | null {
    const ownerKey = normalizestring(playerKey);
    const decks = ensureDecks(cardState);
    const copyState = ensureCardCopyState(cardState);
    const deck = Array.isArray(decks[ownerKey]) ? decks[ownerKey] : null;
    if (!deck || deck.length <= 0) return null;
    const cardId = deck.pop();
    const cardCopyId = normalizeSingleCopyId(
        cardState,
        copyState.deckCopyIdsByPlayer[ownerKey].pop()
    );
    return { cardId, cardCopyId };
}

function removeHandCardAt(cardState: any, playerKey: string, handIndex: number): HandResult | null {
    const ownerKey = normalizestring(playerKey);
    const hands = ensureHands(cardState);
    const copyState = ensureCardCopyState(cardState);
    const hand = Array.isArray(hands[ownerKey]) ? hands[ownerKey] : null;
    if (!hand || !Number.isInteger(handIndex) || handIndex < 0 || handIndex >= hand.length) return null;
    const cardId = hand.splice(handIndex, 1)[0];
    const cardCopyId = normalizeSingleCopyId(
        cardState,
        copyState.handCopyIdsByPlayer[ownerKey].splice(handIndex, 1)[0]
    );
    return { cardId, cardCopyId, handIndex };
}

function clearHandToDiscard(cardState: any, playerKey: string, context: Context, opts?: any): HandResult {
    const ownerKey = normalizestring(playerKey);
    const hands = ensureHands(cardState);
    const copyState = ensureCardCopyState(cardState);
    const hand = Array.isArray(hands[ownerKey]) ? hands[ownerKey] : null;
    if (!hand || hand.length <= 0) {
        return { destroyedCards: [], destroyedCopyIds: [] };
    }
    const options = opts || {};
    const isInviolableSpecialCardId = typeof options.isInviolableSpecialCardId === 'function'
        ? options.isInviolableSpecialCardId
        : () => false;
    const rawCards = hand.splice(0, hand.length);
    const rawCopyIds = copyState.handCopyIdsByPlayer[ownerKey].splice(0, copyState.handCopyIdsByPlayer[ownerKey].length);
    const keptCards: string[] = [];
    const keptCopyIds: number[] = [];
    const destroyedCards: string[] = [];
    const destroyedCopyIds: number[] = [];

    rawCards.forEach((cardId: string, index: number) => {
        const copyId = normalizeSingleCopyId(cardState, rawCopyIds[index]);
        if (isInviolableSpecialCardId(cardId)) {
            keptCards.push(cardId);
            keptCopyIds.push(copyId);
            return;
        }
        destroyedCards.push(cardId);
        destroyedCopyIds.push(copyId);
    });

    hand.push(...keptCards);
    copyState.handCopyIdsByPlayer[ownerKey].push(...keptCopyIds);
    ensureDiscard(cardState).push(...destroyedCards);
    copyState.discardCopyIds.push(...destroyedCopyIds);
    return { destroyedCards, destroyedCopyIds, keptCards, keptCopyIds };
}

function moveDiscardCardToHandByCardId(cardState: any, playerKey: string, cardId: string, context: Context, opts?: any): HandResult | null {
    const discard = ensureDiscard(cardState);
    const copyState = ensureCardCopyState(cardState);
    const discardIndex = discard.lastIndexOf(cardId);
    if (discardIndex < 0) return null;
    const removedCardId = discard.splice(discardIndex, 1)[0];
    const removedCopyId = normalizeSingleCopyId(cardState, copyState.discardCopyIds.splice(discardIndex, 1)[0]);
    const added = addCardToHand(cardState, playerKey, removedCardId, context, {
        ...(opts && typeof opts === 'object' ? opts : {}),
        cardCopyId: removedCopyId
    });
    if (added) return added;
    discard.splice(discardIndex, 0, removedCardId);
    copyState.discardCopyIds.splice(discardIndex, 0, removedCopyId);
    return null;
}

function hasTargets(targets: any[], minimumCount: number): boolean {
    const safeMinimumCount = Number.isFinite(Number(minimumCount))
        ? Math.max(1, Math.trunc(Number(minimumCount)))
        : 1;
    return Array.isArray(targets) && targets.length >= safeMinimumCount;
}

function invokeLocalSelector(context: Context, methodName: string, args: any[]): any {
    const helpers = getHelpers(context);
    const selector = helpers[methodName];
    if (typeof selector !== 'function') return null;
    try {
        return selector.apply(null, args);
    } catch (e) {
        return null;
    }
}

function invokeModuleSelector(context: Context, methodName: string, args: any[]): any {
    const selectorsModule = getCardSelectorsModule(context);
    if (!selectorsModule || typeof selectorsModule[methodName] !== 'function') return null;
    try {
        return selectorsModule[methodName].apply(selectorsModule, args);
    } catch (e) {
        return null;
    }
}

function requireLocalTargets(context: Context, methodName: string, args: any[], minimumCount: number): boolean {
    const targets = invokeLocalSelector(context, methodName, args);
    return targets === null ? true : hasTargets(targets, minimumCount);
}

function requireModuleTargets(context: Context, methodName: string, args: any[], minimumCount: number): boolean {
    const targets = invokeModuleSelector(context, methodName, args);
    return targets === null ? true : hasTargets(targets, minimumCount);
}

const USAGE_PRECHECK_TARGET_METHODS = [
    'getDestroyTargets',
    'getReverseWillTargets',
    'getTemptWillTargets',
    'getCaptureWillTargets',
    'getStrongWindTargets',
    'getBuoyancyTargets',
    'getSuperBuoyancyTargets',
    'getGravityTargets',
    'getSuperGravityTargets',
    'getSuperAttractionTargets',
    'getTrapTargets',
    'getGuardTargets',
    'getLivingWillTargets',
    'getExtendLifeTargets',
    'getCorrosionTargets',
    'getTimeBombTargets',
    'getTeleportTargets',
    'getCellTeleportTargets',
    'getCloneTargets',
    'getSwapTargets',
    'getPositionSwapTargets',
    'getBoardExpansionTargets',
    'getBoardExpansionGodTargets',
    'getBoardShrinkTargets',
    'getBoardShrinkGodTargets',
    'getBlockadeTargets',
    'getMeteorTargets',
    'getCausalReplayTargets',
    'getFreezeTargets',
    'getSeedTargets'
];

function resolveUsagePrecheckTargetResolver(context: Context, methodName: string): any {
    const helpers = getHelpers(context);
    if (typeof helpers[methodName] === 'function') {
        return helpers[methodName];
    }
    const selectorsModule = getCardSelectorsModule(context);
    if (selectorsModule && typeof selectorsModule[methodName] === 'function') {
        return function moduleTargetResolver(...args: any[]) {
            return selectorsModule[methodName].apply(selectorsModule, args);
        };
    }
    return undefined;
}

function buildUsagePrecheckTargetResolvers(context: Context): Record<string, any> {
    const resolvers: Record<string, any> = {};
    for (const methodName of USAGE_PRECHECK_TARGET_METHODS) {
        const resolver = resolveUsagePrecheckTargetResolver(context, methodName);
        if (typeof resolver === 'function') {
            resolvers[methodName] = resolver;
        }
    }
    return resolvers;
}

function passesUsagePreconditionsForUsableList(
    cardState: any,
    gameState: any,
    playerKey: string,
    cardId: string,
    cardType: string,
    context: Context
): boolean {
    if (!CardUsagePrechecksModule || typeof CardUsagePrechecksModule.validateCardUsagePreconditions !== 'function') {
        return true;
    }
    const helpers = getHelpers(context);
    const { RIBO_WILL_UNLOCK_TURN_INDEX } = getConstants(context);
    const heavenSeedHint = typeof helpers.buildHeavenBlessingSeedHint === 'function'
        ? helpers.buildHeavenBlessingSeedHint(cardState, playerKey)
        : '';
    const result = CardUsagePrechecksModule.validateCardUsagePreconditions({
        ...helpers,
        ...buildUsagePrecheckTargetResolvers(context),
        cardState,
        gameState,
        playerKey,
        cardId,
        cardType,
        prng: helpers.prng || helpers.defaultPrng || null,
        heavenSeedHint,
        turnIndex: Number(cardState && cardState.turnIndex),
        riboUnlockTurnIndex: RIBO_WILL_UNLOCK_TURN_INDEX,
        CardBoardExecutorResolutionModule: getBoardExecutorResolutionModule(context)
    });
    return result && result.ok === true;
}

function dealInitialHands(cardState: any, prng: any, context: Context): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.turnCountByPlayer || typeof cardState.turnCountByPlayer !== 'object') {
        (cardState as any).turnCountByPlayer = { black: 0, white: 0 };
        return;
    }
    (cardState as any).turnCountByPlayer.black = 0;
    (cardState as any).turnCountByPlayer.white = 0;
}

function commitDraw(cardState: any, playerKey: string, prng: any, context: Context): string | null {
    const { MAX_HAND_SIZE } = getConstants(context);
    const ownerKey = normalizestring(playerKey);
    const hands = ensureHands(cardState);
    const hand = Array.isArray(hands[ownerKey]) ? hands[ownerKey] : null;
    if (!hand || hand.length >= MAX_HAND_SIZE) return null;
    const drawn = popDeckCard(cardState, playerKey);
    if (!drawn || !drawn.cardId) return null;
    const added = addCardToHand(cardState, playerKey, drawn.cardId, context, { cardCopyId: drawn.cardCopyId });
    if (added && added.cardId) return added.cardId;
    const decks = ensureDecks(cardState);
    const copyState = ensureCardCopyState(cardState);
    decks[ownerKey].push(drawn.cardId);
    copyState.deckCopyIdsByPlayer[ownerKey].push(drawn.cardCopyId);
    return null;
}

function getCardDef(cardId: string, context: Context): any {
    const defsModule = getCardDefsModule(context);
    if (defsModule && typeof defsModule.getCardDef === 'function') {
        return defsModule.getCardDef(cardId);
    }
    const { CARD_DEFS } = getConstants(context);
    return CARD_DEFS.find((card) => card && card.id === cardId) || null;
}

function getCardType(cardId: string, context: Context): string | null {
    const defsModule = getCardDefsModule(context);
    if (defsModule && typeof defsModule.getCardType === 'function') {
        return defsModule.getCardType(cardId);
    }
    const { CARD_TYPE_BY_ID } = getConstants(context);
    return CARD_TYPE_BY_ID[cardId] || null;
}

function getCardDisplayName(cardId: string, context: Context): string {
    const defsModule = getCardDefsModule(context);
    if (defsModule && typeof defsModule.getCardDisplayName === 'function') {
        return defsModule.getCardDisplayName(cardId);
    }
    const def = getCardDef(cardId, context);
    return def ? def.name : '';
}

function getCardCodeName(displayName: string, context: Context): string | null {
    const defsModule = getCardDefsModule(context);
    if (defsModule && typeof defsModule.getCardCodeName === 'function') {
        return defsModule.getCardCodeName(displayName);
    }
    const { CARD_DEFS } = getConstants(context);
    const def = CARD_DEFS.find((card) => card && card.name === displayName);
    return def ? def.id : null;
}

function getCardCost(cardId: string, context: Context): number {
    const costsModule = getCardCostsModule(context);
    if (costsModule && typeof costsModule.getCardCost === 'function') {
        return costsModule.getCardCost(cardId);
    }
    const def = getCardDef(cardId, context);
    return def ? def.cost : 0;
}

function isCardPlayLockedForPlayer(cardState: any, playerKey: string, context: Context): boolean {
    const helpers = getHelpers(context);
    if (helpers && typeof helpers.isCardPlayLockedForPlayer === 'function') {
        return helpers.isCardPlayLockedForPlayer(cardState, playerKey) === true;
    }
    if (CardMarkersModule && typeof CardMarkersModule.isCardPlayLockedForPlayer === 'function') {
        return CardMarkersModule.isCardPlayLockedForPlayer(cardState, playerKey) === true;
    }
    return false;
}

function isInviolableSpecialCardId(cardId: any, context: Context): boolean {
    const helpers = getHelpers(context);
    if (helpers && typeof helpers.isInviolableSpecialCardId === 'function') {
        return helpers.isInviolableSpecialCardId(cardId) === true;
    }
    if (SpecialCardRegistryModule && typeof SpecialCardRegistryModule.isInviolableSpecialCardId === 'function') {
        return SpecialCardRegistryModule.isInviolableSpecialCardId(cardId) === true;
    }
    return false;
}

function canUseBoardExecutor(cardState: any, playerKey: string, context: Context): boolean {
    const helpers = getHelpers(context);
    if (helpers && typeof helpers.canUseBoardExecutor === 'function') {
        return helpers.canUseBoardExecutor(cardState, playerKey) === true;
    }
    const moduleRef = getBoardExecutorResolutionModule(context);
    if (moduleRef && typeof moduleRef.canUseBoardExecutor === 'function') {
        return moduleRef.canUseBoardExecutor(cardState, playerKey) === true;
    }
    return false;
}

function isActiveManifestStoneMarker(marker: any): boolean {
    if (ManifestStoneRegistryModule && typeof ManifestStoneRegistryModule.isActiveManifestStoneMarker === 'function') {
        return ManifestStoneRegistryModule.isActiveManifestStoneMarker(marker) === true;
    }
    if (CardMarkersModule && typeof CardMarkersModule.isManifestStoneMarker === 'function') {
        if (CardMarkersModule.isManifestStoneMarker(marker) !== true) return false;
    } else {
        const type = marker && marker.data ? String(marker.data.type || '').toUpperCase() : '';
        if (!marker || (marker.kind !== 'manifestStone' && marker.kind !== 'specialStone')) return false;
        if (!isManifestStoneType(type)) return false;
    }
    if (marker && marker.data && Object.prototype.hasOwnProperty.call(marker.data, 'remainingOwnerTurns')) {
        const remaining = Number(marker.data.remainingOwnerTurns);
        return Number.isFinite(remaining) && remaining > 0;
    }
    return true;
}

function hasActiveManifestStone(cardState: any): boolean {
    if (CardMarkersModule && typeof CardMarkersModule.getActiveManifestMarkers === 'function') {
        return CardMarkersModule.getActiveManifestMarkers(cardState).length > 0;
    }
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    return markers.some(isActiveManifestStoneMarker);
}

function normalizeRequestedHandIndex(opts: any): number | null {
    const source = opts && typeof opts === 'object' ? opts : {};
    const candidates = [source.handIndex, source.useCardHandIndex];
    for (const candidate of candidates) {
        const numeric = Number(candidate);
        if (Number.isInteger(numeric) && numeric >= 0) {
            return Math.trunc(numeric);
        }
    }
    return null;
}

function resolveHandIndexForCard(cardState: any, playerKey: string, cardId: string, opts?: any): number {
    const hands = cardState && cardState.hands;
    if (!hands || !Array.isArray(hands[playerKey])) return -1;
    const hand = hands[playerKey];
    const requestedIndex = normalizeRequestedHandIndex(opts);
    if (
        requestedIndex !== null
        && requestedIndex < hand.length
        && String(hand[requestedIndex]) === String(cardId)
    ) {
        return requestedIndex;
    }
    return hand.indexOf(cardId);
}

function canUseCard(cardState: any, playerKey: string, cardId: string, context: Context, opts?: any): boolean {
    const { RIBO_WILL_UNLOCK_TURN_INDEX } = getConstants(context);
    const hands = cardState && cardState.hands;
    if (!hands || !Array.isArray(hands[playerKey])) return false;
    if (isCardPlayLockedForPlayer(cardState, playerKey, context)) return false;
    const skipCostAndTurnLimit = opts && opts.skipCostAndTurnLimit;
    const hasLiveTurnUsageFlag = !skipCostAndTurnLimit
        && cardState
        && (cardState as any).lastTurnStartedFor === playerKey
        && (cardState as any).hasUsedCardThisTurnByPlayer
        && (cardState as any).hasUsedCardThisTurnByPlayer[playerKey];
    if (hasLiveTurnUsageFlag) return false;
    const handIndex = resolveHandIndexForCard(cardState, playerKey, cardId, opts);
    if (handIndex < 0) return false;
    if (!skipCostAndTurnLimit) {
        const copyId = getHandCopyIdAt(cardState, playerKey, handIndex);
        const cost = getEffectiveCardCostForCopy(cardState, cardId, Number(copyId || 0), context);
        if (!cardState.charge || Number(cardState.charge[playerKey] || 0) < cost) return false;
    }
    const cardType = getCardType(cardId, context);
    if (isInviolableSpecialCardId(cardId, context) && hasActiveManifestStone(cardState)) {
        return false;
    }
    if (cardType === 'THEORY_INCARNATION') {
        const totals = (cardState as any).numberCellCollectedTotalByPlayer;
        const collected = Number(totals && totals[playerKey] || 0);
        if (!Number.isFinite(collected) || collected < 42) return false;
    }
    if (cardType === 'BOARD_EXECUTOR' && !canUseBoardExecutor(cardState, playerKey, context)) {
        return false;
    }
    if (cardType === 'RIBO_WILL' && Number((cardState as any).turnIndex || 0) < RIBO_WILL_UNLOCK_TURN_INDEX) {
        return false;
    }
    return true;
}

function ensureHandDestroyFlags(cardState: any): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.hasDestroyedCardThisTurnByPlayer || typeof cardState.hasDestroyedCardThisTurnByPlayer !== 'object') {
        (cardState as any).hasDestroyedCardThisTurnByPlayer = { black: false, white: false };
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'black')) {
        (cardState as any).hasDestroyedCardThisTurnByPlayer.black = false;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'white')) {
        (cardState as any).hasDestroyedCardThisTurnByPlayer.white = false;
    }
}

function destroyHandCard(cardState: any, playerKey: string, cardId: string, opts: any, context: Context): DestroyResult {
    if (!cardState || !cardState.hands) return { applied: false, reason: 'invalid_state' };
    const ownerKey = normalizestring(playerKey);
    const hand = Array.isArray(cardState.hands[ownerKey]) ? cardState.hands[ownerKey] : null;
    if (!hand) return { applied: false, reason: 'invalid_hand' };
    const options = opts || {};
    const isInviolableSpecialCardId = typeof options.isInviolableSpecialCardId === 'function'
        ? options.isInviolableSpecialCardId
        : () => false;

    ensureHandDestroyFlags(cardState);

    const index = hand.indexOf(cardId);
    if (index < 0) return { applied: false, reason: 'card_not_in_hand' };
    if (isInviolableSpecialCardId(cardId)) {
        return { applied: false, reason: 'inviolable_special_card' };
    }

    const removed = removeHandCardAt(cardState, ownerKey, index);
    if (!removed) return { applied: false, reason: 'card_not_in_hand' };
    addCardToDiscard(cardState, removed.cardId!, removed.cardCopyId!);
    (cardState as any).hasDestroyedCardThisTurnByPlayer[ownerKey] = true;

    return { applied: true, destroyedCardId: removed.cardId, destroyedCardCopyId: removed.cardCopyId };
}

function getUsableCardIds(cardState: any, gameState: any, playerKey: string, context: Context, opts?: any): string[] {
    if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return [];
    const helpers = getHelpers(context);
    const hand = cardState.hands[playerKey];
    const res: string[] = [];

    for (let handIndex = 0; handIndex < hand.length; handIndex += 1) {
        const cardId = hand[handIndex];
        const perSlotOpts = Object.assign({}, opts || {}, { handIndex });
        if (!canUseCard(cardState, playerKey, cardId, context, perSlotOpts)) continue;
        const def = getCardDef(cardId, context);
        if (!def) continue;
        const type = def.type;
        if (gameState && !passesUsagePreconditionsForUsableList(cardState, gameState, playerKey, cardId, type, context)) continue;

        if (type === 'EQUALITY_WILL') {
            if (typeof helpers.canUseEqualityWillForPlayer !== 'function') continue;
            if (!helpers.canUseEqualityWillForPlayer(cardState, gameState, playerKey)) continue;
        }

        if (type === 'CONDEMN_WILL') {
            const opponentKey = playerKey === 'black' ? 'white' : 'black';
            const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey]))
                ? cardState.hands[opponentKey]
                : [];
            if (opponentHand.length === 0) continue;
        }

        if (type === 'REVEAL_HAND_WILL') {
            const opponentKey = playerKey === 'black' ? 'white' : 'black';
            const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey]))
                ? cardState.hands[opponentKey]
                : [];
            if (opponentHand.length === 0) continue;
        }

        if (type === 'SALVATION_WILL') {
            const salvationLedger = (cardState as any).prevOpponentTurnDestroyedStonesByPlayer
                || (cardState as any).prevOpponentTurnDestroyedNormalByPlayer;
            const salvationList = salvationLedger && salvationLedger[playerKey];
            if (!Array.isArray(salvationList) || salvationList.length === 0) continue;
        }

        if (type === 'EXECUTION_WILL') {
            const opponentKey = playerKey === 'black' ? 'white' : 'black';
            const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey]))
                ? cardState.hands[opponentKey]
                : [];
            if (!opponentHand.some((opponentCardId: any) => !isInviolableSpecialCardId(opponentCardId, context))) continue;
            const executionLedger = (cardState as any).prevOpponentTurnDestroyedStonesByPlayer
                || (cardState as any).prevOpponentTurnDestroyedNormalByPlayer;
            const executionList = executionLedger && executionLedger[playerKey];
            const destroyedOwnStoneCount = Array.isArray(executionList)
                ? executionList.filter((entry: any) => entry && entry.owner === playerKey).length
                : 0;
            if (destroyedOwnStoneCount <= 0) continue;
        }

        if (gameState) {
            if (type === 'LAST_RESORT') {
                if (typeof helpers.canUseLastResortForPlayer !== 'function') continue;
                if (!helpers.canUseLastResortForPlayer(cardState, gameState, playerKey)) continue;
            }

            if (type === 'REINFORCEMENT_WILL') {
                if (typeof helpers.canUseReinforcementWillForPlayer !== 'function') continue;
                if (!helpers.canUseReinforcementWillForPlayer(cardState, gameState, playerKey)) continue;
            }

            if (type === 'SUPPORT_TROOPS_WILL') {
                if (typeof helpers.canUseSupportTroopsWillForPlayer !== 'function') continue;
                if (!helpers.canUseSupportTroopsWillForPlayer(cardState, gameState, playerKey)) continue;
            }

            if (type === 'TIME_STOP_GOD') {
                if (typeof helpers.canUseTimeStopGodForPlayer !== 'function') continue;
                if (!helpers.canUseTimeStopGodForPlayer(cardState, gameState, playerKey)) continue;
            }

            if (type === 'TEMPT_WILL' && !requireLocalTargets(context, 'getTemptWillTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'TRAP_WILL' && !requireLocalTargets(context, 'getTrapTargets', [cardState, gameState, playerKey], 1)) continue;
            if ((type === 'GUARD_WILL' || type === 'GUARDIAN_GOD') && !requireLocalTargets(context, 'getGuardTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'LIVING_WILL' && !requireLocalTargets(context, 'getLivingWillTargets', [cardState, gameState, playerKey], 1)) continue;
            if ((type === 'EXTEND_LIFE_WILL' || type === 'EXTEND_LIFE_GOD') && !requireLocalTargets(context, 'getExtendLifeTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'CORROSION_WILL' && !requireLocalTargets(context, 'getCorrosionTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'TIME_BOMB' && !requireLocalTargets(context, 'getTimeBombTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'TELEPORT_WILL' && !requireLocalTargets(context, 'getTeleportTargets', [cardState, gameState], 1)) continue;
            if (type === 'CELL_TELEPORT_WILL' && !requireLocalTargets(context, 'getCellTeleportTargets', [cardState, gameState], 1)) continue;
            if (type === 'BUOYANCY_WILL' && !requireLocalTargets(context, 'getBuoyancyTargets', [cardState, gameState], 1)) continue;
            if (type === 'SUPER_BUOYANCY_WILL' && !requireLocalTargets(context, 'getSuperBuoyancyTargets', [cardState, gameState], 1)) continue;
            if (type === 'GRAVITY_WILL' && !requireLocalTargets(context, 'getGravityTargets', [cardState, gameState], 1)) continue;
            if (type === 'SUPER_GRAVITY_WILL' && !requireLocalTargets(context, 'getSuperGravityTargets', [cardState, gameState], 1)) continue;
            if (type === 'SUPER_ATTRACTION_WILL' && !requireLocalTargets(context, 'getSuperAttractionTargets', [cardState, gameState, playerKey, null], 1)) continue;
            if (type === 'CLONE_WILL' && !requireLocalTargets(context, 'getCloneTargets', [cardState, gameState, playerKey], 1)) continue;

            if (type === 'POSITION_SWAP_WILL') {
                const getOccupiedBoardShapeCellsForCard = helpers.getOccupiedBoardShapeCellsForCard;
                const occupied = typeof getOccupiedBoardShapeCellsForCard === 'function'
                    ? getOccupiedBoardShapeCellsForCard(cardState, gameState).length
                    : 0;
                if (occupied < 2) continue;
            }

            if (type === 'BOARD_EXPANSION_WILL' && !requireLocalTargets(context, 'getBoardExpansionTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'BOARD_EXPANSION_GOD' && !requireLocalTargets(context, 'getBoardExpansionGodTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'BOARD_SHRINK_WILL' && !requireLocalTargets(context, 'getBoardShrinkTargets', [cardState, gameState, playerKey], 3)) continue;
            if (type === 'BOARD_SHRINK_GOD' && !requireLocalTargets(context, 'getBoardShrinkGodTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'BLOCKADE_WILL' && !requireLocalTargets(context, 'getBlockadeTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'METEOR_WILL' && !requireLocalTargets(context, 'getMeteorTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'FREEZE_WILL' && !requireLocalTargets(context, 'getFreezeTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'SEED_WILL' && !requireLocalTargets(context, 'getSeedTargets', [cardState, gameState, playerKey], 1)) continue;

            if (type === 'DESTROY_ONE_STONE' && !requireModuleTargets(context, 'getDestroyTargets', [cardState, gameState], 1)) continue;
            if (type === 'STRONG_WIND_WILL' && !requireModuleTargets(context, 'getStrongWindTargets', [cardState, gameState], 1)) continue;
            if (type === 'BUOYANCY_WILL' && !requireModuleTargets(context, 'getBuoyancyTargets', [cardState, gameState], 1)) continue;
            if (type === 'SUPER_BUOYANCY_WILL' && !requireModuleTargets(context, 'getSuperBuoyancyTargets', [cardState, gameState], 1)) continue;
            if (type === 'GRAVITY_WILL' && !requireModuleTargets(context, 'getGravityTargets', [cardState, gameState], 1)) continue;
            if (type === 'SUPER_GRAVITY_WILL' && !requireModuleTargets(context, 'getSuperGravityTargets', [cardState, gameState], 1)) continue;
            if (type === 'SUPER_ATTRACTION_WILL' && !requireModuleTargets(context, 'getSuperAttractionTargets', [cardState, gameState, playerKey, null], 1)) continue;
            if (type === 'SWAP_WITH_ENEMY' && !requireModuleTargets(context, 'getSwapTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'POSITION_SWAP_WILL' && !requireModuleTargets(context, 'getPositionSwapTargets', [cardState, gameState, playerKey, null], 2)) continue;
            if (type === 'TRAP_WILL' && !requireModuleTargets(context, 'getTrapTargets', [cardState, gameState, playerKey], 1)) continue;
            if ((type === 'GUARD_WILL' || type === 'GUARDIAN_GOD') && !requireModuleTargets(context, 'getGuardTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'LIVING_WILL' && !requireModuleTargets(context, 'getLivingWillTargets', [cardState, gameState, playerKey], 1)) continue;
            if ((type === 'EXTEND_LIFE_WILL' || type === 'EXTEND_LIFE_GOD') && !requireModuleTargets(context, 'getExtendLifeTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'TIME_BOMB' && !requireModuleTargets(context, 'getTimeBombTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'TELEPORT_WILL' && !requireModuleTargets(context, 'getTeleportTargets', [cardState, gameState], 1)) continue;
            if (type === 'CELL_TELEPORT_WILL' && !requireModuleTargets(context, 'getCellTeleportTargets', [cardState, gameState], 1)) continue;
            if (type === 'CLONE_WILL' && !requireModuleTargets(context, 'getCloneTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'BOARD_EXPANSION_GOD' && !requireModuleTargets(context, 'getBoardExpansionGodTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'BOARD_SHRINK_WILL' && !requireModuleTargets(context, 'getBoardShrinkTargets', [cardState, gameState, playerKey], 3)) continue;
            if (type === 'BOARD_SHRINK_GOD' && !requireModuleTargets(context, 'getBoardShrinkGodTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'BLOCKADE_WILL' && !requireModuleTargets(context, 'getBlockadeTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'METEOR_WILL' && !requireModuleTargets(context, 'getMeteorTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'FREEZE_WILL' && !requireModuleTargets(context, 'getFreezeTargets', [cardState, gameState, playerKey], 1)) continue;
            if (type === 'SEED_WILL' && !requireModuleTargets(context, 'getSeedTargets', [cardState, gameState, playerKey], 1)) continue;
        }

        res.push(cardId);
    }

    return res;
}

function hasUsableCard(cardState: any, gameState: any, playerKey: string, context: Context): boolean {
    return getUsableCardIds(cardState, gameState, playerKey, context).length > 0;
}

export = {
    dealInitialHands,
    commitDraw,
    getCardDef,
    getCardType,
    getCardDisplayName,
    getCardCodeName,
    getCardCost,
    resolveHandIndexForCard,
    canUseCard,
    ensureHandDestroyFlags,
    ensureCardCopyState,
    getHandCopyIdAt,
    getHandCopyIds,
    isCardCopyIdRevealedToViewer,
    revealCurrentHandToViewer,
    setCardCostOverrideForCopyId,
    addCardCostModifierForCopyId,
    getEffectiveCardCostForCopy,
    addCardToHand,
    addCardToDiscard,
    removeHandCardAt,
    clearHandToDiscard,
    moveDiscardCardToHandByCardId,
    destroyHandCard,
    getUsableCardIds,
    hasUsableCard
};
