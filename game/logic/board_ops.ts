import type { CardState, GameState, PlayerKey } from '../../src/types';

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

function getRuntimeGlobalValue(key: string): any {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[key]) {
        return (globalThis as any)[key];
    }
    if (typeof self !== 'undefined' && (self as any)[key]) {
        return (self as any)[key];
    }
    return null;
}

let CardExpansionModule: any = null;
let CardMarkersModule: any = null;
let SharedBoardUtilsModule: any = null;

CardExpansionModule = safeRequire('./cards/expansion') || getRuntimeGlobalValue('CardExpansion');
CardMarkersModule = safeRequire('./cards/markers') || getRuntimeGlobalValue('CardMarkers');
SharedBoardUtilsModule = safeRequire('../../shared/shared-board-utils') || getRuntimeGlobalValue('SharedBoardUtils');

const SharedConstants = safeRequire('../../shared-constants') || getRuntimeGlobalValue('SharedConstants');
const PresentationEffectProfiles = safeRequire('../../shared/presentation-effect-profiles') || getRuntimeGlobalValue('PresentationEffectProfiles');
const EvasionStatus = safeRequire('../../shared/evasion-status') || getRuntimeGlobalValue('EvasionStatus');

const { EMPTY } = SharedConstants || {};
const BoardUtils = SharedBoardUtilsModule || null;

function getCardExpansionModule(): any {
    return CardExpansionModule || null;
}

function getCardMarkersModule(): any {
    return CardMarkersModule || null;
}

function getSpecialStoneRegistryModule(): any {
    return safeRequire('../../shared/special-stone-registry') || getRuntimeGlobalValue('SpecialStoneRegistry');
}

function getManifestStoneRegistryModule(): any {
    return safeRequire('../../shared/manifest-stone-registry') || getRuntimeGlobalValue('ManifestStoneRegistry');
}

function isOverlayOnlySpecialStoneType(type: string): boolean {
    const registry = getSpecialStoneRegistryModule();
    if (registry && typeof registry.isOverlayOnlySpecialStoneType === 'function') {
        return registry.isOverlayOnlySpecialStoneType(type);
    }
    const typeUpper = String(type || '').toUpperCase();
    return typeUpper === 'GUARD' || typeUpper === 'LIVING_WILL';
}

function getCardRegenModule(): any {
    return safeRequire('./cards/regen') || getRuntimeGlobalValue('CardRegen');
}

function getCardLivingWillModule(): any {
    return safeRequire('./cards/living_will') || getRuntimeGlobalValue('CardLivingWill');
}

const MarkersAdapter = ((): any => {
    return safeRequire('./markers_adapter');
})();

const MARKER_KINDS = (CardMarkersModule && CardMarkersModule.MARKER_KINDS)
    || (MarkersAdapter && MarkersAdapter.MARKER_KINDS);

const DestroyOutcomeContract = ((): any => {
    return safeRequire('../../shared/destroy-outcome-contract') || getRuntimeGlobalValue('DestroyOutcomeContract');
})();

const StoneStatusSnapshot = ((): any => {
    return safeRequire('../../shared/stone-status-snapshot') || getRuntimeGlobalValue('StoneStatusSnapshot');
})();

const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS)
    || Object.freeze({
        DESTROYED: 'destroyed',
        REGENERATED: 'regenerated',
        LIVING_WILL_RESTORED: 'living_will_restored',
        GHOST_BLOCKED: 'ghost_blocked',
        PROLIFERATED: 'proliferated',
        EVADED_MOVE: 'evaded_move'
    });

function getDestroyOutcomeKind(result: any): string | null {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.getDestroyOutcomeKind === 'function') {
        return DestroyOutcomeContract.getDestroyOutcomeKind(result);
    }
    if (!result || typeof result !== 'object') return null;
    if (result.livingWillRevived === true) return DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED;
    if (result.regenerated === true) return DESTROY_OUTCOME_KINDS.REGENERATED;
    if (result.proliferated === true) return DESTROY_OUTCOME_KINDS.PROLIFERATED;
    if (result.blockedByGhost === true) return DESTROY_OUTCOME_KINDS.GHOST_BLOCKED;
    if (result.evaded === true) return DESTROY_OUTCOME_KINDS.EVADED_MOVE;
    if (result.destroyed === true) return DESTROY_OUTCOME_KINDS.DESTROYED;
    return null;
}

function createDestroyOutcome(kindOrResult: string | any, details?: any): any {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.createDestroyOutcome === 'function') {
        return DestroyOutcomeContract.createDestroyOutcome(kindOrResult, details);
    }
    const source = (typeof kindOrResult === 'string')
        ? Object.assign({}, (details && typeof details === 'object') ? details : {}, { kind: kindOrResult })
        : Object.assign({}, (kindOrResult && typeof kindOrResult === 'object') ? kindOrResult : {});
    const kind = getDestroyOutcomeKind(source) || (typeof kindOrResult === 'string' ? kindOrResult : null);
    const outcome: any = Object.assign({}, source, {
        destroyed: kind === DESTROY_OUTCOME_KINDS.DESTROYED || source.destroyed === true,
        regenerated: kind === DESTROY_OUTCOME_KINDS.REGENERATED || source.regenerated === true,
        livingWillRevived: kind === DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED || source.livingWillRevived === true,
        evaded: kind === DESTROY_OUTCOME_KINDS.EVADED_MOVE || source.evaded === true,
        blockedByGhost: kind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED || source.blockedByGhost === true,
        proliferated: kind === DESTROY_OUTCOME_KINDS.PROLIFERATED || source.proliferated === true
    });
    if (kind) outcome.kind = kind;
    if (outcome.to && typeof outcome.destination === 'undefined') outcome.destination = outcome.to;
    return outcome;
}

function isBoardOpsDebugEnabled(cardState: any): boolean {
    if (cardState && cardState.debugBoardOpsLog === true) return true;
    return false;
}

function _ensureCardState(cardState: any): void {
    if (!cardState.presentationEvents) cardState.presentationEvents = [];
    if (cardState._nextStoneId === undefined || cardState._nextStoneId === null) cardState._nextStoneId = 1;
    if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') cardState.expansionStoneIdByCell = {};
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.ensureMarkers === 'function') {
        cardMarkers.ensureMarkers(cardState);
    } else if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
        MarkersAdapter.ensureMarkers(cardState);
    } else if (!Array.isArray(cardState.markers)) {
        cardState.markers = [];
    }
}

function allocateStoneId(cardState: any): string {
    _ensureCardState(cardState);
    return 's' + String(cardState._nextStoneId++);
}

function resolveBoardDims(gameState: any, cardState: any): { rows: number; cols: number } {
    const boardSource = (gameState && Array.isArray(gameState.board))
        ? gameState
        : (cardState && Array.isArray(cardState.stoneIdMap) ? cardState : (gameState || cardState));
    if (BoardUtils && typeof BoardUtils.resolveBoardConfig === 'function') {
        const config = BoardUtils.resolveBoardConfig(boardSource);
        return { rows: config.rows, cols: config.cols };
    }
    const board = (gameState && Array.isArray(gameState.board))
        ? gameState.board
        : (cardState && Array.isArray(cardState.stoneIdMap) ? cardState.stoneIdMap : null);
    const rows = Array.isArray(board) && board.length > 0 ? board.length : 8;
    const cols = Array.isArray(board) && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return { rows, cols };
}

function isMainBoardCell(row: number, col: number, boardOrState: any): boolean {
    const cardExpansion = getCardExpansionModule();
    if (cardExpansion && typeof cardExpansion.isMainBoardCellForCard === 'function') {
        return cardExpansion.isMainBoardCellForCard(row, col, boardOrState);
    }
    const dims = resolveBoardDims(boardOrState, boardOrState);
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < dims.rows && col >= 0 && col < dims.cols;
}

function resolveExpansionSide(side: string | null, row: number, col: number, boardOrState: any): string | null {
    const cardExpansion = getCardExpansionModule();
    if (cardExpansion && typeof cardExpansion.resolveExpansionSideForCard === 'function') {
        return cardExpansion.resolveExpansionSideForCard(side, row, col, boardOrState);
    }
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    const dims = resolveBoardDims(boardOrState, boardOrState);
    if (col === -1) return 'left';
    if (col === dims.cols) return 'right';
    if (row === -1) return 'top';
    if (row === dims.rows) return 'bottom';
    return null;
}

function isExpansionCoordinate(row: number, col: number, boardOrState: any): boolean {
    const cardExpansion = getCardExpansionModule();
    if (cardExpansion && typeof cardExpansion.isExpansionCoordinateForCard === 'function') {
        return cardExpansion.isExpansionCoordinateForCard(row, col, boardOrState);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const dims = resolveBoardDims(boardOrState, boardOrState);
    if (row < -1 || row > dims.rows || col < -1 || col > dims.cols) return false;
    if (isMainBoardCell(row, col, boardOrState)) return false;
    return true;
}

function isMainBoardCorner(row: number, col: number, boardOrState: any): boolean {
    const dims = resolveBoardDims(boardOrState, boardOrState);
    return isMainBoardCell(row, col, boardOrState) && (row === 0 || row === dims.rows - 1) && (col === 0 || col === dims.cols - 1);
}

function ensureResultTotals(cardState: any): void {
    if (!cardState || typeof cardState !== 'object') return;
    if (!cardState.totalFlipCountByPlayer || typeof cardState.totalFlipCountByPlayer !== 'object') {
        cardState.totalFlipCountByPlayer = { black: 0, white: 0 };
    }
    if (!cardState.cornerCaptureCountByPlayer || typeof cardState.cornerCaptureCountByPlayer !== 'object') {
        cardState.cornerCaptureCountByPlayer = { black: 0, white: 0 };
    }
    if (!Number.isFinite(Number(cardState.totalFlipCountByPlayer.black))) cardState.totalFlipCountByPlayer.black = 0;
    if (!Number.isFinite(Number(cardState.totalFlipCountByPlayer.white))) cardState.totalFlipCountByPlayer.white = 0;
    if (!Number.isFinite(Number(cardState.cornerCaptureCountByPlayer.black))) cardState.cornerCaptureCountByPlayer.black = 0;
    if (!Number.isFinite(Number(cardState.cornerCaptureCountByPlayer.white))) cardState.cornerCaptureCountByPlayer.white = 0;
}

function getExpansionKey(row: number, col: number): string {
    return `${row},${col}`;
}

function normalizeExpansionOwner(owner: number): number {
    const cardExpansion = getCardExpansionModule();
    if (cardExpansion && typeof cardExpansion.normalizeExpansionOwnerForCard === 'function') {
        return cardExpansion.normalizeExpansionOwnerForCard(owner);
    }
    if (BoardUtils && typeof BoardUtils.normalizeOwner === 'function') {
        const normalizedOwner = BoardUtils.normalizeOwner(owner);
        return (normalizedOwner === SharedConstants.BLACK || normalizedOwner === SharedConstants.WHITE)
            ? normalizedOwner
            : EMPTY;
    }
    return (owner === SharedConstants.BLACK || owner === SharedConstants.WHITE) ? owner : EMPTY;
}

function getExpansionDescriptors(gameState: any): Array<{ side: string | null; row: number; col: number; owner: number }> {
    const cardExpansion = getCardExpansionModule();
    if (cardExpansion && typeof cardExpansion.getExpansionDescriptorsForCard === 'function') {
        return cardExpansion.getExpansionDescriptorsForCard(gameState);
    }
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion) return [];

    const out: Array<{ side: string | null; row: number; col: number; owner: number }> = [];
    const pushDescriptor = (source: any, legacyRow?: number, legacyOwner?: number): void => {
        let side: string | null = null;
        let row: number | null = null;
        let col: number | null = null;
        let owner = legacyOwner;

        if (source && typeof source === 'object') {
            side = source.side;
            row = source.row;
            col = source.col;
            owner = source.owner;
            if (!Number.isInteger(col) && side === 'left') col = -1;
            if (!Number.isInteger(col) && side === 'right') col = resolveBoardDims(gameState, null).cols;
        } else {
            side = source;
            row = legacyRow !== undefined ? legacyRow : null;
            if (side === 'left') col = -1;
            if (side === 'right') col = resolveBoardDims(gameState, null).cols;
        }

        if (!isExpansionCoordinate(row as number, col as number, gameState)) return;
        if (out.some((desc) => desc && desc.row === row && desc.col === col)) return;
        out.push({
            side: resolveExpansionSide(side, row as number, col as number, gameState),
            row: row as number,
            col: col as number,
            owner: normalizeExpansionOwner(owner as number)
        });
    };

    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object') continue;
            pushDescriptor(cell);
        }
    }

    if (out.length === 0 && expansion.active === true) {
        pushDescriptor(expansion);
    }

    return out;
}

function syncLegacyExpansionFields(expansion: any, gameState: any): void {
    const cardExpansion = getCardExpansionModule();
    if (cardExpansion && typeof cardExpansion.syncLegacyExpansionFieldsForCard === 'function') {
        cardExpansion.syncLegacyExpansionFieldsForCard(expansion, gameState);
        return;
    }
    if (!expansion || typeof expansion !== 'object') return;
    if (!Array.isArray(expansion.cells)) expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
    expansion.row = latest ? latest.row : null;
    expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : EMPTY;
}

function ensureExpansionStateMutable(gameState: any): any {
    const cardExpansion = getCardExpansionModule();
    if (cardExpansion && typeof cardExpansion.ensureMutableBoardExpansionForCard === 'function') {
        return cardExpansion.ensureMutableBoardExpansionForCard(gameState);
    }
    if (!gameState.boardExpansion || typeof gameState.boardExpansion !== 'object') {
        gameState.boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: EMPTY,
            usedByPlayer: { black: false, white: false },
            cells: []
        };
        return gameState.boardExpansion;
    }
    const expansion = gameState.boardExpansion;
    if (!expansion.usedByPlayer || typeof expansion.usedByPlayer !== 'object') {
        expansion.usedByPlayer = { black: false, white: false };
    } else {
        expansion.usedByPlayer.black = !!expansion.usedByPlayer.black;
        expansion.usedByPlayer.white = !!expansion.usedByPlayer.white;
    }
    const descriptors = getExpansionDescriptors(gameState);
    expansion.cells = descriptors.map((desc) => ({
        side: desc.side,
        row: desc.row,
        col: desc.col,
        owner: normalizeExpansionOwner(desc.owner)
    }));
    syncLegacyExpansionFields(expansion, gameState);
    return expansion;
}

function getExpansionDescriptor(gameState: any): any {
    const descriptors = getExpansionDescriptors(gameState);
    return descriptors.length > 0 ? descriptors[0] : null;
}

function isExpansionCell(gameState: any, row: number, col: number): boolean {
    const descriptors = getExpansionDescriptors(gameState);
    return descriptors.some((desc) => desc && desc.row === row && desc.col === col);
}

