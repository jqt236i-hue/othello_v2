
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

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

function readRuntimeGlobal(globalKey: string): any {
    if (!globalKey) return null;
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
            return (globalThis as any)[globalKey];
        }
        if (typeof self !== 'undefined' && (self as any)[globalKey]) {
            return (self as any)[globalKey];
        }
    } catch (e) {
        return null;
    }
    return null;
}

function unwrapModule(mod: any): any {
    if (mod && typeof mod === 'object' && Object.prototype.hasOwnProperty.call(mod, 'module.exports')) {
        return mod['module.exports'] || mod;
    }
    if (mod && typeof mod === 'object' && Object.prototype.hasOwnProperty.call(mod, 'default')) {
        return mod.default || mod;
    }
    return mod;
}

const CardModuleResolver = safeRequire('../logic/cards-internal/module-resolver');

function loadRuntimeModule(id: string, globalKey: string): any {
    if (CardModuleResolver && typeof CardModuleResolver.resolveModule === 'function') {
        const resolved = CardModuleResolver.resolveModule({
            globalName: globalKey,
            requirePath: id,
            requireFn: _require,
            label: globalKey
        });
        if (resolved) return unwrapModule(resolved);
    }

    return unwrapModule(safeRequire(id)) || unwrapModule(readRuntimeGlobal(globalKey));
}

const SharedConstants = loadRuntimeModule('../../shared-constants', 'SharedConstants');
const SharedBoardUtils = loadRuntimeModule('../../shared/shared-board-utils', 'SharedBoardUtils');
const CardMarkers = loadRuntimeModule('../logic/cards/markers', 'CardMarkers');
const CardSelectors = loadRuntimeModule('../logic/cards/selectors', 'CardSelectors');
const CardTargets = loadRuntimeModule('../logic/cards/targets', 'CardTargets');
const CardFlips = loadRuntimeModule('../logic/cards/flips', 'CardFlips');
const SpecialStoneRegistry = loadRuntimeModule('../../shared/special-stone-registry', 'SpecialStoneRegistry');
const CardProtectionContext = loadRuntimeModule('../logic/cards-internal/protection-context', 'CardProtectionContext');

