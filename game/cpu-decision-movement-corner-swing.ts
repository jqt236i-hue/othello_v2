const MOVEMENT_CORNER_SWING_CARD_TYPES = [
    'BUOYANCY_WILL',
    'GRAVITY_WILL',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL',
    'SUPER_ATTRACTION_WILL'
];

const TARGET_GETTER_BY_CARD_TYPE: Record<string, string> = {
    BUOYANCY_WILL: 'getBuoyancyTargets',
    GRAVITY_WILL: 'getGravityTargets',
    SUPER_BUOYANCY_WILL: 'getSuperBuoyancyTargets',
    SUPER_GRAVITY_WILL: 'getSuperGravityTargets',
    SUPER_ATTRACTION_WILL: 'getSuperAttractionTargets'
};

type MovementCornerSwingConfig = {
    cardLogic?: any;
    cardState?: any;
    gameState?: any;
    playerKey?: any;
    board?: any;
    playerValue?: any;
    pending?: any;
    getBoardCellValueSafe?: (board: any, row: any, col: any) => any;
    isCornerCell?: (row: any, col: any, board?: any) => any;
};

function normalizeConfig(config: MovementCornerSwingConfig): MovementCornerSwingConfig {
    return (config && typeof config === 'object') ? config : {};
}

function normalizeTarget(target: any): any {
    if (!target) return null;
    const row = Number(target.row);
    const col = Number(target.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function readCell(config: MovementCornerSwingConfig, row: number, col: number): any {
    const cfg = normalizeConfig(config);
    if (typeof cfg.getBoardCellValueSafe === 'function') {
        const value = cfg.getBoardCellValueSafe(cfg.board, row, col);
        return typeof value === 'undefined' ? null : value;
    }
    const board = cfg.board;
    if (!Array.isArray(board) || !Array.isArray(board[row])) return null;
    return typeof board[row][col] === 'undefined' ? null : board[row][col];
}

function isCorner(config: MovementCornerSwingConfig, row: number, col: number): boolean {
    const cfg = normalizeConfig(config);
    return typeof cfg.isCornerCell === 'function'
        ? cfg.isCornerCell(row, col, cfg.board) === true
        : ((row === 0 || row === 7) && (col === 0 || col === 7));
}

function isEnemyCorner(config: MovementCornerSwingConfig, target: any): boolean {
    const point = normalizeTarget(target);
    if (!point) return false;
    const playerValue = Number(config && config.playerValue);
    if (!Number.isFinite(playerValue) || playerValue === 0) return false;
    if (!isCorner(config, point.row, point.col)) return false;
    return readCell(config, point.row, point.col) === -playerValue;
}

function getMarkers(config: MovementCornerSwingConfig): any[] {
    const cs = config && config.cardState;
    return Array.isArray(cs && cs.markers) ? cs.markers : [];
}

function getMarkerType(marker: any): string {
    return String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
}

function hasMarkerTypeAt(config: MovementCornerSwingConfig, row: number, col: number, types: Set<string>): boolean {
    return getMarkers(config).some((marker) => (
        marker &&
        marker.row === row &&
        marker.col === col &&
        types.has(getMarkerType(marker))
    ));
}

function isBlockedCell(config: MovementCornerSwingConfig, row: number, col: number): boolean {
    return hasMarkerTypeAt(config, row, col, new Set(['BLOCKADE', 'METEOR_HOLE', 'FREEZE']));
}

function isGuardProtectedCell(config: MovementCornerSwingConfig, row: number, col: number): boolean {
    return hasMarkerTypeAt(config, row, col, new Set(['GUARD']));
}

function isGhostCell(config: MovementCornerSwingConfig, row: number, col: number): boolean {
    return hasMarkerTypeAt(config, row, col, new Set(['GHOST']));
}

function getVerticalMovementProfile(cardType: any): any {
    switch (String(cardType || '')) {
        case 'BUOYANCY_WILL':
            return { direction: -1, crush: false };
        case 'SUPER_BUOYANCY_WILL':
            return { direction: -1, crush: true };
        case 'GRAVITY_WILL':
            return { direction: 1, crush: false };
        case 'SUPER_GRAVITY_WILL':
            return { direction: 1, crush: true };
        default:
            return null;
    }
}

function collectVerticalSlideOutcome(config: MovementCornerSwingConfig, source: any, direction: number): any {
    const firstRow = source.row + direction;
    if (readCell(config, firstRow, source.col) === null) return null;
    if (isBlockedCell(config, firstRow, source.col)) return null;
    if (readCell(config, firstRow, source.col) !== 0) return null;

    let targetRow = firstRow;
    for (let row = firstRow + direction; readCell(config, row, source.col) !== null; row += direction) {
        if (isBlockedCell(config, row, source.col)) break;
        if (readCell(config, row, source.col) !== 0) break;
        targetRow = row;
    }

    return {
        from: { row: source.row, col: source.col },
        to: { row: targetRow, col: source.col },
        destroyed: []
    };
}

function collectVerticalCrushOutcome(config: MovementCornerSwingConfig, source: any, direction: number): any {
    let destination: any = null;
    const destroyed: any[] = [];

    for (let row = source.row + direction; readCell(config, row, source.col) !== null; row += direction) {
        if (isBlockedCell(config, row, source.col)) break;
        const cell = readCell(config, row, source.col);
        if (cell !== 0 && isGuardProtectedCell(config, row, source.col)) break;
        if (cell !== 0) {
            destroyed.push({ row, col: source.col });
            if (!isGhostCell(config, row, source.col)) {
                destination = { row, col: source.col };
            }
            continue;
        }
        destination = { row, col: source.col };
    }

    if (!destination) return null;
    return {
        from: { row: source.row, col: source.col },
        to: destination,
        destroyed
    };
}

function collectVerticalMovementOutcome(cardType: any, config: MovementCornerSwingConfig, target: any): any {
    const source = normalizeTarget(target);
    if (!source) return null;
    const sourceValue = readCell(config, source.row, source.col);
    if (sourceValue === null || sourceValue === 0) return null;
    const profile = getVerticalMovementProfile(cardType);
    if (!profile) return null;
    const outcome = profile.crush
        ? collectVerticalCrushOutcome(config, source, profile.direction)
        : collectVerticalSlideOutcome(config, source, profile.direction);
    if (!outcome) return null;
    outcome.sourceValue = sourceValue;
    return outcome;
}

function isCornerSwingVerticalTarget(cardType: any, config: MovementCornerSwingConfig, target: any): boolean {
    const outcome = collectVerticalMovementOutcome(cardType, config, target);
    if (!outcome) return false;
    const playerValue = Number(config && config.playerValue);
    if (!Number.isFinite(playerValue) || playerValue === 0) return false;

    const sourceDisplacesEnemyCorner = isEnemyCorner(config, outcome.from) && !isCorner(config, outcome.to.row, outcome.to.col);
    if (sourceDisplacesEnemyCorner) return true;

    const replacesEnemyCorner = (
        outcome.sourceValue === playerValue &&
        isCorner(config, outcome.to.row, outcome.to.col) &&
        readCell(config, outcome.to.row, outcome.to.col) === -playerValue
    );
    return replacesEnemyCorner;
}

function getTargetsByCardType(cardType: any, config: MovementCornerSwingConfig, pending?: any): any[] {
    const cfg = normalizeConfig(config);
    const logic = cfg.cardLogic;
    const methodName = TARGET_GETTER_BY_CARD_TYPE[String(cardType || '')];
    if (!logic || !methodName || typeof logic[methodName] !== 'function') return [];
    if (String(cardType || '') === 'SUPER_ATTRACTION_WILL') {
        return logic[methodName](cfg.cardState, cfg.gameState, cfg.playerKey, pending || null) || [];
    }
    return logic[methodName](cfg.cardState, cfg.gameState, cfg.playerKey) || [];
}

function makeSuperAttractionPendingForSource(source: any): any {
    return {
        type: 'SUPER_ATTRACTION_WILL',
        stage: 'selectTarget',
        firstTarget: { row: source.row, col: source.col }
    };
}

function isCornerSwingSuperAttractionDestination(config: MovementCornerSwingConfig, source: any, destination: any): boolean {
    const from = normalizeTarget(source);
    const to = normalizeTarget(destination);
    if (!from || !to) return false;
    const playerValue = Number(config && config.playerValue);
    if (!Number.isFinite(playerValue) || playerValue === 0) return false;
    const sourceValue = readCell(config, from.row, from.col);
    if (sourceValue === null || sourceValue === 0) return false;

    if (isEnemyCorner(config, from)) {
        return !isCorner(config, to.row, to.col);
    }
    return sourceValue === playerValue && isEnemyCorner(config, to);
}

function isCornerSwingSuperAttractionSource(config: MovementCornerSwingConfig, source: any): boolean {
    const from = normalizeTarget(source);
    if (!from) return false;
    const destinations = getTargetsByCardType(
        'SUPER_ATTRACTION_WILL',
        config,
        makeSuperAttractionPendingForSource(from)
    );
    return destinations.some((destination) => isCornerSwingSuperAttractionDestination(config, from, destination));
}

function filterMovementCornerSwingTargets(cardType: any, targets: any[], config: MovementCornerSwingConfig): any[] {
    const cfg = normalizeConfig(config);
    const safeTargets = Array.isArray(targets) ? targets : [];
    if (String(cardType || '') === 'SUPER_ATTRACTION_WILL') {
        const pending = cfg.pending;
        const first = pending && pending.firstTarget ? normalizeTarget(pending.firstTarget) : null;
        if (first) {
            return safeTargets.filter((target) => isCornerSwingSuperAttractionDestination(cfg, first, target));
        }
        return safeTargets.filter((target) => isCornerSwingSuperAttractionSource(cfg, target));
    }
    if (!getVerticalMovementProfile(cardType)) return safeTargets.slice();
    return safeTargets.filter((target) => isCornerSwingVerticalTarget(cardType, cfg, target));
}

function countMovementCornerSwingTargetsForCardType(cardType: any, config: MovementCornerSwingConfig): number {
    const cfg = normalizeConfig(config);
    const targets = getTargetsByCardType(cardType, cfg, cfg.pending);
    return filterMovementCornerSwingTargets(cardType, targets, cfg).length;
}

function getMovementCornerSwingTargetCounts(config: MovementCornerSwingConfig): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const cardType of MOVEMENT_CORNER_SWING_CARD_TYPES) {
        counts[cardType] = countMovementCornerSwingTargetsForCardType(cardType, config);
    }
    return counts;
}

function getMaxMovementCornerSwingTargetCount(counts: any): number {
    if (!counts || typeof counts !== 'object') return 0;
    let max = 0;
    for (const cardType of MOVEMENT_CORNER_SWING_CARD_TYPES) {
        const value = Number(counts[cardType]);
        if (Number.isFinite(value) && value > max) max = Math.floor(value);
    }
    return max;
}

module.exports = {
    MOVEMENT_CORNER_SWING_CARD_TYPES,
    filterMovementCornerSwingTargets,
    getMovementCornerSwingTargetCounts,
    getMaxMovementCornerSwingTargetCount,
    countMovementCornerSwingTargetsForCardType
};