function getCellValue(gameState: any, row: number, col: number): number | null {
    const cardExpansion = getCardExpansionModule();
    if (cardExpansion && typeof cardExpansion.getCellValueForCard === 'function') {
        return cardExpansion.getCellValueForCard(gameState, row, col);
    }
    if (isMainBoardCell(row, col, gameState)) return gameState.board[row][col];
    const descriptors = getExpansionDescriptors(gameState);
    for (const descriptor of descriptors) {
        if (!descriptor) continue;
        if (descriptor.row === row && descriptor.col === col) {
            return normalizeExpansionOwner(descriptor.owner);
        }
    }
    return null;
}

function setCellValue(gameState: any, row: number, col: number, value: number): boolean {
    const cardExpansion = getCardExpansionModule();
    if (cardExpansion && typeof cardExpansion.setCellValueForCard === 'function') {
        return cardExpansion.setCellValueForCard(gameState, row, col, value);
    }
    if (isMainBoardCell(row, col, gameState)) {
        gameState.board[row][col] = value;
        return true;
    }
    const expansion = ensureExpansionStateMutable(gameState);
    if (!Array.isArray(expansion.cells)) return false;
    const normalizedOwner = normalizeExpansionOwner(value);
    for (let i = 0; i < expansion.cells.length; i++) {
        const cell = expansion.cells[i];
        if (!cell) continue;
        const cellCol = Number.isInteger(cell.col)
            ? cell.col
            : (cell.side === 'left' ? -1 : (cell.side === 'right' ? resolveBoardDims(gameState, null).cols : null));
        if (!Number.isInteger(cellCol)) continue;
        if (cell.row === row && cellCol === col) {
            expansion.cells[i] = {
                side: resolveExpansionSide(cell.side, cell.row, cellCol, gameState),
                row: cell.row,
                col: cellCol,
                owner: normalizedOwner
            };
            syncLegacyExpansionFields(expansion, gameState);
            return true;
        }
    }
    return false;
}

function getStoneIdAt(cardState: any, gameState: any, row: number, col: number): string | null {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.getStoneIdAtForCard === 'function') {
        return cardMarkers.getStoneIdAtForCard(cardState, gameState, row, col);
    }
    if (isMainBoardCell(row, col, gameState)) {
        return cardState.stoneIdMap ? cardState.stoneIdMap[row][col] : null;
    }
    if (isExpansionCell(gameState, row, col)) {
        return cardState.expansionStoneIdByCell ? cardState.expansionStoneIdByCell[getExpansionKey(row, col)] : null;
    }
    return null;
}

function setStoneIdAt(cardState: any, gameState: any, row: number, col: number, stoneId: string | null): boolean {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.setStoneIdAtForCard === 'function') {
        return cardMarkers.setStoneIdAtForCard(cardState, gameState, row, col, stoneId);
    }
    if (isMainBoardCell(row, col, gameState || cardState)) {
        const dims = resolveBoardDims(gameState, cardState);
        if (!cardState.stoneIdMap) {
            cardState.stoneIdMap = Array.from({ length: dims.rows }, () => Array.from({ length: dims.cols }, () => null));
        }
        if (!Array.isArray(cardState.stoneIdMap[row])) {
            cardState.stoneIdMap[row] = Array.from({ length: dims.cols }, () => null);
        }
        cardState.stoneIdMap[row][col] = stoneId;
        return true;
    }
    if (isExpansionCell(gameState, row, col)) {
        if (!cardState.expansionStoneIdByCell || typeof cardState.expansionStoneIdByCell !== 'object') {
            cardState.expansionStoneIdByCell = {};
        }
        const key = getExpansionKey(row, col);
        if (stoneId === null || stoneId === undefined) {
            delete cardState.expansionStoneIdByCell[key];
        } else {
            cardState.expansionStoneIdByCell[key] = stoneId;
        }
        return true;
    }
    return false;
}

function _normalizeCounterValue(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.trunc(numeric));
}

function _normalizeBoardIndex(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.trunc(numeric);
}

function _normalizeCellPosition(row: any, col: any): { row: number; col: number } | null {
    const normalizedRow = _normalizeBoardIndex(row);
    const normalizedCol = _normalizeBoardIndex(col);
    if (normalizedRow === null || normalizedCol === null) return null;
    return { row: normalizedRow, col: normalizedCol };
}

function _getSpecialMarkersAt(cardState: any, row: number, col: number): any[] {
    const pos = _normalizeCellPosition(row, col);
    if (!pos) return [];
    const cardMarkers = getCardMarkersModule();
    const markers = (cardMarkers && typeof cardMarkers.getSpecialMarkers === 'function')
        ? cardMarkers.getSpecialMarkers(cardState)
        : ((!cardState || !Array.isArray(cardState.markers))
            ? []
            : cardState.markers.filter((m: any) => (
                m &&
                m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                !_isManifestStoneMarker(m)
            )));
    return markers.filter((m: any) => (
        m &&
        _normalizeBoardIndex(m.row) === pos.row &&
        _normalizeBoardIndex(m.col) === pos.col
    ));
}

function _isManifestStoneType(type: any): boolean {
    const registry = getManifestStoneRegistryModule();
    if (registry && typeof registry.isManifestStoneType === 'function') {
        return registry.isManifestStoneType(type) === true;
    }
    const typeUpper = String(type || '').toUpperCase();
    return typeUpper === 'THEORY_INCARNATION' || typeUpper === 'BOARD_EXECUTOR' || typeUpper === 'OBSERVER_WILL';
}

function _isManifestStoneMarker(marker: any): boolean {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.isManifestStoneMarker === 'function') {
        return cardMarkers.isManifestStoneMarker(marker) === true;
    }
    const registry = getManifestStoneRegistryModule();
    if (registry && typeof registry.isManifestStoneMarker === 'function') {
        return registry.isManifestStoneMarker(marker) === true;
    }
    return !!(
        marker &&
        (marker.kind === 'manifestStone' || marker.kind === 'specialStone') &&
        _isManifestStoneType(marker && marker.data && marker.data.type)
    );
}

function _getManifestMarkersAt(cardState: any, row: number, col: number): any[] {
    const pos = _normalizeCellPosition(row, col);
    if (!pos) return [];
    const cardMarkers = getCardMarkersModule();
    const markers = (cardMarkers && typeof cardMarkers.getManifestMarkers === 'function')
        ? cardMarkers.getManifestMarkers(cardState)
        : ((!cardState || !Array.isArray(cardState.markers))
            ? []
            : cardState.markers.filter(_isManifestStoneMarker));
    return markers.filter((m: any) => (
        m &&
        _normalizeBoardIndex(m.row) === pos.row &&
        _normalizeBoardIndex(m.col) === pos.col
    ));
}

function _isBlockingMarkerType(type: string): boolean {
    const typeUpper = String(type || '').toUpperCase();
    return typeUpper === 'BLOCKADE' || typeUpper === 'METEOR_HOLE' || typeUpper === 'FREEZE';
}

function _isCellFixedMarkerType(type: string): boolean {
    const typeUpper = String(type || '').toUpperCase();
    return typeUpper === 'BLOCKADE' ||
        typeUpper === 'METEOR_HOLE' ||
        typeUpper === 'FREEZE' ||
        typeUpper === 'SEED';
}

function _isStoneAttachedMoveMarker(marker: any): boolean {
    if (!marker) return false;
    const typeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
    return !_isCellFixedMarkerType(typeUpper);
}

function _moveStoneAttachedMarkers(cardState: any, fromRow: number, fromCol: number, toRow: number, toCol: number): any[] {
    if (!cardState || !Array.isArray(cardState.markers)) return [];
    const moved: any[] = [];
    for (const marker of cardState.markers) {
        if (!marker) continue;
        if (_normalizeBoardIndex(marker.row) !== fromRow || _normalizeBoardIndex(marker.col) !== fromCol) continue;
        if (!_isStoneAttachedMoveMarker(marker)) continue;
        marker.row = toRow;
        marker.col = toCol;
        moved.push(marker);
    }
    _moveLinkedMarkerPositions(cardState, fromRow, fromCol, toRow, toCol);
    return moved;
}

function _swapStoneAttachedMarkers(cardState: any, aRow: number, aCol: number, bRow: number, bCol: number): void {
    if (!cardState || !Array.isArray(cardState.markers)) return;
    for (const marker of cardState.markers) {
        if (!marker || !_isStoneAttachedMoveMarker(marker)) continue;
        const row = _normalizeBoardIndex(marker.row);
        const col = _normalizeBoardIndex(marker.col);
        if (row === aRow && col === aCol) {
            marker.row = bRow;
            marker.col = bCol;
        } else if (row === bRow && col === bCol) {
            marker.row = aRow;
            marker.col = aCol;
        }
    }
    _swapLinkedMarkerPositions(cardState, aRow, aCol, bRow, bCol);
}

function _moveLinkedMarkerPositions(cardState: any, fromRow: number, fromCol: number, toRow: number, toCol: number): void {
    const movePoint = (point: any) => {
        if (!point || !Number.isInteger(point.row) || !Number.isInteger(point.col)) return point;
        if (point.row === fromRow && point.col === fromCol) return { row: toRow, col: toCol };
        return point;
    };
    if (cardState && cardState.workAnchorPosByPlayer) {
        cardState.workAnchorPosByPlayer.black = movePoint(cardState.workAnchorPosByPlayer.black);
        cardState.workAnchorPosByPlayer.white = movePoint(cardState.workAnchorPosByPlayer.white);
    }
    if (cardState && cardState.breedingSproutByOwner) {
        for (const owner of ['black', 'white']) {
            const points = Array.isArray(cardState.breedingSproutByOwner[owner]) ? cardState.breedingSproutByOwner[owner] : [];
            cardState.breedingSproutByOwner[owner] = points.map(movePoint);
        }
    }
    if (cardState && cardState.breedingFrontierByAnchorId && typeof cardState.breedingFrontierByAnchorId === 'object') {
        for (const key of Object.keys(cardState.breedingFrontierByAnchorId)) {
            const points = Array.isArray(cardState.breedingFrontierByAnchorId[key]) ? cardState.breedingFrontierByAnchorId[key] : [];
            cardState.breedingFrontierByAnchorId[key] = points.map(movePoint);
        }
    }
}

function _swapLinkedMarkerPositions(cardState: any, aRow: number, aCol: number, bRow: number, bCol: number): void {
    const swapPoint = (point: any) => {
        if (!point || !Number.isInteger(point.row) || !Number.isInteger(point.col)) return point;
        if (point.row === aRow && point.col === aCol) return { row: bRow, col: bCol };
        if (point.row === bRow && point.col === bCol) return { row: aRow, col: aCol };
        return point;
    };
    if (cardState && cardState.workAnchorPosByPlayer) {
        cardState.workAnchorPosByPlayer.black = swapPoint(cardState.workAnchorPosByPlayer.black);
        cardState.workAnchorPosByPlayer.white = swapPoint(cardState.workAnchorPosByPlayer.white);
    }
    if (cardState && cardState.breedingSproutByOwner) {
        for (const owner of ['black', 'white']) {
            const points = Array.isArray(cardState.breedingSproutByOwner[owner]) ? cardState.breedingSproutByOwner[owner] : [];
            cardState.breedingSproutByOwner[owner] = points.map(swapPoint);
        }
    }
    if (cardState && cardState.breedingFrontierByAnchorId && typeof cardState.breedingFrontierByAnchorId === 'object') {
        for (const key of Object.keys(cardState.breedingFrontierByAnchorId)) {
            const points = Array.isArray(cardState.breedingFrontierByAnchorId[key]) ? cardState.breedingFrontierByAnchorId[key] : [];
            cardState.breedingFrontierByAnchorId[key] = points.map(swapPoint);
        }
    }
}

function _isFrozenCell(cardState: any, row: number, col: number): boolean {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.isFrozenCellForCard === 'function') {
        return !!cardMarkers.isFrozenCellForCard(cardState, row, col);
    }
    const markers = _getSpecialMarkersAt(cardState, row, col).concat(_getManifestMarkersAt(cardState, row, col));
    return markers.some((marker: any) => String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() === 'FREEZE');
}

function _isAbsoluteProtectedCell(cardState: any, row: number, col: number): boolean {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.isAbsoluteProtectedCell === 'function') {
        return !!cardMarkers.isAbsoluteProtectedCell(cardState, row, col);
    }
    const registry = getSpecialStoneRegistryModule();
    const markers = _getSpecialMarkersAt(cardState, row, col);
    return markers.some((marker: any) => {
        const data = marker && marker.data ? marker.data : null;
        if (data && Object.prototype.hasOwnProperty.call(data, 'remainingOwnerTurns')) {
            const remainingOwnerTurns = Number(data.remainingOwnerTurns);
            if (!Number.isFinite(remainingOwnerTurns) || remainingOwnerTurns <= 0) return false;
        }
        const type = String(data && data.type ? data.type : '').trim().toUpperCase();
        if (registry && typeof registry.isAbsoluteProtectedSpecialType === 'function') {
            return registry.isAbsoluteProtectedSpecialType(type) === true;
        }
        return type === 'ABSOLUTE_PROTECTED' || _isManifestStoneType(type);
    });
}

function _isBlockedDestinationCell(cardState: any, row: number, col: number): boolean {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.getBlockingMarkers === 'function') {
        return cardMarkers.getBlockingMarkers(cardState).some((marker: any) => (
            marker &&
            _normalizeBoardIndex(marker.row) === row &&
            _normalizeBoardIndex(marker.col) === col
        ));
    }
    const markers = _getSpecialMarkersAt(cardState, row, col);
    return markers.some((marker: any) => _isBlockingMarkerType(marker && marker.data && marker.data.type));
}

function _getDestroyEvadeMarkerAt(cardState: any, row: number, col: number): any {
    const markersAtCell = _getSpecialMarkersAt(cardState, row, col);
    let bestMarker: any = null;
    let bestCreatedSeq = Number.POSITIVE_INFINITY;
    for (const marker of markersAtCell) {
        const remaining = EvasionStatus && typeof EvasionStatus.readDestroyEvadeRemaining === 'function'
            ? EvasionStatus.readDestroyEvadeRemaining(marker)
            : _normalizeCounterValue(marker && marker.data && marker.data.destroyEvadeRemaining);
        if (remaining === null || remaining <= 0) continue;
        const createdSeq = Number.isFinite(Number(marker && marker.createdSeq))
            ? Number(marker.createdSeq)
            : Number.POSITIVE_INFINITY;
        if (bestMarker === null || createdSeq < bestCreatedSeq) {
            bestCreatedSeq = createdSeq;
            bestMarker = marker;
        }
    }
    return bestMarker;
}

