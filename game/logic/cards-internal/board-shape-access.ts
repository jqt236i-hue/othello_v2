type CardBoardShapeAccessConfig = {
    emptyValue: any;
    blackValue: any;
    whiteValue: any;
    createBoardContextForCard: (cardState: any, gameState: any) => any;
    createBoardViewForCard: (cardState: any, gameState: any) => any;
    getEffectiveCornerCellsForCard: (cardState: any, gameState: any) => Array<{ row: number; col: number }>;
    toBoardCellKey: (row: number, col: number) => string;
    getBlockingMarkers: (cardState: any) => any[];
    resolveDeterministicRandomIndex: (length: any, randomLike: any, fallbackLike: any, label: any) => any;
};

export function createCardBoardShapeAccess(config: CardBoardShapeAccessConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CardBoardShapeAccessConfig;
    if (
        typeof cfg.createBoardContextForCard !== 'function' ||
        typeof cfg.createBoardViewForCard !== 'function' ||
        typeof cfg.getEffectiveCornerCellsForCard !== 'function' ||
        typeof cfg.toBoardCellKey !== 'function'
    ) {
        throw new Error('[board-shape-access] BoardContext/BoardView APIs are required');
    }
    if (
        typeof cfg.getBlockingMarkers !== 'function' ||
        typeof cfg.resolveDeterministicRandomIndex !== 'function'
    ) {
        throw new Error('[board-shape-access] marker and deterministic-random APIs are required');
    }

    const emptyValue = cfg.emptyValue;
    const blackValue = cfg.blackValue;
    const whiteValue = cfg.whiteValue;

    function createView(cardState: any, gameState: any): any {
        // Constructing the context here intentionally validates both authoritative
        // sources before the read-only BoardView is used.
        cfg.createBoardContextForCard(cardState, gameState);
        return cfg.createBoardViewForCard(cardState, gameState);
    }

    function isBlockedCell(cardState: any, row: any, col: any, gameState: any): boolean {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        const boardView = createView(cardState, gameState);
        const key = cfg.toBoardCellKey(rowNum, colNum);
        if (boardView.topology.holeKeys.has(key)) return true;
        if (!boardView.isPlayable(rowNum, colNum)) return false;
        return cfg.getBlockingMarkers(cardState)
            .some((marker: any) => marker && marker.row === rowNum && marker.col === colNum);
    }

    function toBoardCellKey(row: any, col: any): string {
        return cfg.toBoardCellKey(Number(row), Number(col));
    }

    function hasMeteorHoleAtForCard(cardState: any, gameState: any, row: any, col: any): boolean {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        const view = createView(cardState, gameState);
        return view.topology.holeKeys.has(cfg.toBoardCellKey(rowNum, colNum));
    }

    function hasBoardShapeCellForCard(cardState: any, gameState: any, row: any, col: any): boolean {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        return createView(cardState, gameState).isPlayable(rowNum, colNum);
    }

    function getCurrentBoardShapeCellsForCard(cardState: any, gameState: any): any[] {
        return createView(cardState, gameState).coordinates
            .map((cell: any) => ({ row: cell.row, col: cell.col }));
    }

    function getOccupiedBoardShapeCellsForCard(cardState: any, gameState: any): any[] {
        const view = createView(cardState, gameState);
        return view.coordinates
            .filter((cell: any) => view.get(cell.row, cell.col) !== emptyValue)
            .map((cell: any) => ({ row: cell.row, col: cell.col }));
    }

    function getEmptyBoardShapeCellsForCard(cardState: any, gameState: any): any[] {
        const view = createView(cardState, gameState);
        return view.coordinates
            .filter((cell: any) => view.get(cell.row, cell.col) === emptyValue)
            .map((cell: any) => ({ row: cell.row, col: cell.col }));
    }

    function getAvailableEmptyBoardShapeCellsForCard(cardState: any, gameState: any, fromRow: any, fromCol: any): any[] {
        return getEmptyBoardShapeCellsForCard(cardState, gameState)
            .filter((cell: any) => {
                if (cell.row === fromRow && cell.col === fromCol) return false;
                return !isBlockedCell(cardState, cell.row, cell.col, gameState);
            });
    }

    function selectRandomEmptyBoardShapeDestination(cardState: any, gameState: any, fromRow: any, fromCol: any, randomSource: any): any {
        const candidates = getAvailableEmptyBoardShapeCellsForCard(cardState, gameState, fromRow, fromCol);
        if (!candidates.length) return null;
        const index = cfg.resolveDeterministicRandomIndex(
            candidates.length,
            randomSource,
            null,
            'CardLogic.selectRandomEmptyBoardShapeDestination'
        );
        return candidates[index] || candidates[0] || null;
    }

    function getChebyshevDistance(from: any, to: any): number {
        return Math.max(
            Math.abs(Number(from.row) - Number(to.row)),
            Math.abs(Number(from.col) - Number(to.col))
        );
    }

    function collectNearestEmptyBoardShapeCellsForCard(cardState: any, gameState: any, row: any, col: any): any[] {
        const origin = { row: Number(row), col: Number(col) };
        if (!Number.isInteger(origin.row) || !Number.isInteger(origin.col)) return [];
        const candidates = getAvailableEmptyBoardShapeCellsForCard(cardState, gameState, origin.row, origin.col);
        if (!candidates.length) return [];
        let bestDistance = Number.POSITIVE_INFINITY;
        const nearest: any[] = [];
        for (const candidate of candidates) {
            const distance = getChebyshevDistance(origin, candidate);
            if (distance < bestDistance) {
                bestDistance = distance;
                nearest.length = 0;
                nearest.push(candidate);
            } else if (distance === bestDistance) {
                nearest.push(candidate);
            }
        }
        return nearest;
    }

    function moveCoexistingSpecialMarkers(cardState: any, anchorEntry: any, fromRow: any, fromCol: any, toRow: any, toCol: any): void {
        if (!Array.isArray(cardState && cardState.markers)) return;
        for (const marker of cardState.markers) {
            if (!marker || marker === anchorEntry) continue;
            if (marker.row !== fromRow || marker.col !== fromCol) continue;
            if (marker.kind === 'specialStone') {
                const markerTypeUpper = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
                if (
                    markerTypeUpper === 'BLOCKADE' ||
                    markerTypeUpper === 'METEOR_HOLE' ||
                    markerTypeUpper === 'FREEZE' ||
                    markerTypeUpper === 'SEED' ||
                    markerTypeUpper === 'POISON_CELL'
                ) continue;
            }
            marker.row = toRow;
            marker.col = toCol;
        }
    }

    function collectEmptyNeighborCellsForCard(cardState: any, gameState: any, row: any, col: any): any[] {
        const view = createView(cardState, gameState);
        const neighbors: any[] = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const targetRow = Number(row) + dr;
                const targetCol = Number(col) + dc;
                if (!view.isPlayable(targetRow, targetCol)) continue;
                if (view.get(targetRow, targetCol) !== emptyValue) continue;
                if (isBlockedCell(cardState, targetRow, targetCol, gameState)) continue;
                neighbors.push({ row: targetRow, col: targetCol });
            }
        }
        return neighbors;
    }

    function collectCloneSpawnCellsForCard(cardState: any, gameState: any, row: any, col: any): any[] {
        const neighbors = collectEmptyNeighborCellsForCard(cardState, gameState, row, col);
        return neighbors.length > 0
            ? neighbors
            : collectNearestEmptyBoardShapeCellsForCard(cardState, gameState, row, col);
    }

    function getCurrentCornerCellsForCard(cardState: any, gameState: any): any[] {
        const view = createView(cardState, gameState);
        return cfg.getEffectiveCornerCellsForCard(cardState, gameState)
            .filter((cell: any) => cell && view.isPlayable(cell.row, cell.col))
            .map((cell: any) => ({ row: cell.row, col: cell.col }));
    }

    function countOccupiedCornersForPlayer(cardState: any, gameState: any, playerKey: any): number {
        const playerValue = playerKey === 'white' ? whiteValue : blackValue;
        const view = createView(cardState, gameState);
        return getCurrentCornerCellsForCard(cardState, gameState)
            .reduce((count: number, cell: any) => (
                view.get(cell.row, cell.col) === playerValue ? count + 1 : count
            ), 0);
    }

    function countOpponentOccupiedCornersForPlayer(cardState: any, gameState: any, playerKey: any): number {
        return countOccupiedCornersForPlayer(
            cardState,
            gameState,
            playerKey === 'black' ? 'white' : 'black'
        );
    }

    return {
        isBlockedCell,
        toBoardCellKey,
        hasMeteorHoleAtForCard,
        hasBoardShapeCellForCard,
        getCurrentBoardShapeCellsForCard,
        getOccupiedBoardShapeCellsForCard,
        getEmptyBoardShapeCellsForCard,
        selectRandomEmptyBoardShapeDestination,
        moveCoexistingSpecialMarkers,
        collectEmptyNeighborCellsForCard,
        collectCloneSpawnCellsForCard,
        getCurrentCornerCellsForCard,
        countOccupiedCornersForPlayer,
        countOpponentOccupiedCornersForPlayer
    };
}

module.exports = {
    createCardBoardShapeAccess
};
