/**
 * @file swap_with_enemy.ts
 * @description SWAP_WITH_ENEMY helper - TypeScript module for browser and Node.js
 */

import SharedConstantsImport = require('../../../shared-constants');
import SharedBoardUtilsImport = require('../../../shared/shared-board-utils');
import CardUtilsImport = require('../cards/utils');
import CoreImport = require('../core');
import BoardOpsImport = require('../board_ops');

const SharedConstants: any = SharedConstantsImport;
const SharedBoardUtils: any = SharedBoardUtilsImport;
const CardUtils: any = CardUtilsImport;
const CoreModule: any = CoreImport;
const DefaultBoardOps: any = BoardOpsImport;

const { BLACK, WHITE, EMPTY, CHARGE_MAX } = SharedConstants || {};
const P_BLACK = BLACK || 1;
const P_WHITE = WHITE || -1;
const P_EMPTY = (typeof EMPTY === 'number') ? EMPTY : 0;

interface SwapResult {
    swapped: boolean;
    flipped?: { row: number; col: number }[];
}

interface SwapDeps {
    BoardOps?: any;
    clearHyperactiveAtPositions?: (cardState: any, positions: { row: number; col: number }[]) => void;
    clearBombAt?: (cardState: any, row: number, col: number) => void;
    Core?: any;
    cardContext?: any;
    emitPresentationEvent?: (cardState: any, event: any) => void;
}

function normalizeFlips(flips: number[][]): [number, number][] {
    if (!Array.isArray(flips) || flips.length === 0) return [];
    return flips
        .filter(f => Array.isArray(f) && Number.isInteger(f[0]) && Number.isInteger(f[1]))
        .map(f => [f[0], f[1]] as [number, number]);
}

function getCellValue(gameState: any, cardState: any, row: number, col: number): number | null {
    if (!SharedBoardUtils || typeof SharedBoardUtils.getStateCellValue !== 'function') {
        throw new Error('SharedBoardUtils.getStateCellValue is required by SwapWithEnemy');
    }
    return SharedBoardUtils.getStateCellValue(gameState, row, col, cardState || null);
}

function setCellValue(gameState: any, cardState: any, row: number, col: number, value: number): boolean {
    if (!SharedBoardUtils || typeof SharedBoardUtils.setStateCellValue !== 'function') {
        throw new Error('SharedBoardUtils.setStateCellValue is required by SwapWithEnemy');
    }
    return SharedBoardUtils.setStateCellValue(gameState, row, col, value, cardState || null);
}

function resolveSwapFlips(gameState: any, cardState: any, row: number, col: number, player: number, context: any, core: any): [number, number][] {
    if (!core || typeof core.getFlipsWithContext !== 'function') return [];
    if (!gameState) return [];
    const prev = getCellValue(gameState, cardState, row, col);
    if (prev === null) return [];
    if (!setCellValue(gameState, cardState, row, col, P_EMPTY)) return [];
    try {
        const flipContext = Object.assign({}, context || {}, { cardState: cardState || null });
        return normalizeFlips(core.getFlipsWithContext(gameState, row, col, player, flipContext));
    } finally {
        setCellValue(gameState, cardState, row, col, prev);
    }
}

function resolveChargeGainMultiplier(cardState: any, playerKey: string): number {
    const source = cardState && cardState.chargeGainMultiplierByPlayer && typeof cardState.chargeGainMultiplierByPlayer === 'object'
        ? cardState.chargeGainMultiplierByPlayer
        : {};
    const raw = Number(source[playerKey]);
    return Number.isFinite(raw) && raw > 1 ? Math.floor(raw) : 1;
}