function _getProliferationMarkerAt(cardState: any, row: number, col: number): any {
    const markersAtCell = _getSpecialMarkersAt(cardState, row, col);
    return markersAtCell.find((marker: any) => (
        String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() === 'PROLIFERATION'
    )) || null;
}

function _consumeProliferationMarkerOnNormalFlip(cardState: any, row: number, col: number): any {
    if (!cardState || !Array.isArray(cardState.markers)) return null;
    const markerKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
    let removed: any = null;
    cardState.markers = cardState.markers.filter((entry: any) => {
        const shouldRemove = !!(
            entry &&
            entry.kind === markerKind &&
            entry.row === row &&
            entry.col === col &&
            entry.data &&
            String(entry.data.type || '').toUpperCase() === 'PROLIFERATION'
        );
        if (shouldRemove && !removed) removed = entry;
        return !shouldRemove;
    });
    return removed;
}

function _clonePresentationMeta(meta: any): any {
    const out = (meta && typeof meta === 'object') ? Object.assign({}, meta) : {};
    delete out.randomSource;
    delete out.prng;
    return out;
}

function _clonePresentationMetaWithActionContext(cardState: any, meta: any): any {
    const out = _clonePresentationMeta(meta);
    const actionMeta = cardState && cardState._currentActionMeta && typeof cardState._currentActionMeta === 'object'
        ? cardState._currentActionMeta
        : null;
    if (!actionMeta) return out;
    if (out.actionId === undefined && actionMeta.actionId !== undefined && actionMeta.actionId !== null) {
        out.actionId = actionMeta.actionId;
    }
    if (out.effectBlockId === undefined && actionMeta.effectBlockId !== undefined && actionMeta.effectBlockId !== null) {
        out.effectBlockId = actionMeta.effectBlockId;
    }
    if (out.effectKind === undefined && actionMeta.effectKind !== undefined && actionMeta.effectKind !== null) {
        out.effectKind = actionMeta.effectKind;
    }
    if (out.turnIndex === undefined && typeof actionMeta.turnIndex === 'number') {
        out.turnIndex = actionMeta.turnIndex;
    }
    return out;
}

function _resolveBoardOpsRandomSource(cardState: any, meta: any): any {
    if (meta && meta.randomSource && typeof meta.randomSource.random === 'function') return meta.randomSource;
    if (meta && meta.prng && typeof meta.prng.random === 'function') return meta.prng;
    if (cardState && cardState._boardOpsRandomSource && typeof cardState._boardOpsRandomSource.random === 'function') {
        return cardState._boardOpsRandomSource;
    }
    if (cardState && cardState._currentActionMeta && cardState._currentActionMeta.randomSource && typeof cardState._currentActionMeta.randomSource.random === 'function') {
        return cardState._currentActionMeta.randomSource;
    }
    if (cardState && cardState._defaultRandomSource && typeof cardState._defaultRandomSource.random === 'function') {
        return cardState._defaultRandomSource;
    }
    throw new Error('BoardOps requires an injected deterministic PRNG.');
}

function _resolveRandomIndex(randomSource: any, length: number): number {
    if (!Number.isInteger(length) || length <= 0) return 0;
    const raw = Math.floor(Number(randomSource.random()) * length);
    if (!Number.isInteger(raw)) return 0;
    return Math.max(0, Math.min(length - 1, raw));
}

function _getProliferationOwnerTurns(): number {
    const raw = Number(SharedConstants && SharedConstants.PROLIFERATION_WILL_TURNS);
    return Number.isFinite(raw) ? Math.max(1, Math.trunc(raw)) : 10;
}

function _findProliferationDestination(cardState: any, gameState: any, row: number, col: number, meta: any): { row: number; col: number } | null {
    const allCandidates = _collectBoardShapeEmptyCells(cardState, gameState);
    if (!allCandidates.length) return null;
    let minDistance = Number.POSITIVE_INFINITY;
    let candidates: Array<{ row: number; col: number }> = [];
    for (const candidate of allCandidates) {
        const distance = _getChebyshevDistance(row, col, candidate.row, candidate.col);
        if (distance < minDistance) {
            minDistance = distance;
            candidates = [candidate];
            continue;
        }
        if (distance === minDistance) {
            candidates.push(candidate);
        }
    }
    if (!candidates.length) return null;
    const randomSource = _resolveBoardOpsRandomSource(cardState, meta);
    return candidates[_resolveRandomIndex(randomSource, candidates.length)] || candidates[0] || null;
}

function _collectBoardShapeEmptyCells(cardState: any, gameState: any): Array<{ row: number; col: number }> {
    const out: Array<{ row: number; col: number }> = [];
    const pushCell = (row: number, col: number): void => {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        if (out.some((entry) => entry.row === row && entry.col === col)) return;
        if (getCellValue(gameState, row, col) !== EMPTY) return;
        if (_isBlockedDestinationCell(cardState, row, col)) return;
        out.push({ row, col });
    };
    const dims = resolveBoardDims(gameState, cardState);
    for (let row = 0; row < dims.rows; row += 1) {
        for (let col = 0; col < dims.cols; col += 1) {
            pushCell(row, col);
        }
    }
    for (const descriptor of getExpansionDescriptors(gameState)) {
        if (!descriptor) continue;
        pushCell(descriptor.row, descriptor.col);
    }
    return out;
}

function _findStoneSalvationGodMarker(cardState: any, ownerKey: string): any {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const markerKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
    return markers.find((marker: any) => (
        marker &&
        marker.kind === markerKind &&
        marker.owner === ownerKey &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === 'STONE_SALVATION_GOD' &&
        (_normalizeCounterValue(marker.data.remainingOwnerTurns) === null || (_normalizeCounterValue(marker.data.remainingOwnerTurns) || 0) > 0)
    )) || null;
}

function _resolveStoneSalvationGodRescuerOwner(cardState: any, destroyedOwnerKey: string): string | null {
    if (destroyedOwnerKey !== 'black' && destroyedOwnerKey !== 'white') return null;
    const opponentOwnerKey = destroyedOwnerKey === 'black' ? 'white' : 'black';
    if (_findStoneSalvationGodMarker(cardState, destroyedOwnerKey)) return destroyedOwnerKey;
    if (_findStoneSalvationGodMarker(cardState, opponentOwnerKey)) return opponentOwnerKey;
    return null;
}

function _ensurePendingStoneSalvationGodRevives(cardState: any): any {
    _ensureCardState(cardState);
    if (
        !cardState.pendingStoneSalvationGodRevivesByPlayer ||
        typeof cardState.pendingStoneSalvationGodRevivesByPlayer !== 'object'
    ) {
        cardState.pendingStoneSalvationGodRevivesByPlayer = { black: [], white: [] };
    }
    if (!Array.isArray(cardState.pendingStoneSalvationGodRevivesByPlayer.black)) {
        cardState.pendingStoneSalvationGodRevivesByPlayer.black = [];
    }
    if (!Array.isArray(cardState.pendingStoneSalvationGodRevivesByPlayer.white)) {
        cardState.pendingStoneSalvationGodRevivesByPlayer.white = [];
    }
    return cardState.pendingStoneSalvationGodRevivesByPlayer;
}

function _ensureStoneSalvationGodBlockQueue(cardState: any): any[] {
    _ensureCardState(cardState);
    if (!Array.isArray(cardState._stoneSalvationGodReviveBlockQueue)) {
        cardState._stoneSalvationGodReviveBlockQueue = [];
    }
    return cardState._stoneSalvationGodReviveBlockQueue;
}

function _isStoneSalvationGodMarkerAt(cardState: any, row: number, col: number, ownerKey: string): boolean {
    return _getSpecialMarkersAt(cardState, row, col).some((marker: any) => (
        marker &&
        marker.owner === ownerKey &&
        marker.data &&
        String(marker.data.type || '').toUpperCase() === 'STONE_SALVATION_GOD'
    ));
}

function _queueDestroyedStoneForStoneSalvationGod(cardState: any, row: number, col: number, destroyedOwnerKey: string, cause: string | null, reason: string | null, meta: any): any {
    const ownerKey = _resolveStoneSalvationGodRescuerOwner(cardState, destroyedOwnerKey);
    if (!ownerKey) return null;
    const source = _findStoneSalvationGodMarker(cardState, ownerKey);
    if (!source) return null;
    const entry = {
        row,
        col,
        owner: ownerKey,
        destroyedOwner: destroyedOwnerKey,
        cause: cause || null,
        reason: reason || null,
        meta: _clonePresentationMetaWithActionContext(cardState, meta),
        queuedTurnIndex: Number.isFinite(Number(cardState && cardState.turnIndex)) ? Number(cardState.turnIndex) : null
    };
    _ensureStoneSalvationGodBlockQueue(cardState).push(entry);
    return { queued: true, entry };
}

function _reviveDestroyedStoneByStoneSalvationGod(cardState: any, gameState: any, pendingEntry: any, ownerKey: string, meta: any): any {
    const source = _findStoneSalvationGodMarker(cardState, ownerKey);
    if (!source) return null;
    const allCandidates = _collectBoardShapeEmptyCells(cardState, gameState);
    const excludedCells = meta && meta.excludeReviveCells instanceof Set
        ? meta.excludeReviveCells
        : null;
    const candidates = excludedCells && excludedCells.size > 0
        ? allCandidates.filter((cell) => !excludedCells.has(`${cell.row},${cell.col}`))
        : allCandidates;
    const reviveCandidates = candidates.length ? candidates : allCandidates;
    if (!reviveCandidates.length) return { revived: false, reason: 'no_empty_cell' };
    const randomSource = _resolveBoardOpsRandomSource(cardState, meta);
    const destination = reviveCandidates[_resolveRandomIndex(randomSource, reviveCandidates.length)] || reviveCandidates[0] || null;
    if (!destination) return { revived: false, reason: 'no_empty_cell' };
    const reviveMeta = Object.assign(_clonePresentationMeta(pendingEntry && pendingEntry.meta), {
        owner: ownerKey,
        sourceSpecial: 'STONE_SALVATION_GOD',
        revivedFromRow: pendingEntry && Number.isInteger(pendingEntry.row) ? pendingEntry.row : null,
        revivedFromCol: pendingEntry && Number.isInteger(pendingEntry.col) ? pendingEntry.col : null,
        revivedOwner: ownerKey,
        destroyedOwner: pendingEntry && pendingEntry.destroyedOwner ? pendingEntry.destroyedOwner : ownerKey,
        sourceRow: source.row,
        sourceCol: source.col,
        delayedRevive: false,
        sameTurnRevive: true,
        destroyedCause: pendingEntry && pendingEntry.cause ? pendingEntry.cause : null,
        destroyedReason: pendingEntry && pendingEntry.reason ? pendingEntry.reason : null
    });
    const spawnResult = spawnAt(
        cardState,
        gameState,
        destination.row,
        destination.col,
        ownerKey as PlayerKey,
        'STONE_SALVATION_GOD',
        'stone_salvation_god_revive',
        reviveMeta
    );
    return {
        revived: !!(spawnResult && spawnResult.spawned),
        row: destination.row,
        col: destination.col,
        stoneId: spawnResult && spawnResult.stoneId,
        reason: spawnResult && spawnResult.spawned ? null : ((spawnResult && spawnResult.reason) || 'spawn_failed')
    };
}

function consumeStoneSalvationGodRevives(cardState: any, gameState: any, ownerKey: string, meta: any = {}): any {
    const pending = _ensurePendingStoneSalvationGodRevives(cardState);
    const ownerPending = Array.isArray(pending[ownerKey]) ? pending[ownerKey].slice() : [];
    pending[ownerKey] = [];
    const revived: any[] = [];
    const failed: any[] = [];
    if (!ownerPending.length) return { revived, failed, requestedCount: 0, revivedCount: 0 };
    if (!_findStoneSalvationGodMarker(cardState, ownerKey)) {
        return {
            revived,
            failed: ownerPending.map((entry: any) => Object.assign({}, entry, { reason: 'source_missing' })),
            requestedCount: ownerPending.length,
            revivedCount: 0
        };
    }
    for (const entry of ownerPending) {
        const result = _reviveDestroyedStoneByStoneSalvationGod(cardState, gameState, entry, ownerKey, meta);
        if (result && result.revived) {
            revived.push(Object.assign({}, entry, {
                row: result.row,
                col: result.col,
                stoneId: result.stoneId
            }));
        } else {
            failed.push(Object.assign({}, entry, { reason: (result && result.reason) || 'source_missing' }));
        }
    }
    return {
        revived,
        failed,
        requestedCount: ownerPending.length,
        revivedCount: revived.length
    };
}

function _flushStoneSalvationGodDestroyBlock(cardState: any, gameState: any, meta: any = {}): any {
    const queued = _ensureStoneSalvationGodBlockQueue(cardState).slice();
    cardState._stoneSalvationGodReviveBlockQueue.length = 0;
    const revived: any[] = [];
    const failed: any[] = [];
    if (!queued.length) return { revived, failed, requestedCount: 0, revivedCount: 0 };
    const excludeReviveCells = new Set();
    for (const entry of queued) {
        if (!entry) continue;
        if (Number.isInteger(entry.row) && Number.isInteger(entry.col)) {
            excludeReviveCells.add(`${entry.row},${entry.col}`);
        }
    }
    const reviveMeta = Object.assign({}, meta, { excludeReviveCells });

    for (const entry of queued) {
        const ownerKey = entry && entry.owner;
        if (ownerKey !== 'black' && ownerKey !== 'white') {
            failed.push(Object.assign({}, entry, { reason: 'invalid_owner' }));
            continue;
        }
        const result = _reviveDestroyedStoneByStoneSalvationGod(cardState, gameState, entry, ownerKey, reviveMeta);
        if (result && result.revived) {
            revived.push(Object.assign({}, entry, {
                row: result.row,
                col: result.col,
                stoneId: result.stoneId
            }));
        } else {
            failed.push(Object.assign({}, entry, { reason: (result && result.reason) || 'source_missing' }));
        }
    }

    return {
        revived,
        failed,
        requestedCount: queued.length,
        revivedCount: revived.length
    };
}

function _nextEffectBlockId(cardState: any, meta: any = {}): string {
    _ensureCardState(cardState);
    if (meta && meta.effectBlockId) return String(meta.effectBlockId);
    const current = Number.isFinite(Number(cardState._nextEffectBlockId))
        ? Math.max(0, Math.trunc(Number(cardState._nextEffectBlockId)))
        : 0;
    cardState._nextEffectBlockId = current + 1;
    const turnIndex = Number.isFinite(Number(cardState.turnIndex))
        ? Math.max(0, Math.trunc(Number(cardState.turnIndex)))
        : 0;
    const cause = String(meta && meta.cause ? meta.cause : 'effect').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    return `effect_${turnIndex}_${current}_${cause}`;
}

