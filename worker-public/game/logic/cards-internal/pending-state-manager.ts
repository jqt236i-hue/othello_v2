/**
 * @file pending-state-manager.ts
 * @description Pending selection state management shared between Browser and Headless.
 */


interface PendingSelectionContract {
    kind: string;
    turnOutcome: string;
    deferNetworkPublish: boolean;
    waitForPlaybackIdle: boolean;
}

interface PendingSelectionDefinition {
    kind: string;
    turnOutcome: string;
    deferNetworkPublish: boolean;
    waitForPlaybackIdle: boolean;
    needsTargetSelection: boolean;
    cancellable?: boolean;
    dispatchKey: string;
}

interface PendingEffectState {
    type: string;
    cardId?: string;
    pendingEffectId?: string;
    sourceHandIndex?: number;
    stage: string | null;
    offers?: string[];
    selectedCount?: number;
    maxSelections?: number;
    selectedTargets?: any[];
    placementsRemaining?: number;
}

interface CancelResult {
    canceled: boolean;
    reason?: string;
    cardId?: string;
}

interface CancelOptions {
    refundCost?: boolean;
    resetUsage?: boolean;
    noConsume?: boolean;
}

interface CancelContext {
    helpers?: {
        getCardDef?: (cardId: string) => any;
        addChargeValue?: (cardState: any, playerKey: string, amount: number, reason: string) => void;
        moveDiscardCardToHandByCardId?: (cardState: any, handKey: string, cardId: string, opts: any) => any;
    };
}

const PENDING_SELECTION_CONTRACT_DEFINITIONS: Record<string, PendingSelectionDefinition> = Object.freeze({
    DESTROY_ONE_STONE: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'destroy' },
    STRONG_WIND_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'strong_wind' },
    SUPER_BUOYANCY_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'super_buoyancy' },
    SUPER_GRAVITY_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'super_gravity' },
    TELEPORT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'teleport' },
    CELL_TELEPORT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'cell_teleport' },
    TEMPT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'tempt' },
    CAPTURE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'capture' },
    TRAP_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'trap' },
    GUARD_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'guard' },
    GUARDIAN_GOD: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'guard' },
    LIVING_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'living_will' },
    EXTEND_LIFE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'extend_life' },
    EXTEND_LIFE_GOD: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'extend_life' },
    CORROSION_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'corrosion' },
    CLONE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'clone' },
    BLOCKADE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'blockade' },
    BOARD_EXPANSION_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'board_expansion' },
    BOARD_EXPANSION_GOD: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'board_expansion' },
    BOARD_SHRINK_WILL: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'board_shrink' },
    BOARD_SHRINK_GOD: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'board_shrink' },
    FREEZE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'freeze' },
    SEED_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'seed' },
    POSITION_SWAP_WILL: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'position_swap' },
    METEOR_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'meteor' },
    TIME_BOMB: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'time_bomb' },
    SWAP_WITH_ENEMY: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'swap_with_enemy' },
    HEAVEN_BLESSING: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'heaven_blessing' },
    CONDEMN_WILL: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'condemn' }
});

function buildPendingSelectionContracts(definitions: Record<string, PendingSelectionDefinition>): Record<string, PendingSelectionContract> {
    const contracts: Record<string, PendingSelectionContract> = {};
    Object.keys(definitions).forEach((cardType) => {
        const definition = definitions[cardType] || {};
        contracts[cardType] = Object.freeze({
            kind: definition.kind,
            turnOutcome: definition.turnOutcome,
            deferNetworkPublish: definition.deferNetworkPublish === true,
            waitForPlaybackIdle: definition.waitForPlaybackIdle === true
        });
    });
    return Object.freeze(contracts);
}

function buildPendingSelectionTypeSet(definitions: Record<string, PendingSelectionDefinition>, fieldName: keyof PendingSelectionDefinition): Set<string> {
    const types: string[] = [];
    Object.keys(definitions).forEach((cardType) => {
        if (definitions[cardType] && definitions[cardType][fieldName] === true) {
            types.push(cardType);
        }
    });
    return new Set(types);
}

function buildPendingSelectionDispatchKeys(definitions: Record<string, PendingSelectionDefinition>): Record<string, string> {
    const dispatchKeys: Record<string, string> = {};
    Object.keys(definitions).forEach((cardType) => {
        const dispatchKey = definitions[cardType] && definitions[cardType].dispatchKey;
        if (typeof dispatchKey === 'string' && dispatchKey) {
            dispatchKeys[cardType] = dispatchKey;
        }
    });
    return Object.freeze(dispatchKeys);
}

