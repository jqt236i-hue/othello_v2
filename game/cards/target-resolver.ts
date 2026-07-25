
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

    function resolveBoardConfig(gameState: any) {
        if (BoardUtils && typeof BoardUtils.resolveBoardConfig === 'function') {
            return BoardUtils.resolveBoardConfig(gameState);
        }
        const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
        const rows = Array.isArray(board) && board.length > 0 ? board.length : 8;
        const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
        return {
            rows,
            cols,
            baseBounds: { minRow: 0, maxRow: rows - 1, minCol: 0, maxCol: cols - 1 },
            outerBounds: { minRow: -1, maxRow: rows, minCol: -1, maxCol: cols }
        };
    }

    function isMainBoardCell(row: any, col: any, gameState: any) {
        if (BoardUtils && typeof BoardUtils.isMainBoardCell === 'function') {
            return BoardUtils.isMainBoardCell(row, col, gameState);
        }
        const config = resolveBoardConfig(gameState);
        return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < config.rows && col >= 0 && col < config.cols;
    }

    function getCellValue(gameState: any, row: any, col: any) {
        if (BoardUtils && typeof BoardUtils.getCellValue === 'function') {
            return BoardUtils.getCellValue(gameState && gameState.board, row, col);
        }
        if (isMainBoardCell(row, col, gameState)) {
            return (gameState && Array.isArray(gameState.board) && Array.isArray(gameState.board[row]))
                ? gameState.board[row][col]
                : null;
        }
        for (const cell of getExpansionCells(gameState)) {
            if (!cell) continue;
            if (cell.row === row && cell.col === col) {
                return Number(cell.owner);
            }
        }
        return null;
    }

    function getExpansionCells(gameState: any) {
        if (BoardUtils && typeof BoardUtils.collectExpansionDescriptors === 'function') {
            return BoardUtils.collectExpansionDescriptors(gameState && gameState.boardExpansion, gameState);
        }
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];
        const config = resolveBoardConfig(gameState);
        const cells: any[] = [];
        const pushCell = (source: any) => {
            let side = null;
            let row = null;
            let col = null;
            let owner = null;
            if (source && typeof source === 'object') {
                side = source.side;
                row = source.row;
                col = source.col;
                owner = source.owner;
                if (!Number.isInteger(col) && side === 'left') col = config.outerBounds.minCol;
                if (!Number.isInteger(col) && side === 'right') col = config.outerBounds.maxCol;
            }
            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            if (row < config.outerBounds.minRow || row > config.outerBounds.maxRow) return;
            if (col < config.outerBounds.minCol || col > config.outerBounds.maxCol) return;
            if (isMainBoardCell(row, col, gameState)) return;
            if (cells.some((c) => c && c.row === row && c.col === col)) return;
            const normalizedOwner = (owner === BLACK || owner === WHITE) ? owner : EMPTY;
            cells.push({ side, row, col, owner: normalizedOwner });
        };
        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
                pushCell(cell);
            }
        }
        if (cells.length === 0 && expansion.active === true) {
            pushCell(expansion);
        }
        return cells;
    }

    function forEachBoardShapeCell(gameState: any, visitor: any) {
        if (typeof visitor !== 'function') return;
        if (BoardUtils && typeof BoardUtils.forEachBoardShapeCell === 'function') {
            BoardUtils.forEachBoardShapeCell(gameState, visitor);
            return;
        }
        if (!gameState || !Array.isArray(gameState.board)) return;
        const config = resolveBoardConfig(gameState);
        for (let row = 0; row < config.rows; row++) {
            const boardRow = Array.isArray(gameState.board[row]) ? gameState.board[row] : [];
            for (let col = 0; col < config.cols; col++) {
                visitor(row, col, boardRow[col]);
            }
        }
        for (const cell of getExpansionCells(gameState)) {
            if (!cell) continue;
            visitor(cell.row, cell.col, Number(cell.owner));
        }
    }

    function hasBoardShapeCell(gameState: any, row: any, col: any) {
        return getCellValue(gameState, row, col) !== null;
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

    function toBoardCellKey(row: number, col: number) {
        return `${row},${col}`;
    }

    function getCurrentBoardShapeCells(cardState: any, gameState: any) {
        const cells: any[] = [];
        const config = resolveBoardConfig(gameState);
        for (let row = 0; row < config.rows; row++) {
            for (let col = 0; col < config.cols; col++) {
                if (!isMainBoardCell(row, col, gameState)) continue;
                if (isMeteorHoleCell(cardState, row, col)) continue;
                cells.push({ row, col });
            }
        }
        for (const desc of getExpansionCells(gameState)) {
            if (!desc || !Number.isInteger(desc.row) || !Number.isInteger(desc.col)) continue;
            if (isMeteorHoleCell(cardState, desc.row, desc.col)) continue;
            cells.push({ row: desc.row, col: desc.col });
        }
        return cells;
    }

    function getOccupiedBoardShapeCells(cardState: any, gameState: any) {
        return getCurrentBoardShapeCells(cardState, gameState)
            .filter((cell: any) => getCellValue(gameState, cell.row, cell.col) !== EMPTY);
    }

    function getEmptyBoardShapeCells(cardState: any, gameState: any) {
        return getCurrentBoardShapeCells(cardState, gameState)
            .filter((cell: any) => getCellValue(gameState, cell.row, cell.col) === EMPTY);
    }

    function isPositionSwapProtectedCell(cardState: any, row: number, col: number) {
        return !!(
            isFrozenCell(cardState, row, col) ||
            findSpecialMarkerAt(cardState, row, col, 'GLUTTONOUS') ||
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
                if (!hasBoardShapeCell(gameState, targetRow, targetCol)) continue;
                if (getCellValue(gameState, targetRow, targetCol) !== EMPTY) continue;
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

    function getTabooReverseDirectionalFlips(gameState: any, row: any, col: any, ownerVal: any, direction: any, context: any) {
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

        while (getCellValue(gameState, r, c) === -ownerVal) {
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

        const tail = getCellValue(gameState, r, c);
        if (blockedSet && blockedSet.has(`${r},${c}`)) {
            return [];
        }
        if (tail === ownerVal) {
            return [];
        }

        return flips;
    }

    function countDiscsByPlayer(gameState: any, playerKey: any) {
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        let own = 0;
        let opp = 0;
        forEachBoardShapeCell(gameState, (r: any, c: any, value: any) => {
            if (value === playerVal) own += 1;
            else if (value === -playerVal) opp += 1;
        });
        return { own, opp };
    }

    function getDiscDisadvantageForPlayer(gameState: any, playerKey: any) {
        const counts = countDiscsByPlayer(gameState, playerKey);
        return Math.max(0, counts.opp - counts.own);
    }

    function hasStandardLegalMoveForPlayer(cardState: any, gameState: any, playerKey: any) {
        // Fallback: check if there is any empty cell with at least one opponent neighbor
        // and a self stone beyond it in any direction.
        const playerVal = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const opponentVal = -playerVal;
        const directions = DIRECTIONS || [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        for (const cell of getCurrentBoardShapeCells(cardState, gameState)) {
            const row = cell.row;
            const col = cell.col;
            if (getCellValue(gameState, row, col) !== EMPTY) continue;
            if (isBlockedCell(cardState, row, col)) continue;
            for (const [dr, dc] of directions) {
                let r = row + dr;
                let c = col + dc;
                let hasOpponent = false;
                while (getCellValue(gameState, r, c) === opponentVal) {
                    hasOpponent = true;
                    r += dr;
                    c += dc;
                }
                if (hasOpponent && getCellValue(gameState, r, c) === playerVal) {
                    return true;
                }
            }
        }
        return false;
    }

    function getBoardExpansionGodCornerDescriptors(gameState: any) {
        const config = resolveBoardConfig(gameState);
        const lastRow = config.baseBounds.maxRow;
        const lastCol = config.baseBounds.maxCol;
        const outerMinRow = config.outerBounds.minRow;
        const outerMaxRow = config.outerBounds.maxRow;
        const outerMinCol = config.outerBounds.minCol;
        const outerMaxCol = config.outerBounds.maxCol;
        return [
            {
                row: 0,
                col: 0,
                cells: [
                    { row: outerMinRow, col: 0 },
                    { row: outerMinRow, col: outerMinCol },
                    { row: 0, col: outerMinCol }
                ]
            },
            {
                row: 0,
                col: lastCol,
                cells: [
                    { row: outerMinRow, col: lastCol },
                    { row: outerMinRow, col: outerMaxCol },
                    { row: 0, col: outerMaxCol }
                ]
            },
            {
                row: lastRow,
                col: 0,
                cells: [
                    { row: outerMaxRow, col: 0 },
                    { row: outerMaxRow, col: outerMinCol },
                    { row: lastRow, col: outerMinCol }
                ]
            },
            {
                row: lastRow,
                col: lastCol,
                cells: [
                    { row: lastRow, col: outerMaxCol },
                    { row: outerMaxRow, col: outerMaxCol },
                    { row: outerMaxRow, col: lastCol }
                ]
            }
        ];
    }

    function getBoardExpansionWillCellDescriptors(gameState: any) {
        const config = resolveBoardConfig(gameState);
        const cells: any[] = [];
        for (let row = 0; row < config.rows; row++) {
            cells.push({ row, col: config.outerBounds.minCol, side: 'left' });
            cells.push({ row, col: config.outerBounds.maxCol, side: 'right' });
        }
        return cells;
    }

    function resolveExpansionSide(side: any, row: any, col: any, gameState: any) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        const config = resolveBoardConfig(gameState);
        if (col === config.outerBounds.minCol) return 'left';
        if (col === config.outerBounds.maxCol) return 'right';
        if (row === config.outerBounds.minRow) return 'top';
        if (row === config.outerBounds.maxRow) return 'bottom';
        return null;
    }

    function normalizeExpansionOwner(owner: any) {
        return (owner === BLACK || owner === WHITE) ? owner : EMPTY;
    }

    function isAdjacentToAnyStoneForReinforcement(cardState: any, gameState: any, row: any, col: any) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nextRow = row + dr;
                const nextCol = col + dc;
                if (!hasBoardShapeCell(gameState, nextRow, nextCol)) continue;
                if (getCellValue(gameState, nextRow, nextCol) !== EMPTY) return true;
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
            if (getCellValue(gameState, row, col) !== playerVal) continue;
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
            .filter((cell: any) => !isInviolableCell(cardState, cell.row, cell.col));
    }

    function getBoardExpansionTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getBoardExpansionTargets === 'function') {
            return Selectors.getBoardExpansionTargets(cardState, gameState, playerKey);
        }
        if (!gameState || !gameState.board) return [];
        const config = resolveBoardConfig(gameState);
        const blockedEdgeTargets = new Set();
        const expansionCells = getExpansionCells(gameState);
        for (const cell of expansionCells) {
            if (!cell) continue;
            if (cell.col === config.outerBounds.minCol && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < config.rows) {
                blockedEdgeTargets.add(`${cell.row},0`);
            }
            if (cell.col === config.outerBounds.maxCol && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < config.rows) {
                blockedEdgeTargets.add(`${cell.row},${config.baseBounds.maxCol}`);
            }
        }
        const res: any[] = [];
        for (let r = 0; r < config.rows; r++) {
            if (!blockedEdgeTargets.has(`${r},0`)) {
                res.push({ row: r, col: 0, side: 'left' });
            }
            if (!blockedEdgeTargets.has(`${r},${config.baseBounds.maxCol}`)) {
                res.push({ row: r, col: config.baseBounds.maxCol, side: 'right' });
            }
        }
        return res;
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

        const targetValue = getCellValue(gameState, row, col);
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
            const flips = getTabooReverseDirectionalFlips(gameState, row, col, ownerVal, direction, context);
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
        const context = getCardContext(cardState);
        const res: any[] = [];
        forEachBoardShapeCell(gameState, (row: any, col: any, owner: any) => {
            if (owner !== BLACK && owner !== WHITE) return;
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
                getCurrentBoardShapeCellsForCard: getCurrentBoardShapeCells,
                getCellValueForCard: getCellValue,
                getExpansionDescriptorsForCard: getExpansionCells,
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
        forEachBoardShapeCell(gameState, (r: any, c: any, owner: any) => {
            if (owner === EMPTY) return;
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

        forEachBoardShapeCell(gameState, (r: any, c: any, owner: any) => {
            if (owner !== opVal) return;
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
            if (getCellValue(gameState, row, col) !== playerVal) continue;
            const hasBomb = markersAt(row, col).some((m: any) => isBombCategoryMarker(m));
            if (hasBomb) continue;
            if (isInviolableCell(cardState, row, col)) continue;
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
        forEachBoardShapeCell(gameState, (r: any, c: any) => {
            if (isGuarded(r, c)) return;
            if (!isSpecialStoneAt(cardState, r, c)) return;
            if (getSpecialOwnerAt(cardState, r, c) !== opponentKey) return;
            if (getCellValue(gameState, r, c) === EMPTY) return;
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
        forEachBoardShapeCell(gameState, (r: any, c: any, owner: any) => {
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
        forEachBoardShapeCell(gameState, (r: any, c: any, owner: any) => {
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
            if (getCellValue(gameState, cell.row, cell.col) !== playerVal) continue;
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
        forEachBoardShapeCell(gameState, (r: any, c: any) => {
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
        const res: any[] = [];
        forEachBoardShapeCell(gameState, (r: any, c: any) => {
            if (!isMeteorHoleCell(cardState, r, c)) return;
            res.push({ row: r, col: c });
        });
        return res;
    }

    function getFreezeTargets(cardState: any, gameState: any, playerKey: any) {
        if (typeof Selectors.getFreezeTargets === 'function') {
            return Selectors.getFreezeTargets(cardState, gameState);
        }
        if (!gameState || !gameState.board) return [];
        const res: any[] = [];
        forEachBoardShapeCell(gameState, (r: any, c: any) => {
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
        forEachBoardShapeCell(gameState, (r: any, c: any, owner: any) => {
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

        const activeExpansionCells = getExpansionCells(gameState);
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
            const owner = activeCell ? normalizeExpansionOwner(activeCell.owner) : EMPTY;
            if (owner !== EMPTY) return;
            if (isBlockedCell(cardState, row, col)) return;
            destinations.push({ row, col, side: resolveExpansionSide(side, row, col, gameState), active: !!activeCell });
        };

        for (const cell of getBoardExpansionWillCellDescriptors(gameState)) {
            if (!cell) continue;
            pushCandidate(cell.row, cell.col, cell.side);
        }
        for (const corner of getBoardExpansionGodCornerDescriptors(gameState)) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            for (const cell of corner.cells) {
                if (!cell) continue;
                pushCandidate(cell.row, cell.col, resolveExpansionSide(null, cell.row, cell.col, gameState));
            }
        }

        if (!destinations.length) return [];

        const res: any[] = [];
        forEachBoardShapeCell(gameState, (r: any, c: any, owner: any) => {
            if (owner === EMPTY) return;
            if (isFrozenCell(cardState, r, c)) return;
            if (isInviolableCell(cardState, r, c)) return;
            if (isMeteorHoleCell(cardState, r, c)) return;
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
            if (getCellValue(gameState, row, col) !== playerVal) continue;
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

        const expansionCells = getExpansionCells(gameState);
        const occupied = new Set(expansionCells.map((cell: any) => `${cell.row},${cell.col}`));
        const pending = cardState && cardState.pendingEffectByPlayer
            ? cardState.pendingEffectByPlayer[playerKey]
            : null;
        const selectedKeys = new Set();
        const selectedTargets = [];
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
            selectedKeys.add(`${target.row},${target.col}`);
        }

        const res: any[] = [];
        for (const corner of getBoardExpansionGodCornerDescriptors(gameState)) {
            if (!corner || !Array.isArray(corner.cells)) continue;
            if (selectedKeys.has(`${corner.row},${corner.col}`)) continue;
            const hasOccupied = corner.cells.some((cell: any) => occupied.has(`${cell.row},${cell.col}`));
            if (hasOccupied) continue;
            res.push({ row: corner.row, col: corner.col });
        }
        return res;
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