function runEffectBlock(cardState: any, gameState: any, options: any, fn: any): any {
    _ensureCardState(cardState);
    const meta = options && typeof options === 'object' ? options : {};
    const previousActionMeta = cardState._currentActionMeta;
    const hadPreviousActionMeta = cardState && Object.prototype.hasOwnProperty.call(cardState, '_currentActionMeta');
    const effectBlockId = _nextEffectBlockId(cardState, meta);
    const previousDepth = Number.isFinite(Number(cardState._stoneSalvationGodDestroyBlockDepth))
        ? Number(cardState._stoneSalvationGodDestroyBlockDepth)
        : 0;
    const previousEffectDepth = Number.isFinite(Number(cardState._effectBlockDepth))
        ? Number(cardState._effectBlockDepth)
        : 0;
    const rescueFlush = meta.rescueFlush !== false;
    const nextActionMeta = Object.assign({}, previousActionMeta || {}, meta, {
        effectBlockId,
        effectKind: meta.kind || meta.effectKind || null,
        actionId: meta.actionId || (previousActionMeta && previousActionMeta.actionId) || effectBlockId,
        turnIndex: typeof meta.turnIndex === 'number'
            ? meta.turnIndex
            : (previousActionMeta && typeof previousActionMeta.turnIndex === 'number'
                ? previousActionMeta.turnIndex
                : (cardState.turnIndex || 0)),
        plyIndex: typeof meta.plyIndex === 'number'
            ? meta.plyIndex
            : (previousActionMeta && typeof previousActionMeta.plyIndex === 'number'
                ? previousActionMeta.plyIndex
                : 0),
        randomSource: meta.randomSource || (previousActionMeta && previousActionMeta.randomSource) || null
    });
    cardState._currentActionMeta = nextActionMeta;
    cardState._effectBlockDepth = previousEffectDepth + 1;
    if (rescueFlush) {
        cardState._stoneSalvationGodDestroyBlockDepth = previousDepth + 1;
    }
    try {
        return (typeof fn === 'function') ? fn() : undefined;
    } finally {
        try {
            cardState._effectBlockDepth = previousEffectDepth;
            if (rescueFlush) {
                cardState._stoneSalvationGodDestroyBlockDepth = previousDepth;
                if (previousEffectDepth === 0) {
                    _flushStoneSalvationGodDestroyBlock(cardState, gameState, Object.assign({}, meta, { effectBlockId }));
                }
            }
        } finally {
            if (previousActionMeta && typeof previousActionMeta.plyIndex === 'number' && typeof nextActionMeta.plyIndex === 'number') {
                previousActionMeta.plyIndex = nextActionMeta.plyIndex;
            }
            if (hadPreviousActionMeta) cardState._currentActionMeta = previousActionMeta;
            else delete cardState._currentActionMeta;
        }
    }
}

function runDestroyBlock(cardState: any, gameState: any, fn: any, meta: any = {}): any {
    _ensureCardState(cardState);
    const currentActionMeta = cardState._currentActionMeta || null;
    const previousEffectDepth = Number.isFinite(Number(cardState._effectBlockDepth))
        ? Number(cardState._effectBlockDepth)
        : 0;
    const hasActiveEffectBlock = previousEffectDepth > 0 || !!(currentActionMeta && currentActionMeta.effectBlockId);
    if (!hasActiveEffectBlock) {
        return runEffectBlock(cardState, gameState, Object.assign({
            kind: 'destroy_block',
            effectKind: 'destroy_block'
        }, meta || {}), fn);
    }
    const previousDepth = Number.isFinite(Number(cardState._stoneSalvationGodDestroyBlockDepth))
        ? Number(cardState._stoneSalvationGodDestroyBlockDepth)
        : 0;
    cardState._stoneSalvationGodDestroyBlockDepth = previousDepth + 1;
    try {
        return (typeof fn === 'function') ? fn() : undefined;
    } finally {
        cardState._stoneSalvationGodDestroyBlockDepth = previousDepth;
        if (previousDepth === 0) {
            _flushStoneSalvationGodDestroyBlock(cardState, gameState, meta);
        }
    }
}

function runCellRemovalBlock(cardState: any, gameState: any, fn: any, meta: any = {}): any {
    _ensureCardState(cardState);
    const currentActionMeta = cardState._currentActionMeta || null;
    const previousEffectDepth = Number.isFinite(Number(cardState._effectBlockDepth))
        ? Number(cardState._effectBlockDepth)
        : 0;
    const hasActiveEffectBlock = previousEffectDepth > 0 || !!(currentActionMeta && currentActionMeta.effectBlockId);
    if (!hasActiveEffectBlock) {
        return runEffectBlock(cardState, gameState, Object.assign({
            kind: 'cell_removal',
            effectKind: 'cell_removal'
        }, meta || {}), fn);
    }
    return runDestroyBlock(cardState, gameState, fn, meta);
}

function applyHoleAt(cardState: any, gameState: any, row: number, col: number, ownerKey: string, meta: any = {}): any {
    _ensureCardState(cardState);
    const prev = getCellValue(gameState, row, col);
    if (prev === null) return { applied: false, reason: 'out_of_board', row, col };

    setStoneIdAt(cardState, gameState, row, col, null);
    setCellValue(gameState, row, col, EMPTY);

    const removeOptions = meta && meta.removeOptions ? meta.removeOptions : undefined;
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
        cardMarkers.removeMarkersAt(cardState, row, col, removeOptions);
    } else if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        MarkersAdapter.removeMarkersAt(cardState, row, col, removeOptions);
    } else if (Array.isArray(cardState.markers)) {
        cardState.markers = cardState.markers.filter((m: any) => !(m && m.row === row && m.col === col));
    }

    const data: any = { type: 'METEOR_HOLE' };
    if (meta && meta.visualVariant) data.visualVariant = meta.visualVariant;
    const statusMetaExtras: any = {};
    if (meta && meta.cellRemovalCause) statusMetaExtras.cellRemovalCause = meta.cellRemovalCause;
    if (meta && meta.cellRemovalReason) statusMetaExtras.cellRemovalReason = meta.cellRemovalReason;
    if (meta && meta.removalCause) statusMetaExtras.cellRemovalCause = meta.removalCause;
    if (meta && meta.removalReason) statusMetaExtras.cellRemovalReason = meta.removalReason;
    if (meta && meta.removalKind) statusMetaExtras.removalKind = meta.removalKind;
    if (meta && meta.removalPolicy) statusMetaExtras.removalPolicy = meta.removalPolicy;
    const patchEmittedHoleStatusMeta = (events: any[]) => {
        if (!Array.isArray(events)) return false;
        for (let index = events.length - 1; index >= 0; index -= 1) {
            const ev = events[index];
            if (!ev || ev.type !== 'STATUS_APPLIED' || ev.row !== row || ev.col !== col) continue;
            if (!ev.meta || ev.meta.special !== 'METEOR_HOLE') continue;
            ev.meta = Object.assign({}, ev.meta, statusMetaExtras);
            return true;
        }
        return false;
    };
    const liveBefore = Array.isArray(cardState.presentationEvents) ? cardState.presentationEvents.length : 0;
    const persistBefore = Array.isArray(cardState._presentationEventsPersist) ? cardState._presentationEventsPersist.length : 0;
    const marker = _addSpecialStoneMarker(cardState, row, col, ownerKey, data);
    const liveAfter = Array.isArray(cardState.presentationEvents) ? cardState.presentationEvents.length : 0;
    if (marker && liveAfter > liveBefore) {
        patchEmittedHoleStatusMeta(cardState.presentationEvents);
        patchEmittedHoleStatusMeta(cardState._presentationEventsPersist);
    } else if (marker) {
        if (Array.isArray(cardState._presentationEventsPersist) && cardState._presentationEventsPersist.length > persistBefore) {
            for (let index = cardState._presentationEventsPersist.length - 1; index >= persistBefore; index--) {
                const ev = cardState._presentationEventsPersist[index];
                if (ev && ev.type === 'STATUS_APPLIED' && ev.row === row && ev.col === col && ev.meta && ev.meta.special === 'METEOR_HOLE') {
                    cardState._presentationEventsPersist.splice(index, 1);
                    break;
                }
            }
        }
        const statusMeta: any = { special: 'METEOR_HOLE', timer: null, owner: ownerKey };
        if (meta && meta.visualVariant) statusMeta.visualVariant = meta.visualVariant;
        Object.assign(statusMeta, statusMetaExtras);
        emitPresentationEvent(cardState, { type: 'STATUS_APPLIED', row, col, meta: statusMeta });
    }
    return {
        applied: !!marker,
        row,
        col,
        owner: ownerKey,
        previousValue: prev,
        marker,
        reason: marker ? null : 'marker_failed'
    };
}

function _removeOccupiedCellForCellRemoval(
    cardState: any,
    gameState: any,
    row: number,
    col: number,
    prev: any,
    cause: string | null,
    reason: string | null,
    options: any
): any {
    const ownerBeforeKey = (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white';
    const stoneId = getStoneIdAt(cardState, gameState, row, col);
    const specialKindForSalvation = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
    const wasSpecialStoneForSalvation = !!(Array.isArray(cardState.markers) && cardState.markers.some(
        (m: any) => m && m.kind === specialKindForSalvation && m.row === row && m.col === col
    ));
    const wasStoneSalvationGod = _isStoneSalvationGodMarkerAt(cardState, row, col, ownerBeforeKey);
    const removalPolicy = String(
        (options && options.removalPolicy) ||
        (options && options.policy) ||
        'absolute_only'
    );
    const removalCause = String(
        (options && options.removalCause) ||
        (cause || '')
    );
    const removalKind = String(
        (options && options.removalKind) ||
        'meteor_hole'
    );
    const destroyMeta = _populateSpecialVisualMeta(cardState, row, col, _clonePresentationMeta(
        options && options.destroyMeta && typeof options.destroyMeta === 'object' ? options.destroyMeta : {}
    ));
    destroyMeta.cellRemoval = true;
    destroyMeta.removalPolicy = removalPolicy;
    destroyMeta.removalKind = removalKind;
    if (removalCause) destroyMeta.removalCause = removalCause;

    setStoneIdAt(cardState, gameState, row, col, null);
    setCellValue(gameState, row, col, EMPTY);
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
        cardMarkers.removeMarkersAt(cardState, row, col);
    } else if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        MarkersAdapter.removeMarkersAt(cardState, row, col);
    } else if (Array.isArray(cardState.markers)) {
        cardState.markers = cardState.markers.filter((m: any) => !(m && m.row === row && m.col === col));
    }

    emitPresentationEvent(cardState, {
        type: 'DESTROY',
        stoneId,
        row,
        col,
        ownerBefore: ownerBeforeKey,
        cause: cause || null,
        reason: reason || null,
        meta: destroyMeta
    });

    _recordCellRemovalForSalvationFallback(cardState, {
        from: { row, col },
        owner: ownerBeforeKey,
        salvationFallback: {
            wasSpecial: wasSpecialStoneForSalvation
        }
    });

    const stoneSalvationGodReviveQueued = wasStoneSalvationGod
        ? null
        : _queueDestroyedStoneForStoneSalvationGod(cardState, row, col, ownerBeforeKey, cause, reason, destroyMeta);
    return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED, Object.assign({
        reason: 'cell_removed',
        cellRemoval: true,
        removalPolicy,
        removalKind
    }, stoneSalvationGodReviveQueued && stoneSalvationGodReviveQueued.queued ? {
        stoneSalvationGodReviveQueued: true
    } : {}));
}

function _recordCellRemovalForSalvationFallback(cardState: any, pending: any): void {
    if (!pending || !pending.from) return;
    const activeTurnPlayer = cardState._activeTurnPlayer;
    const beneficiaryPlayer = activeTurnPlayer === 'black'
        ? 'white'
        : (activeTurnPlayer === 'white' ? 'black' : null);
    if (!beneficiaryPlayer) return;
    if (!cardState.prevOpponentTurnDestroyedStonesByPlayer) {
        cardState.prevOpponentTurnDestroyedStonesByPlayer = { black: [], white: [] };
    }
    if (!Array.isArray(cardState.prevOpponentTurnDestroyedStonesByPlayer[beneficiaryPlayer])) {
        cardState.prevOpponentTurnDestroyedStonesByPlayer[beneficiaryPlayer] = [];
    }
    cardState.prevOpponentTurnDestroyedStonesByPlayer[beneficiaryPlayer].push({
        row: pending.from.row,
        col: pending.from.col,
        owner: pending.owner,
        wasSpecial: !!(pending.salvationFallback && pending.salvationFallback.wasSpecial)
    });
}

function applyCellRemovalAt(
    cardState: any,
    gameState: any,
    row: number,
    col: number,
    ownerKey: string,
    cause: string | null,
    reason: string | null,
    options: any = {}
): any {
    _ensureCardState(cardState);
    const pos = _normalizeCellPosition(row, col);
    if (!pos) return { applied: false, reason: 'out_of_board', row, col };
    row = pos.row;
    col = pos.col;

    const prev = getCellValue(gameState, row, col);
    if (prev === null) return { applied: false, reason: 'out_of_board', row, col };
    if (!(options && options.ignoreAbsoluteProtection === true) && _isAbsoluteProtectedCell(cardState, row, col)) {
        return { applied: false, reason: 'absolute_protected', row, col, destroyed: false };
    }

    let destroyed = false;
    let destroyResult: any = null;
    if (prev !== EMPTY) {
        destroyResult = _removeOccupiedCellForCellRemoval(cardState, gameState, row, col, prev, cause, reason, options);
        destroyed = true;
    }

    const holeMeta = Object.assign({}, (options && options.holeMeta && typeof options.holeMeta === 'object') ? options.holeMeta : {});
    if (cause && holeMeta.cellRemovalCause === undefined) holeMeta.cellRemovalCause = cause;
    if (reason && holeMeta.cellRemovalReason === undefined) holeMeta.cellRemovalReason = reason;
    if (options && options.removalCause && holeMeta.removalCause === undefined) holeMeta.removalCause = options.removalCause;
    if (options && options.removalKind && holeMeta.removalKind === undefined) holeMeta.removalKind = options.removalKind;
    if (options && (options.removalPolicy || options.policy) && holeMeta.removalPolicy === undefined) {
        holeMeta.removalPolicy = options.removalPolicy || options.policy;
    }
    const holeResult = applyHoleAt(cardState, gameState, row, col, ownerKey, holeMeta);
    if (!holeResult || !holeResult.applied) {
        return {
            applied: false,
            reason: (holeResult && holeResult.reason) || 'hole_failed',
            row,
            col,
            destroyed,
            destroyResult
        };
    }
    return { applied: true, row, col, destroyed, destroyResult, holeResult };
}

