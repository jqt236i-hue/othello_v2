/**
 * @file flips.ts
 * @description Flip calculation helpers (Shared between Browser and Headless)
 */

import { GameState } from '../../../src/types';
import SharedConstantsImport = require('../../../shared-constants');
import SharedBoardUtilsImport = require('../../../shared/shared-board-utils');

const SharedConstants: any = SharedConstantsImport;
const SharedBoardUtils: any = SharedBoardUtilsImport;

const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};

if (DIRECTIONS === undefined || EMPTY === undefined) {
    throw new Error('SharedConstants missing DIRECTIONS/EMPTY');
}

function requireBoardUtils(): any {
    if (
        !SharedBoardUtils ||
        typeof SharedBoardUtils.createBoardContext !== 'function' ||
        typeof SharedBoardUtils.createBoardView !== 'function'
    ) {
        throw new Error('SharedBoardUtils.createBoardContext/createBoardView are required by CardFlips');
    }
    return SharedBoardUtils;
}

function resolveExplicitCardState(gameState: GameState, context: any): any {
    if (context && Object.prototype.hasOwnProperty.call(context, 'cardState')) {
        return context.cardState;
    }
    if (gameState && Object.prototype.hasOwnProperty.call(gameState as any, 'cardState')) {
        return (gameState as any).cardState;
    }
    const blockedCells = context && Array.isArray(context.blockedCells)
        ? context.blockedCells
        : [];
    return {
        markers: blockedCells
            .filter((cell: any) => String(cell && cell.type || '').toUpperCase() === 'METEOR_HOLE')
            .map((cell: any) => ({
                kind: 'specialStone',
                row: cell.row,
                col: cell.col,
                data: { type: 'METEOR_HOLE' }
            }))
    };
}

function createFlipBoardView(gameState: GameState, context: any): any {
    const boardUtils = requireBoardUtils();
    const boardContext = boardUtils.createBoardContext(
        gameState,
        resolveExplicitCardState(gameState, context)
    );
    return boardUtils.createBoardView(boardContext.gameState, {
        cardState: boardContext.cardState,
        strict: false
    });
}

function getDirectionalChainFlips(gameState: GameState, row: number, col: number, ownerVal: number, dir: number[], context: any): Array<{row: number; col: number}> {
    const protectedStones = context.protectedStones || [];
    const permaProtectedStones = context.permaProtectedStones || [];
    const blockedCells = context.blockedCells || [];

    const protectedSet = protectedStones.length
        ? new Set(protectedStones.map((p: any) => `${p.row},${p.col}`))
        : null;
    const permaSet = permaProtectedStones.length
        ? new Set(permaProtectedStones.map((p: any) => `${p.row},${p.col}`))
        : null;
    const blockedSet = blockedCells.length
        ? new Set(blockedCells.map((p: any) => `${p.row},${p.col}`))
        : null;

    const [dr, dc] = dir;
    const view = createFlipBoardView(gameState, context);
    const flips: Array<{row: number; col: number}> = [];
    let r = row + dr;
    let c = col + dc;
    while (view.get(r, c) === -ownerVal) {
        const key = `${r},${c}`;
        if (blockedSet && blockedSet.has(key)) {
            return [];
        }
        if ((protectedSet && protectedSet.has(key)) ||
            (permaSet && permaSet.has(key))) {
            flips.length = 0;
            break;
        }
        flips.push({ row: r, col: c });
        r += dr;
        c += dc;
    }

    if (flips.length === 0) return [];
    if (blockedSet && blockedSet.has(`${r},${c}`)) return [];
    if (view.get(r, c) !== ownerVal) return [];
    return flips;
}

function getFlipsWithContext(state: GameState, row: number, col: number, player: number, context: any = {}): number[][] {
    const blockedCells = context.blockedCells || [];
    const protectedStones = context.protectedStones || [];
    const permaProtectedStones = context.permaProtectedStones || [];
    const view = createFlipBoardView(state, context);
    return view.getFlips(row, col, player, {
        blockedKeys: blockedCells.map((p: any) => `${p.row},${p.col}`),
        protectedKeys: protectedStones.map((p: any) => `${p.row},${p.col}`),
        permanentProtectedKeys: permaProtectedStones.map((p: any) => `${p.row},${p.col}`)
    }).map((cell: any) => [cell.row, cell.col]);
}

function getOccupiedOriginFlipsWithContext(state: GameState, row: number, col: number, player: number, context: any = {}): number[][] {
    const view = createFlipBoardView(state, context);
    if (view.get(row, col) !== player) return [];
    const allFlips: number[][] = [];
    for (const dir of (DIRECTIONS || [])) {
        const flips = getDirectionalChainFlips(state, row, col, player, dir, context);
        if (flips && flips.length) {
            for (const f of flips) allFlips.push([f.row, f.col]);
        }
    }
    return allFlips;
}

export = {
    getDirectionalChainFlips,
    getFlipsWithContext,
    getOccupiedOriginFlipsWithContext
};
