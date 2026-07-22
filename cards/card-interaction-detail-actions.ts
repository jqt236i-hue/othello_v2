export {};

import PendingSelectionRegistry = require('../game/logic/cards-internal/pending-selection-registry');

type CardInteractionDetailActionsDeps = {
    isAutoModeActive: () => boolean;
    canInputPlayerActNow: () => boolean;
    isDebugUnlimitedUsage: () => boolean;
    ensureHandDestroyFlags: () => any;
    hasPlayerUsedCardThisActiveTurn: (playerKey: any) => boolean;
    canInteractWithCardUi: () => boolean;
    isSelectionSettlementLocked: () => boolean;
    getCardDef: (cardId: any) => any;
    getEffectiveCardCost?: (cardId: any, ownerKey: any, handIndex?: any) => number;
    getCardStateValue: () => any;
    isSelectedCardUsableNow: (playerKey: any, cardId: any, options?: any) => boolean;
    getLegalMovesForCurrentPlayer: () => any[];
    isPlacementLockedForPlayer?: (playerKey: any) => boolean;
    isVisualPlaybackRunningNow: () => boolean;
    isStaleVisualPlaybackLock: () => boolean;
    isReversiMode: () => boolean;
    getDocumentRef: () => Document | null;
    getGameStateValue?: () => any;
    posToNotation: (row: any, col: any) => string;
};

type PendingSelectionPromptContext = {
    posToNotation?: (row: any, col: any) => string;
};

type PendingSelectionPromptResolver = (pending: any, context: PendingSelectionPromptContext) => string;

const PENDING_SELECTION_REGISTRY = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY || {};

const STATIC_PENDING_SELECTION_PROMPTS: Record<string, string> = Object.freeze({
    DESTROY_ONE_STONE: '破壊対象を選んでください（キャンセル可）',
    STRONG_WIND_WILL: '移動させる石を選んでください',
    BUOYANCY_WILL: '上方向へ移動させる石を選んでください',
    SUPER_BUOYANCY_WILL: '上方向へ移動させる石を選んでください',
    GRAVITY_WILL: '下方向へ移動させる石を選んでください',
    SUPER_GRAVITY_WILL: '下方向へ移動させる石を選んでください',
    TELEPORT_WILL: 'テレポートさせる石を選んでください',
    CELL_TELEPORT_WILL: 'マステレポートさせるマスを選んでください',
    SWAP_WITH_ENEMY: '交換する敵石を選んでください',
    TRAP_WILL: '罠を設置する自分の石を選んでください（選択後にターン終了）',
    REVERSE_WILL: '反転を起動する石を選んでください',
    TEMPT_WILL: '誘惑する相手の石効果を選んでください',
    CAPTURE_WILL: '捕獲する相手特殊石を選んでください',
    GUARD_WILL: '守る石にする自分の石を選んでください',
    GUARDIAN_GOD: '守護神にする自分の石を選んでください',
    LIVING_WILL: '生きる意志を付与する自分の石を選んでください（キャンセル可）',
    EXTEND_LIFE_WILL: '延命する自分の特殊石を選んでください',
    EXTEND_LIFE_GOD: '4倍延命する自分の特殊石を選んでください',
    CORROSION_WILL: '腐食の対象となる特殊石を選んでください',
    CLONE_WILL: '複製する自分の石を選んでください',
    BOARD_EXPANSION_WILL: '外周マスの外向き矢印を選んで盤面を拡張してください',
    BOARD_EXPANSION_GOD: '角マスの外向き矢印を選んで盤面を拡張してください',
    BLOCKADE_WILL: '封鎖する空きマスを選んでください',
    POISON_WILL: '毒マスにするマスを選んでください',
    FREEZE_WILL: '凍結するマスを選んでください',
    SEED_WILL: '種をまく空きマスを選んでください',
    METEOR_WILL: '因果抹消で破壊するマスを選んでください',
    CAUSAL_REPLAY_WILL: '再生する穴マスを選んでください',
    TIME_BOMB: '時限爆弾にする自分の石を選んでください',
    HEAVEN_BLESSING: '候補5枚から1枚選択してください',
    CONDEMN_WILL: '相手手札から破壊する1枚を選択してください',
    OBSERVER_WILL: '奪う相手手札を選んでください'
});