function _addSpecialStoneMarker(cardState: any, row: number, col: number, owner: string, data: any): any {
    _ensureCardState(cardState);
    const markerKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.addMarker === 'function') {
        return cardMarkers.addMarker(cardState, markerKind, row, col, owner, data);
    }
    if (MarkersAdapter && typeof MarkersAdapter.addMarker === 'function') {
        return MarkersAdapter.addMarker(cardState, markerKind, row, col, owner, data);
    }
    const id = cardState._nextMarkerId || 1;
    cardState._nextMarkerId = id + 1;
    if (typeof cardState._nextCreatedSeq === 'undefined') cardState._nextCreatedSeq = 1;
    const createdSeq = cardState._nextCreatedSeq++;
    const marker = {
        id,
        row,
        col,
        kind: markerKind,
        owner,
        createdSeq,
        data: Object.assign({}, data)
    };
    cardState.markers.push(marker);
    return marker;
}

function _pruneAfterimageMarkerIfDepleted(cardState: any, marker: any): void {
    if (!cardState || !Array.isArray(cardState.markers) || !marker || !marker.data) return;
    if (!(EvasionStatus && typeof EvasionStatus.shouldPruneEvasionMarker === 'function')) return;
    if (!EvasionStatus.shouldPruneEvasionMarker(marker)) return;
    cardState.markers = cardState.markers.filter((entry: any) => entry !== marker);
}

function _consumeAfterimageMarkerOnNormalChange(cardState: any, row: number, col: number): any {
    if (!cardState || !Array.isArray(cardState.markers)) return null;
    const marker = cardState.markers.find((entry: any) => (
        entry &&
        entry.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
        entry.row === row &&
        entry.col === col &&
        entry.data &&
        String(entry.data.type || '').toUpperCase() === 'AFTERIMAGE_WILL'
    ));
    if (!marker || !marker.data) return null;
    const flipRemaining = _normalizeCounterValue(marker.data && marker.data.flipEvadeRemaining) || 0;
    if (flipRemaining > 0) return null;
    cardState.markers = cardState.markers.filter((entry: any) => entry !== marker);
    return marker;
}

function _collectAllBoardCoordinates(gameState: any): Array<{ row: number; col: number }> {
    const coords: Array<{ row: number; col: number }> = [];
    const dims = resolveBoardDims(gameState, null);
    for (let row = 0; row < dims.rows; row++) {
        for (let col = 0; col < dims.cols; col++) {
            coords.push({ row, col });
        }
    }
    const expansions = getExpansionDescriptors(gameState);
    for (const expansion of expansions) {
        if (!expansion) continue;
        coords.push({ row: expansion.row, col: expansion.col });
    }
    return coords;
}

function _getChebyshevDistance(fromRow: number, fromCol: number, toRow: number, toCol: number): number {
    return Math.max(Math.abs(Number(fromRow) - Number(toRow)), Math.abs(Number(fromCol) - Number(toCol)));
}

function _getManhattanDistance(fromRow: number, fromCol: number, toRow: number, toCol: number): number {
    return Math.abs(Number(fromRow) - Number(toRow)) + Math.abs(Number(fromCol) - Number(toCol));
}

function _getForbiddenDestroyEvadeCellSet(meta: any): Set<string> {
    const out = new Set<string>();
    const cells = meta && Array.isArray(meta.forbiddenEvadeCells) ? meta.forbiddenEvadeCells : [];
    for (const cell of cells) {
        if (!cell) continue;
        const pos = _normalizeCellPosition(cell.row, cell.col);
        if (!pos) continue;
        out.add(`${pos.row},${pos.col}`);
    }
    return out;
}

function _findDestroyEvadeDestination(cardState: any, gameState: any, row: number, col: number, meta: any): { row: number; col: number } | null {
    const forbiddenCells = _getForbiddenDestroyEvadeCellSet(meta);
    const candidates: Array<{ row: number; col: number; chebyshev: number; manhattan: number }> = [];
    for (const cell of _collectAllBoardCoordinates(gameState)) {
        if (!cell) continue;
        if (cell.row === row && cell.col === col) continue;
        if (forbiddenCells.has(`${cell.row},${cell.col}`)) continue;
        const value = getCellValue(gameState, cell.row, cell.col);
        if (value !== EMPTY) continue;
        if (_isBlockedDestinationCell(cardState, cell.row, cell.col)) continue;
        candidates.push({
            row: cell.row,
            col: cell.col,
            chebyshev: _getChebyshevDistance(row, col, cell.row, cell.col),
            manhattan: _getManhattanDistance(row, col, cell.row, cell.col)
        });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
        if (a.chebyshev !== b.chebyshev) return a.chebyshev - b.chebyshev;
        if (a.manhattan !== b.manhattan) return a.manhattan - b.manhattan;
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
    });
    return { row: candidates[0].row, col: candidates[0].col };
}

function _moveCellMarkers(cardState: any, fromRow: number, fromCol: number, toRow: number, toCol: number): void {
    if (!cardState || !Array.isArray(cardState.markers)) return;
    for (const marker of cardState.markers) {
        if (!marker || marker.row !== fromRow || marker.col !== fromCol) continue;
        if (_isBlockingMarkerType(marker && marker.data && marker.data.type)) continue;
        marker.row = toRow;
        marker.col = toCol;
    }
}

function _shouldSkipDestroyEvade(cause: string | null, reason: string | null, meta: any): boolean {
    if (meta && (meta.ignoreDestroyEvade === true || meta.evade === true)) return true;
    const normalizedReason = String(reason || '').toLowerCase();
    return normalizedReason === 'anchor_expired'
        || normalizedReason === 'duration_end'
        || normalizedReason.indexOf('expire') >= 0;
}

function _resolveSpecialDisplayTimerValue(markerData: any): number | null {
    if (StoneStatusSnapshot && typeof StoneStatusSnapshot.resolveDisplayTimerValue === 'function') {
        return StoneStatusSnapshot.resolveDisplayTimerValue({
            type: markerData && markerData.type,
            remainingOwnerTurns: markerData && markerData.remainingOwnerTurns,
            regenRemaining: markerData && markerData.regenRemaining
        });
    }
    const primaryTimer = _normalizeCounterValue(markerData && markerData.remainingOwnerTurns);
    if (primaryTimer !== null) return primaryTimer;
    if (String(markerData && markerData.type ? markerData.type : '').toUpperCase() === 'REGEN') {
        return _normalizeCounterValue(markerData && markerData.regenRemaining);
    }
    return null;
}

function _getSpecialVisualMeta(cardState: any, row: number, col: number): any {
    if (cardState && Array.isArray(cardState.markers)) {
        const markersAtCell = _getSpecialMarkersAt(cardState, row, col);
        const cardMarkers = getCardMarkersModule();
        const b = cardMarkers && typeof cardMarkers.findBombMarkerAt === 'function'
            ? cardMarkers.findBombMarkerAt(cardState, row, col)
            : (MarkersAdapter && typeof MarkersAdapter.findBombMarkerAt === 'function'
                ? MarkersAdapter.findBombMarkerAt(cardState, row, col)
                : cardState.markers.find((m: any) => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && m.data && m.data.category === 'bomb' && m.row === row && m.col === col))
            ;
        if (StoneStatusSnapshot && typeof StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers === 'function') {
            return StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers(markersAtCell, {
                bombMarker: b,
                mode: 'raw'
            });
        }

        let flipEvadeRemaining: number | null = null;
        let destroyEvadeRemaining: number | null = null;
        const destroyEvadeTotal = markersAtCell.reduce((sum: number, marker: any) => {
            const remaining = EvasionStatus && typeof EvasionStatus.readDestroyEvadeRemaining === 'function'
                ? EvasionStatus.readDestroyEvadeRemaining(marker)
                : _normalizeCounterValue(marker && marker.data && marker.data.destroyEvadeRemaining);
            return remaining === null ? sum : (sum + remaining);
        }, 0);
        if (destroyEvadeTotal > 0 || markersAtCell.some((marker: any) => _normalizeCounterValue(marker && marker.data && marker.data.destroyEvadeRemaining) === 0)) {
            destroyEvadeRemaining = destroyEvadeTotal;
        }

        const visualSpecial = markersAtCell.find((m: any) => {
            const typeUpper = String(m && m.data && m.data.type ? m.data.type : '').toUpperCase();
            if (!typeUpper) return false;
            return !isOverlayOnlySpecialStoneType(typeUpper);
        });
        if (visualSpecial) {
            flipEvadeRemaining = _normalizeCounterValue(visualSpecial.data && visualSpecial.data.flipEvadeRemaining);
            return {
                special: (visualSpecial.data && visualSpecial.data.type) || null,
                timer: _resolveSpecialDisplayTimerValue(visualSpecial.data),
                owner: (visualSpecial.owner !== undefined && visualSpecial.owner !== null) ? visualSpecial.owner : null,
                flipEvadeRemaining,
                destroyEvadeRemaining
            };
        }

        if (b) {
            return {
                special: 'TIME_BOMB',
                timer: (b.data && typeof b.data.remainingTurns === 'number') ? b.data.remainingTurns : null,
                owner: (b.owner !== undefined && b.owner !== null) ? b.owner : null,
                flipEvadeRemaining,
                destroyEvadeRemaining
            };
        }
    }

    return {
        special: null,
        timer: null,
        owner: null,
        flipEvadeRemaining: null,
        destroyEvadeRemaining: null
    };
}

function _getGhostMarkerAt(cardState: any, row: number, col: number): any {
    const markersAtCell = _getSpecialMarkersAt(cardState, row, col);
    return markersAtCell.find((marker: any) => String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() === 'GHOST') || null;
}

function _shouldBlockGhostChange(cause: string | null, reason: string | null): boolean {
    const causeUpper = String(cause || '').toUpperCase();
    const reasonLower = String(reason || '').toLowerCase();
    if (reasonLower === 'tempt_applied') return false;
    if (causeUpper === 'SWAP') return true;
    if (reasonLower === 'regen_triggered') return true;
    if (reasonLower.includes('flip')) return true;
    if (reasonLower.includes('convert')) return true;
    return false;
}

function _shouldBlockGhostDestroy(reason: string | null, meta: any): boolean {
    const reasonLower = String(reason || '').toLowerCase();
    if (meta && meta.allowGhostDestroy === true) return false;
    if (reasonLower === 'meteor_cell_destroy') return false;
    return true;
}

function _populateSpecialVisualMeta(cardState: any, row: number, col: number, meta: any): any {
    const metaOut = _clonePresentationMeta(meta);
    if (metaOut.special !== undefined && metaOut.special !== null) return metaOut;
    const visual = _getSpecialVisualMeta(cardState, row, col);
    if (visual.special !== null) metaOut.special = visual.special;
    if (visual.timer !== null) metaOut.timer = visual.timer;
    if (visual.owner !== null) metaOut.owner = visual.owner;
    if (visual.flipEvadeRemaining !== null) metaOut.flipEvadeRemaining = visual.flipEvadeRemaining;
    if (visual.destroyEvadeRemaining !== null) metaOut.destroyEvadeRemaining = visual.destroyEvadeRemaining;
    return metaOut;
}

function emitPresentationEvent(cardState: any, ev: any): void {
    _ensureCardState(cardState);
    const metaSource = cardState._currentActionMeta || {};
    const eventMeta = ev && ev.meta && typeof ev.meta === 'object' ? ev.meta : null;
    const metaActionId = eventMeta && eventMeta.actionId !== undefined && eventMeta.actionId !== null ? eventMeta.actionId : null;
    const metaEffectBlockId = eventMeta && eventMeta.effectBlockId !== undefined && eventMeta.effectBlockId !== null ? eventMeta.effectBlockId : null;
    const actionId = (ev.actionId !== undefined && ev.actionId !== null) ? ev.actionId : (metaActionId || metaSource.actionId || null);
    const effectBlockId = (ev.effectBlockId !== undefined && ev.effectBlockId !== null) ? ev.effectBlockId : (metaEffectBlockId || metaSource.effectBlockId || null);
    const turnIndex = (ev.turnIndex !== undefined && ev.turnIndex !== null) ? ev.turnIndex : (typeof metaSource.turnIndex === 'number' ? metaSource.turnIndex : (cardState.turnIndex || 0));
    const plyIndex = (ev.plyIndex !== undefined && ev.plyIndex !== null) ? ev.plyIndex : (typeof metaSource.plyIndex === 'number' ? metaSource.plyIndex : null);

    const outMeta = (ev.meta && typeof ev.meta === 'object') ? Object.assign({}, ev.meta) : ev.meta;
    if (effectBlockId && outMeta && typeof outMeta === 'object' && outMeta.effectBlockId === undefined) {
        outMeta.effectBlockId = effectBlockId;
    }
    if (metaSource.effectKind && outMeta && typeof outMeta === 'object' && outMeta.effectKind === undefined) {
        outMeta.effectKind = metaSource.effectKind;
    }
    const out = Object.assign({}, ev, { meta: outMeta, actionId, effectBlockId, turnIndex, plyIndex });
    cardState.presentationEvents.push(out);
    if (!cardState._presentationEventsPersist) cardState._presentationEventsPersist = [];
    cardState._presentationEventsPersist.push(out);
    if (isBoardOpsDebugEnabled(cardState)) {
        try { if (typeof console !== 'undefined' && console.log) console.log('[BOARDOPS] emitPresentationEvent pushed, persist len', cardState._presentationEventsPersist.length); } catch (e) { /* Intentionally empty: debug logging guard */ }
    }

    if (metaSource && typeof metaSource.plyIndex === 'number') {
        metaSource.plyIndex = metaSource.plyIndex + 1;
    }
}

function _findSpecialMarkerAt(cardState: any, row: number, col: number, type: string): any {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.findSpecialMarkerAt === 'function') {
        return cardMarkers.findSpecialMarkerAt(cardState, row, col, type) || null;
    }
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.find((marker: any) => (
        marker &&
        marker.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === type
    )) || null;
}

function _removeSpecialMarkersAt(cardState: any, row: number, col: number, options?: any): void {
    const cardMarkers = getCardMarkersModule();
    if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
        cardMarkers.removeMarkersAt(cardState, row, col, options);
        return;
    }
    if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        MarkersAdapter.removeMarkersAt(cardState, row, col, options);
        return;
    }
    if (!cardState || !Array.isArray(cardState.markers)) return;
    const opts = options || {};
    cardState.markers = cardState.markers.filter((marker: any) => {
        if (!marker || marker.row !== row || marker.col !== col) return true;
        if (opts.kind && marker.kind !== opts.kind) return true;
        if (opts.type && (!marker.data || marker.data.type !== opts.type)) return true;
        if (opts.owner && marker.owner !== opts.owner) return true;
        return false;
    });
}

