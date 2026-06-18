import type { CardState, PlayerKey } from '../../../src/types';

function ownerKeyOf(playerKey: any): PlayerKey {
    return playerKey === 'white' ? 'white' : 'black';
}

function cellKeyOf(row: number, col: number): string {
    return `${row},${col}`;
}

function ensureTheoryState(cardState: any): void {
    if (!cardState.theoryIncarnationStateByPlayer || typeof cardState.theoryIncarnationStateByPlayer !== 'object') {
        cardState.theoryIncarnationStateByPlayer = { black: null, white: null };
    }
    if (!cardState.nextTheoryIncarnationStoneByPlayer || typeof cardState.nextTheoryIncarnationStoneByPlayer !== 'object') {
        cardState.nextTheoryIncarnationStoneByPlayer = { black: null, white: null };
    }
    if (!cardState.theoryNumberCellsBySession || typeof cardState.theoryNumberCellsBySession !== 'object') {
        cardState.theoryNumberCellsBySession = {};
    }
    if (!cardState.theoryNumberCellByCell || typeof cardState.theoryNumberCellByCell !== 'object') {
        cardState.theoryNumberCellByCell = {};
    }
    if (!cardState.numberCellCollectedTotalByPlayer || typeof cardState.numberCellCollectedTotalByPlayer !== 'object') {
        cardState.numberCellCollectedTotalByPlayer = { black: 0, white: 0 };
    }
    if (!cardState._theoryIncarnationPendingAutoExpireByPlayer || typeof cardState._theoryIncarnationPendingAutoExpireByPlayer !== 'object') {
        cardState._theoryIncarnationPendingAutoExpireByPlayer = { black: null, white: null };
    }
    if (!Number.isFinite(Number(cardState._nextTheoryIncarnationSeq))) {
        cardState._nextTheoryIncarnationSeq = 1;
    }
}

function addNumberCellCollectedTotal(cardState: CardState, playerKey: PlayerKey, amount: any): number {
    const ownerKey = ownerKeyOf(playerKey);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return Number((cardState as any).numberCellCollectedTotalByPlayer && (cardState as any).numberCellCollectedTotalByPlayer[ownerKey] || 0);
    ensureTheoryState(cardState as any);
    const before = Number((cardState as any).numberCellCollectedTotalByPlayer[ownerKey] || 0);
    const after = before + Math.floor(n);
    (cardState as any).numberCellCollectedTotalByPlayer[ownerKey] = after;
    return after;
}

function restoreTheoryNumberCells(cardState: any, sessionId: string): number {
    const session = cardState.theoryNumberCellsBySession && cardState.theoryNumberCellsBySession[sessionId];
    if (!session || !session.cells) return 0;
    const boardBonus = (cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object') ? cardState.boardBonusByCell : (cardState.boardBonusByCell = {});
    const consumed = (cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object') ? cardState.boardBonusConsumedByCell : (cardState.boardBonusConsumedByCell = {});
    let restoredCount = 0;
    for (const [key, cell] of Object.entries(session.cells) as Array<[string, any]>) {
        if (cell && cell.consumed === true) {
            if (cardState.theoryNumberCellByCell) delete cardState.theoryNumberCellByCell[key];
            continue;
        }
        const originalValue = Number(cell && cell.originalValue || 0);
        if (originalValue > 0) boardBonus[key] = originalValue;
        else delete boardBonus[key];
        if (cell && cell.originalConsumed === true) consumed[key] = true;
        else delete consumed[key];
        if (cardState.theoryNumberCellByCell) delete cardState.theoryNumberCellByCell[key];
        restoredCount += 1;
    }
    delete cardState.theoryNumberCellsBySession[sessionId];
    return restoredCount;
}

export = {
    ownerKeyOf,
    cellKeyOf,
    ensureTheoryState,
    addNumberCellCollectedTotal,
    restoreTheoryNumberCells
};