function normalizePendingType(pendingType: any): string {
    return String(pendingType || '').trim().toUpperCase();
}

function buildTypeSet(predicate: (entry: any) => boolean): Set<string> {
    const types: string[] = [];
    Object.keys(PENDING_SELECTION_REGISTRY).forEach((cardType) => {
        const entry = PENDING_SELECTION_REGISTRY[cardType];
        if (predicate(entry)) {
            types.push(cardType);
        }
    });
    return new Set(types);
}

function fallbackPosToNotation(row: any, col: any): string {
    return `${Number(row) + 1}-${Number(col) + 1}`;
}

function resolvePosToNotation(context: PendingSelectionPromptContext): (row: any, col: any) => string {
    return (context && typeof context.posToNotation === 'function')
        ? context.posToNotation
        : fallbackPosToNotation;
}

function createPendingSelectionPromptResolvers(): Record<string, PendingSelectionPromptResolver> {
    const resolvers: Record<string, PendingSelectionPromptResolver> = {};

    Object.keys(STATIC_PENDING_SELECTION_PROMPTS).forEach((cardType) => {
        const text = STATIC_PENDING_SELECTION_PROMPTS[cardType];
        resolvers[cardType] = () => text;
    });

    resolvers.SUPER_ATTRACTION_WILL = (pending) => pending && pending.firstTarget
        ? '引き寄せ先のマスを選んでください'
        : '引き寄せる石を選んでください';

    resolvers.POSITION_SWAP_WILL = (pending, context) => {
        const first = pending && pending.firstTarget;
        if (!first) {
            return '1つ目の石を選んでください（全ての石が対象）';
        }
        const posToNotation = resolvePosToNotation(context);
        return `2つ目の石を選んでください（1つ目: ${posToNotation(first.row, first.col)}）`;
    };

    resolvers.BOARD_EXPANSION_GOD = (pending) => {
        const selectedTargets = pending && Array.isArray(pending.selectedTargets)
            ? pending.selectedTargets
            : [];
        return selectedTargets.length === 1
            ? '盤面拡張神: もう1角を選ぶか、「1角で確定」を押してください'
            : '角マスの外向き矢印を選んで盤面を拡張してください';
    };

    resolvers.BOARD_SHRINK_WILL = (pending) => {
        const selectedCount = Number.isFinite(Number(pending && pending.selectedCount))
            ? Number(pending.selectedCount)
            : 0;
        const maxSelections = Number.isFinite(Number(pending && pending.maxSelections))
            ? Number(pending.maxSelections)
            : 3;
        const remainingSelections = Math.max(0, maxSelections - selectedCount);
        return remainingSelections < maxSelections
            ? `盤面縮小: つながる外周マスをあと${remainingSelections}つ選んでください`
            : '盤面縮小: 外周の連続3マスを選んでください';
    };

    resolvers.BOARD_SHRINK_GOD = (pending, context) => {
        const first = pending && pending.firstTarget;
        if (!first) {
            return '盤面縮小神: 縮小する辺の角マスを選んでください';
        }
        const posToNotation = resolvePosToNotation(context);
        return `盤面縮小神: ${posToNotation(first.row, first.col)}から伸ばす辺方向を選んでください`;
    };

    const missingPromptTypes = Object.keys(PENDING_SELECTION_REGISTRY).filter((cardType) => {
        const entry = PENDING_SELECTION_REGISTRY[cardType];
        return !!(entry && entry.needsTargetSelection) && typeof resolvers[cardType] !== 'function';
    });
    if (missingPromptTypes.length > 0) {
        throw new Error(`Missing pending selection UI prompt resolvers: ${missingPromptTypes.join(', ')}`);
    }

    const unknownPromptTypes = Object.keys(resolvers).filter((cardType) => !PENDING_SELECTION_REGISTRY[cardType]);
    if (unknownPromptTypes.length > 0) {
        throw new Error(`Unknown pending selection UI prompt types: ${unknownPromptTypes.join(', ')}`);
    }

    return Object.freeze(resolvers);
}