function _invalidateSeedMarkerAt(cardState: any, row: number, col: number, cause: string | null, reason: string | null): boolean {
    const seedMarker = _findSpecialMarkerAt(cardState, row, col, 'SEED');
    if (!seedMarker) return false;
    emitPresentationEvent(cardState, {
        type: 'STATUS_REMOVED',
        row,
        col,
        cause: cause || null,
        reason: 'seed_invalidated',
        meta: {
            special: 'SEED',
            owner: seedMarker.owner || null,
            reason: 'seed_invalidated',
            invalidatedByCause: cause || null,
            invalidatedByReason: reason || null
        }
    });
    _removeSpecialMarkersAt(cardState, row, col, {
        kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone',
        type: 'SEED'
    });
    return true;
}

function spawnAt(cardState: any, gameState: any, row: number, col: number, ownerKey: PlayerKey, cause: string | null, reason: string | null, meta: any = {}): any {
    _ensureCardState(cardState);
    const pos = _normalizeCellPosition(row, col);
    if (!pos) return { spawned: false, reason: 'out_of_board' };
    row = pos.row;
    col = pos.col;
    if (_isBlockedDestinationCell(cardState, row, col)) return { spawned: false, reason: 'blocked_destination' };
    _invalidateSeedMarkerAt(cardState, row, col, cause, reason);
    const ownerVal = ownerKey === 'black' ? (SharedConstants.BLACK || 1) : (SharedConstants.WHITE || -1);
    if (!setCellValue(gameState, row, col, ownerVal)) return { spawned: false };
    const stoneId = allocateStoneId(cardState);

    setStoneIdAt(cardState, gameState, row, col, stoneId);

    const metaOut = _clonePresentationMeta(meta);
    if (metaOut.spawnIntent === undefined || metaOut.spawnIntent === null) {
        const inferredIntent = _inferSpawnIntent(cause, reason);
        if (inferredIntent) metaOut.spawnIntent = inferredIntent;
    }
    if (metaOut.special === undefined || metaOut.special === null) {
        const visual = _getSpecialVisualMeta(cardState, row, col);
        if (visual.special !== null) metaOut.special = visual.special;
        if (visual.timer !== null) metaOut.timer = visual.timer;
        if (visual.owner !== null) metaOut.owner = visual.owner;
        if (visual.flipEvadeRemaining !== null) metaOut.flipEvadeRemaining = visual.flipEvadeRemaining;
        if (visual.destroyEvadeRemaining !== null) metaOut.destroyEvadeRemaining = visual.destroyEvadeRemaining;
    }
    emitPresentationEvent(cardState, {
        type: 'SPAWN',
        stoneId,
        row,
        col,
        ownerAfter: ownerKey,
        cause: cause || null,
        reason: reason || null,
        meta: metaOut
    });
    return { spawned: true, stoneId };
}

function _inferSpawnIntent(cause: string | null, reason: string | null): string | null {
    if (PresentationEffectProfiles && typeof PresentationEffectProfiles.inferSpawnIntent === 'function') {
        return PresentationEffectProfiles.inferSpawnIntent(cause, reason);
    }
    const causeUpper = String(cause || '').toUpperCase();
    const reasonLower = String(reason || '').toLowerCase();
    if (causeUpper === 'CLONE_WILL') return 'clone_spawn';
    if (causeUpper === 'BREEDING') return 'breeding_spawn';
    if (causeUpper === 'PROLIFERATION_WILL') return 'proliferation_spawn';
    if (causeUpper === 'SALVATION_WILL') return 'salvation_spawn';
    if (causeUpper === 'STONE_SALVATION_GOD') return 'salvation_spawn';
    if (causeUpper === 'LIVING_WILL') return 'restore_spawn';
    if (causeUpper === 'EQUALITY_WILL' || causeUpper === 'REINFORCEMENT_WILL' || reasonLower.indexOf('_spawn') >= 0) {
        return 'normal_spawn';
    }
    return null;
}

function runSpawnBlock(cardState: any, gameState: any, fn: any, meta: any = {}): any {
    _ensureCardState(cardState);
    const currentActionMeta = cardState._currentActionMeta || null;
    const previousEffectDepth = Number.isFinite(Number(cardState._effectBlockDepth))
        ? Number(cardState._effectBlockDepth)
        : 0;
    const hasActiveEffectBlock = previousEffectDepth > 0 || !!(currentActionMeta && currentActionMeta.effectBlockId);
    if (!hasActiveEffectBlock) {
        return runEffectBlock(cardState, gameState, Object.assign({}, meta || {}, {
            kind: 'spawn_block',
            effectKind: 'spawn_block',
            rescueFlush: false
        }), () => runSpawnBlock(cardState, gameState, fn, meta));
    }
    const previousDepth = Number.isFinite(Number(cardState._spawnBlockDepth))
        ? Number(cardState._spawnBlockDepth)
        : 0;
    cardState._spawnBlockDepth = previousDepth + 1;
    const previousMeta = cardState._spawnBlockMeta;
    cardState._spawnBlockMeta = Object.assign({}, previousMeta || {}, meta || {});
    try {
        return (typeof fn === 'function') ? fn() : undefined;
    } finally {
        cardState._spawnBlockDepth = previousDepth;
        if (previousMeta === undefined) delete cardState._spawnBlockMeta;
        else cardState._spawnBlockMeta = previousMeta;
    }
}

function spawnMany(cardState: any, gameState: any, targets: any[], ownerKey: PlayerKey, cause: string | null, reason: string | null, options: any = {}): any {
    _ensureCardState(cardState);
    const list = Array.isArray(targets) ? targets.filter((target) => (
        target && Number.isInteger(target.row) && Number.isInteger(target.col)
    )) : [];
    const requestedCount = Number.isFinite(Number(options && options.requestedCount))
        ? Math.max(0, Math.trunc(Number(options.requestedCount)))
        : list.length;
    const metaFactory = options && typeof options.metaFactory === 'function'
        ? options.metaFactory
        : ((spawnIndex: number, target: any) => Object.assign({}, options && options.meta ? options.meta : {}, {
            owner: ownerKey,
            requestedCount,
            spawnIndex
        }));
    const spawned: any[] = [];
    const failed: any[] = [];
    const result = runSpawnBlock(cardState, gameState, () => {
        for (const target of list) {
            const spawnIndex = spawned.length + 1;
            const spawnMeta = metaFactory(spawnIndex, target) || {};
            const spawnResult = spawnAt(
                cardState,
                gameState,
                target.row,
                target.col,
                ownerKey,
                cause,
                reason,
                spawnMeta
            );
            if (spawnResult && spawnResult.spawned) {
                spawned.push({
                    row: target.row,
                    col: target.col,
                    stoneId: spawnResult.stoneId || null
                });
            } else {
                failed.push({
                    row: target.row,
                    col: target.col,
                    reason: (spawnResult && spawnResult.reason) || 'spawn_failed'
                });
                if (options && options.stopOnFailure === true) break;
            }
        }
        return { spawned, failed };
    }, options && options.blockMeta ? options.blockMeta : {});
    return {
        applied: true,
        requestedCount,
        spawnedCount: spawned.length,
        spawned,
        failedCount: failed.length,
        failed,
        result
    };
}

function _inferMoveIntent(cause: string | null, reason: string | null): string | null {
    const causeUpper = String(cause || '').toUpperCase();
    const reasonLower = String(reason || '').toLowerCase();
    if (causeUpper === 'STRONG_WIND_WILL' || reasonLower.indexOf('strong_wind_move') === 0) return 'wind_move';
    if (causeUpper === 'TELEPORT_WILL' || causeUpper === 'CELL_TELEPORT_WILL' || reasonLower.indexOf('teleport_move') === 0) return 'teleport_move';
    if (causeUpper === 'BUOYANCY_WILL' || causeUpper === 'SUPER_BUOYANCY_WILL' || causeUpper === 'GRAVITY_WILL' || causeUpper === 'SUPER_GRAVITY_WILL' || causeUpper === 'SUPER_ATTRACTION_WILL' || reasonLower.indexOf('buoyancy_move') === 0 || reasonLower.indexOf('super_buoyancy_move') === 0 || reasonLower.indexOf('gravity_move') === 0 || reasonLower.indexOf('super_gravity_move') === 0 || reasonLower.indexOf('super_attraction_move') === 0) return 'crush_move';
    if (causeUpper === 'POSITION_SWAP_WILL' || reasonLower.indexOf('position_swap') === 0 || reasonLower.indexOf('extreme_hyperactive_forced_swap') === 0) return 'position_swap';
    if (causeUpper === 'DESTROY_EVADE' || reasonLower.indexOf('destroy_evade_move') === 0 || reasonLower.indexOf('flip_evade_move') >= 0) return 'evade_move';
    if (causeUpper === 'ULTIMATE_REVERSE_DRAGON' || causeUpper === 'ULTIMATE_DESTROY_GOD' || causeUpper === 'WILL_HUNTER_KING' || reasonLower.indexOf('ultimate_reverse_dragon_move') === 0 || reasonLower.indexOf('ultimate_destroy_god_move') === 0 || reasonLower.indexOf('will_hunter_king_slash_move') === 0) return 'anchor_move';
    if (
        causeUpper === 'HYPERACTIVE' ||
        causeUpper === 'AFTERIMAGE_WILL' ||
        causeUpper === 'ESCAPE_HYPERACTIVE' ||
        causeUpper === 'EXTREME_HYPERACTIVE_WILL' ||
        causeUpper === 'ROBOT_VACUUM' ||
        causeUpper === 'ROBOT_VACUUM_WILL' ||
        causeUpper === 'GLUTTONOUS_WILL' ||
        causeUpper === 'ULTIMATE_HYPERACTIVE' ||
        causeUpper === 'ULTIMATE_HYPERACTIVE_GOD' ||
        reasonLower.indexOf('hyperactive') >= 0 ||
        reasonLower.indexOf('gluttonous') >= 0 ||
        reasonLower.indexOf('robot_vacuum_move') === 0
    ) return 'hyperactive_move';
    return null;
}

