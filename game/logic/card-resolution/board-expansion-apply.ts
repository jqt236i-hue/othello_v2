import type { CardState, GameState, PlayerKey } from '../../../src/types';

(function (root: any, factory: any) {
    if (root && root.SharedConstants) {
        root.CardBoardExpansionApply = factory(root.SharedConstants);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardBoardExpansionApply = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants: any) {
    'use strict';

    const { EMPTY } = SharedConstants || {};

function resolveExpansionTarget(targets: any[], row: number, col: number, directionKey: any): any {
    const anchorMatches = (Array.isArray(targets) ? targets : []).filter((target: any) => (
        target && target.row === row && target.col === col
    ));
    const normalizedDirectionKey = typeof directionKey === 'string' ? directionKey : '';
    if (normalizedDirectionKey) {
        return anchorMatches.find((target: any) => target.directionKey === normalizedDirectionKey) || null;
    }
    if (anchorMatches.length === 1) return anchorMatches[0];
    const legacyHorizontalMatches = anchorMatches.filter((target: any) => target.side === 'left' || target.side === 'right');
    return legacyHorizontalMatches.length === 1 ? legacyHorizontalMatches[0] : null;
}

function copyExpansionTarget(target: any): any {
    return {
        row: target.row,
        col: target.col,
        directionKey: target.directionKey
    };
}

function applyBoardExpansionWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, directionKey: any, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const getBoardExpansionTargets = deps && deps.getBoardExpansionTargets;
    const ensureMutableBoardExpansionForCard = deps && deps.ensureMutableBoardExpansionForCard;
    const getExpansionDescriptorsForCard = deps && deps.getExpansionDescriptorsForCard;
    const resolveExpansionSideForCard = deps && deps.resolveExpansionSideForCard;
    const normalizeExpansionOwnerForCard = deps && deps.normalizeExpansionOwnerForCard;
    const syncLegacyExpansionFieldsForCard = deps && deps.syncLegacyExpansionFieldsForCard;
    const addStateExpansionCells = deps && deps.addStateExpansionCells;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof getBoardExpansionTargets !== 'function' ||
        typeof ensureMutableBoardExpansionForCard !== 'function' ||
        typeof getExpansionDescriptorsForCard !== 'function' ||
        typeof resolveExpansionSideForCard !== 'function' ||
        typeof normalizeExpansionOwnerForCard !== 'function' ||
        typeof syncLegacyExpansionFieldsForCard !== 'function' ||
        typeof addStateExpansionCells !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'BOARD_EXPANSION_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const targets = getBoardExpansionTargets(cardState, gameState, playerKey);
    const target = resolveExpansionTarget(targets, row, col, directionKey);
    if (!target || !Array.isArray(target.additions) || target.additions.length !== 1) return { applied: false, reason: 'invalid_target' };

    const boardExpansion = ensureMutableBoardExpansionForCard(cardState, gameState);
    const addition = target.additions[0];
    const side = resolveExpansionSideForCard(target.side, addition.row, addition.col, gameState);
    const additionResult = addStateExpansionCells(gameState, [{
        side,
        row: addition.row,
        col: addition.col,
        owner: EMPTY
    }], cardState);
    if (!additionResult || additionResult.added !== true) {
        return {
            applied: false,
            reason: additionResult && additionResult.reason === 'coordinate_conflict'
                ? 'already_expanded'
                : 'invalid_target'
        };
    }

    boardExpansion.usedByPlayer[playerKey] = true;

    clearCardPendingEffect(cardState, playerKey);
    return { applied: true, side, row: addition.row, col: addition.col, directionKey: target.directionKey };
}

function applyBoardExpansionGod(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, directionKey: any, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const getBoardExpansionGodTargets = deps && deps.getBoardExpansionGodTargets;
    const getBoardExpansionGodRequiredSelectionCount = deps && deps.getBoardExpansionGodRequiredSelectionCount;
    const getBoardExpansionGodPendingSelectionsForCard = deps && deps.getBoardExpansionGodPendingSelectionsForCard;
    const ensureMutableBoardExpansionForCard = deps && deps.ensureMutableBoardExpansionForCard;
    const getExpansionDescriptorsForCard = deps && deps.getExpansionDescriptorsForCard;
    const getBoardExpansionGodSocketTargets = deps && deps.getBoardExpansionGodSocketTargets;
    const resolveExpansionSideForCard = deps && deps.resolveExpansionSideForCard;
    const normalizeExpansionOwnerForCard = deps && deps.normalizeExpansionOwnerForCard;
    const syncLegacyExpansionFieldsForCard = deps && deps.syncLegacyExpansionFieldsForCard;
    const addStateExpansionCells = deps && deps.addStateExpansionCells;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof getBoardExpansionGodTargets !== 'function' ||
        typeof getBoardExpansionGodRequiredSelectionCount !== 'function' ||
        typeof getBoardExpansionGodPendingSelectionsForCard !== 'function' ||
        typeof ensureMutableBoardExpansionForCard !== 'function' ||
        typeof getExpansionDescriptorsForCard !== 'function' ||
        typeof getBoardExpansionGodSocketTargets !== 'function' ||
        typeof resolveExpansionSideForCard !== 'function' ||
        typeof normalizeExpansionOwnerForCard !== 'function' ||
        typeof syncLegacyExpansionFieldsForCard !== 'function' ||
        typeof addStateExpansionCells !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'BOARD_EXPANSION_GOD' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const selectedTargets = getBoardExpansionGodPendingSelectionsForCard(pending);
    const confirmedTarget = selectedTargets.length === 1
        ? resolveExpansionTarget(selectedTargets, row, col, directionKey)
        : null;
    const targets = confirmedTarget
        ? []
        : getBoardExpansionGodTargets(cardState, gameState, playerKey);
    const selectedTarget = confirmedTarget || resolveExpansionTarget(targets, row, col, directionKey);
    if (!selectedTarget) return { applied: false, reason: 'invalid_target' };

    const maxSelections = confirmedTarget
        ? selectedTargets.length
        : getBoardExpansionGodRequiredSelectionCount(cardState, gameState, playerKey);
    if (maxSelections <= 0) return { applied: false, reason: 'invalid_target' };
    const nextSelections = confirmedTarget
        ? selectedTargets.map(copyExpansionTarget)
        : selectedTargets.concat(copyExpansionTarget(selectedTarget));

    if (nextSelections.length < maxSelections) {
        pending.selectedTargets = nextSelections;
        pending.selectedCount = pending.selectedTargets.length;
        pending.maxSelections = maxSelections;
        const remainingTargets = getBoardExpansionGodTargets(cardState, gameState, playerKey);
        if (remainingTargets.length > 0) {
            return {
                applied: true,
                completed: false,
                selectedCount: pending.selectedCount,
                maxSelections,
                remainingSelections: maxSelections - pending.selectedCount,
                target: copyExpansionTarget(selectedTarget),
                selectedTargets: pending.selectedTargets.map(copyExpansionTarget)
            };
        }
    }

    const currentSocketTargets = getBoardExpansionGodSocketTargets(cardState, gameState);
    const resolvedSelections = [];
    for (const target of nextSelections) {
        const resolved = resolveExpansionTarget(currentSocketTargets, target.row, target.col, target.directionKey);
        if (!resolved) return { applied: false, reason: 'invalid_target' };
        resolvedSelections.push(resolved);
    }

    const boardExpansion = ensureMutableBoardExpansionForCard(cardState, gameState);
    const cells = getExpansionDescriptorsForCard(cardState, gameState);
    const occupied = new Set(cells.map((cell: any) => `${cell.row},${cell.col}`));
    const additions = [];
    const additionKeys = new Set();
    for (const target of resolvedSelections) {
        if (!Array.isArray(target.additions) || target.additions.length !== 3) {
            return { applied: false, reason: 'invalid_target' };
        }
        for (const cell of target.additions) {
            const key = `${cell.row},${cell.col}`;
            if (occupied.has(key) || additionKeys.has(key)) {
                return { applied: false, reason: 'already_expanded' };
            }
            additionKeys.add(key);
            additions.push({ row: cell.row, col: cell.col });
        }
    }

    const additionResult = addStateExpansionCells(gameState, additions.map((cell: any) => ({
            side: resolveExpansionSideForCard(null, cell.row, cell.col, gameState),
            row: cell.row,
            col: cell.col,
            owner: EMPTY
        })), cardState);
    if (!additionResult || additionResult.added !== true) {
        return {
            applied: false,
            reason: additionResult && additionResult.reason === 'coordinate_conflict'
                ? 'already_expanded'
                : 'invalid_target'
        };
    }

    boardExpansion.usedByPlayer[playerKey] = true;

    clearCardPendingEffect(cardState, playerKey);
    return {
        applied: true,
        completed: true,
        source: copyExpansionTarget(selectedTarget),
        sources: resolvedSelections.map(copyExpansionTarget),
        selectedTargets: resolvedSelections.map(copyExpansionTarget),
        added: additions.map((cell: any) => ({ row: cell.row, col: cell.col }))
    };
}

    return {
        applyBoardExpansionWill,
        applyBoardExpansionGod
    };
}));
