/**
 * @file targets.ts
 * @description Card target selection helpers (Shared between Browser and Headless)
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

function getRuntimeGlobalValue(key: string): any {
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return undefined;
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

function resolveTargetsModuleOrGlobal(id: string, globalKey: string): any {
    if (typeof module === 'object' && module.exports) {
        return safeRequire(id) || getRuntimeGlobalValue(globalKey);
    }

    return getRuntimeGlobalValue(globalKey);
}

const SharedConstants = resolveTargetsModuleOrGlobal('../../../shared-constants', 'SharedConstants');
const BoardUtils = resolveTargetsModuleOrGlobal('../../../shared/shared-board-utils', 'SharedBoardUtils');

const { EMPTY } = SharedConstants || {};
const P_EMPTY = (EMPTY === undefined || EMPTY === null) ? 0 : EMPTY;

function requireBoardUtils(): any {
    if (
        !BoardUtils ||
        typeof BoardUtils.createBoardContext !== 'function' ||
        typeof BoardUtils.createBoardView !== 'function'
    ) {
        throw new Error('SharedBoardUtils BoardContext APIs are required by CardTargets');
    }
    return BoardUtils;
}

function createBoardView(cardState: any, gameState: GameState): any {
    const boardUtils = requireBoardUtils();
    const context = boardUtils.createBoardContext(gameState, cardState);
    return boardUtils.createBoardView(context.gameState, {
        cardState: context.cardState,
        strict: false
    });
}

function getCellValue(cardState: any, gameState: GameState, row: number, col: number): number | null {
    return createBoardView(cardState, gameState).get(row, col);
}

function forEachBoardShapeCell(cardState: any, gameState: GameState, visitor: (row: number, col: number, value: number) => void) {
    if (typeof visitor !== 'function') return;
    const view = createBoardView(cardState, gameState);
    for (const cell of view.coordinates) {
        const value = view.get(cell.row, cell.col);
        if (value === null) {
            throw new Error(`BoardView owner missing at ${cell.row},${cell.col}`);
        }
        visitor(cell.row, cell.col, value);
    }
}

function getCardUtils(): any {
    return ((typeof module === 'object' && module.exports) ? safeRequire('./utils') : null) || getRuntimeGlobalValue('CardUtils');
}

function normalizeMarkerType(marker: any): string {
    return String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
}

function isGhostStoneStatusMarker(cardUtils: any, markerEntry: any): boolean {
    const marker = markerEntry && markerEntry.marker ? markerEntry.marker : markerEntry;
    if (!marker) return false;
    if (normalizeMarkerType(marker) !== 'GHOST') return false;
    if (cardUtils && typeof cardUtils.getMarkerRuleClass === 'function') {
        return cardUtils.getMarkerRuleClass(marker) === 'stone_status';
    }
    return true;
}

function unwrapMarkerEntry(markerEntry: any): any | null {
    return markerEntry && markerEntry.marker ? markerEntry.marker : markerEntry;
}

function isFallbackTemptTargetableMarker(cardUtils: any, marker: any): boolean {
    if (!marker || !marker.data) return false;
    const type = normalizeMarkerType(marker);
    if (type === 'GUARD') return false;
    const ruleClass = cardUtils && typeof cardUtils.getMarkerRuleClass === 'function'
        ? cardUtils.getMarkerRuleClass(marker)
        : null;
    return ruleClass === 'true_special_stone' || ruleClass === 'trap' || ruleClass === 'bomb' || type === 'LIVING_WILL';
}

function isTemptTargetableMarkerForCard(cardUtils: any, marker: any): boolean {
    if (!marker) return false;
    if (cardUtils && typeof cardUtils.isTemptTargetableMarker === 'function') {
        return cardUtils.isTemptTargetableMarker(marker) === true;
    }
    return isFallbackTemptTargetableMarker(cardUtils, marker);
}

function isCaptureTargetableMarkerForCard(cardUtils: any, marker: any): boolean {
    if (!marker) return false;
    if (cardUtils && typeof cardUtils.isCaptureTargetableMarker === 'function') {
        return cardUtils.isCaptureTargetableMarker(marker) === true;
    }
    if (isGhostStoneStatusMarker(cardUtils, marker)) return true;
    const ruleClass = cardUtils && typeof cardUtils.getMarkerRuleClass === 'function'
        ? cardUtils.getMarkerRuleClass(marker)
        : null;
    return ruleClass === 'true_special_stone';
}

function getMarkersAtCell(cardState: any, row: number, col: number): any[] {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.filter((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col
    ));
}

function blocksTemptAt(cardUtils: any, cardState: any, row: number, col: number): boolean {
    if (cardUtils && typeof cardUtils.blocksTemptAt === 'function') {
        return cardUtils.blocksTemptAt(cardState, row, col) === true;
    }
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.some((marker: any) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === 'GUARD'
    ));
}

function getCaptureMarkerAt(cardState: any, row: number, col: number): any | null {
    const cardUtils = getCardUtils();
    if (cardUtils && typeof cardUtils.getTrueSpecialStoneMarkerAt === 'function') {
        const trueSpecial = cardUtils.getTrueSpecialStoneMarkerAt(cardState, row, col);
        const marker = unwrapMarkerEntry(trueSpecial);
        if (isCaptureTargetableMarkerForCard(cardUtils, marker)) return trueSpecial;
    }
    if (cardUtils && typeof cardUtils.getSpecialMarkerAt === 'function') {
        const markerEntry = cardUtils.getSpecialMarkerAt(cardState, row, col);
        const marker = unwrapMarkerEntry(markerEntry);
        if (isCaptureTargetableMarkerForCard(cardUtils, marker)) return markerEntry;
        return null;
    }
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.find((marker: any) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.row === row &&
        marker.col === col &&
        isCaptureTargetableMarkerForCard(cardUtils, marker)
    )) || null;
}

function getTemptWillTargets(cardState: any, gameState: GameState, playerKey: string): Array<{row: number; col: number}> {
    const opponentKey = playerKey === 'black' ? 'white' : 'black';
    const res: Array<{row: number; col: number}> = [];
    const CardUtils = getCardUtils();
    forEachBoardShapeCell(cardState, gameState, (r, c) => {
        if (blocksTemptAt(CardUtils, cardState, r, c)) return;
        const markersAtCell = getMarkersAtCell(cardState, r, c);
        const targetMarker = markersAtCell.find((marker: any) => (
            marker &&
            marker.owner === opponentKey &&
            isTemptTargetableMarkerForCard(CardUtils, marker)
        )) || null;
        if (!targetMarker) return;
        if (getCellValue(cardState, gameState, r, c) === P_EMPTY) return;
        res.push({ row: r, col: c });
    });
    return res;
}

function getCaptureWillTargets(cardState: any, gameState: GameState, playerKey: string): Array<{row: number; col: number}> {
    const targets = getTemptWillTargets(cardState, gameState, playerKey);
    return targets.filter((target) => !!getCaptureMarkerAt(cardState, target.row, target.col));
}

export = {
    getTemptWillTargets,
    getCaptureWillTargets
};
