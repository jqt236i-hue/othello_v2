declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../../src/types';

declare const CHARGE_MAX: any;

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

function getRuntimeGlobalValue(key: string): any {
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return undefined;
}

const SharedConstants = safeRequire('../../../shared-constants') || getRuntimeGlobalValue('SharedConstants');

let OwnerHelpersModule: any = null;
OwnerHelpersModule = safeRequire('../../../utils/owner-helpers') || getRuntimeGlobalValue('OwnerHelpers');

function normalizePlayerKey(playerKey: any): string | null {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            return OwnerHelpersModule.normalizePlayerKeyOptional(playerKey);
        }
    } catch (e) { /* ignore */ }

    const normalized = String(playerKey == null ? '' : playerKey).trim().toLowerCase();
    if (playerKey === 1 || normalized === '1' || normalized === '+1' || normalized === 'black' || normalized === 'b') {
        return 'black';
    }
    if (playerKey === -1 || normalized === '-1' || normalized === 'white' || normalized === 'w') {
        return 'white';
    }
    return null;
}

function ensureChargeState(cardState: any): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.charge || typeof cardState.charge !== 'object') {
        cardState.charge = { black: 0, white: 0 };
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'black')) cardState.charge.black = 0;
    if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'white')) cardState.charge.white = 0;
}

function ensureChargeDeltaQueue(cardState: any): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!Array.isArray(cardState.chargeDeltaEvents)) {
        cardState.chargeDeltaEvents = [];
    }
    const nextSeq = Number(cardState._nextChargeDeltaSeq);
    cardState._nextChargeDeltaSeq = Number.isFinite(nextSeq) && nextSeq >= 1
        ? Math.trunc(nextSeq)
        : 1;
}

function resolveChargeMax(): number {
    if (SharedConstants && Number.isFinite(Number(SharedConstants.CHARGE_MAX))) {
        return Number(SharedConstants.CHARGE_MAX);
    }
    try {
        if (typeof CHARGE_MAX !== 'undefined' && Number.isFinite(Number(CHARGE_MAX))) {
            return Number(CHARGE_MAX);
        }
    } catch (e) { /* ignore */ }
    return 99;
}

function normalizeChargeDeltaMeta(meta: any): any {
    if (!meta || typeof meta !== 'object') return null;

    const popupKind = String(meta.popupKind || '').trim();
    if (popupKind !== 'board') return null;

    if (!Number.isInteger(meta.anchorRow) || !Number.isInteger(meta.anchorCol)) {
        throw new Error('board popup requires integer anchorRow/anchorCol');
    }
    const anchorRow = Number(meta.anchorRow);
    const anchorCol = Number(meta.anchorCol);

    const normalizedMeta: any = {
        popupKind: 'board',
        anchorRow,
        anchorCol
    };
    const sourceType = String(meta.sourceType || '').trim();
    if (sourceType) normalizedMeta.sourceType = sourceType;
    return normalizedMeta;
}

function appendChargeDeltaEvent(cardState: any, normalizedPlayerKey: string, delta: number, before: number, after: number, reason: any, meta: any): void {
    if (!cardState || !delta) return;
    ensureChargeDeltaQueue(cardState);
    const event: any = {
        seq: cardState._nextChargeDeltaSeq,
        player: normalizedPlayerKey,
        delta,
        before,
        after,
        reason: reason
    };
    const normalizedMeta = normalizeChargeDeltaMeta(meta);
    if (normalizedMeta) Object.assign(event, normalizedMeta);
    cardState.chargeDeltaEvents.push(event);
    cardState._nextChargeDeltaSeq += 1;
}