const CANCELLABLE_PENDING_SELECTION_TYPES = buildTypeSet((entry) => !!(entry && entry.cancellable));
const HAND_OVERLAY_PENDING_SELECTION_TYPES = buildTypeSet((entry) => entry && entry.kind === 'hand_overlay');
const PENDING_SELECTION_PROMPT_RESOLVERS = createPendingSelectionPromptResolvers();

export function isCancellablePendingSelectionFallback(pendingType: any): boolean {
    return CANCELLABLE_PENDING_SELECTION_TYPES.has(normalizePendingType(pendingType));
}

export function isHandOverlayPendingSelectionFallback(pendingType: any): boolean {
    return HAND_OVERLAY_PENDING_SELECTION_TYPES.has(normalizePendingType(pendingType));
}

export function resolvePendingSelectionPromptText(
    pending: any,
    context: PendingSelectionPromptContext = {}
): string {
    if (!pending || pending.stage !== 'selectTarget') return '';
    const normalizedType = normalizePendingType(pending.type);
    if (!normalizedType) return '';
    const resolver = PENDING_SELECTION_PROMPT_RESOLVERS[normalizedType];
    if (typeof resolver === 'function') {
        return String(resolver(pending, context) || '');
    }
    return '破壊対象を選んでください（キャンセル可）';
}

export const getPendingSelectionPrompt = resolvePendingSelectionPromptText;

type ConsecutivePassStatusModel = {
    shouldShow: boolean;
    count: number;
    max: 2;
    text: string;
};

const CONSECUTIVE_PASS_STATUS_SUFFIX = '(パスカウント2で終局)';

function setTextIfChanged(el: any, value: any): void {
    if (!el) return;
    const normalized = String(value ?? '');
    if (el.textContent !== normalized) el.textContent = normalized;
}

function setBooleanPropertyIfChanged(el: any, key: string, value: boolean): void {
    if (!el) return;
    if (el[key] !== value) el[key] = value;
}

function setAttributeIfChanged(el: any, name: string, value: any): void {
    if (!el || typeof el.getAttribute !== 'function' || typeof el.setAttribute !== 'function') return;
    const normalized = String(value ?? '');
    if (el.getAttribute(name) !== normalized) el.setAttribute(name, normalized);
}

function normalizeConsecutivePassDisplayCount(value: any): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(2, Math.trunc(numeric)));
}

export function resolveConsecutivePassStatusModel(input: any = {}): ConsecutivePassStatusModel {
    const gameStateValue = input && input.gameState ? input.gameState : {};
    const count = normalizeConsecutivePassDisplayCount(gameStateValue.consecutivePasses);
    const resultShown = gameStateValue && gameStateValue.__resultShown === true;
    const shouldShow = !resultShown && (count > 0 || input.canShowPass === true);
    return {
        shouldShow,
        count,
        max: 2,
        text: shouldShow ? `連続パス${count}/2${CONSECUTIVE_PASS_STATUS_SUFFIX}` : ''
    };
}

export function syncConsecutivePassStatus(actionState: any, documentRef: Document | null): void {
    if (!documentRef) return;
    const statusEl = documentRef.getElementById('consecutive-pass-status') as HTMLElement | null;
    if (!statusEl) return;
    const model = actionState && actionState.consecutivePassStatus
        ? actionState.consecutivePassStatus
        : resolveConsecutivePassStatusModel({
            gameState: {},
            canShowPass: actionState && actionState.canShowPass
        });
    setBooleanPropertyIfChanged(statusEl, 'hidden', !model.shouldShow);
    setAttributeIfChanged(statusEl, 'aria-hidden', model.shouldShow ? 'false' : 'true');
    setAttributeIfChanged(statusEl, 'aria-label', model.shouldShow ? model.text : '');
    const currentEl = statusEl.querySelector('[data-pass-streak-current="true"]') as HTMLElement | null;
    if (currentEl) {
        setTextIfChanged(currentEl, model.count);
        const noteEl = statusEl.querySelector('.pass-streak-note') as HTMLElement | null;
        if (noteEl) {
            setTextIfChanged(noteEl, CONSECUTIVE_PASS_STATUS_SUFFIX);
        }
    } else {
        setTextIfChanged(statusEl, model.text);
    }
}