const PENDING_SELECTION_CONTRACTS = buildPendingSelectionContracts(PENDING_SELECTION_CONTRACT_DEFINITIONS);
const TARGET_SELECTION_PENDING_TYPES = buildPendingSelectionTypeSet(PENDING_SELECTION_CONTRACT_DEFINITIONS, 'needsTargetSelection');
const CANCELLABLE_PENDING_TYPES = buildPendingSelectionTypeSet(PENDING_SELECTION_CONTRACT_DEFINITIONS, 'cancellable');
const PENDING_SELECTION_DISPATCH_KEYS = buildPendingSelectionDispatchKeys(PENDING_SELECTION_CONTRACT_DEFINITIONS);

function normalizeCardType(cardType: any): string {
    return String(cardType || '');
}

function normalizePendingType(cardType: any): string {
    return String(cardType || '').trim().toUpperCase();
}

function getHelpers(context: CancelContext | undefined): CancelContext['helpers'] {
    return (context && context.helpers) || {};
}

function ensureChargeState(cardState: any): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.charge || typeof cardState.charge !== 'object') {
        (cardState as any).charge = { black: 0, white: 0 };
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'black')) (cardState as any).charge.black = 0;
    if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'white')) (cardState as any).charge.white = 0;
}

function addChargeFallback(cardState: any, playerKey: string, amount: number): void {
    ensureChargeState(cardState);
    if (!cardState || !(cardState as any).charge) return;
    const before = Number((cardState as any).charge[playerKey] || 0);
    const safeBefore = Number.isFinite(before) ? before : 0;
    const delta = Number(amount);
    const safeDelta = Number.isFinite(delta) ? delta : 0;
    (cardState as any).charge[playerKey] = safeBefore + safeDelta;
}

function ensureUsageFlags(cardState: any): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.hasUsedCardThisTurnByPlayer || typeof cardState.hasUsedCardThisTurnByPlayer !== 'object') {
        (cardState as any).hasUsedCardThisTurnByPlayer = { black: false, white: false };
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.hasUsedCardThisTurnByPlayer, 'black')) {
        (cardState as any).hasUsedCardThisTurnByPlayer.black = false;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.hasUsedCardThisTurnByPlayer, 'white')) {
        (cardState as any).hasUsedCardThisTurnByPlayer.white = false;
    }
}

function ensureUseCounts(cardState: any): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.cardUseCountByPlayer || typeof cardState.cardUseCountByPlayer !== 'object') {
        (cardState as any).cardUseCountByPlayer = { black: 0, white: 0 };
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.cardUseCountByPlayer, 'black')) {
        (cardState as any).cardUseCountByPlayer.black = 0;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.cardUseCountByPlayer, 'white')) {
        (cardState as any).cardUseCountByPlayer.white = 0;
    }
}

function ensureHands(cardState: any): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.hands || typeof cardState.hands !== 'object') {
        (cardState as any).hands = { black: [], white: [] };
        return;
    }
    if (!Array.isArray(cardState.hands.black)) (cardState as any).hands.black = [];
    if (!Array.isArray(cardState.hands.white)) (cardState as any).hands.white = [];
}

function ensureDiscard(cardState: any): string[] {
    if (!cardState || typeof cardState !== 'object') return [];
    if (!Array.isArray(cardState.discard)) (cardState as any).discard = [];
    return cardState.discard as string[];
}

function requiresTargetSelection(cardType: string): boolean {
    const normalizedType = normalizeCardType(cardType);
    return !!normalizedType && TARGET_SELECTION_PENDING_TYPES.has(normalizedType);
}

function isCancellablePendingType(cardType: string): boolean {
    const normalizedType = normalizeCardType(cardType);
    return !!normalizedType && CANCELLABLE_PENDING_TYPES.has(normalizedType);
}

function resolvePendingSelectionContract(cardType: string): PendingSelectionContract | null {
    const normalizedType = normalizePendingType(cardType);
    return normalizedType && PENDING_SELECTION_CONTRACTS[normalizedType]
        ? PENDING_SELECTION_CONTRACTS[normalizedType]
        : null;
}

function isSelectionOnlyEndTurnPendingType(cardType: string): boolean {
    const contract = resolvePendingSelectionContract(cardType);
    return !!(contract && contract.turnOutcome === 'end_turn');
}

function shouldDeferNetworkPublishForPendingType(cardType: string): boolean {
    const contract = resolvePendingSelectionContract(cardType);
    return !!(contract && contract.deferNetworkPublish === true);
}

function shouldWaitForPlaybackIdleForPendingType(cardType: string): boolean {
    const contract = resolvePendingSelectionContract(cardType);
    return !!(contract && contract.waitForPlaybackIdle === true);
}

