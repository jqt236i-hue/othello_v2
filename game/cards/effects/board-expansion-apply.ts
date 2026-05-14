import type { CardState, GameState, PlayerKey } from '../../../src/types';

(function (root: any, factory: any) {
    if (root && root.SharedConstants) {
        root.CardBoardExpansionApply = factory(root.SharedConstants);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardBoardExpansionApply = factory(root.SharedConstants);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (SharedConstants: any) {
    'use strict';

    const { EMPTY } = SharedConstants || {};

function applyBoardExpansionWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const getBoardExpansionTargets = deps && deps.getBoardExpansionTargets;
    const ensureMutableBoardExpansionForCard = deps && deps.ensureMutableBoardExpansionForCard;
    const getExpansionDescriptorsForCard = deps && deps.getExpansionDescriptorsForCard;
    const resolveExpansionSideForCard = deps && deps.resolveExpansionSideForCard;
    const normalizeExpansionOwnerForCard = deps && deps.normalizeExpansionOwnerForCard;
    const syncLegacyExpansionFieldsForCard = deps && deps.syncLegacyExpansionFieldsForCard;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof getBoardExpansionTargets !== 'function' ||
        typeof ensureMutableBoardExpansionForCard !== 'function' ||
        typeof getExpansionDescriptorsForCard !== 'function' ||
        typeof resolveExpansionSideForCard !== 'function' ||
        typeof normalizeExpansionOwnerForCard !== 'function' ||
        typeof syncLegacyExpansionFieldsForCard !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'BOARD_EXPANSION_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const targets = getBoardExpansionTargets(cardState, gameState, playerKey);
    const allowed = targets.some((t: any) => t.row === row && t.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const side = col === 0 ? 'left' : (col === 7 ? 'right' : null);
    if (!side || !Number.isInteger(row) || row < 0 || row >= 8) {
        return { applied: false, reason: 'invalid_target' };
    }

    const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
    const cells = getExpansionDescriptorsForCard(gameState);
    const targetCol = side === 'left' ? -1 : 8;
    const alreadyExists = cells.some((cell: any) => cell && cell.row === row && cell.col === targetCol);
    if (alreadyExists) return { applied: false, reason: 'already_expanded' };

    cells.push({ side, row, col: targetCol, owner: EMPTY });

    boardExpansion.cells = cells.map((cell: any) => ({
        side: resolveExpansionSideForCard(cell.side, cell.row, cell.col),
        row: cell.row,
        col: cell.col,
        owner: normalizeExpansionOwnerForCard(cell.owner)
    }));
    syncLegacyExpansionFieldsForCard(boardExpansion);

    boardExpansion.usedByPlayer[playerKey] = true;

    clearCardPendingEffect(cardState, playerKey);
    return { applied: true, side, row, col: targetCol };
}

function applyBoardExpansionGod(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const getBoardExpansionGodTargets = deps && deps.getBoardExpansionGodTargets;
    const getBoardExpansionGodRequiredSelectionCount = deps && deps.getBoardExpansionGodRequiredSelectionCount;
    const getBoardExpansionGodPendingSelectionsForCard = deps && deps.getBoardExpansionGodPendingSelectionsForCard;
    const ensureMutableBoardExpansionForCard = deps && deps.ensureMutableBoardExpansionForCard;
    const getExpansionDescriptorsForCard = deps && deps.getExpansionDescriptorsForCard;
    const getBoardExpansionGodAdditionsForCard = deps && deps.getBoardExpansionGodAdditionsForCard;
    const resolveExpansionSideForCard = deps && deps.resolveExpansionSideForCard;
    const normalizeExpansionOwnerForCard = deps && deps.normalizeExpansionOwnerForCard;
    const syncLegacyExpansionFieldsForCard = deps && deps.syncLegacyExpansionFieldsForCard;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof getBoardExpansionGodTargets !== 'function' ||
        typeof getBoardExpansionGodRequiredSelectionCount !== 'function' ||
        typeof getBoardExpansionGodPendingSelectionsForCard !== 'function' ||
        typeof ensureMutableBoardExpansionForCard !== 'function' ||
        typeof getExpansionDescriptorsForCard !== 'function' ||
        typeof getBoardExpansionGodAdditionsForCard !== 'function' ||
        typeof resolveExpansionSideForCard !== 'function' ||
        typeof normalizeExpansionOwnerForCard !== 'function' ||
        typeof syncLegacyExpansionFieldsForCard !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'BOARD_EXPANSION_GOD' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const targets = getBoardExpansionGodTargets(cardState, gameState, playerKey);
    const allowed = targets.some((target: any) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target' };

    const maxSelections = getBoardExpansionGodRequiredSelectionCount(cardState, gameState, playerKey);
    if (maxSelections <= 0) return { applied: false, reason: 'invalid_target' };
    const selectedTargets = getBoardExpansionGodPendingSelectionsForCard(pending);
    const nextSelections = selectedTargets.concat({ row, col }).map((target: any) => ({ row: target.row, col: target.col }));

    if (nextSelections.length < maxSelections) {
        pending.selectedTargets = nextSelections;
        pending.selectedCount = pending.selectedTargets.length;
        pending.maxSelections = maxSelections;
        return {
            applied: true,
            completed: false,
            selectedCount: pending.selectedCount,
            maxSelections,
            remainingSelections: maxSelections - pending.selectedCount,
            target: { row, col },
            selectedTargets: pending.selectedTargets.map((target: any) => ({ row: target.row, col: target.col }))
        };
    }

    const boardExpansion = ensureMutableBoardExpansionForCard(gameState);
    const cells = getExpansionDescriptorsForCard(gameState);
    const occupied = new Set(cells.map((cell: any) => `${cell.row},${cell.col}`));
    const additions = [];
    const additionKeys = new Set();
    for (const target of nextSelections) {
        const targetAdditions = getBoardExpansionGodAdditionsForCard(target.row, target.col);
        if (!targetAdditions || targetAdditions.length !== 3) {
            return { applied: false, reason: 'invalid_target' };
        }
        for (const cell of targetAdditions) {
            const key = `${cell.row},${cell.col}`;
            if (occupied.has(key) || additionKeys.has(key)) {
                return { applied: false, reason: 'already_expanded' };
            }
            additionKeys.add(key);
            additions.push({ row: cell.row, col: cell.col });
        }
    }

    for (const cell of additions) {
        cells.push({
            side: resolveExpansionSideForCard(null, cell.row, cell.col),
            row: cell.row,
            col: cell.col,
            owner: EMPTY
        });
    }

    boardExpansion.cells = cells.map((cell: any) => ({
        side: resolveExpansionSideForCard(cell.side, cell.row, cell.col),
        row: cell.row,
        col: cell.col,
        owner: normalizeExpansionOwnerForCard(cell.owner)
    }));
    syncLegacyExpansionFieldsForCard(boardExpansion);

    boardExpansion.usedByPlayer[playerKey] = true;

    clearCardPendingEffect(cardState, playerKey);
    return {
        applied: true,
        completed: true,
        source: { row, col },
        sources: nextSelections.map((target: any) => ({ row: target.row, col: target.col })),
        selectedTargets: nextSelections.map((target: any) => ({ row: target.row, col: target.col })),
        added: additions.map((cell: any) => ({ row: cell.row, col: cell.col }))
    };
}

    return {
        applyBoardExpansionWill,
        applyBoardExpansionGod
    };
}));