function applySwapWithEnemy(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: SwapDeps = {}): SwapResult {
    const boardOpsInstance = deps.BoardOps || DefaultBoardOps;
    const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;
    const clearBombAt = deps.clearBombAt;
    const core = deps.Core || CoreModule || null;
    const cardContext = deps.cardContext || {};
    const result: SwapResult = { swapped: false };
    if (!boardOpsInstance || typeof boardOpsInstance.changeAt !== 'function') {
        throw new Error('SwapWithEnemy requires BoardOps.changeAt for ownership changes');
    }

    const player = playerKey === 'black' ? P_BLACK : P_WHITE;
    const opponent = -player;

    if (!gameState || getCellValue(gameState, cardState, row, col) !== opponent) return result;

    const hasSpecialOrBomb = (cardState.markers || []).some((m: any) => {
        if (!m || m.row !== row || m.col !== col) return false;
        if (m.kind !== 'specialStone') return false;
        const isHiddenTrapForPlayer = !!(m.data && m.data.type === 'TRAP' && m.owner && m.owner !== playerKey);
        if (isHiddenTrapForPlayer) return false;
        const isExpiredUltimateHyperactive = !!(
            m.data &&
            m.data.type === 'ULTIMATE_HYPERACTIVE' &&
            Number.isFinite(Number(m.data.remainingOwnerTurns)) &&
            Number(m.data.remainingOwnerTurns) <= 0
        );
        if (isExpiredUltimateHyperactive) return false;
        return true;
    });
    if (hasSpecialOrBomb) return result;

    const changeResult = boardOpsInstance.changeAt(cardState, gameState, row, col, playerKey, 'SWAP', 'swap_with_enemy');
    if (!changeResult || changeResult.changed !== true) return result;

    if (typeof clearHyperactiveAtPositions === 'function') {
        clearHyperactiveAtPositions(cardState, [{ row, col }]);
    } else if (cardState.markers && cardState.markers.length) {
        (cardState as any).markers = cardState.markers.filter((s: any) =>
            !(
                s.kind === 'specialStone' &&
                s.data &&
                (s.data.type === 'HYPERACTIVE' || s.data.type === 'ESCAPE_HYPERACTIVE' || s.data.type === 'EXTREME_HYPERACTIVE') &&
                s.row === row &&
                s.col === col
            )
        );
    }

    const swapFlips = resolveSwapFlips(gameState, cardState, row, col, player, cardContext, core);
    const appliedSwapFlips: { row: number; col: number }[] = [];
    if (swapFlips.length > 0) {
        for (const [fr, fc] of swapFlips) {
            const changeRes = boardOpsInstance.changeAt(cardState, gameState, fr, fc, playerKey, 'SWAP', 'swap_with_enemy_capture');
            const changed = !!(changeRes && changeRes.changed);
            if (!changed) continue;
            if (typeof clearBombAt === 'function') {
                clearBombAt(cardState, fr, fc);
            }
            appliedSwapFlips.push({ row: fr, col: fc });
        }
        if (appliedSwapFlips.length > 0 && typeof clearHyperactiveAtPositions === 'function') {
            clearHyperactiveAtPositions(cardState, appliedSwapFlips);
        }
    }

    (cardState as any).pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
    (cardState as any).pendingEffectByPlayer[playerKey] = null;

    (cardState as any).charge = cardState.charge || { black: 0, white: 0 };
    const chargeGain = 1 + appliedSwapFlips.length;
    const requestedChargeGain = chargeGain * resolveChargeGainMultiplier(cardState, playerKey);
    const chargeMeta = {
        popupKind: 'board',
        sourceType: 'swap_flip_gain',
        anchorRow: row,
        anchorCol: col
    };
    let added = 0;
    if (CardUtils && typeof CardUtils.addChargeWithDelta === 'function') {
        const deltaRes = CardUtils.addChargeWithDelta(cardState, playerKey, requestedChargeGain, 'swap_flip_gain', chargeMeta);
        added = deltaRes ? (Number(deltaRes.delta) || 0) : 0;
    } else {
        const before = Number((cardState as any).charge[playerKey] || 0);
        (cardState as any).charge[playerKey] = Math.min(CHARGE_MAX || 99, ((cardState as any).charge[playerKey] || 0) + requestedChargeGain);
        added = Number((cardState as any).charge[playerKey] || 0) - before;
    }
    if (added > 0 && typeof deps.emitPresentationEvent === 'function') {
        deps.emitPresentationEvent(cardState, {
            type: 'CHARGE_BUBBLE',
            player: playerKey,
            row,
            col,
            gained: added,
            meta: {
                owner: playerKey,
                sourceType: 'swap_flip_gain'
            }
        });
    }

    result.swapped = true;
    result.flipped = appliedSwapFlips.slice();
    return result;
}

export = {
    applySwapWithEnemy
};
