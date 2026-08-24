/**
 * @file chain.ts
 * @description Chain-Will selection helpers (Shared between Browser and Headless)
 */

import { GameState } from '../../../src/types';
import SharedConstantsImport = require('../../../shared-constants');
import CardFlipsImport = require('./flips');
import RandomSourceImport = require('../cards-internal/random-source');

const SharedConstants: any = SharedConstantsImport;
const CardFlips: any = CardFlipsImport;
const RandomSourceModule: any = RandomSourceImport;

const { DIRECTIONS } = SharedConstants || {};

if (!DIRECTIONS) throw new Error('SharedConstants.DIRECTIONS required');
if (!CardFlips || typeof CardFlips.getDirectionalChainFlips !== 'function') {
    throw new Error('CardFlips.getDirectionalChainFlips required');
}

interface Point { row: number; col: number }
interface ChainCandidate { from: Point; dir: any; score: number; flips: Point[] }
interface ChainResult { applied: boolean; flips: Point[]; chosen: ChainCandidate | null }
type ApplyChainDeps = {
    readCardPendingEffect: (cardState: any, playerKey: any) => any;
    getChainWillConfig: (pendingType: any) => any;
    blackValue: any;
    whiteValue: any;
    getCardContext: (cardState: any) => any;
    defaultPrng: any;
    resolveChainWillMaxLinks: (cardState: any, gameState: any, chainConfig: any) => any;
    findChainChoice?: (gameState: any, primaryFlips: any[], ownerVal: number, context: any, prng?: { random(): number }) => ChainResult;
    createBoardViewForCard: (cardState: any, gameState: any) => any;
    setBoardCellForCard: (cardState: any, gameState: any, row: any, col: any, value: any) => boolean;
    BoardOpsModule?: any;
    eventCause: any;
    clearBombAt: (cardState: any, row: any, col: any) => any;
    clearHyperactiveAtPositions: (cardState: any, positions: any[]) => any;
};

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
    const boardView = context && context.boardView;
    if (!boardView || typeof boardView.get !== 'function') {
        throw new Error('[chain] an explicit BoardView is required');
    }
    const candidatePoints: Point[] = [];
    const seen = new Set<string>();
    for (const f of (primaryFlips || [])) {
        const pt = normalizePoint(f);
        const key = `${pt.row},${pt.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (boardView.get(pt.row, pt.col) === ownerVal) {
            candidatePoints.push({ row: pt.row, col: pt.col });
        }
    }

    if (candidatePoints.length === 0) {
        return { applied: false, flips: [], chosen: null };
    }

    const candidates: ChainCandidate[] = [];
    for (const point of candidatePoints) {
        for (const dir of (DIRECTIONS || [])) {
            const flips = CardFlips.getDirectionalChainFlips(gameState, point.row, point.col, ownerVal, dir, context);
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

function applyChainWillAfterMove(cardState: any, gameState: any, playerKey: any, primaryFlips: any, prng: any, deps: ApplyChainDeps): any {
    const pending = deps.readCardPendingEffect(cardState, playerKey);
    const chainConfig = pending ? deps.getChainWillConfig(pending.type) : null;
    if (!pending || !chainConfig) {
        return { applied: false, flips: [], chosen: null };
    }
    if (typeof deps.createBoardViewForCard !== 'function') {
        throw new Error('[chain] createBoardViewForCard is required');
    }
    if (
        (!deps.BoardOpsModule || typeof deps.BoardOpsModule.changeAt !== 'function') &&
        typeof deps.setBoardCellForCard !== 'function'
    ) {
        throw new Error('[chain] setBoardCellForCard is required without BoardOps.changeAt');
    }

    const playerValue = playerKey === 'black' ? (deps.blackValue || 1) : (deps.whiteValue || -1);
    const baseContext = Object.assign({}, deps.getCardContext(cardState) || {}, { cardState });
    const p = prng || deps.defaultPrng;
    const choose = deps.findChainChoice || findChainChoice;

    const appliedFlips = [];
    const chosenSteps = [];
    let sourceFlips = Array.isArray(primaryFlips) ? primaryFlips.slice() : [];
    const maxLinks = deps.resolveChainWillMaxLinks(cardState, gameState, chainConfig);
    for (let i = 0; i < maxLinks; i++) {
        const context = Object.assign({}, baseContext, {
            boardView: deps.createBoardViewForCard(cardState, gameState)
        });
        const res = choose(gameState, sourceFlips, playerValue, context, p);
        if (!res || !res.applied || !Array.isArray(res.flips) || res.flips.length === 0) break;
        const chainLink = i + 1;
        const appliedThisLink = [];
        for (const pos of res.flips) {
            let changed = true;
            if (deps.BoardOpsModule && typeof deps.BoardOpsModule.changeAt === 'function') {
                const changeRes = deps.BoardOpsModule.changeAt(cardState, gameState, pos.row, pos.col, playerKey, deps.eventCause, 'chain_flip', { chainLink });
                changed = !!(changeRes && changeRes.changed);
            } else {
                changed = deps.setBoardCellForCard(cardState, gameState, pos.row, pos.col, playerValue);
            }
            if (!changed) continue;
            deps.clearBombAt(cardState, pos.row, pos.col);
            const appliedPos = { row: pos.row, col: pos.col };
            appliedThisLink.push(appliedPos);
            appliedFlips.push(appliedPos);
        }
        if (appliedThisLink.length > 0) {
            deps.clearHyperactiveAtPositions(cardState, appliedThisLink);
            chosenSteps.push(res.chosen || null);
        }
        sourceFlips = appliedThisLink;
        if (sourceFlips.length === 0) break;
    }
    if (appliedFlips.length === 0) return { applied: false, flips: [], chosen: null, chosenSteps: [] };
    return { applied: true, flips: appliedFlips, chosen: chosenSteps[chosenSteps.length - 1] || null, chosenSteps };
}

export = {
    findChainChoice,
    applyChainWillAfterMove
};