const { BLACK, WHITE, EMPTY, DIRECTIONS, BOARD_SIZE } = SharedConstants || {};
const BoardUtils = SharedBoardUtils || null;
const Markers = CardMarkers || {};
const Selectors = CardSelectors || {};
const Targets = CardTargets || {};
const Flips = CardFlips || {};



    // ---- Helpers ----

    function requireBoardUtils() {
        if (
            !BoardUtils ||
            typeof BoardUtils.createBoardContext !== 'function' ||
            typeof BoardUtils.createBoardView !== 'function' ||
            typeof BoardUtils.resolveExpansionSide !== 'function' ||
            typeof BoardUtils.getBoardExpansionEdgeSockets !== 'function' ||
            typeof BoardUtils.getBoardExpansionCornerSockets !== 'function' ||
            typeof BoardUtils.mapBoardExpansionSocketTarget !== 'function'
        ) {
            throw new Error('[target-resolver] SharedBoardUtils board kernel is required');
        }
        return BoardUtils;
    }

    function createBoardContext(cardState: any, gameState: any) {
        return requireBoardUtils().createBoardContext(gameState, cardState == null ? null : cardState);
    }

    function createBoardView(cardState: any, gameState: any) {
        const boardUtils = requireBoardUtils();
        const context = createBoardContext(cardState, gameState);
        return boardUtils.createBoardView(context.gameState, {
            cardState: context.cardState,
            strict: false
        });
    }

    function getCellValue(cardState: any, gameState: any, row: any, col: any) {
        return createBoardView(cardState, gameState).get(row, col);
    }

    function getExpansionCells(cardState: any, gameState: any) {
        const view = createBoardView(cardState, gameState);
        return view.expansionCells
            .filter((cell: any) => view.isPlayable(cell.row, cell.col))
            .map((cell: any) => ({
                side: cell.side || null,
                row: cell.row,
                col: cell.col,
                owner: cell.owner
            }));
    }

    function forEachBoardShapeCell(cardState: any, gameState: any, visitor: any) {
        if (typeof visitor !== 'function') return;
        const view = createBoardView(cardState, gameState);
        for (const cell of view.coordinates) {
            const owner = view.get(cell.row, cell.col);
            if (owner === null) {
                throw new Error(`[target-resolver] BoardView owner missing at ${cell.row},${cell.col}`);
            }
            visitor(cell.row, cell.col, owner);
        }
    }

    function hasBoardShapeCell(cardState: any, gameState: any, row: any, col: any) {
        return createBoardView(cardState, gameState).isPlayable(row, col);
    }

    function getMeteorHoleCells(cardState: any, gameState: any) {
        return createBoardView(cardState, gameState).topology.holeCoordinates
            .map((cell: any) => ({ row: cell.row, col: cell.col }));
    }

    function isBlockedCell(cardState: any, row: number, col: number) {
        if (Markers && typeof Markers.getBlockingMarkers === 'function') {
            return Markers.getBlockingMarkers(cardState).some((m: any) => m.row === row && m.col === col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE' || m.data.type === 'FREEZE')
        ));
    }

    function isInviolableCell(cardState: any, row: number, col: number) {
        if (Markers && typeof Markers.isInviolableCell === 'function') {
            return !!Markers.isInviolableCell(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((m: any) => (
            m &&
            m.row === row &&
            m.col === col &&
            m.data &&
            (m.kind === 'manifestStone' ||
                (m.kind === 'specialStone' && (
                    m.data.type === 'THEORY_INCARNATION' ||
                    m.data.type === 'BOARD_EXECUTOR' ||
                    m.data.type === 'OBSERVER_WILL'
                )))
        ));
    }

    function isFrozenCell(cardState: any, row: number, col: number) {
        if (Markers && typeof Markers.isFrozenCellForCard === 'function') {
            return !!Markers.isFrozenCellForCard(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'FREEZE'
        ));
    }

    function isMeteorHoleCell(cardState: any, row: number, col: number) {
        if (Markers && typeof Markers.isMeteorHoleCell === 'function') {
            return !!Markers.isMeteorHoleCell(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'METEOR_HOLE'
        ));
    }

    function isGuardProtectedCell(cardState: any, row: number, col: number) {
        if (Markers && typeof Markers.isGuardProtectedCell === 'function') {
            return !!Markers.isGuardProtectedCell(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'GUARD'
        ));
    }

    function hasSeedMarkerAt(cardState: any, row: any, col: any) {
        if (Markers && typeof Markers.findSpecialMarkerAt === 'function') {
            return !!Markers.findSpecialMarkerAt(cardState, row, col, 'SEED');
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            m.data &&
            m.data.type === 'SEED'
        ));
    }

    function isSpecialStoneAt(cardState: any, row: number, col: number) {
        if (Markers && typeof Markers.isSpecialStoneAt === 'function') {
            return !!Markers.isSpecialStoneAt(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.some((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col
        ));
    }

    function getSpecialOwnerAt(cardState: any, row: number, col: number) {
        if (Markers && typeof Markers.getSpecialOwnerAt === 'function') {
            return Markers.getSpecialOwnerAt(cardState, row, col);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const marker = markers.find((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col
        ));
        return marker ? marker.owner : null;
    }

    function isBombCategoryMarker(marker: any) {
        if (Markers && typeof Markers.isBombCategoryMarker === 'function') {
            return Markers.isBombCategoryMarker(marker);
        }
        return !!(
            marker &&
            marker.kind === 'specialStone' &&
            marker.data &&
            marker.data.category === 'bomb'
        );
    }

    function createMarkersAtLookup(cardState: any) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const markerCellIndex = Markers && typeof Markers.createMarkerCellIndex === 'function'
            ? Markers.createMarkerCellIndex(cardState)
            : null;
        return (row: any, col: any) => markerCellIndex
            ? markerCellIndex.get(row, col)
            : markers.filter((m: any) => m && m.row === row && m.col === col);
    }

    function getSpecialMarkers(cardState: any) {
        if (Markers && typeof Markers.getSpecialMarkers === 'function') {
            return Markers.getSpecialMarkers(cardState);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.filter((m: any) => m && m.kind === 'specialStone');
    }

    function getManifestMarkers(cardState: any) {
        if (Markers && typeof Markers.getManifestMarkers === 'function') {
            return Markers.getManifestMarkers(cardState);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.filter((m: any) => {
            const type = String(m && m.data && m.data.type || '').toUpperCase();
            return !!(
                m &&
                (m.kind === 'manifestStone' || m.kind === 'specialStone') &&
                (type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL')
            );
        });
    }

    function getBombMarkers(cardState: any) {
        if (Markers && typeof Markers.getBombMarkers === 'function') {
            return Markers.getBombMarkers(cardState);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.filter((m: any) => m && m.kind === 'specialStone' && m.data && m.data.category === 'bomb');
    }

    function findSpecialMarkerAt(cardState: any, row: number, col: number, type?: any, owner?: any) {
        if (Markers && typeof Markers.findSpecialMarkerAt === 'function') {
            return Markers.findSpecialMarkerAt(cardState, row, col, type, owner);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        return markers.find((m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.row === row &&
            m.col === col &&
            (!type || (m.data && m.data.type === type)) &&
            (!owner || m.owner === owner)
        )) || null;
    }

    function isMultiCellSpecialStoneCell(cardState: any, row: number, col: number) {
        return !!findSpecialMarkerAt(cardState, row, col, 'SHINRA_BANSHO_GOD');
    }

    function toBoardCellKey(row: number, col: number) {
        return `${row},${col}`;
    }

    function getCurrentBoardShapeCells(cardState: any, gameState: any) {
        return createBoardView(cardState, gameState).coordinates
            .map((cell: any) => ({ row: cell.row, col: cell.col }));
    }

    function getOccupiedBoardShapeCells(cardState: any, gameState: any) {
        return getCurrentBoardShapeCells(cardState, gameState)
            .filter((cell: any) => getCellValue(cardState, gameState, cell.row, cell.col) !== EMPTY);
    }

    function getEmptyBoardShapeCells(cardState: any, gameState: any) {
        return getCurrentBoardShapeCells(cardState, gameState)
            .filter((cell: any) => getCellValue(cardState, gameState, cell.row, cell.col) === EMPTY);
    }

    function isPositionSwapProtectedCell(cardState: any, row: number, col: number) {
        return !!(
            isFrozenCell(cardState, row, col) ||
            findSpecialMarkerAt(cardState, row, col, 'GLUTTONOUS') ||
            isMultiCellSpecialStoneCell(cardState, row, col) ||
            isInviolableCell(cardState, row, col)
        );
    }

    function collectEmptyNeighborCells(cardState: any, gameState: any, row: any, col: any) {
        const neighbors: any[] = [];
        const seen = new Set();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const targetRow = row + dr;
                const targetCol = col + dc;
                if (!hasBoardShapeCell(cardState, gameState, targetRow, targetCol)) continue;
                if (getCellValue(cardState, gameState, targetRow, targetCol) !== EMPTY) continue;
                if (isBlockedCell(cardState, targetRow, targetCol)) continue;
                const key = `${targetRow},${targetCol}`;
                if (seen.has(key)) continue;
                seen.add(key);
                neighbors.push({ row: targetRow, col: targetCol });
            }
        }
        return neighbors;
    }

    function getCardContext(cardState: any) {
        if (!CardProtectionContext || typeof CardProtectionContext.buildCardProtectionContext !== 'function') {
            throw new Error('[target-resolver] CardProtectionContext.buildCardProtectionContext not available');
        }
        if (!SpecialStoneRegistry || typeof SpecialStoneRegistry.getSpecialStoneInfo !== 'function') {
            throw new Error('[target-resolver] SpecialStoneRegistry.getSpecialStoneInfo not available');
        }
        return CardProtectionContext.buildCardProtectionContext(cardState, {
            constants: SharedConstants,
            SpecialStoneRegistry,
            getSpecialMarkers,
            getManifestMarkers,
            getBombMarkers,
            getBlockingMarkers: (state: any) => {
                const specials = getSpecialMarkers(state);
                return specials.filter((entry: any) => {
                    const type = String(entry && entry.data && entry.data.type || '').toUpperCase();
                    return type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'FREEZE';
                });
            }
        });
    }

    function getTabooReverseDirectionalFlips(cardState: any, gameState: any, row: any, col: any, ownerVal: any, direction: any, context: any) {
        const blockedCells = context && context.blockedCells ? context.blockedCells : [];
        const inviolableStones = context && context.inviolableStones ? context.inviolableStones : [];

        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map((p: any) => `${p.row},${p.col}`))
            : null;
        const inviolableSet = inviolableStones.length
            ? new Set(inviolableStones.map((p: any) => `${p.row},${p.col}`))
            : null;

        const [dr, dc] = direction;
        const flips = [];
        let r = row + dr;
        let c = col + dc;

        while (getCellValue(cardState, gameState, r, c) === -ownerVal) {
            const key = `${r},${c}`;
            if (blockedSet && blockedSet.has(key)) {
                return [];
            }
            if (!(inviolableSet && inviolableSet.has(key))) {
                flips.push({ row: r, col: c });
            }
            r += dr;
            c += dc;
        }

        const tail = getCellValue(cardState, gameState, r, c);
        if (blockedSet && blockedSet.has(`${r},${c}`)) {
            return [];
        }
        if (tail === ownerVal) {
            return [];
        }

        return flips;
    }

    function getExpansionSocketTargets(cardState: any, gameState: any, kind: 'edge' | 'corner') {
        const boardUtils = requireBoardUtils();
        const context = createBoardContext(cardState, gameState);
        const sockets = kind === 'corner'
            ? boardUtils.getBoardExpansionCornerSockets(context)
            : boardUtils.getBoardExpansionEdgeSockets(context);
        return sockets
            .map((socket: any) => boardUtils.mapBoardExpansionSocketTarget(socket))
            .filter((target: any) => !!target);
    }

    function resolveExpansionSide(cardState: any, gameState: any, side: any, row: any, col: any) {
        const context = createBoardContext(cardState, gameState);
        return requireBoardUtils().resolveExpansionSide(side, row, col, context.gameState);
    }

    function isAdjacentToAnyStoneForReinforcement(cardState: any, gameState: any, row: any, col: any) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nextRow = row + dr;
                const nextCol = col + dc;
                if (!hasBoardShapeCell(cardState, gameState, nextRow, nextCol)) continue;
                if (getCellValue(cardState, gameState, nextRow, nextCol) !== EMPTY) return true;
            }
        }
        return false;
    }

    // ---- 29 Target Functions ----

    function getTrapTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getTrapTargets === 'function') {
            return Selectors.getTrapTargets(cardState, gameState, playerKey);
        }
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const markersAt = createMarkersAtLookup(cardState);
        const res: any[] = [];
        for (const cell of getOccupiedBoardShapeCells(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValue(cardState, gameState, row, col) !== playerVal) continue;
            const hasBomb = markersAt(row, col).some((m: any) => isBombCategoryMarker(m));
            if (hasBomb) continue;
            if (isInviolableCell(cardState, row, col)) continue;
            const hasOwnTrap = markersAt(row, col).some((m: any) => (
                m &&
                m.kind === 'specialStone' &&
                m.owner === playerKey &&
                m.data &&
                m.data.type === 'TRAP'
            ));
            if (hasOwnTrap) continue;
            res.push({ row, col });
        }
        return res;
    }

    function getTeleportTargets(cardState: any, gameState: any) {
        if (typeof Selectors.getTeleportTargets === 'function') {
            return Selectors.getTeleportTargets(cardState, gameState);
        }
        const destinations = getEmptyBoardShapeCells(cardState, gameState)
            .filter((cell: any) => !isBlockedCell(cardState, cell.row, cell.col));
        if (!destinations.length) return [];
        return getOccupiedBoardShapeCells(cardState, gameState)
            .filter((cell: any) => !isFrozenCell(cardState, cell.row, cell.col))
            .filter((cell: any) => !isInviolableCell(cardState, cell.row, cell.col))
            .filter((cell: any) => !isMultiCellSpecialStoneCell(cardState, cell.row, cell.col));
    }

    function getBoardExpansionTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getBoardExpansionTargets === 'function') {
            return Selectors.getBoardExpansionTargets(cardState, gameState, playerKey);
        }
        if (!gameState || !gameState.board) return [];
        return getExpansionSocketTargets(cardState, gameState, 'edge');
    }

    function getBoardShrinkTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getBoardShrinkTargets === 'function') {
            return Selectors.getBoardShrinkTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getTabooReverseCandidates(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
        if (!gameState || !Array.isArray(gameState.board)) return [];
        if (!Number.isInteger(row) || !Number.isInteger(col)) return [];

        const targetValue = getCellValue(cardState, gameState, row, col);
        if (targetValue !== EMPTY) return [];

        const context = getCardContext(cardState);
        const blockedCells = (context && Array.isArray(context.blockedCells)) ? context.blockedCells : [];
        const blockedSet = blockedCells.length
            ? new Set(blockedCells.map((p: any) => `${p.row},${p.col}`))
            : null;
        if (blockedSet && blockedSet.has(`${row},${col}`)) return [];

        const ownerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);

        const candidates = [];
        for (const direction of (DIRECTIONS || [])) {
            if (!Array.isArray(direction) || direction.length !== 2) continue;
            const flips = getTabooReverseDirectionalFlips(cardState, gameState, row, col, ownerVal, direction, context);
            if (!Array.isArray(flips) || flips.length === 0) continue;
            candidates.push({
                direction: [direction[0], direction[1]],
                flips,
                score: flips.length
            });
        }
        return candidates;
    }

    function getReverseWillTargets(cardState: any, gameState: any) {
        if (!gameState || !Array.isArray(gameState.board)) return [];
        if (!Flips || typeof Flips.getOccupiedOriginFlipsWithContext !== 'function') return [];
        const context = { ...getCardContext(cardState), cardState };
        const res: any[] = [];
        forEachBoardShapeCell(cardState, gameState, (row: any, col: any, owner: any) => {
            if (owner !== BLACK && owner !== WHITE) return;
            if (isMultiCellSpecialStoneCell(cardState, row, col)) return;
            const flips = Flips.getOccupiedOriginFlipsWithContext(gameState, row, col, owner, context);
            if (!Array.isArray(flips) || flips.length === 0) return;
            res.push({
                row,
                col,
                owner: owner === BLACK ? 'black' : 'white',
                flipCount: flips.length,
                flips: flips.map((pos: any) => Array.isArray(pos)
                    ? { row: pos[0], col: pos[1] }
                    : { row: pos.row, col: pos.col })
            });
        });
        return res;
    }

    function pickTabooReverseFlips(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps: any = {}) {
        const candidates = typeof deps.getTabooReverseCandidates === 'function'
            ? deps.getTabooReverseCandidates(cardState, gameState, playerKey, row, col)
            : getTabooReverseCandidates(cardState, gameState, playerKey, row, col);
        if (candidates.length === 0) {
            return { applied: false, flips: [], direction: null, score: 0 };
        }

        const maxScore = candidates.reduce((max: any, one: any) => Math.max(max, Number(one && one.score) || 0), 0);
        const topCandidates = candidates.filter((one: any) => (Number(one && one.score) || 0) === maxScore);

        const fallbackPrng = (cardState && cardState._boardOpsRandomSource && typeof cardState._boardOpsRandomSource.random === 'function')
            ? cardState._boardOpsRandomSource
            : (cardState && cardState._currentActionMeta && cardState._currentActionMeta.randomSource && typeof cardState._currentActionMeta.randomSource.random === 'function')
                ? cardState._currentActionMeta.randomSource
                : (cardState && cardState._defaultRandomSource && typeof cardState._defaultRandomSource.random === 'function')
                    ? cardState._defaultRandomSource
                    : null;
        const resolveIndex = typeof deps.resolveDeterministicRandomIndex === 'function'
            ? deps.resolveDeterministicRandomIndex
            : null;
        const index = topCandidates.length === 1
            ? 0
            : (resolveIndex
                ? resolveIndex(topCandidates.length, prng, fallbackPrng, 'CardLogic.applyChainChoice')
                : Math.floor(Math.max(0, Math.min(0.999999, Number(prng && prng.random ? prng.random() : 0))) * topCandidates.length));
        const chosen = topCandidates[index] || topCandidates[0];

        return {
            applied: true,
            flips: (chosen.flips || []).map((pos: any) => ({ row: pos.row, col: pos.col })),
            direction: chosen.direction ? [chosen.direction[0], chosen.direction[1]] : null,
            score: Number(chosen.score) || 0
        };
    }

    function buildLocalPendingTargetSelectors() {
        const callSelectorsMethod = (methodName: string) => (...args: any[]) => {
            const selector = Selectors && Selectors[methodName];
            return typeof selector === 'function' ? selector(...args) : [];
        };
        return {
            getDestroyTargets,
            getReverseWillTargets,
            getStrongWindTargets: callSelectorsMethod('getStrongWindTargets'),
            getBuoyancyTargets: callSelectorsMethod('getBuoyancyTargets'),
            getSuperBuoyancyTargets: callSelectorsMethod('getSuperBuoyancyTargets'),
            getGravityTargets: callSelectorsMethod('getGravityTargets'),
            getSuperGravityTargets: callSelectorsMethod('getSuperGravityTargets'),
            getSuperAttractionTargets: callSelectorsMethod('getSuperAttractionTargets'),
            getTrapTargets,
            getGuardTargets,
            getTimeBombTargets,
            getTeleportTargets,
            getCellTeleportTargets,
            getCloneTargets,
            getBoardExpansionTargets,
            getBoardShrinkTargets,
            getBlockadeTargets,
            getPoisonTargets,
            getMeteorTargets,
            getCausalReplayTargets,
            getFreezeTargets,
            getSeedTargets,
            getTemptTargets,
            getTemptWillTargets: getTemptTargets,
            getCaptureTargets,
            getCaptureWillTargets: getCaptureTargets,
            getPositionSwapTargets,
            getSwapTargets,
            getLivingWillTargets,
            getHyperactiveInheritTargets,
            getExtendLifeTargets,
            getCorrosionTargets,
            getBoardExpansionGodTargets,
            getBoardShrinkGodTargets
        };
    }

    function getPendingSelectorArgs(argsKey: string, context: any) {
        switch (argsKey) {
        case 'board':
            return [context.cardState, context.gameState];
        case 'player_pending':
            return [context.cardState, context.gameState, context.playerKey, context.pending];
        case 'player':
        default:
            return [context.cardState, context.gameState, context.playerKey];
        }
    }

    function buildSelectableTargetContext(cardState: any, gameState: any, playerKey: any, pending: any) {
        return {
            cardState,
            gameState,
            playerKey,
            pending,
            selectorsModule: Selectors,
            constants: { BLACK, WHITE, EMPTY },
            helpers: {
                createBoardViewForCard: (stateCard: any, stateGame: any) =>
                    createBoardView(stateCard, stateGame),
                getCurrentBoardShapeCellsForCard: getCurrentBoardShapeCells,
                getCellValueForCard: (state: any, row: any, col: any) =>
                    getCellValue(cardState, state, row, col),
                getExpansionDescriptorsForCard: (state: any) =>
                    getExpansionCells(cardState, state),
                isPositionSwapProtectedCell
            },
            localSelectors: buildLocalPendingTargetSelectors()
        };
    }

    function getSelectableTargetsViaRegistry(context: any) {
        const registry = safeRequire('../logic/cards-internal/pending-selection-registry');
        if (!registry || typeof registry.getPendingSelectionEntry !== 'function') return [];
        const entry = registry.getPendingSelectionEntry(context && context.pending && context.pending.type);
        const target = entry && entry.target;
        if (!target || !target.method) return [];
        const selector = context.localSelectors && context.localSelectors[target.method];
        if (typeof selector !== 'function') return [];
        const targets = selector(...getPendingSelectorArgs(target.argsKey, context));
        return Array.isArray(targets) ? targets : [];
    }

    function getSelectableTargets(cardState: any, gameState: any, playerKey: any) {
        const pending = (cardState && cardState.pendingEffectByPlayer) ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending) return [];
        const context = buildSelectableTargetContext(cardState, gameState, playerKey, pending);
        const SelectorOrchestrator = safeRequire('../logic/cards-internal/selector-orchestrator');

        if (SelectorOrchestrator && typeof SelectorOrchestrator.getSelectableTargetsForPending === 'function') {
            return SelectorOrchestrator.getSelectableTargetsForPending(context);
        }

        return getSelectableTargetsViaRegistry(context);
    }

    function getDestroyTargets(cardState: any, gameState: any) {
        if (typeof Selectors.getDestroyTargets === 'function') {
            return Selectors.getDestroyTargets(cardState, gameState);
        }
        const res: any[] = [];
        const markersAt = createMarkersAtLookup(cardState);
        forEachBoardShapeCell(cardState, gameState, (r: any, c: any, owner: any) => {
            if (owner === EMPTY) return;
            if (isMultiCellSpecialStoneCell(cardState, r, c)) return;
            const guarded = markersAt(r, c).some((m: any) =>
                m &&
                m.kind === 'specialStone' &&
                m.data &&
                m.data.type === 'GUARD'
            );
            if (guarded) return;
            if (isFrozenCell(cardState, r, c)) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getSwapTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getSwapTargets === 'function') {
            return Selectors.getSwapTargets(cardState, gameState, playerKey);
        }
        const res: any[] = [];
        const opVal = playerKey === 'black' ? WHITE : BLACK;
        const markersAt = createMarkersAtLookup(cardState);
        const isHiddenTrapForPlayer = (m: any) => (
            m &&
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'TRAP' &&
            m.owner &&
            m.owner !== playerKey
        );

        forEachBoardShapeCell(cardState, gameState, (r: any, c: any, owner: any) => {
            if (owner !== opVal) return;
            if (isMultiCellSpecialStoneCell(cardState, r, c)) return;
            const hasSpecialOrBomb = markersAt(r, c).some((m: any) => {
                if (!m) return false;
                if (m.kind !== 'specialStone') return false;
                if (isHiddenTrapForPlayer(m)) return false;
                const isExpiredUltimateHyperactive = !!(
                    m.data &&
                    m.data.type === 'ULTIMATE_HYPERACTIVE' &&
                    Number.isFinite(Number(m.data.remainingOwnerTurns)) &&
                    Number(m.data.remainingOwnerTurns) <= 0
                );
                if (isExpiredUltimateHyperactive) return false;
                return true;
            });
            if (hasSpecialOrBomb) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getGuardTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getGuardTargets === 'function') {
            return Selectors.getGuardTargets(cardState, gameState, playerKey);
        }
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const markersAt = createMarkersAtLookup(cardState);
        const res: any[] = [];
        for (const cell of getOccupiedBoardShapeCells(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValue(cardState, gameState, row, col) !== playerVal) continue;
            const hasBomb = markersAt(row, col).some((m: any) => isBombCategoryMarker(m));
            if (hasBomb) continue;
            if (isInviolableCell(cardState, row, col)) continue;
            if (isMultiCellSpecialStoneCell(cardState, row, col)) continue;
            res.push({ row, col });
        }
        return res;
    }

    function getCaptureTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Targets.getCaptureWillTargets === 'function') {
            return Targets.getCaptureWillTargets(cardState, gameState, playerKey);
        }
        // Fallback: same as tempt targets filtered by capturable source
        const temptTargets = getTemptTargets(cardState, gameState, playerKey);
        return temptTargets.filter((target: any) => {
            const marker = findSpecialMarkerAt(cardState, target.row, target.col);
            return !!marker;
        });
    }

    function getTemptTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Targets.getTemptWillTargets === 'function') {
            return Targets.getTemptWillTargets(cardState, gameState, playerKey);
        }
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const res: any[] = [];
        const markersAt = createMarkersAtLookup(cardState);
        const isGuarded = (r: any, c: any) => markersAt(r, c).some((m: any) =>
            m &&
            m.kind === 'specialStone' &&
            m.data &&
            m.data.type === 'GUARD'
        );
        forEachBoardShapeCell(cardState, gameState, (r: any, c: any) => {
            if (isGuarded(r, c)) return;
            if (!isSpecialStoneAt(cardState, r, c)) return;
            if (getSpecialOwnerAt(cardState, r, c) !== opponentKey) return;
            if (getCellValue(cardState, gameState, r, c) === EMPTY) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getPositionSwapTargets(cardState: any, gameState: any, playerKey: any, pending: any) {
        if (typeof Selectors.getPositionSwapTargets === 'function') {
            return Selectors.getPositionSwapTargets(cardState, gameState, playerKey, pending);
        }
        const res: any[] = [];
        const first = pending && pending.firstTarget ? pending.firstTarget : null;
        forEachBoardShapeCell(cardState, gameState, (r: any, c: any, owner: any) => {
            if (owner === EMPTY) return;
            if (first && first.row === r && first.col === c) return;
            if (isPositionSwapProtectedCell(cardState, r, c)) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getSeedTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getSeedTargets === 'function') {
            return Selectors.getSeedTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board) return [];
        const res: any[] = [];
        forEachBoardShapeCell(cardState, gameState, (r: any, c: any, owner: any) => {
            if (owner !== EMPTY) return;
            if (isBlockedCell(cardState, r, c)) return;
            if (hasSeedMarkerAt(cardState, r, c)) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getCloneTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getCloneTargets === 'function') {
            return Selectors.getCloneTargets(cardState, gameState, playerKey);
        }
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const res: any[] = [];
        for (const cell of getOccupiedBoardShapeCells(cardState, gameState)) {
            if (getCellValue(cardState, gameState, cell.row, cell.col) !== playerVal) continue;
            if (isMultiCellSpecialStoneCell(cardState, cell.row, cell.col)) continue;
            if (collectEmptyNeighborCells(cardState, gameState, cell.row, cell.col).length === 0) continue;
            res.push({ row: cell.row, col: cell.col });
        }
        return res;
    }

    function getBreedingTargets(cardState: any, gameState: any, playerKey: any) {
        // BREEDING_WILL is a next-stone effect; no board targets to select.
        return [];
    }

    function getMeteorTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getMeteorTargets === 'function') {
            return Selectors.getMeteorTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board) return [];
        const res: any[] = [];
        forEachBoardShapeCell(cardState, gameState, (r: any, c: any) => {
            if (isMeteorHoleCell(cardState, r, c)) return;
            if (isInviolableCell(cardState, r, c)) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getCausalReplayTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getCausalReplayTargets === 'function') {
            return Selectors.getCausalReplayTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board) return [];
        return getMeteorHoleCells(cardState, gameState);
    }

    function getFreezeTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getFreezeTargets === 'function') {
            return Selectors.getFreezeTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board) return [];
        const res: any[] = [];
        forEachBoardShapeCell(cardState, gameState, (r: any, c: any) => {
            if (isBlockedCell(cardState, r, c)) return;
            if (hasSeedMarkerAt(cardState, r, c)) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getBlockadeTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getBlockadeTargets === 'function') {
            return Selectors.getBlockadeTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board) return [];
        const res: any[] = [];
        forEachBoardShapeCell(cardState, gameState, (r: any, c: any, owner: any) => {
            if (owner !== EMPTY) return;
            if (isBlockedCell(cardState, r, c)) return;
            if (hasSeedMarkerAt(cardState, r, c)) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getCellTeleportTargets(cardState: any, gameState: any) {
        if (typeof Selectors.getCellTeleportTargets === 'function') {
            return Selectors.getCellTeleportTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board) return [];

        const activeExpansionCells = getExpansionCells(cardState, gameState);
        const activeByKey = new Map();
        for (const cell of activeExpansionCells) {
            if (!cell) continue;
            activeByKey.set(`${cell.row},${cell.col}`, cell);
        }

        const destinations: any[] = [];
        const seen = new Set();
        const pushCandidate = (row: any, col: any, side: any) => {
            const key = `${row},${col}`;
            if (seen.has(key)) return;
            seen.add(key);
            const activeCell = activeByKey.get(key) || null;
            const owner = activeCell ? Number(activeCell.owner) : EMPTY;
            if (owner !== EMPTY) return;
            if (isBlockedCell(cardState, row, col)) return;
            destinations.push({
                row,
                col,
                side: resolveExpansionSide(cardState, gameState, side, row, col),
                active: !!activeCell
            });
        };

        for (const cell of activeExpansionCells) {
            if (!cell) continue;
            pushCandidate(cell.row, cell.col, cell.side);
        }
        const socketTargets = getExpansionSocketTargets(cardState, gameState, 'edge')
            .concat(getExpansionSocketTargets(cardState, gameState, 'corner'));
        for (const target of socketTargets) {
            for (const cell of Array.isArray(target.additions) ? target.additions : []) {
                if (!cell) continue;
                pushCandidate(
                    cell.row,
                    cell.col,
                    resolveExpansionSide(cardState, gameState, null, cell.row, cell.col)
                );
            }
        }

        if (!destinations.length) return [];

        const res: any[] = [];
        forEachBoardShapeCell(cardState, gameState, (r: any, c: any, owner: any) => {
            if (owner === EMPTY) return;
            if (isFrozenCell(cardState, r, c)) return;
            if (isInviolableCell(cardState, r, c)) return;
            if (isMeteorHoleCell(cardState, r, c)) return;
            if (isMultiCellSpecialStoneCell(cardState, r, c)) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getSniperTargets(cardState: any, gameState: any, playerKey: any) {
        // SNIPER_WILL is a next-stone effect; no board targets to select.
        return [];
    }

    function getTimeBombTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getTimeBombTargets === 'function') {
            return Selectors.getTimeBombTargets(cardState, gameState, playerKey);
        }
        return getGuardTargets(cardState, gameState, playerKey);
    }

    function getLightningTargets(cardState: any, gameState: any, playerKey: any) {
        // LIGHTNING_WILL is a next-stone effect; no board targets to select.
        return [];
    }

    function getCrossBombTargets(cardState: any, gameState: any, playerKey: any) {
        // CROSS_BOMB is a next-stone effect; no board targets to select.
        return [];
    }

    function getXBombTargets(cardState: any, gameState: any, playerKey: any) {
        // X_BOMB is a next-stone effect; no board targets to select.
        return [];
    }

    function getReinforcementTargets(cardState: any, gameState: any, playerKey: any) {
        if (!gameState || !Array.isArray(gameState.board)) return [];
        return getEmptyBoardShapeCells(cardState, gameState)
            .filter((cell: any) => {
                const row = Number(cell && cell.row);
                const col = Number(cell && cell.col);
                if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
                return isAdjacentToAnyStoneForReinforcement(cardState, gameState, row, col);
            });
    }

    function getPoisonTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getPoisonTargets === 'function') {
            return Selectors.getPoisonTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getScorchTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getScorchTargets === 'function') {
            return Selectors.getScorchTargets(cardState, gameState, playerKey);
        }
        return [];
    }

    function getEqualityTargets(cardState: any, gameState: any, playerKey: any) {
        void cardState;
        void gameState;
        void playerKey;
        return [];
    }

    function getLastResortTargets(cardState: any, gameState: any, playerKey: any) {
        // LAST_RESORT places stones on empty cells when no legal moves and losing.
        return getEmptyBoardShapeCells(cardState, gameState);
    }

    // Additional helpers that are also target-related and used by getSelectableTargets

    function getLivingWillTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getLivingWillTargets === 'function') {
            return Selectors.getLivingWillTargets(cardState, gameState, playerKey);
        }
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const markersAt = createMarkersAtLookup(cardState);
        const res: any[] = [];
        for (const cell of getOccupiedBoardShapeCells(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValue(cardState, gameState, row, col) !== playerVal) continue;
            const hasBomb = markersAt(row, col).some((m: any) => isBombCategoryMarker(m));
            if (hasBomb) continue;
            if (isInviolableCell(cardState, row, col)) continue;
            const hasLivingWill = markersAt(row, col).some((m: any) => (
                m &&
                m.kind === 'specialStone' &&
                m.data &&
                m.data.type === 'LIVING_WILL'
            ));
            if (hasLivingWill) continue;
            res.push({ row, col });
        }
        return res;
    }

    function getHyperactiveInheritTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getHyperactiveInheritTargets === 'function') {
            return Selectors.getHyperactiveInheritTargets(cardState, gameState, playerKey);
        }
        return getGuardTargets(cardState, gameState, playerKey);
    }

    function getExtendLifeTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getExtendLifeTargets === 'function') {
            return Selectors.getExtendLifeTargets(cardState, gameState, playerKey);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res: any[] = [];
        for (const m of markers) {
            if (!m || m.kind !== 'specialStone') continue;
            if (typeof Markers.isTrueSpecialStoneMarker !== 'function' || !Markers.isTrueSpecialStoneMarker(m)) continue;
            if (typeof Markers.isDurationAffectableMarker !== 'function' || !Markers.isDurationAffectableMarker(m)) continue;
            if (m.owner !== playerKey) continue;
            const rem = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (rem === null || !Number.isFinite(rem) || rem <= 0) continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }

    function getCorrosionTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getCorrosionTargets === 'function') {
            return Selectors.getCorrosionTargets(cardState, gameState, playerKey);
        }
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res: any[] = [];
        for (const m of markers) {
            if (!m || m.kind !== 'specialStone') continue;
            const rem = (m.data && Number.isFinite(m.data.remainingOwnerTurns)) ? Number(m.data.remainingOwnerTurns) : null;
            if (rem === null || !Number.isFinite(rem) || rem <= 0) continue;
            res.push({ row: m.row, col: m.col });
        }
        return res;
    }

    function getBoardExpansionGodTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getBoardExpansionGodTargets === 'function') {
            return Selectors.getBoardExpansionGodTargets(cardState, gameState, playerKey);
        }
        if (!gameState || !gameState.board) return [];

        const socketTargets = getExpansionSocketTargets(cardState, gameState, 'corner');
        const pending = cardState && cardState.pendingEffectByPlayer
            ? cardState.pendingEffectByPlayer[playerKey]
            : null;
        const selectedKeys = new Set<string>();
        const selectedAnchorKeys = new Set<string>();
        const selectedAdditionKeys = new Set<string>();
        const selectedTargets: any[] = [];
        if (pending && pending.type === 'BOARD_EXPANSION_GOD') {
            if (pending.firstTarget && Number.isInteger(pending.firstTarget.row) && Number.isInteger(pending.firstTarget.col)) {
                selectedTargets.push(pending.firstTarget);
            }
            if (Array.isArray(pending.selectedTargets)) {
                selectedTargets.push(...pending.selectedTargets);
            }
        }
        for (const target of selectedTargets) {
            if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) continue;
            const directionKey = typeof target.directionKey === 'string' ? target.directionKey : '';
            if (directionKey) selectedKeys.add(`${target.row},${target.col},${directionKey}`);
            else selectedAnchorKeys.add(`${target.row},${target.col}`);
            const matchingSocket = socketTargets.find((candidate: any) => (
                candidate.row === target.row &&
                candidate.col === target.col &&
                (!directionKey || candidate.directionKey === directionKey)
            ));
            if (matchingSocket && Array.isArray(matchingSocket.additions)) {
                for (const cell of matchingSocket.additions) {
                    if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col)) {
                        selectedAdditionKeys.add(`${cell.row},${cell.col}`);
                    }
                }
            }
        }

        return socketTargets.filter((target: any) => {
            if (selectedKeys.has(`${target.row},${target.col},${target.directionKey || ''}`)) return false;
            if (selectedAnchorKeys.has(`${target.row},${target.col}`)) return false;
            return !(Array.isArray(target.additions) && target.additions.some(
                (cell: any) => selectedAdditionKeys.has(`${cell.row},${cell.col}`)
            ));
        });
    }

    function getBoardShrinkGodTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getBoardShrinkGodTargets === 'function') {
            return Selectors.getBoardShrinkGodTargets(cardState, gameState, playerKey);
        }
        return [];
    }

export = {
    getTrapTargets,
    getTeleportTargets,
    getBoardExpansionTargets,
    getBoardShrinkTargets,
    getTabooReverseCandidates,
    pickTabooReverseFlips,
    getReverseWillTargets,
    getSelectableTargets,
    getDestroyTargets,
    getSwapTargets,
    getGuardTargets,
    getCaptureTargets,
    getTemptTargets,
    getPositionSwapTargets,
    getSeedTargets,
    getCloneTargets,
    getBreedingTargets,
    getMeteorTargets,
    getCausalReplayTargets,
    getFreezeTargets,
    getBlockadeTargets,
    getPoisonTargets,
    getScorchTargets,
    getCellTeleportTargets,
    getSniperTargets,
    getTimeBombTargets,
    getLightningTargets,
    getCrossBombTargets,
    getXBombTargets,
    getReinforcementTargets,
    getEqualityTargets,
    getLastResortTargets
};
