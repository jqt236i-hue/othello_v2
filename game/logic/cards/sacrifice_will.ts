/**
 * @file sacrifice_will.ts
 * @description Sacrifice Will card-nullification helpers.
 */

import PlayerEncodingImport = require('../../../shared/player-encoding');
import SharedBoardUtilsImport = require('../../../shared/shared-board-utils');

const OwnerHelpersModule: any = {
    normalizePlayerKeyOptional: PlayerEncodingImport.parseSeatKeyOptional
};
const SharedBoardUtils: any = SharedBoardUtilsImport;

type PlayerKey = 'black' | 'white';

type SacrificeWillDeps = {
    BoardOpsModule?: any;
    SpecialCardRegistry?: any;
    MARKER_KINDS?: any;
    gameState?: any;
    getSpecialMarkers?: (cardState: any) => any[];
    EMPTY?: any;
};

type SacrificeCandidate = {
    marker: any;
    row: number;
    col: number;
    owner: PlayerKey;
};

const SACRIFICE_SPECIAL_TYPE = 'SACRIFICE';
const SACRIFICE_WILL_CAUSE = 'SACRIFICE_WILL';
const SACRIFICE_NULLIFIED_REASON = 'card_nullified';
const SACRIFICE_SEAL_BURN_EFFECT = 'sacrifice_seal_burn';
const SACRIFICE_NULLIFIED_LOG_TEXT = '犠牲の意志がカードを無効化';
const SACRIFICE_TRIGGER_TEXT = 'その一手は、ここで断つ。';

const INVIOLABLE_SPECIAL_CARD_TYPES = Object.freeze({
    THEORY_INCARNATION: true,
    BOARD_EXECUTOR: true,
    OBSERVER_WILL: true
});

function normalizePlayerKey(value: any): PlayerKey | null {
    if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
        const normalized = OwnerHelpersModule.normalizePlayerKeyOptional(value);
        if (normalized === 'black' || normalized === 'white') return normalized;
    }
    if (value === 'black' || value === 1 || value === '1') return 'black';
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    return null;
}

function getOpponentPlayerKey(playerKey: any): PlayerKey | null {
    const normalized = normalizePlayerKey(playerKey);
    if (normalized === 'black') return 'white';
    if (normalized === 'white') return 'black';
    return null;
}

function normalizeType(value: any): string {
    return String(value || '').trim().toUpperCase();
}

function getMarkerType(marker: any): string {
    if (!marker || typeof marker !== 'object') return '';
    const data = marker.data && typeof marker.data === 'object' ? marker.data : {};
    return normalizeType(data.type || marker.type);
}