function _destroyAtCore(cardState: any, gameState: any, row: number, col: number, cause: string | null, reason: string | null, meta: any = {}): any {
    _ensureCardState(cardState);
    const pos = _normalizeCellPosition(row, col);
    if (!pos) return { destroyed: false, reason: 'out_of_board' };
    row = pos.row;
    col = pos.col;
    const prev = getCellValue(gameState, row, col);
    if (prev === EMPTY) return { destroyed: false };
    if (prev === null) return { destroyed: false, reason: 'out_of_board' };
    if (_isAbsoluteProtectedCell(cardState, row, col)) return { destroyed: false, reason: 'absolute_protected' };
    const ignoreGuard = !!(meta && meta.ignoreGuard === true);
    const ignoreRegen = !!(meta && meta.ignoreRegen === true);
    const cardMarkers = getCardMarkersModule();

    const guardMarker = cardMarkers && typeof cardMarkers.findSpecialMarkerAt === 'function'
        ? cardMarkers.findSpecialMarkerAt(cardState, row, col, 'GUARD')
        : (Array.isArray(cardState.markers)
            ? cardState.markers.find((m: any) => (
                m &&
                m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') &&
                m.row === row &&
                m.col === col &&
                m.data &&
                m.data.type === 'GUARD'
            ))
            : null)
        ;
    if (guardMarker && !ignoreGuard) return { destroyed: false, reason: 'guard_protected' };
    if (_isFrozenCell(cardState, row, col)) return { destroyed: false, reason: 'frozen_protected' };
    const ghostMarker = _getGhostMarkerAt(cardState, row, col);
    if (ghostMarker && _shouldBlockGhostDestroy(reason, meta)) {
        const stoneId = getStoneIdAt(cardState, gameState, row, col);
        const metaOut = _populateSpecialVisualMeta(cardState, row, col, _clonePresentationMeta(meta));
        metaOut.blockedByGhost = true;
        emitPresentationEvent(cardState, {
            type: 'DESTROY',
            stoneId,
            row,
            col,
            ownerBefore: (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white',
            cause: cause || null,
            reason: reason || null,
            meta: metaOut
        });
        return createDestroyOutcome(DESTROY_OUTCOME_KINDS.GHOST_BLOCKED, {
            reason: 'ghost_protected'
        });
    }

    const destroyEvadeMarker = _shouldSkipDestroyEvade(cause, reason, meta)
        ? null
        : _getDestroyEvadeMarkerAt(cardState, row, col);
    if (destroyEvadeMarker) {
        const destination = _findDestroyEvadeDestination(cardState, gameState, row, col, meta);
        if (destination) {
            const beforeRawDestroyRemaining = destroyEvadeMarker.data && destroyEvadeMarker.data.destroyEvadeRemaining;
            const beforeRemaining = EvasionStatus && typeof EvasionStatus.readDestroyEvadeRemaining === 'function'
                ? (EvasionStatus.readDestroyEvadeRemaining(destroyEvadeMarker) || 0)
                : (_normalizeCounterValue(destroyEvadeMarker.data && destroyEvadeMarker.data.destroyEvadeRemaining) || 0);
            const afterRemaining = EvasionStatus && typeof EvasionStatus.consumeDestroyEvade === 'function'
                ? EvasionStatus.consumeDestroyEvade(destroyEvadeMarker)
                : Math.max(0, beforeRemaining - 1);
            if (!(EvasionStatus && typeof EvasionStatus.consumeDestroyEvade === 'function')) {
                destroyEvadeMarker.data.destroyEvadeRemaining = afterRemaining;
            }
            const afterimageWillDepleted = !!(
                EvasionStatus &&
                typeof EvasionStatus.shouldPruneEvasionMarker === 'function' &&
                EvasionStatus.shouldPruneEvasionMarker(destroyEvadeMarker)
            );
            const visual = _getSpecialVisualMeta(cardState, row, col);
            const moveMeta = Object.assign({}, meta, {
                special: afterimageWillDepleted
                    ? null
                    : (visual.special !== null ? visual.special : ((destroyEvadeMarker.data && destroyEvadeMarker.data.type) || null)),
                timer: afterimageWillDepleted ? null : (visual.timer !== null ? visual.timer : null),
                owner: afterimageWillDepleted
                    ? null
                    : (visual.owner !== null ? visual.owner : ((destroyEvadeMarker.owner !== undefined && destroyEvadeMarker.owner !== null) ? destroyEvadeMarker.owner : null)),
                flipEvadeRemaining: afterimageWillDepleted
                    ? null
                    : (visual.flipEvadeRemaining !== null ? visual.flipEvadeRemaining : null),
                destroyEvadeRemaining: afterimageWillDepleted ? null : afterRemaining,
                destroyEvadeTriggeredBy: cause || null,
                destroyEvadeTriggerReason: reason || null,
                destroyEvadeOriginRow: row,
                destroyEvadeOriginCol: col
            });
            const moveResult = moveAt(
                cardState,
                gameState,
                row,
                col,
                destination.row,
                destination.col,
                'DESTROY_EVADE',
                'destroy_evade_move',
                moveMeta
            );
            if (moveResult && moveResult.moved) {
                _moveCellMarkers(cardState, row, col, destination.row, destination.col);
                _pruneAfterimageMarkerIfDepleted(cardState, destroyEvadeMarker);
                return createDestroyOutcome(DESTROY_OUTCOME_KINDS.EVADED_MOVE, {
                    reason: 'destroy_evaded',
                    from: { row, col },
                    to: { row: destination.row, col: destination.col }
                });
            }
            destroyEvadeMarker.data.destroyEvadeRemaining = beforeRawDestroyRemaining;
        }
    }

    const proliferationMarker = _getProliferationMarkerAt(cardState, row, col);
    if (proliferationMarker) {
        const destination = _findProliferationDestination(cardState, gameState, row, col, meta);
        if (destination) {
            const ownerBeforeKey = (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white';
            const proliferationOwnerTurns = _getProliferationOwnerTurns();
            const stoneId = getStoneIdAt(cardState, gameState, row, col);
            const destroyMeta = _populateSpecialVisualMeta(cardState, row, col, _clonePresentationMeta(meta));
            destroyMeta.proliferated = true;
            destroyMeta.proliferationOriginRow = row;
            destroyMeta.proliferationOriginCol = col;
            destroyMeta.proliferationDestinationRow = destination.row;
            destroyMeta.proliferationDestinationCol = destination.col;
            destroyMeta.proliferationTriggeredBy = cause || null;
            destroyMeta.proliferationTriggerReason = reason || null;
            emitPresentationEvent(cardState, {
                type: 'DESTROY',
                stoneId,
                row,
                col,
                ownerBefore: ownerBeforeKey,
                cause: cause || null,
                reason: reason || null,
                meta: destroyMeta
            });
            const spawnMeta = Object.assign(_clonePresentationMeta(meta), {
                special: 'PROLIFERATION',
                timer: proliferationOwnerTurns,
                owner: ownerBeforeKey,
                fromRow: row,
                fromCol: col,
                cloneVisual: true,
                proliferationOriginRow: row,
                proliferationOriginCol: col,
                proliferationTriggeredBy: cause || null,
                proliferationTriggerReason: reason || null
            });
            const spawnResult = spawnAt(
                cardState,
                gameState,
                destination.row,
                destination.col,
                ownerBeforeKey as PlayerKey,
                'PROLIFERATION_WILL',
                'proliferation_spawn',
                spawnMeta
            );
            if (spawnResult && spawnResult.spawned) {
                _addSpecialStoneMarker(cardState, destination.row, destination.col, ownerBeforeKey, {
                    type: 'PROLIFERATION',
                    remainingOwnerTurns: proliferationOwnerTurns
                });
                return createDestroyOutcome(DESTROY_OUTCOME_KINDS.PROLIFERATED, {
                    reason: 'proliferation_triggered',
                    from: { row, col },
                    to: { row: destination.row, col: destination.col }
                });
            }
        }
    }

    const cardRegenModule = getCardRegenModule();
    const activeRegenMarker = cardRegenModule && typeof cardRegenModule.findActiveRegenMarkerAt === 'function'
        ? cardRegenModule.findActiveRegenMarkerAt(cardState, row, col)
        : null;
    if (!ignoreRegen && activeRegenMarker && typeof cardRegenModule.applyRegenAfterDestroy === 'function') {
        const ownerBeforeKeyForRegen = (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white';
        const stoneId = getStoneIdAt(cardState, gameState, row, col);
        const destroyMeta = _populateSpecialVisualMeta(cardState, row, col, _clonePresentationMeta(meta));
        destroyMeta.regenerated = true;
        destroyMeta.regenTriggeredBy = cause || null;
        destroyMeta.regenTriggerReason = reason || null;
        emitPresentationEvent(cardState, {
            type: 'DESTROY',
            stoneId,
            row,
            col,
            ownerBefore: ownerBeforeKeyForRegen,
            cause: cause || null,
            reason: reason || null,
            meta: destroyMeta
        });
        const regenResult = cardRegenModule.applyRegenAfterDestroy(cardState, gameState, row, col, {
            destroyCause: cause || null,
            destroyReason: reason || null
        }, {
            BoardOps: {
                changeAt,
                emitPresentationEvent
            }
        });
        if (regenResult && regenResult.regenerated) {
            return createDestroyOutcome(DESTROY_OUTCOME_KINDS.REGENERATED, {
                reason: 'regen_triggered',
                row,
                col,
                owner: regenResult.owner || ownerBeforeKeyForRegen,
                remaining: regenResult.remaining,
                captureFlips: Array.isArray(regenResult.captureFlips) ? regenResult.captureFlips.slice() : []
            });
        }
    }

    const specialKindForSalvation = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';
    const wasSpecialStoneForSalvation = !!(Array.isArray(cardState.markers) && cardState.markers.some(
        (m: any) => m && m.kind === specialKindForSalvation && m.row === row && m.col === col
    ));
    const ownerBeforeKeyForDestroy = (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white';
    const wasStoneSalvationGodForDestroy = _isStoneSalvationGodMarkerAt(cardState, row, col, ownerBeforeKeyForDestroy);
    const recordSalvationDestroy = () => {
        const activeTurnPlayer = cardState._activeTurnPlayer;
        const beneficiaryPlayer = activeTurnPlayer === 'black'
            ? 'white'
            : (activeTurnPlayer === 'white' ? 'black' : null);
        if (beneficiaryPlayer) {
            if (!cardState.prevOpponentTurnDestroyedStonesByPlayer) {
                cardState.prevOpponentTurnDestroyedStonesByPlayer = { black: [], white: [] };
            }
            if (!Array.isArray(cardState.prevOpponentTurnDestroyedStonesByPlayer[beneficiaryPlayer])) {
                cardState.prevOpponentTurnDestroyedStonesByPlayer[beneficiaryPlayer] = [];
            }
            cardState.prevOpponentTurnDestroyedStonesByPlayer[beneficiaryPlayer].push({
                row,
                col,
                owner: ownerBeforeKeyForDestroy,
                wasSpecial: wasSpecialStoneForSalvation
            });
        }
    };

    const cardLivingWillModule = getCardLivingWillModule();
    const livingWillMarker = cardLivingWillModule && typeof cardLivingWillModule.findLivingWillMarkerAt === 'function'
        ? cardLivingWillModule.findLivingWillMarkerAt(cardState, row, col)
        : null;
    if (livingWillMarker && cardLivingWillModule && typeof cardLivingWillModule.restoreFromLivingWillSnapshot === 'function') {
        const livingStoneId = getStoneIdAt(cardState, gameState, row, col);
        const destroyMeta = _populateSpecialVisualMeta(cardState, row, col, _clonePresentationMeta(meta));
        setStoneIdAt(cardState, gameState, row, col, null);
        setCellValue(gameState, row, col, EMPTY);
        if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
            cardMarkers.removeMarkersAt(cardState, row, col);
        } else if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
            MarkersAdapter.removeMarkersAt(cardState, row, col);
        } else if (Array.isArray(cardState.markers)) {
            cardState.markers = cardState.markers.filter((m: any) => !(m.row === row && m.col === col));
        }
        destroyMeta.livingWillTriggered = true;
        emitPresentationEvent(cardState, {
            type: 'DESTROY',
            stoneId: livingStoneId,
            row,
            col,
            ownerBefore: ownerBeforeKeyForDestroy,
            cause: cause || null,
            reason: reason || null,
            meta: destroyMeta
        });
        const livingWillResult = cardLivingWillModule.restoreFromLivingWillSnapshot(
            cardState,
            gameState,
            livingWillMarker,
            {
                triggerKind: 'destroy',
                sourceRow: row,
                sourceCol: col,
                cause: cause || null,
                reason: reason || null
            },
            {
                BoardOps: {
                    spawnAt,
                    changeAt,
                    getCellValue,
                    getExpansionDescriptors,
                    emitPresentationEvent
                },
                random: meta && meta.random
            }
        );
        if (livingWillResult && livingWillResult.restored) {
            return createDestroyOutcome(DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED, {
                reason: 'living_will_restored',
                from: { row, col },
                to: livingWillResult.destination || { row, col },
                owner: livingWillResult.owner || ownerBeforeKeyForDestroy,
                livingWillRevived: true,
                relocated: !!livingWillResult.relocated
            });
        }
        recordSalvationDestroy();
        const stoneSalvationGodReviveQueued = wasStoneSalvationGodForDestroy
            ? null
            : _queueDestroyedStoneForStoneSalvationGod(cardState, row, col, ownerBeforeKeyForDestroy, cause, reason, meta);
        return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED, stoneSalvationGodReviveQueued && stoneSalvationGodReviveQueued.queued ? {
            stoneSalvationGodReviveQueued: true
        } : undefined);
    }

    let stoneId: string | null = null;
    stoneId = getStoneIdAt(cardState, gameState, row, col);
    const destroyMeta = _populateSpecialVisualMeta(cardState, row, col, _clonePresentationMeta(meta));
    setStoneIdAt(cardState, gameState, row, col, null);

    setCellValue(gameState, row, col, EMPTY);
    if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
        cardMarkers.removeMarkersAt(cardState, row, col);
    } else if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        MarkersAdapter.removeMarkersAt(cardState, row, col);
    } else if (Array.isArray(cardState.markers)) {
        cardState.markers = cardState.markers.filter((m: any) => !(m.row === row && m.col === col));
    }
    emitPresentationEvent(cardState, {
        type: 'DESTROY',
        stoneId,
        row,
        col,
        ownerBefore: ownerBeforeKeyForDestroy,
        cause: cause || null,
        reason: reason || null,
        meta: destroyMeta
    });

    recordSalvationDestroy();

    const stoneSalvationGodReviveQueued = wasStoneSalvationGodForDestroy
        ? null
        : _queueDestroyedStoneForStoneSalvationGod(cardState, row, col, ownerBeforeKeyForDestroy, cause, reason, meta);

    return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED, stoneSalvationGodReviveQueued && stoneSalvationGodReviveQueued.queued ? {
        stoneSalvationGodReviveQueued: true
    } : undefined);
}

function destroyAt(cardState: any, gameState: any, row: number, col: number, cause: string | null, reason: string | null, meta: any = {}): any {
    _ensureCardState(cardState);
    const depth = Number.isFinite(Number(cardState._stoneSalvationGodDestroyBlockDepth))
        ? Number(cardState._stoneSalvationGodDestroyBlockDepth)
        : 0;
    if (depth > 0) {
        return _destroyAtCore(cardState, gameState, row, col, cause, reason, meta);
    }
    let result: any;
    runDestroyBlock(cardState, gameState, () => {
        result = _destroyAtCore(cardState, gameState, row, col, cause, reason, meta);
    }, Object.assign({ cause, reason }, meta || {}));
    return result;
}

