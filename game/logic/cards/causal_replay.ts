/**
 * @file causal_replay.ts
 * @description Causal replay helpers (Shared between Browser and Headless)
 */

import { CardState, GameState } from '../../../src/types';

interface CausalReplayDeps {
    getCausalReplayTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<{row: number; col: number}>;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: any): boolean;
    clearStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number): any;
    removeMarkersAt?(cardState: CardState, row: number, col: number, options?: any): any;
    emitPresentationEvent?(cardState: CardState, event: any): any;
    clearCardPendingEffect?(cardState: CardState, playerKey: string): any;
    MARKER_KINDS?: { SPECIAL_STONE?: string };
    EMPTY?: any;
}

interface CausalReplayResult {
    applied: boolean;
    reason?: string;
    row?: number;
    col?: number;
    restored?: boolean;
}

function getSpecialStoneKind(deps: CausalReplayDeps): string {
    return (deps && deps.MARKER_KINDS && deps.MARKER_KINDS.SPECIAL_STONE) || 'specialStone';
}

function findMeteorHoleMarker(cardState: CardState, row: number, col: number, deps: CausalReplayDeps): any {
    const specialStoneKind = getSpecialStoneKind(deps);
    const markers = (cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : [];
    return markers.find((marker: any) => (
        marker &&
        marker.kind === specialStoneKind &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === 'METEOR_HOLE'
    )) || null;
}

function hasMeteorHoleMarker(cardState: CardState, row: number, col: number, deps: CausalReplayDeps): boolean {
    return !!findMeteorHoleMarker(cardState, row, col, deps);
}

function clearPending(cardState: CardState, playerKey: string, deps: CausalReplayDeps): void {
    if (deps && typeof deps.clearCardPendingEffect === 'function') {
        deps.clearCardPendingEffect(cardState, playerKey);
        return;
    }
    if ((cardState as any) && (cardState as any).pendingEffectByPlayer) {
        (cardState as any).pendingEffectByPlayer[playerKey] = null;
    }
}

function applyCausalReplayWill(
    cardState: CardState,
    gameState: GameState,
    playerKey: string,
    row: number,
    col: number,
    deps: CausalReplayDeps = {}
): CausalReplayResult {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'CAUSAL_REPLAY_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const getCausalReplayTargets = deps.getCausalReplayTargets || (() => []);
    const targets = getCausalReplayTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed || !hasMeteorHoleMarker(cardState, row, col, deps)) {
        return { applied: false, reason: 'invalid_target', row, col };
    }
    if (typeof deps.setCellValueForCard !== 'function' || typeof deps.removeMarkersAt !== 'function') {
        return { applied: false, reason: 'deps_missing', row, col };
    }

    const holeMarker = findMeteorHoleMarker(cardState, row, col, deps);
    const emptyValue = Object.prototype.hasOwnProperty.call(deps, 'EMPTY') ? deps.EMPTY : 0;
    if (typeof deps.clearStoneIdAtForCard === 'function') {
        deps.clearStoneIdAtForCard(cardState, gameState, row, col);
    }
    const restoredCell = deps.setCellValueForCard(gameState, row, col, emptyValue);
    if (restoredCell === false) {
        return { applied: false, reason: 'restore_failed', row, col };
    }

    deps.removeMarkersAt(cardState, row, col, {
        kind: getSpecialStoneKind(deps),
        type: 'METEOR_HOLE'
    });
    if (hasMeteorHoleMarker(cardState, row, col, deps)) {
        return { applied: false, reason: 'marker_not_removed', row, col };
    }

    if (typeof deps.emitPresentationEvent === 'function') {
        deps.emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED',
            row,
            col,
            cause: 'CAUSAL_REPLAY_WILL',
            reason: 'causal_replay_selected',
            meta: {
                special: 'METEOR_HOLE',
                owner: (holeMarker && holeMarker.owner) || playerKey,
                timer: null,
                cellRestorationCause: 'CAUSAL_REPLAY_WILL',
                restoredAs: 'normal_empty_cell',
                highlightTone: 'positive'
            }
        });
    }

    clearPending(cardState, playerKey, deps);
    return { applied: true, row, col, restored: true };
}

export = {
    applyCausalReplayWill
};