function setChargeWithDelta(cardState: any, playerKey: any, nextValue: any, reason: any, meta?: any): { changed: boolean; before: number; after: number; delta: number } {
    const normalized = normalizePlayerKey(playerKey);
    if (!cardState || !normalized) return { changed: false, before: 0, after: 0, delta: 0 };

    ensureChargeState(cardState);
    ensureChargeDeltaQueue(cardState);

    const beforeRaw = Number(cardState.charge && cardState.charge[normalized]);
    const safeBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
    const requested = Number(nextValue);
    const safeRequested = Number.isFinite(requested) ? requested : safeBefore;
    const after = Math.max(0, Math.min(resolveChargeMax(), safeRequested));
    const delta = after - safeBefore;

    cardState.charge[normalized] = after;
    if (delta !== 0) {
        appendChargeDeltaEvent(cardState, normalized, delta, safeBefore, after, reason, meta);
    }

    return {
        changed: delta !== 0,
        before: safeBefore,
        after,
        delta
    };
}

function addChargeWithDelta(cardState: any, playerKey: any, amount: any, reason: any, meta?: any): { changed: boolean; before: number; after: number; delta: number } {
    const normalized = normalizePlayerKey(playerKey);
    if (!cardState || !normalized) return { changed: false, before: 0, after: 0, delta: 0 };

    ensureChargeState(cardState);
    const beforeRaw = Number(cardState.charge && cardState.charge[normalized]);
    const safeBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
    const add = Number(amount);
    const safeAdd = Number.isFinite(add) ? add : 0;
    return setChargeWithDelta(cardState, normalized, safeBefore + safeAdd, reason, meta);
}

function addCharge(cardState: any, playerKey: any, amount: any, reason: any, meta?: any): { changed: boolean; before: number; after: number; delta: number } {
    return addChargeWithDelta(cardState, playerKey, amount, reason, meta);
}

function getBoardCell(gameState: any, row: any, col: any): any {
    if (!gameState || !Array.isArray(gameState.board)) return undefined;
    const boardRow = gameState.board[row];
    return Array.isArray(boardRow) ? boardRow[col] : undefined;
}

function getMarkers(cardState: any): any[] {
    return cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
}

function isSpecialStoneMarker(marker: any): boolean {
    return !!(marker && marker.kind === 'specialStone');
}

function isBombCategoryMarker(marker: any): boolean {
    return !!(marker && marker.data && marker.data.category === 'bomb');
}

function isHiddenTrapMarker(marker: any): boolean {
    return !!(
        marker &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === 'TRAP' &&
        marker.data.hidden
    );
}

function isNormalVisualSpecialMarker(marker: any): boolean {
    const type = String(marker && marker.data && marker.data.type || '').toUpperCase();
    return type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'TRAP' || isHiddenTrapMarker(marker);
}

function getSpecialMarkerAt(cardState: any, row: any, col: any): any | null {
    const marker = getMarkers(cardState).find((candidate: any) => (
        candidate &&
        candidate.row === row &&
        candidate.col === col &&
        (isSpecialStoneMarker(candidate) || isBombCategoryMarker(candidate)) &&
        !isNormalVisualSpecialMarker(candidate) &&
        String(candidate && candidate.data && candidate.data.type || '').toUpperCase() !== 'LIVING_WILL'
    ));
    return marker || null;
}

function isSpecialStoneAt(cardState: any, row: any, col: any): boolean {
    return !!getSpecialMarkerAt(cardState, row, col);
}

function isNonNormalStoneVisualAt(cardState: any, row: any, col: any): boolean {
    return isSpecialStoneAt(cardState, row, col);
}

function getSpecialOwnerAt(cardState: any, row: any, col: any): string | null {
    const marker = getSpecialMarkerAt(cardState, row, col);
    return marker ? (marker.owner || null) : null;
}

function isNormalStoneForPlayer(cardState: any, gameState: any, playerKey: any, row: any, col: any): boolean {
    const normalized = normalizePlayerKey(playerKey);
    if (!normalized) return false;

    const playerValue = normalized === 'black' ? 1 : -1;
    if (getBoardCell(gameState, row, col) !== playerValue) return false;
    return !isNonNormalStoneVisualAt(cardState, row, col);
}

const utils = {
    normalizePlayerKey,
    ensureChargeState,
    setChargeWithDelta,
    addChargeWithDelta,
    addCharge,
    getSpecialMarkerAt,
    isSpecialStoneAt,
    isNonNormalStoneVisualAt,
    getSpecialOwnerAt,
    isNormalStoneForPlayer
};

export = utils;
