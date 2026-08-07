/**
 * @file zombie_will.ts
 * @description ZOMBIE_WILL effect helpers (Shared between Browser and Headless)
 *  - Next-stone marker placement (ZOMBIE: permanent, one revival)
 *  - Owner turn-start movement followed by infection: every 3rd owner turn start, convert one adjacent
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

    function getCardMarkersModule(deps?: any) {
        if (deps && Object.prototype.hasOwnProperty.call(deps, 'CardMarkers')) {
            return deps.CardMarkers;
        }
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

    function requireBoardKernel() {
        if (
            !SharedBoardUtils ||
            typeof SharedBoardUtils.createBoardContext !== 'function' ||
            typeof SharedBoardUtils.createBoardView !== 'function' ||
            typeof SharedBoardUtils.setCellValue !== 'function'
        ) {
            throw new Error('[zombie-will] SharedBoardUtils BoardContext APIs are required');
        }
        return SharedBoardUtils;
    }

    function createBoardContext(cardState: any, gameState: any) {
        return requireBoardKernel().createBoardContext(gameState, cardState);
    }

    function getCell(cardState: any, gameState: any, row: number, col: number) {
        const boardKernel = requireBoardKernel();
        const context = createBoardContext(cardState, gameState);
        return boardKernel.createBoardView(context.gameState, {
            cardState: context.cardState,
            strict: false
        }).get(row, col);
    }

    function setCell(cardState: any, gameState: any, row: number, col: number, value: number): boolean {
        return requireBoardKernel().setCellValue(
            createBoardContext(cardState, gameState),
            row,
            col,
            value
        );
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
        const cell = getCell(cardState, gameState, row, col);
        if (cell !== ownerValue(ownerKey === 'black' ? 'white' : 'black')) return false;
        const reg = getSpecialStoneRegistryModule();
        if (
            reg
            && typeof reg.isInviolableCell === 'function'
            && reg.isInviolableCell(getMarkers(cardState), row, col) === true
        ) {
            return false;
        }
        if (
            reg
            && typeof reg.isFullyProtectedCell === 'function'
            && reg.isFullyProtectedCell(getMarkers(cardState), row, col) === true
        ) {
            return false;
        }
        const existing = markerAtPosition(cardState, row, col);
        if (!existing) return true;
        if (existing.kind !== 'specialStone') return true;
        const data = existing.data || {};
        const type = String(data.type || '').toUpperCase();
        if (type === 'GUARD') return false;
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

    function requireCardMarkers(deps?: any) {
        const markers = getCardMarkersModule(deps);
        if (!markers || typeof markers.addMarker !== 'function') {
            throw new Error('[zombie-will] CardMarkers.addMarker is required');
        }
        return markers;
    }

    function requireBoardOps(deps?: any) {
        const boardOps = deps && deps.BoardOps;
        if (!boardOps || typeof boardOps.changeAt !== 'function') {
            throw new Error('[zombie-will] BoardOps.changeAt is required');
        }
        return boardOps;
    }

    function addZombieMarker(cardState: any, row: number, col: number, ownerKey: string, deps?: any) {
        const marker = requireCardMarkers(deps).addMarker(
            cardState,
            'specialStone',
            row,
            col,
            ownerKey,
            createZombieMarkerData(ownerKey)
        );
        if (!marker) {
            throw new Error('[zombie-will] CardMarkers.addMarker failed');
        }
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

    function buildTurnStartResult(
        moved: any[],
        sourceRow: number,
        sourceCol: number,
        infected: any[],
        anchors: any[]
    ): any {
        const result: any = { infected, anchors };
        if (Array.isArray(moved) && moved.length > 0) {
            result.moved = moved;
            result.source = { row: sourceRow, col: sourceCol };
        }
        return result;
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
        let currentRow = row;
        let currentCol = col;
        let moved: any[] = [];
        if (deps && typeof deps.moveAtTurnStart === 'function') {
            const movement = deps.moveAtTurnStart(cardState, gameState, playerKey, row, col, prng);
            moved = Array.isArray(movement && movement.moved) ? movement.moved : [];
            const lastMove = moved.length > 0 ? moved[moved.length - 1] : null;
            if (
                lastMove &&
                lastMove.to &&
                Number.isInteger(lastMove.to.row) &&
                Number.isInteger(lastMove.to.col)
            ) {
                currentRow = lastMove.to.row;
                currentCol = lastMove.to.col;
            }
        }

        const zombie = findZombieMarkerAt(cardState, currentRow, currentCol, playerKey);
        if (!zombie) return buildTurnStartResult(moved, currentRow, currentCol, [], []);
        if (getCell(cardState, gameState, currentRow, currentCol) !== ownerValue(playerKey)) {
            return buildTurnStartResult(moved, currentRow, currentCol, [], []);
        }

        const data = zombie.data || {};
        const before = Number.isFinite(Number(data.turnsUntilInfection))
            ? Math.max(1, Math.trunc(Number(data.turnsUntilInfection)))
            : ZOMBIE_INFECTION_INTERVAL;
        const after = before - 1;
        if (after > 0) {
            data.turnsUntilInfection = after;
            return buildTurnStartResult(
                moved,
                currentRow,
                currentCol,
                [],
                [{ row: currentRow, col: currentCol, turnsUntilInfection: after }]
            );
        }

        const candidates = findAdjacentInfectionCandidates(cardState, gameState, currentRow, currentCol, playerKey);
        if (candidates.length === 0) {
            data.turnsUntilInfection = ZOMBIE_INFECTION_INTERVAL;
            return buildTurnStartResult(
                moved,
                currentRow,
                currentCol,
                [],
                [{ row: currentRow, col: currentCol, turnsUntilInfection: ZOMBIE_INFECTION_INTERVAL }]
            );
        }

        const boardOps = requireBoardOps(deps);
        requireCardMarkers(deps);
        const targetIdx = getRandomIndex(candidates.length, prng);
        const target = candidates[targetIdx];
        const previousOwner = getCell(cardState, gameState, target.row, target.col);
        const changeResult = boardOps.changeAt(
            cardState,
            gameState,
            target.row,
            target.col,
            playerKey,
            'ZOMBIE',
            'zombie_infection',
            { sourceRow: currentRow, sourceCol: currentCol }
        );
        data.turnsUntilInfection = ZOMBIE_INFECTION_INTERVAL;
        if (!changeResult || changeResult.changed !== true) {
            return buildTurnStartResult(
                moved,
                currentRow,
                currentCol,
                [],
                [{ row: currentRow, col: currentCol, turnsUntilInfection: ZOMBIE_INFECTION_INTERVAL }]
            );
        }
        removeStoneStatusMarkersAt(cardState, target.row, target.col);
        try {
            addZombieMarker(cardState, target.row, target.col, playerKey, deps);
        } catch (error) {
            if (previousOwner !== null) {
                setCell(cardState, gameState, target.row, target.col, previousOwner);
            }
            throw error;
        }
        return buildTurnStartResult(
            moved,
            currentRow,
            currentCol,
            [target],
            [{ row: currentRow, col: currentCol, turnsUntilInfection: ZOMBIE_INFECTION_INTERVAL }]
        );
    }

    return {
        createZombieMarkerData,
        processZombieEffectsAtTurnStartAnchor,
        ZOMBIE_INFECTION_INTERVAL
    };
}));

export = CardZombieWill;