function getMarkerSequence(marker: any): number {
    const value = Number(marker && marker.createdSeq);
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function getMarkerIdNumber(marker: any): number {
    const value = Number(marker && marker.id);
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function getSpecialStoneKind(deps?: SacrificeWillDeps): string {
    const kinds = deps && deps.MARKER_KINDS;
    return String(kinds && kinds.SPECIAL_STONE ? kinds.SPECIAL_STONE : 'specialStone');
}

function getMarkers(cardState: any, deps?: SacrificeWillDeps): any[] {
    if (deps && typeof deps.getSpecialMarkers === 'function') {
        const markers = deps.getSpecialMarkers(cardState);
        return Array.isArray(markers) ? markers : [];
    }
    return cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
}

function createSacrificeBoardView(cardState: any, gameState: any): any {
    if (
        !SharedBoardUtils ||
        typeof SharedBoardUtils.createBoardContext !== 'function' ||
        typeof SharedBoardUtils.createBoardView !== 'function'
    ) {
        throw new Error('[sacrifice-will] SharedBoardUtils BoardContext APIs are required');
    }
    const boardContext = SharedBoardUtils.createBoardContext(gameState, cardState);
    return SharedBoardUtils.createBoardView(boardContext.gameState, {
        cardState: boardContext.cardState,
        strict: false
    });
}

function isOccupiedCell(boardView: any, row: number, col: number, deps?: SacrificeWillDeps): boolean {
    const value = boardView.get(row, col);
    const empty = deps && Object.prototype.hasOwnProperty.call(deps, 'EMPTY') ? deps.EMPTY : 0;
    return value !== null && typeof value !== 'undefined' && value !== empty;
}

function compareCandidates(a: SacrificeCandidate, b: SacrificeCandidate): number {
    const seqDiff = getMarkerSequence(a.marker) - getMarkerSequence(b.marker);
    if (seqDiff !== 0) return seqDiff;
    const idDiff = getMarkerIdNumber(a.marker) - getMarkerIdNumber(b.marker);
    if (idDiff !== 0) return idDiff;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
}

function shouldSacrificeNullifyCard(cardId: any, cardType: any, deps?: SacrificeWillDeps): boolean {
    const normalizedCardId = typeof cardId === 'string' ? cardId.trim() : '';
    const normalizedCardType = normalizeType(cardType);
    const specialRegistry = deps && deps.SpecialCardRegistry;
    if (
        normalizedCardId &&
        specialRegistry &&
        typeof specialRegistry.isInviolableSpecialCardId === 'function' &&
        specialRegistry.isInviolableSpecialCardId(normalizedCardId)
    ) {
        return false;
    }
    if ((INVIOLABLE_SPECIAL_CARD_TYPES as any)[normalizedCardType]) return false;
    return !!(normalizedCardId || normalizedCardType);
}

function findTriggeringSacrificeMarker(cardState: any, cardUserKey: any, deps?: SacrificeWillDeps): SacrificeCandidate | null {
    const gameState = deps && deps.gameState;
    const targetOwner = getOpponentPlayerKey(cardUserKey);
    if (!targetOwner) return null;

    const specialKind = getSpecialStoneKind(deps);
    const candidates: SacrificeCandidate[] = [];
    for (const marker of getMarkers(cardState, deps)) {
        if (!marker || typeof marker !== 'object') continue;
        if (String(marker.kind || '') !== specialKind) continue;
        if (getMarkerType(marker) !== SACRIFICE_SPECIAL_TYPE) continue;
        const owner = normalizePlayerKey(marker.owner);
        if (owner !== targetOwner) continue;
        const row = Number(marker.row);
        const col = Number(marker.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        candidates.push({ marker, row, col, owner });
    }

    if (candidates.length <= 0) return null;
    const boardView = createSacrificeBoardView(cardState, gameState);
    const occupiedCandidates = candidates.filter((candidate) =>
        isOccupiedCell(boardView, candidate.row, candidate.col, deps)
    );
    if (occupiedCandidates.length <= 0) return null;
    occupiedCandidates.sort(compareCandidates);
    return occupiedCandidates[0];
}

function isSacrificeSelfDestructPaid(result: any): boolean {
    if (result === true) return true;
    if (!result || typeof result !== 'object') return false;
    if (result.destroyed === true || result.livingWillRevived === true) return true;
    const kind = String(result.kind || '').trim().toLowerCase();
    return kind === 'destroyed' || kind === 'living_will_restored';
}

function applySacrificeNullification(cardState: any, gameState: any, input: any, deps?: SacrificeWillDeps): any {
    const data = input && typeof input === 'object' ? input : {};
    if (!shouldSacrificeNullifyCard(data.cardId, data.cardType, deps)) {
        return { applied: false, reason: 'special_card' };
    }
    const sacrifice = data.sacrifice || findTriggeringSacrificeMarker(cardState, data.cardUserKey, Object.assign({}, deps || {}, { gameState }));
    if (!sacrifice) return { applied: false, reason: 'no_sacrifice' };

    const boardOps = deps && deps.BoardOpsModule;
    if (!boardOps || typeof boardOps.destroyAt !== 'function') {
        return { applied: false, reason: 'missing_board_ops', sacrifice };
    }

    const destroyResult = boardOps.destroyAt(
        cardState,
        gameState,
        sacrifice.row,
        sacrifice.col,
        SACRIFICE_WILL_CAUSE,
        SACRIFICE_NULLIFIED_REASON,
        {
            owner: sacrifice.owner,
            special: SACRIFICE_SPECIAL_TYPE,
            nullifiedCardId: data.cardId || null,
            nullifiedCardType: data.cardType || null,
            nullifiedCardUser: data.cardUserKey || null,
            sacrificeWill: true,
            ignoreGuard: true,
            ignoreRegen: true,
            ignoreDestroyEvade: true,
            ignoreFrozen: true
        }
    );

    if (!isSacrificeSelfDestructPaid(destroyResult)) {
        return { applied: false, reason: 'destroy_failed', sacrifice, destroyResult };
    }
    return { applied: true, sacrifice, destroyResult };
}

const SacrificeWillModule = {
    SACRIFICE_SPECIAL_TYPE,
    SACRIFICE_WILL_CAUSE,
    SACRIFICE_NULLIFIED_REASON,
    SACRIFICE_SEAL_BURN_EFFECT,
    SACRIFICE_NULLIFIED_LOG_TEXT,
    SACRIFICE_TRIGGER_TEXT,
    applySacrificeNullification,
    findTriggeringSacrificeMarker,
    shouldSacrificeNullifyCard
};

export = SacrificeWillModule;