function resolvePendingSelectionDispatchKey(cardType: string): string | null {
    const normalizedType = normalizePendingType(cardType);
    return normalizedType && PENDING_SELECTION_DISPATCH_KEYS[normalizedType]
        ? PENDING_SELECTION_DISPATCH_KEYS[normalizedType]
        : null;
}

function createPendingEffectState(options?: any): PendingEffectState | null {
    const opts = (options && typeof options === 'object') ? options : {};
    const cardType = normalizeCardType(opts.cardType);
    if (!cardType) return null;

    const needsSelection = (typeof opts.needsSelection === 'boolean')
        ? opts.needsSelection
        : requiresTargetSelection(cardType);

    return {
        type: cardType,
        cardId: opts.cardId,
        pendingEffectId: (typeof opts.pendingEffectId === 'string' && opts.pendingEffectId) ? opts.pendingEffectId : undefined,
        sourceHandIndex: Number.isInteger(opts.sourceHandIndex) ? opts.sourceHandIndex : undefined,
        stage: needsSelection ? 'selectTarget' : null,
        offers: opts.offers || undefined,
        selectedCount: (cardType === 'BOARD_EXPANSION_GOD' || cardType === 'BOARD_SHRINK_WILL') ? 0 : undefined,
        maxSelections: cardType === 'BOARD_EXPANSION_GOD'
            ? 2
            : (cardType === 'BOARD_SHRINK_WILL' ? 3 : undefined),
        selectedTargets: (cardType === 'BOARD_EXPANSION_GOD' || cardType === 'BOARD_SHRINK_WILL') ? [] : undefined,
        placementsRemaining: cardType === 'LAST_RESORT' ? 3 : undefined
    };
}

function cancelPendingSelection(cardState: any, playerKey: string, opts?: CancelOptions, context: CancelContext = {}): CancelResult {
    if (!cardState || !(cardState as any).pendingEffectByPlayer) return { canceled: false, reason: 'no_state' };
    const pending = (cardState as any).pendingEffectByPlayer[playerKey];
    if (!pending || pending.stage !== 'selectTarget') return { canceled: false, reason: 'not_pending' };
    if (!isCancellablePendingType(pending.type)) return { canceled: false, reason: 'not_cancellable' };

    const helpers = getHelpers(context) || {};
    const getCardDef = helpers.getCardDef;
    const addChargeValue = helpers.addChargeValue;
    const moveDiscardCardToHandByCardId = helpers.moveDiscardCardToHandByCardId;
    const cardId = pending.cardId;
    const cardDef = (cardId && typeof getCardDef === 'function') ? getCardDef(cardId) : null;
    const cost = cardDef ? Number(cardDef.cost || 0) : 0;
    const refundCost = !(opts && opts.refundCost === false);
    const resetUsage = !(opts && opts.resetUsage === false);
    const noConsume = !!(opts && opts.noConsume);

    if (refundCost && !noConsume) {
        if (typeof addChargeValue === 'function') {
            addChargeValue(cardState, playerKey, cost, 'card_cancel_refund');
        } else {
            addChargeFallback(cardState, playerKey, cost);
        }
    }

    if (resetUsage && !noConsume) {
        ensureUsageFlags(cardState);
        (cardState as any).hasUsedCardThisTurnByPlayer[playerKey] = false;
    }

    if (!noConsume) {
        ensureUseCounts(cardState);
        (cardState as any).cardUseCountByPlayer[playerKey] = Math.max(0, Number((cardState as any).cardUseCountByPlayer[playerKey] || 0) - 1);
    }

    if (cardId) {
        const handKey = Array.isArray((cardState as any).hands[playerKey]) ? playerKey : 'black';
        const restored = (typeof moveDiscardCardToHandByCardId === 'function')
            ? moveDiscardCardToHandByCardId(cardState, handKey, cardId, { ignoreHandLimit: true })
            : null;
        if (!restored) {
            ensureHands(cardState);
            const discard = ensureDiscard(cardState);
            if (!(cardState as any).hands[handKey].includes(cardId)) {
                (cardState as any).hands[handKey].push(cardId);
            }
            const discardIndex = discard.lastIndexOf(cardId);
            if (discardIndex >= 0) {
                discard.splice(discardIndex, 1);
            }
        }
    }

    (cardState as any).pendingEffectByPlayer[playerKey] = null;
    return { canceled: true, cardId };
}

export = {
    PENDING_SELECTION_CONTRACTS,
    requiresTargetSelection,
    isCancellablePendingType,
    resolvePendingSelectionContract,
    isSelectionOnlyEndTurnPendingType,
    shouldDeferNetworkPublishForPendingType,
    shouldWaitForPlaybackIdleForPendingType,
    resolvePendingSelectionDispatchKey,
    createPendingEffectState,
    cancelPendingSelection
};
