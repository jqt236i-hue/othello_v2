/**
 * @file chain.ts
 * @description Chain-Will selection helpers (Shared between Browser and Headless)
 */

import { GameState } from '../../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

const SharedConstants = (typeof module === 'object' && module.exports)
    ? _require('../../../shared-constants')
    : (typeof self !== 'undefined' ? (self as any).SharedConstants : undefined);

const CardFlips = (typeof module === 'object' && module.exports)
    ? _require('./flips')
    : (typeof self !== 'undefined' ? (self as any).CardFlips : undefined);

const RandomSourceModule = (typeof module === 'object' && module.exports)
    ? _require('../cards-internal/random-source')
    : (typeof self !== 'undefined' ? (self as any).CardRandomSource : null);

const { DIRECTIONS } = SharedConstants || {};

if (!DIRECTIONS) throw new Error('SharedConstants.DIRECTIONS required');

interface Point { row: number; col: number }
interface ChainCandidate { from: Point; dir: any; score: number; flips: Point[] }
interface ChainResult { applied: boolean; flips: Point[]; chosen: ChainCandidate | null }

function normalizePoint(p: any): Point {
    if (Array.isArray(p)) return { row: p[0], col: p[1] };
    return { row: p.row, col: p.col };
}

/**
 * Find the best chain candidate (deterministic via injected PRNG)
 */
function findChainChoice(
    gameState: GameState,
    primaryFlips: any[],
    ownerVal: number,
    context: any = {},
    prng?: { random(): number }
): ChainResult {
    const candidatePoints: Point[] = [];
    const seen = new Set<string>();
    for (const f of (primaryFlips || [])) {
        const pt = normalizePoint(f);
        const key = `${pt.row},${pt.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (gameState.board[pt.row][pt.col] === ownerVal) {
            candidatePoints.push({ row: pt.row, col: pt.col });
        }
    }

    if (candidatePoints.length === 0) {
        return { applied: false, flips: [], chosen: null };
    }

    const candidates: ChainCandidate[] = [];
    for (const point of candidatePoints) {
        for (const dir of (DIRECTIONS || [])) {
            const flips = (CardFlips && typeof CardFlips.getDirectionalChainFlips === 'function')
                ? CardFlips.getDirectionalChainFlips(gameState, point.row, point.col, ownerVal, dir, context)
                : [];
            if (flips && flips.length > 0) {
                candidates.push({ from: { row: point.row, col: point.col }, dir, score: flips.length, flips });
            }
        }
    }

    if (candidates.length === 0) {
        return { applied: false, flips: [], chosen: null };
    }

    let maxScore = 0;
    for (const c of candidates) if (c.score > maxScore) maxScore = c.score;

    const top = candidates.filter(c => c.score === maxScore);
    const pickedIndex = (RandomSourceModule && typeof RandomSourceModule.resolveRandomIndex === 'function')
        ? RandomSourceModule.resolveRandomIndex(top.length, prng, null, 'CardChain')
        : Math.floor(prng!.random() * top.length);
    const chosen = top[pickedIndex];

    return { applied: true, flips: chosen.flips, chosen };
}

export = {
    findChainChoice
};