function changeAt(cardState: any, gameState: any, row: number, col: number, ownerAfterKey: PlayerKey, cause: string | null, reason: string | null, meta: any = {}): any {
    _ensureCardState(cardState);
    const pos = _normalizeCellPosition(row, col);
    if (!pos) return { changed: false, reason: 'out_of_board' };
    row = pos.row;
    col = pos.col;
    const prev = getCellValue(gameState, row, col);
    if (prev === null) return { changed: false, reason: 'out_of_board' };
    const ownerAfterVal = ownerAfterKey === 'black' ? (SharedConstants.BLACK || 1) : (SharedConstants.WHITE || -1);
    const forcePresentation = !!(meta && meta.forcePresentation === true);
    const allowGhostFlip = !!(meta && meta.allowGhostFlip === true);
    if (prev === ownerAfterVal) {
        if (!forcePresentation) return { changed: false };
        const stoneIdForced = getStoneIdAt(cardState, gameState, row, col);
        const forcedMetaInput = _clonePresentationMeta(meta);
        delete forcedMetaInput.forcePresentation;
        delete forcedMetaInput.allowGhostFlip;
        const forcedMeta = _populateSpecialVisualMeta(cardState, row, col, forcedMetaInput);
        emitPresentationEvent(cardState, {
            type: 'CHANGE',
            stoneId: stoneIdForced,
            row,
            col,
            ownerBefore: ownerAfterKey,
            ownerAfter: ownerAfterKey,
            cause: cause || null,
            reason: reason || null,
            meta: forcedMeta
        });
        return { changed: false, presented: true };
    }
    if (_isFrozenCell(cardState, row, col)) return { changed: false, reason: 'frozen_protected' };
    if (_isAbsoluteProtectedCell(cardState, row, col)) return { changed: false, reason: 'absolute_protected' };
    const ownerBeforeKey = (prev === (SharedConstants.BLACK || 1))
        ? 'black'
        : ((prev === (SharedConstants.WHITE || -1)) ? 'white' : null);
    const ghostMarker = _getGhostMarkerAt(cardState, row, col);
    if (ghostMarker && _shouldBlockGhostChange(cause, reason) && !allowGhostFlip) {
        const stoneIdBlocked = getStoneIdAt(cardState, gameState, row, col);
        const metaBlockedInput = _clonePresentationMeta(meta);
        delete metaBlockedInput.allowGhostFlip;
        const metaBlocked = _populateSpecialVisualMeta(cardState, row, col, metaBlockedInput);
        metaBlocked.blockedByGhost = true;
        emitPresentationEvent(cardState, {
            type: 'CHANGE',
            stoneId: stoneIdBlocked,
            row,
            col,
            ownerBefore: ownerBeforeKey,
            ownerAfter: ownerAfterKey,
            cause: cause || null,
            reason: reason || null,
            meta: metaBlocked
        });
        return { changed: false, blockedByGhost: true, reason: 'ghost_protected' };
    }

    if (String(reason || '').toLowerCase().indexOf('flip') >= 0) {
        _consumeProliferationMarkerOnNormalFlip(cardState, row, col);
    }
    _consumeAfterimageMarkerOnNormalChange(cardState, row, col);
    const stoneId = getStoneIdAt(cardState, gameState, row, col);

    setCellValue(gameState, row, col, ownerAfterVal);
    if (ownerBeforeKey !== null) {
        ensureResultTotals(cardState);
        cardState.totalFlipCountByPlayer[ownerAfterKey] = (cardState.totalFlipCountByPlayer[ownerAfterKey] || 0) + 1;
        if (ownerBeforeKey !== ownerAfterKey && isMainBoardCorner(row, col, gameState)) {
            cardState.cornerCaptureCountByPlayer[ownerAfterKey] = (cardState.cornerCaptureCountByPlayer[ownerAfterKey] || 0) + 1;
        }
    }
    const metaOutInput = _clonePresentationMeta(meta);
    delete metaOutInput.allowGhostFlip;
    const metaOut = _populateSpecialVisualMeta(cardState, row, col, metaOutInput);

    emitPresentationEvent(cardState, {
        type: 'CHANGE',
        stoneId,
        row,
        col,
        ownerBefore: (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white',
        ownerAfter: ownerAfterKey,
        cause: cause || null,
        reason: reason || null,
        meta: metaOut
    });
    return { changed: true };
}

function revertSpecialStoneAt(cardState: any, gameState: any, row: number, col: number, specialType: string, ownerKey: string | null, cause: string | null, reason: string | null, meta: any = {}): any {
    _ensureCardState(cardState);
    const pos = _normalizeCellPosition(row, col);
    if (!pos) return { reverted: false, reason: 'out_of_board' };
    row = pos.row;
    col = pos.col;

    const prev = getCellValue(gameState, row, col);
    if (prev === null) return { reverted: false, reason: 'out_of_board' };
    if (prev === EMPTY) return { reverted: false, reason: 'empty_cell' };

    const targetTypeUpper = String(specialType || '').toUpperCase();
    if (!targetTypeUpper) return { reverted: false, reason: 'missing_special_type' };

    const isManifestTarget = _isManifestStoneType(targetTypeUpper);
    const markersAtCell = isManifestTarget
        ? _getSpecialMarkersAt(cardState, row, col).concat(_getManifestMarkersAt(cardState, row, col))
        : _getSpecialMarkersAt(cardState, row, col);
    const matchesAtCell = markersAtCell.filter((marker: any) => {
        const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
        if (markerTypeUpper !== targetTypeUpper) return false;
        if (ownerKey !== undefined && ownerKey !== null && ownerKey !== '' && marker.owner !== ownerKey) return false;
        return true;
    });
    if (!matchesAtCell.length) return { reverted: false, reason: 'marker_not_found' };
    const cardLivingWillModule = getCardLivingWillModule();
    const livingWillMarker = cardLivingWillModule && typeof cardLivingWillModule.findLivingWillMarkerAt === 'function'
        ? cardLivingWillModule.findLivingWillMarkerAt(cardState, row, col)
        : null;
    const shouldRestoreLivingWill = !!(
        livingWillMarker &&
        cardLivingWillModule &&
        typeof cardLivingWillModule.shouldTriggerForSpecialLoss === 'function' &&
        cardLivingWillModule.shouldTriggerForSpecialLoss(livingWillMarker, specialType)
    );

    const markerKind = isManifestTarget
        ? (MARKER_KINDS && MARKER_KINDS.MANIFEST_STONE ? MARKER_KINDS.MANIFEST_STONE : 'manifestStone')
        : (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone');
    const cardMarkers = getCardMarkersModule();
    const removeOptions: any = {
        kind: markerKind,
        type: specialType
    };
    if (ownerKey !== undefined && ownerKey !== null && ownerKey !== '') {
        removeOptions.owner = ownerKey;
    }

    if (cardMarkers && typeof cardMarkers.removeMarkersAt === 'function') {
        cardMarkers.removeMarkersAt(cardState, row, col, removeOptions);
    } else if (MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        MarkersAdapter.removeMarkersAt(cardState, row, col, removeOptions);
    } else if (Array.isArray(cardState.markers)) {
        cardState.markers = cardState.markers.filter((marker: any) => {
            if (!marker || marker.row !== row || marker.col !== col) return true;
            if (marker.kind !== markerKind) return true;
            if (String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase() !== targetTypeUpper) return true;
            if (removeOptions.owner && marker.owner !== removeOptions.owner) return true;
            return false;
        });
    }

    const remainingMarkersAtCell = isManifestTarget
        ? _getSpecialMarkersAt(cardState, row, col).concat(_getManifestMarkersAt(cardState, row, col))
        : _getSpecialMarkersAt(cardState, row, col);
    const remainingMatches = remainingMarkersAtCell.filter((marker: any) => {
        const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
        if (markerTypeUpper !== targetTypeUpper) return false;
        if (removeOptions.owner && marker.owner !== removeOptions.owner) return false;
        return true;
    });
    if (remainingMatches.length >= matchesAtCell.length) {
        return { reverted: false, reason: 'marker_not_removed' };
    }

    const metaOut = _clonePresentationMeta(meta);
    metaOut.special = specialType;
    if ((metaOut.owner === undefined || metaOut.owner === null) && ownerKey !== undefined && ownerKey !== null && ownerKey !== '') {
        metaOut.owner = ownerKey;
    }
    metaOut.reason = reason || null;
    metaOut.reverted = true;

    emitPresentationEvent(cardState, {
        type: 'STATUS_REMOVED',
        row,
        col,
        cause: cause || null,
        reason: reason || null,
        meta: metaOut
    });

    const result: any = {
        reverted: true,
        removedCount: matchesAtCell.length - remainingMatches.length
    };
    if (shouldRestoreLivingWill && cardLivingWillModule && typeof cardLivingWillModule.restoreFromLivingWillSnapshot === 'function') {
        result.livingWillRestore = cardLivingWillModule.restoreFromLivingWillSnapshot(
            cardState,
            gameState,
            livingWillMarker,
            {
                triggerKind: 'special_loss',
                sourceRow: row,
                sourceCol: col,
                cause: cause || null,
                reason: reason || null,
                removedSpecialType: specialType
            },
            {
                BoardOps: {
                    spawnAt,
                    changeAt,
                    getCellValue,
                    getExpansionDescriptors,
                    emitPresentationEvent
                },
                random: meta && meta.random
            }
        );
    }
    return result;
}

function moveAt(cardState: any, gameState: any, fromRow: number, fromCol: number, toRow: number, toCol: number, cause: string | null, reason: string | null, meta: any = {}): any {
    _ensureCardState(cardState);
    const fromPos = _normalizeCellPosition(fromRow, fromCol);
    const toPos = _normalizeCellPosition(toRow, toCol);
    if (!fromPos) return { moved: false, reason: 'from_out_of_board' };
    if (!toPos) return { moved: false, reason: 'to_out_of_board' };
    fromRow = fromPos.row;
    fromCol = fromPos.col;
    toRow = toPos.row;
    toCol = toPos.col;
    const prev = getCellValue(gameState, fromRow, fromCol);
    if (prev === EMPTY) return { moved: false };
    if (prev === null) return { moved: false, reason: 'from_out_of_board' };
    if (_isFrozenCell(cardState, fromRow, fromCol)) return { moved: false, reason: 'frozen_source' };
    if (_isAbsoluteProtectedCell(cardState, fromRow, fromCol)) return { moved: false, reason: 'absolute_protected_source' };
    const destVal = getCellValue(gameState, toRow, toCol);
    if (destVal === null) return { moved: false, reason: 'to_out_of_board' };
    if (destVal !== EMPTY) return { moved: false, reason: 'dest_not_empty' };
    if (_isBlockedDestinationCell(cardState, toRow, toCol)) return { moved: false, reason: 'blocked_destination' };
    _invalidateSeedMarkerAt(cardState, toRow, toCol, cause, reason);

    const stoneId = getStoneIdAt(cardState, gameState, fromRow, fromCol);
    setStoneIdAt(cardState, gameState, fromRow, fromCol, null);
    setStoneIdAt(cardState, gameState, toRow, toCol, stoneId);

    setCellValue(gameState, fromRow, fromCol, EMPTY);
    setCellValue(gameState, toRow, toCol, prev);
    _moveStoneAttachedMarkers(cardState, fromRow, fromCol, toRow, toCol);
    const metaOut = _clonePresentationMeta(meta);
    if (metaOut.moveIntent === undefined || metaOut.moveIntent === null) {
        const inferredIntent = _inferMoveIntent(cause, reason);
        if (inferredIntent) metaOut.moveIntent = inferredIntent;
    }
    if (metaOut.special === undefined || metaOut.special === null) {
        const visual = _getSpecialVisualMeta(cardState, toRow, toCol);
        if (visual.special !== null) metaOut.special = visual.special;
        if (visual.timer !== null) metaOut.timer = visual.timer;
        if (visual.owner !== null) metaOut.owner = visual.owner;
        if (visual.flipEvadeRemaining !== null) metaOut.flipEvadeRemaining = visual.flipEvadeRemaining;
        if (visual.destroyEvadeRemaining !== null) metaOut.destroyEvadeRemaining = visual.destroyEvadeRemaining;
    }
    emitPresentationEvent(cardState, {
        type: 'MOVE',
        stoneId,
        row: toRow,
        col: toCol,
        prevRow: fromRow,
        prevCol: fromCol,
        ownerBefore: (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white',
        ownerAfter: (prev === (SharedConstants.BLACK || 1)) ? 'black' : 'white',
        cause: cause || null,
        reason: reason || null,
        meta: metaOut
    });
    return { moved: true, markerHandled: true };
}

function swapOccupiedCells(cardState: any, gameState: any, posA: any, posB: any, options: any = {}): any {
    _ensureCardState(cardState);
    if (!posA || !posB) return { swapped: false, reason: 'invalid_args' };
    const aPos = _normalizeCellPosition(posA.row, posA.col);
    const bPos = _normalizeCellPosition(posB.row, posB.col);
    if (!aPos || !bPos) return { swapped: false, reason: 'invalid_args' };
    const aRow = aPos.row;
    const aCol = aPos.col;
    const bRow = bPos.row;
    const bCol = bPos.col;
    if (aRow === bRow && aCol === bCol) return { swapped: false, reason: 'same_cell' };

    const valueA = getCellValue(gameState, aRow, aCol);
    const valueB = getCellValue(gameState, bRow, bCol);
    if (valueA === null || valueB === null) return { swapped: false, reason: 'out_of_board' };
    if (valueA === EMPTY || valueB === EMPTY) return { swapped: false, reason: 'empty' };
    if (_isFrozenCell(cardState, aRow, aCol) || _isFrozenCell(cardState, bRow, bCol)) return { swapped: false, reason: 'frozen_source' };
    if (_isAbsoluteProtectedCell(cardState, aRow, aCol) || _isAbsoluteProtectedCell(cardState, bRow, bCol)) return { swapped: false, reason: 'absolute_protected_source' };

    const stoneIdA = getStoneIdAt(cardState, gameState, aRow, aCol);
    const stoneIdB = getStoneIdAt(cardState, gameState, bRow, bCol);
    const ownerA = valueA === (SharedConstants.BLACK || 1) ? 'black' : 'white';
    const ownerB = valueB === (SharedConstants.BLACK || 1) ? 'black' : 'white';

    setCellValue(gameState, aRow, aCol, valueB);
    setCellValue(gameState, bRow, bCol, valueA);
    setStoneIdAt(cardState, gameState, aRow, aCol, stoneIdB);
    setStoneIdAt(cardState, gameState, bRow, bCol, stoneIdA);
    _swapStoneAttachedMarkers(cardState, aRow, aCol, bRow, bCol);

    const cause = options && Object.prototype.hasOwnProperty.call(options, 'cause') ? options.cause : null;
    const reason = options && Object.prototype.hasOwnProperty.call(options, 'reason') ? options.reason : null;
    const firstMeta = _clonePresentationMeta(options && options.firstMeta ? options.firstMeta : options && options.meta);
    const secondMeta = _clonePresentationMeta(options && options.secondMeta ? options.secondMeta : options && options.meta);
    const inferredIntent = _inferMoveIntent(cause, reason);
    if ((firstMeta.moveIntent === undefined || firstMeta.moveIntent === null) && inferredIntent) firstMeta.moveIntent = inferredIntent;
    if ((secondMeta.moveIntent === undefined || secondMeta.moveIntent === null) && inferredIntent) secondMeta.moveIntent = inferredIntent;

    const firstVisual = _getSpecialVisualMeta(cardState, bRow, bCol);
    if (firstMeta.special === undefined || firstMeta.special === null) {
        if (firstVisual.special !== null) firstMeta.special = firstVisual.special;
        if (firstVisual.timer !== null) firstMeta.timer = firstVisual.timer;
        if (firstVisual.owner !== null) firstMeta.owner = firstVisual.owner;
        if (firstVisual.flipEvadeRemaining !== null) firstMeta.flipEvadeRemaining = firstVisual.flipEvadeRemaining;
        if (firstVisual.destroyEvadeRemaining !== null) firstMeta.destroyEvadeRemaining = firstVisual.destroyEvadeRemaining;
    }
    const secondVisual = _getSpecialVisualMeta(cardState, aRow, aCol);
    if (secondMeta.special === undefined || secondMeta.special === null) {
        if (secondVisual.special !== null) secondMeta.special = secondVisual.special;
        if (secondVisual.timer !== null) secondMeta.timer = secondVisual.timer;
        if (secondVisual.owner !== null) secondMeta.owner = secondVisual.owner;
        if (secondVisual.flipEvadeRemaining !== null) secondMeta.flipEvadeRemaining = secondVisual.flipEvadeRemaining;
        if (secondVisual.destroyEvadeRemaining !== null) secondMeta.destroyEvadeRemaining = secondVisual.destroyEvadeRemaining;
    }

    const actionId = options && options.actionId ? options.actionId : null;
    const firstEvent: any = {
        type: 'MOVE',
        stoneId: stoneIdA,
        row: bRow,
        col: bCol,
        prevRow: aRow,
        prevCol: aCol,
        ownerBefore: ownerA,
        ownerAfter: ownerA,
        cause,
        reason,
        meta: firstMeta
    };
    const secondEvent: any = {
        type: 'MOVE',
        stoneId: stoneIdB,
        row: aRow,
        col: aCol,
        prevRow: bRow,
        prevCol: bCol,
        ownerBefore: ownerB,
        ownerAfter: ownerB,
        cause,
        reason,
        meta: secondMeta
    };
    if (actionId) {
        firstEvent.actionId = actionId;
        secondEvent.actionId = actionId;
    }
    emitPresentationEvent(cardState, firstEvent);
    emitPresentationEvent(cardState, secondEvent);
    return {
        swapped: true,
        first: { row: aRow, col: aCol },
        second: { row: bRow, col: bCol }
    };
}

function setActionContext(cardState: any, meta: any): void {
    _ensureCardState(cardState);
    cardState._currentActionMeta = meta;
}

function clearActionContext(cardState: any): void {
    if (cardState && cardState._currentActionMeta !== undefined) delete cardState._currentActionMeta;
}

export = {
    spawnAt,
    spawnMany,
    runSpawnBlock,
    destroyAt,
    changeAt,
    revertSpecialStoneAt,
    moveAt,
    swapOccupiedCells,
    applyHoleAt,
    applyCellRemovalAt,
    getExpansionDescriptors,
    getCellValue,
    setCellValue,
    isExpansionCell,
    isMainBoardCell,
    allocateStoneId,
    emitPresentationEvent,
    setActionContext,
    clearActionContext,
    consumeStoneSalvationGodRevives,
    runEffectBlock,
    runDestroyBlock,
    runCellRemovalBlock
};
