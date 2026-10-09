/**
 * 2回目のパスで終局せず、先にパスした側へ手番が戻ったか（01-rulebook.md §8.2 の数え直し）。
 * パス前後の gameState とパスした側から判定する。UI・ネット権威の両方がパス通知に添える。
 * - 1回目のパス（パス前の連続パスが 0）: 戻っていない
 * - 終局（パス後の連続パスが 2）: 戻っていない
 * - 時間停止で同じ側が続ける（パス後の手番がパスした側）: 戻っていない
 */
function readConsecutivePasses(gameState: any): number {
    const value = Number(gameState && gameState.consecutivePasses);
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function readCurrentPlayerKey(gameState: any): 'black' | 'white' | null {
    const current = gameState ? gameState.currentPlayer : null;
    if (current === 1 || current === 'black') return 'black';
    if (current === -1 || current === 'white') return 'white';
    return null;
}

function didPassReturnTurn(previousGameState: any, nextGameState: any, passedPlayerKey: unknown): boolean {
    const passedKey = passedPlayerKey === 'white' ? 'white' : (passedPlayerKey === 'black' ? 'black' : null);
    if (!passedKey) return false;
    if (readConsecutivePasses(previousGameState) < 1) return false;
    if (readConsecutivePasses(nextGameState) !== 1) return false;
    const nextPlayerKey = readCurrentPlayerKey(nextGameState);
    return !!nextPlayerKey && nextPlayerKey !== passedKey;
}

export = {
    didPassReturnTurn
};