export function createCardInteractionDetailActions(deps: CardInteractionDetailActionsDeps) {
    const cfg = (deps && typeof deps === 'object') ? deps : {} as CardInteractionDetailActionsDeps;

    function resolveCardDetailActionState(selectionContext: any) {
        const context = selectionContext || {};
        const cardStateValue = typeof cfg.getCardStateValue === 'function' ? (cfg.getCardStateValue() || {}) : {};
        const gameStateValue = typeof cfg.getGameStateValue === 'function' ? (cfg.getGameStateValue() || {}) : {};
        const playerKey = context.playerKey;
        const isAutoMode = cfg.isAutoModeActive();
        const canActThisTurn = cfg.canInputPlayerActNow();
        const isDebugUnlimited = cfg.isDebugUnlimitedUsage();
        cfg.ensureHandDestroyFlags();
        const hasNotUsedThisTurn = isDebugUnlimited ? true : !cfg.hasPlayerUsedCardThisActiveTurn(playerKey);
        const canInteract = isDebugUnlimited ? true : cfg.canInteractWithCardUi();
        const selectionSettlementLocked = isDebugUnlimited
            ? false
            : (typeof cfg.isSelectionSettlementLocked === 'function' && cfg.isSelectionSettlementLocked() === true);
        const selectedCardDef = context.hasSelection ? cfg.getCardDef(context.selectedId) : null;
        const effectiveCost = context.hasSelection && typeof cfg.getEffectiveCardCost === 'function'
            ? cfg.getEffectiveCardCost(context.selectedId, playerKey, context.selectedHandIndex)
            : null;
        const cost = Number.isFinite(Number(effectiveCost))
            ? Number(effectiveCost)
            : (selectedCardDef ? (selectedCardDef.cost || 0) : 0);
        const chargeByPlayer = cardStateValue && cardStateValue.charge ? cardStateValue.charge : {};
        const canAfford = isDebugUnlimited ? true : (chargeByPlayer[playerKey] || 0) >= cost;
        const canUseSelectedCardByRules = !!(context.hasSelection && cfg.isSelectedCardUsableNow(
            playerKey,
            context.selectedId,
            Object.assign(
                {},
                isDebugUnlimited ? { skipCostAndTurnLimit: true } : null,
                Number.isInteger(Number(context.selectedHandIndex)) && Number(context.selectedHandIndex) >= 0
                    ? { handIndex: Math.trunc(Number(context.selectedHandIndex)) }
                    : null
            )
        ));
        const placementLocked = typeof cfg.isPlacementLockedForPlayer === 'function'
            ? cfg.isPlacementLockedForPlayer(playerKey) === true
            : false;
        const noLegalMoves = placementLocked || cfg.getLegalMovesForCurrentPlayer().length === 0;
        const pendingByPlayer = cardStateValue && cardStateValue.pendingEffectByPlayer ? cardStateValue.pendingEffectByPlayer : {};
        const pending = pendingByPlayer[playerKey];
        const isSelectingTarget = !!(pending && pending.stage === 'selectTarget');
        const isHeavenSelecting = !!(
            pending
            && (pending.type === 'HEAVEN_BLESSING' || pending.type === 'CONDEMN_WILL' || pending.type === 'OBSERVER_WILL')
            && pending.stage === 'selectTarget'
        );

        let canUse = !isAutoMode
            && canActThisTurn
            && context.hasSelection
            && hasNotUsedThisTurn
            && canInteract
            && canAfford
            && canUseSelectedCardByRules;
        if (isDebugUnlimited) {
            canUse = !!context.hasSelection;
        }
        let canDestroy = !isAutoMode && canActThisTurn && context.hasSelection && canInteract;
        if (isDebugUnlimited) {
            canDestroy = !!context.hasSelection;
        }
        let reason = '';

        if (!context.hasSelection) {
            reason = context.selectedId ? '自分の手札からカードを選択してください' : '';
        } else if (!isDebugUnlimited && !canActThisTurn) {
            reason = '自分のターンではありません';
            canUse = false;
        } else if (isAutoMode) {
            reason = 'AUTO進行中...';
            canUse = false;
        } else if (!hasNotUsedThisTurn) {
            reason = 'このターンは既に使用済み';
            canUse = false;
        } else if (!canAfford) {
            reason = '';
            canUse = false;
        } else if (!canUseSelectedCardByRules) {
            reason = '現在このカードは使用できません（対象不足など）';
            canUse = false;
        } else if (!canInteract) {
            reason = '演出中...';
            canUse = false;
        }

        const canShowPass = canActThisTurn && noLegalMoves && !isSelectingTarget;
        const canPassWhileBusy = !cfg.isVisualPlaybackRunningNow() || cfg.isStaleVisualPlaybackLock();
        const canPass = !selectionSettlementLocked && !isAutoMode && canShowPass && (canInteract || canPassWhileBusy);
        const consecutivePassStatus = resolveConsecutivePassStatusModel({
            gameState: gameStateValue,
            canShowPass
        });

        return {
            canActThisTurn,
            isAutoMode,
            isDebugUnlimited,
            canInteract,
            selectedCardDef,
            cost,
            canAfford,
            pending,
            isSelectingTarget,
            isHeavenSelecting,
            canUse,
            canDestroy,
            canShowPass,
            canPass,
            consecutivePassStatus,
            reason
        };
    }

    function syncPassButtonVisibility(passBtn: HTMLButtonElement | null, shouldShow: boolean, canPass: boolean) {
        if (!passBtn) return;
        setBooleanPropertyIfChanged(passBtn, 'hidden', !shouldShow);
        setAttributeIfChanged(passBtn, 'aria-hidden', shouldShow ? 'false' : 'true');
        setBooleanPropertyIfChanged(passBtn, 'disabled', !shouldShow || !canPass);
    }

    function syncReversiPassButton(actionState: any) {
        const documentRef = typeof cfg.getDocumentRef === 'function' ? cfg.getDocumentRef() : null;
        if (!documentRef) return;
        const legacyPassBtn = (documentRef.getElementById('reversi-pass-btn') || documentRef.getElementById('othello-pass-btn')) as HTMLButtonElement | null;
        const framePassBtn = documentRef.getElementById('board-frame-pass-btn') as HTMLButtonElement | null;
        const canShowPass = !!(actionState && actionState.canShowPass);
        const canPass = !!(actionState && actionState.canPass);
        syncPassButtonVisibility(legacyPassBtn, cfg.isReversiMode() && canShowPass, canPass);
        syncPassButtonVisibility(framePassBtn, canShowPass, canPass);
        syncConsecutivePassStatus(actionState, documentRef);
    }

    function getPendingSelectionPrompt(pending: any) {
        return resolvePendingSelectionPromptText(pending, {
            posToNotation: cfg.posToNotation
        });
    }

    return {
        resolveCardDetailActionState,
        syncReversiPassButton,
        syncConsecutivePassStatus: (actionState: any) => {
            const documentRef = typeof cfg.getDocumentRef === 'function' ? cfg.getDocumentRef() : null;
            syncConsecutivePassStatus(actionState, documentRef);
        },
        getPendingSelectionPrompt
    };
}

module.exports = {
    createCardInteractionDetailActions,
    isCancellablePendingSelectionFallback,
    isHandOverlayPendingSelectionFallback,
    resolveConsecutivePassStatusModel,
    syncConsecutivePassStatus,
    getPendingSelectionPrompt
};
