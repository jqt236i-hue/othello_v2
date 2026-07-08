/**
 * @file zombie_will.ts
 * @description ZOMBIE_WILL effect helpers (Shared between Browser and Headless)
 *  - Next-stone marker placement (ZOMBIE: permanent, one revival)
 *  - Owner turn-start infection: every 3rd owner turn start, convert one adjacent
 *    enemy normal stone to a fresh ZOMBIE marker owned by the infected owner.
 */

const CardZombieWill = (function (root: any, factory: any) {
    if (typeof module === 'object' && module.exports) {
        let CardMarkersModule = null;
        let SpecialStoneRegistryModule = null;
        try {
            CardMarkersModule = require('./markers');
        } catch (e) { /* ignore */ }
        try {
            SpecialStoneRegistryModule = require('../../../shared/special-stone-registry');
        } catch (e) { /* ignore */ }
        return factory(
            require('../../../shared-constants'),
            require('../../../shared/shared-board-utils'),
            CardMarkersModule,
            SpecialStoneRegistryModule
        );
    }
    if (root && root.SharedConstants) {
        return (root.CardZombieWill = factory(
            root.SharedConstants,
            root.SharedBoardUtils || null,
            root.CardMarkers || null,
            root.SpecialStoneRegistry || null
        ));
    } else {
        return (root.CardZombieWill = factory(
            root.SharedConstants,
            root.SharedBoardUtils || null,
            root.CardMarkers || null,
            root.SpecialStoneRegistry || null
        ));
    }
}(typeof self !== 'undefined' ? self : this, function (
    SharedConstants: any,
    SharedBoardUtils: any,
    CardMarkersModule: any,
    SpecialStoneRegistryModule: any
) {
    'use strict';

    const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};
    const ZOMBIE_INFECTION_INTERVAL = 3;

    function getRuntimeGlobalValue(key: string): any {
        if (typeof self !== 'undefined' && (self as any)[key]) {
            return (self as any)[key];
        }
        return null;
    }

    function getCardMarkersModule() {
        if (CardMarkersModule) return CardMarkersModule;
        return getRuntimeGlobalValue('CardMarkers');
    }

    function getSpecialStoneRegistryModule() {
        if (SpecialStoneRegistryModule) return SpecialStoneRegistryModule;
        return getRuntimeGlobalValue('SpecialStoneRegistry');
    }

    if (BLACK === undefined || WHITE === undefined || !Array.isArray(DIRECTIONS)) {
        throw new Error('SharedConstants (BLACK/WHITE/DIRECTIONS) required');
    }

    function ownerValue(ownerKey: string): number {
        return ownerKey === 'black' ? BLACK : WHITE;
    }

    function createZombieMarkerData(ownerKey: string) {
        return {
            type: 'ZOMBIE',
            ownerColor: ownerValue(ownerKey),
            turnsUntilInfection: ZOMBIE_INFECTION_INTERVAL,
            regenRemaining: 1
        };
    }

    function getCell(gameState: any, row: number, col: number) {
        const board = gameState && gameState.board;
        if (!Array.isArray(board) || !Array.isArray(board[row])) return undefined;
        return board[row][col];
    }

    function setCell(gameState: any, row: number, col: number, value: number) {
        const board = gameState && gameState.board;
        if (!Array.isArray(board) || !Array.isArray(board[row])) return;
        board[row][col] = value;
    }

    function getMarkers(cardState: any) {
        if (!cardState) return [];
        return Array.isArray(cardState.markers) ? cardState.markers : [];
    }

    function findZombieMarkerAt(cardState: any, row: number, col: number, ownerKey: string) {
        const markers = getMarkers(cardState);
        for (let i = 0; i < markers.length; i += 1) {
            const marker = markers[i];
            if (!marker) continue;
            if (marker.row !== row || marker.col !== col) continue;
            if (marker.kind !== 'specialStone') continue;
            if (marker.owner !== ownerKey) continue;
            const data = marker.data || {};
            if (String(data.type || '').toUpperCase() === 'ZOMBIE') return marker;
        }
        return null;
    }

    function markerAtPosition(cardState: any, row: number, col: number) {
        const markers = getMarkers(cardState);
        for (let i = 0; i < markers.length; i += 1) {
            const marker = markers[i];
            if (!marker) continue;
            if (marker.row === row && marker.col === col) return marker;
        }
        return null;
    }

    function isEnemyNormalStone(cardState: any, gameState: any, row: number, col: number, ownerKey: string) {
        const cell = getCell(gameState, row, col);
        if (cell !== ownerValue(ownerKey === 'black' ? 'white' : 'black')) return false;
        const existing = markerAtPosition(cardState, row, col);
        if (!existing) return true;
        if (existing.kind !== 'specialStone') return true;
        const data = existing.data || {};
        const type = String(data.type || '').toUpperCase();
        if (type === 'GUARD') return false;
        const reg = getSpecialStoneRegistryModule();
        if (reg && typeof reg.isStoneStatusMarker === 'function' && reg.isStoneStatusMarker(existing)) {
            return false;
        }
        if (reg && typeof reg.countsAsSpecialStone === 'function' && reg.countsAsSpecialStone(type, data)) {
            return false;
        }
        return true;
    }

    function findAdjacentInfectionCandidates(cardState: any, gameState: any, row: number, col: number, ownerKey: string) {
        const out: Array<{ row: number; col: number }> = [];
        for (let i = 0; i < DIRECTIONS.length; i += 1) {
            const dir = DIRECTIONS[i];
            const r = row + dir[0];
            const c = col + dir[1];
            if (isEnemyNormalStone(cardState, gameState, r, c, ownerKey)) {
                out.push({ row: r, col: c });
            }
        }
        return out;
    }

    function removeStoneStatusMarkersAt(cardState: any, row: number, col: number) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        const reg = getSpecialStoneRegistryModule();
        const filterFn = (reg && typeof reg.isStoneStatusMarker === 'function')
            ? (m: any) => reg.isStoneStatusMarker(m)
            : null;
        const newMarkers = [];
        for (let i = 0; i < cardState.markers.length; i += 1) {
            const marker = cardState.markers[i];
            if (!marker) { newMarkers.push(marker); continue; }
            if (marker.row === row && marker.col === col && filterFn && filterFn(marker)) continue;
            newMarkers.push(marker);
        }
        cardState.markers = newMarkers;
    }

    function addZombieMarker(cardState: any, row: number, col: number, ownerKey: string) {
        if (!cardState) return null;
        const markers = getCardMarkersModule();
        if (markers && typeof markers.addMarker === 'function') {
            return markers.addMarker(cardState, 'specialStone', row, col, ownerKey, createZombieMarkerData(ownerKey));
        }
        if (!Array.isArray(cardState.markers)) cardState.markers = [];
        const seqBase = Number.isFinite(Number(cardState._nextCreatedSeq)) ? Number(cardState._nextCreatedSeq) : cardState.markers.length + 1;
        const idBase = Number.isFinite(Number(cardState._nextMarkerId)) ? Number(cardState._nextMarkerId) : cardState.markers.length + 1;
        const marker = {
            id: 'zombie_' + idBase,
            kind: 'specialStone',
            row,
            col,
            owner: ownerKey,
            createdSeq: seqBase,
            data: createZombieMarkerData(ownerKey)
        };
        cardState._nextMarkerId = idBase + 1;
        cardState._nextCreatedSeq = seqBase + 1;
        cardState.markers.push(marker);
        return marker;
    }

    function getRandomIndex(length: number, prng: any): number {
        if (!length) return -1;
        if (prng && typeof prng.random === 'function') {
            const r = Number(prng.random());
            if (Number.isFinite(r)) {
                return Math.min(length - 1, Math.max(0, Math.floor(r * length)));
            }
        }
        return 0;
    }

    function processZombieEffectsAtTurnStartAnchor(
        cardState: any,
        gameState: any,
        playerKey: string,
        row: number,
        col: number,
        prng: any,
        deps: any = {}
    ) {
        const zombie = findZombieMarkerAt(cardState, row, col, playerKey);
        if (!zombie) return { infected: [], anchors: [] };

        const data = zombie.data || {};
        const before = Number.isFinite(Number(data.turnsUntilInfection))
            ? Math.max(1, Math.trunc(Number(data.turnsUntilInfection)))
            : ZOMBIE_INFECTION_INTERVAL;
        const after = before - 1;
        if (after > 0) {
            data.turnsUntilInfection = after;
            return { infected: [], anchors: [{ row, col, turnsUntilInfection: after }] };
        }

        data.turnsUntilInfection = ZOMBIE_INFECTION_INTERVAL;
        const candidates = findAdjacentInfectionCandidates(cardState, gameState, row, col, playerKey);
        if (candidates.length === 0) {
            return { infected: [], anchors: [{ row, col, turnsUntilInfection: ZOMBIE_INFECTION_INTERVAL }] };
        }

        const targetIdx = getRandomIndex(candidates.length, prng);
        const target = candidates[targetIdx];
        removeStoneStatusMarkersAt(cardState, target.row, target.col);
        if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
            deps.BoardOps.changeAt(cardState, gameState, target.row, target.col, playerKey, 'ZOMBIE', 'zombie_infection');
        } else {
            setCell(gameState, target.row, target.col, ownerValue(playerKey));
        }
        addZombieMarker(cardState, target.row, target.col, playerKey);
        return { infected: [target], anchors: [{ row, col, turnsUntilInfection: ZOMBIE_INFECTION_INTERVAL }] };
    }

    return {
        createZombieMarkerData,
        processZombieEffectsAtTurnStartAnchor,
        ZOMBIE_INFECTION_INTERVAL
    };
}));

export = CardZombieWill;
