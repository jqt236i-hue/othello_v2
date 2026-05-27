type CardBoardShapeAccessConfig = {
    emptyValue: any;
    blackValue: any;
    whiteValue: any;
    resolveCardBoardConfig: (boardOrConfig?: any) => any;
    getExpansionDescriptorsForCard: (gameState: any) => any[];
    isMainBoardCellForCard: (row: any, col: any, boardOrConfig: any) => any;
    getCellValueForCard: (gameState: any, row: any, col: any) => any;
    getBlockingMarkers: (cardState: any) => any[];
    findSpecialMarkerAt: (cardState: any, row: any, col: any, type?: any, owner?: any) => any;
    resolveDeterministicRandomIndex: (length: any, randomLike: any, fallbackLike: any, label: any) => any;
};

export function createCardBoardShapeAccess(config: CardBoardShapeAccessConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CardBoardShapeAccessConfig;

    function getEmptyValue(): any {
        return typeof cfg.emptyValue !== 'undefined' ? cfg.emptyValue : 0;
    }

    function getBlackValue(): any {
        return typeof cfg.blackValue !== 'undefined' ? cfg.blackValue : 1;
    }

    function getWhiteValue(): any {
        return typeof cfg.whiteValue !== 'undefined' ? cfg.whiteValue : -1;
    }

    function isBlockedCell(cardState: any, row: any, col: any, gameState: any): any {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        const expansionDescriptors = typeof cfg.getExpansionDescriptorsForCard === 'function'
            ? cfg.getExpansionDescriptorsForCard(gameState)
            : [];
        const isExpansionCell = expansionDescriptors
            .some((desc: any) => desc && desc.row === rowNum && desc.col === colNum);
        const isMainBoardCell = typeof cfg.isMainBoardCellForCard === 'function'
            ? cfg.isMainBoardCellForCard(rowNum, colNum, gameState)
            : false;
        if (!isExpansionCell && !isMainBoardCell) return false;
        const blockingMarkers = typeof cfg.getBlockingMarkers === 'function'
            ? cfg.getBlockingMarkers(cardState)
            : [];
        return blockingMarkers.some((m: any) => m.row === rowNum && m.col === colNum);
    }

    function toBoardCellKey(row: any, col: any): any {
        return `${row},${col}`;
    }

    function hasMeteorHoleAtForCard(cardState: any, row: any, col: any): any {
        return !!(typeof cfg.findSpecialMarkerAt === 'function'
            ? cfg.findSpecialMarkerAt(cardState, row, col, 'METEOR_HOLE')
            : null);
    }

    function hasBoardShapeCellForCard(cardState: any, gameState: any, row: any, col: any): any {
        const rowNum = Number(row);
        const colNum = Number(col);
        if (!Number.isInteger(rowNum) || !Number.isInteger(colNum)) return false;
        if (hasMeteorHoleAtForCard(cardState, rowNum, colNum)) return false;
        if (typeof cfg.isMainBoardCellForCard === 'function' && cfg.isMainBoardCellForCard(rowNum, colNum, gameState)) return true;
        const expansionDescriptors = typeof cfg.getExpansionDescriptorsForCard === 'function'
            ? cfg.getExpansionDescriptorsForCard(gameState)
            : [];
        return expansionDescriptors
            .some((desc: any) => desc && desc.row === rowNum && desc.col === colNum);
    }

    function getCurrentBoardShapeCellsForCard(cardState: any, gameState: any): any {
        const cells = [];
        const boardConfig = typeof cfg.resolveCardBoardConfig === 'function'
            ? cfg.resolveCardBoardConfig(gameState)
            : { rows: 8, cols: 8 };
        for (let row = 0; row < boardConfig.rows; row++) {
            for (let col = 0; col < boardConfig.cols; col++) {
                if (!hasBoardShapeCellForCard(cardState, gameState, row, col)) continue;
                cells.push({ row, col });
            }
        }
        const expansionDescriptors = typeof cfg.getExpansionDescriptorsForCard === 'function'
            ? cfg.getExpansionDescriptorsForCard(gameState)
            : [];
        for (const desc of expansionDescriptors) {
            if (!desc || !Number.isInteger(desc.row) || !Number.isInteger(desc.col)) continue;
            if (!hasBoardShapeCellForCard(cardState, gameState, desc.row, desc.col)) continue;
            cells.push({ row: desc.row, col: desc.col });
        }
        return cells;
    }

    function getOccupiedBoardShapeCellsForCard(cardState: any, gameState: any): any {
        return getCurrentBoardShapeCellsForCard(cardState, gameState)
            .filter((cell: any) => cfg.getCellValueForCard(gameState, cell.row, cell.col) !== getEmptyValue());
    }

    function getEmptyBoardShapeCellsForCard(cardState: any, gameState: any): any {
        return getCurrentBoardShapeCellsForCard(cardState, gameState)
            .filter((cell: any) => cfg.getCellValueForCard(gameState, cell.row, cell.col) === getEmptyValue());
    }

    function selectRandomEmptyBoardShapeDestination(cardState: any, gameState: any, fromRow: any, fromCol: any, randomSource: any): any {
        const candidates = getEmptyBoardShapeCellsForCard(cardState, gameState)
            .filter((cell: any) => {
                if (!cell) return false;
                if (cell.row === fromRow && cell.col === fromCol) return false;
                return !isBlockedCell(cardState, cell.row, cell.col, gameState);
            });
        if (!candidates.length) return null;
        const index = cfg.resolveDeterministicRandomIndex(
            candidates.length,
            randomSource,
            null,
            'CardLogic.selectRandomEmptyBoardShapeDestination'
        );
        return candidates[index] || candidates[0] || null;
    }

    function moveCoexistingSpecialMarkers(cardState: any, anchorEntry: any, fromRow: any, fromCol: any, toRow: any, toCol: any): any {
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
                    markerTypeUpper === 'SEED'
                ) continue;
            }
            marker.row = toRow;
            marker.col = toCol;
        }
    }

    function collectEmptyNeighborCellsForCard(cardState: any, gameState: any, row: any, col: any): any {
        const neighbors = [];
        const seen = new Set();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const targetRow = row + dr;
                const targetCol = col + dc;
                if (!hasBoardShapeCellForCard(cardState, gameState, targetRow, targetCol)) continue;
                if (cfg.getCellValueForCard(gameState, targetRow, targetCol) !== getEmptyValue()) continue;
                if (isBlockedCell(cardState, targetRow, targetCol, gameState)) continue;
                const key = `${targetRow},${targetCol}`;
                if (seen.has(key)) continue;
                seen.add(key);
                neighbors.push({ row: targetRow, col: targetCol });
            }
        }
        return neighbors;
    }

    function getCurrentCornerCellsForCard(cardState: any, gameState: any): any {
        const cells = getCurrentBoardShapeCellsForCard(cardState, gameState);
        if (cells.length === 0) return [];
        const cellKeys = new Set(cells.map((cell: any) => toBoardCellKey(cell.row, cell.col)));
        const quadrants = [
            { vertical: -1, horizontal: -1 },
            { vertical: -1, horizontal: 1 },
            { vertical: 1, horizontal: -1 },
            { vertical: 1, horizontal: 1 }
        ];

        return cells.filter((cell: any) => quadrants.some((quadrant: any) => {
            const verticalKey = toBoardCellKey(cell.row + quadrant.vertical, cell.col);
            const horizontalKey = toBoardCellKey(cell.row, cell.col + quadrant.horizontal);
            return !cellKeys.has(verticalKey) && !cellKeys.has(horizontalKey);
        }));
    }

    function countOccupiedCornersForPlayer(cardState: any, gameState: any, playerKey: any): any {
        const playerValue = playerKey === 'white' ? getWhiteValue() : getBlackValue();
        return getCurrentCornerCellsForCard(cardState, gameState)
            .reduce((count: any, cell: any) => (
                cfg.getCellValueForCard(gameState, cell.row, cell.col) === playerValue ? count + 1 : count
            ), 0);
    }

    function countOpponentOccupiedCornersForPlayer(cardState: any, gameState: any, playerKey: any): any {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        return countOccupiedCornersForPlayer(cardState, gameState, opponentKey);
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
        getCurrentCornerCellsForCard,
        countOccupiedCornersForPlayer,
        countOpponentOccupiedCornersForPlayer
    };
}

module.exports = {
    createCardBoardShapeAccess
};
