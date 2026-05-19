// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const { runSelfPlayGames } = _require('./src/engine/selfplay-runner');
const Core = _require('./game/logic/core');

const originalLog = console.log;
const originalError = console.error;
console.log = () => {};
console.error = () => {};

function output(...args: any[]): void {
    originalLog(...args);
}

function error(...args: any[]): void {
    originalError(...args);
}

const SETTINGS = {
    games: 20,
    baseSeed: 1,
    maxPlies: 220,
    allowCardUsage: true,
    cardUsageRate: 0.35
};

function isCornr(row: number, col: number, boardSize: number = 8): boolean {
    const last = boardSize - 1;
    return (row === 0 || row === last) && (col === 0 || col === last);
}

function isEdge(row: number, col: number, boardSize: number = 8): boolean {
    const last = boardSize - 1;
    return (row === 0 || row === last || col === 0 || col === last) && !isCornr(row, col, boardSize);
}

function getBoardSize(record: any): number {
    if (record.boardString) {
        const parts = record.boardString.split('/');
        return parts.length || 8;
    }
    return 8;
}

function analyzeRecords(allRecords: any[]): any {
    const missedCorners: any[] = [];
    const missedEdges: any[] = [];

    for (const record of allRecords) {
        if (!record || typeof record !== 'object') continue;

        const isPlacementAction = record.actionType === 'place' || 
                                  (record.row !== undefined && record.col !== undefined && 
                                   !record.useCardId && !record.destroyCardId);

        if (!isPlacementAction) continue;

        const boardSize = getBoardSize(record);
        const row = record.row;
        const col = record.col;

        if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= boardSize || col >= boardSize) {
            continue;
        }

        if (record.hasCornerMoveNow && !isCornr(row, col, boardSize)) {
            missedCorners.push({
                seed: record.seed,
                ply: record.ply,
                player: record.player,
                actionType: record.actionType,
                row,
                col,
                useCardId: record.useCardId,
                destroyCardId: record.destroyCardId,
                future: record.futureDiscDelta3Ply !== undefined ? record.futureDiscDelta3Ply : 0,
                handCards: record.handCards,
                decisionCandidates: record.decisionCandidates
            });
        }

        if (record.hasEdgeMoveNow && !record.hasCornerMoveNow && !isEdge(row, col, boardSize) && !isCornr(row, col, boardSize)) {
            missedEdges.push({
                seed: record.seed,
                ply: record.ply,
                player: record.player,
                actionType: record.actionType,
                row,
                col,
                useCardId: record.useCardId,
                destroyCardId: record.destroyCardId,
                future: record.futureDiscDelta3Ply !== undefined ? record.futureDiscDelta3Ply : 0,
                handCards: record.handCards,
                decisionCandidates: record.decisionCandidates
            });
        }
    }

    missedCorners.sort((a, b) => (a.future || 0) - (b.future || 0));
    missedEdges.sort((a, b) => (a.future || 0) - (b.future || 0));

    return {
        missedCornerCount: missedCorners.length,
        missedEdgeCount: missedEdges.length,
        worstMissedCorners: missedCorners.slice(0, 5),
        worstMissedEdges: missedEdges.slice(0, 5)
    };
}

async function main(): Promise<void> {
    error('Running selfplay with settings:', SETTINGS);
    
    try {
        const allRecords: any[] = [];
        
        const onRecord = (record: any) => {
            if (record && typeof record === 'object') {
                allRecords.push(record);
            }
        };

        const result = runSelfPlayGames({
            ...SETTINGS,
            onRecord
        });

        error('Collected records:', records);
        
        const records = result.records && result.records.length > 0 ? result.records : allRecords;
        const analysis = analyzeRecords(records);
        output(JSON.stringify(analysis, null, 2));
    } catch (err) {
        error('Error:', err);
        process.exit(1);
    }
}

main();
