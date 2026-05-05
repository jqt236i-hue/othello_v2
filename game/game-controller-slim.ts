<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const CARD_TYPE_BY_ID = (globalThis as any).CARD_DEFS.reduce((acc: any, c: any) => {
    acc[c.id] = c.type;
    return acc;
}, {});

const GameControllerSharedBoardUtils = (() => {
    try {
        return _require('../shared/shared-board-utils');
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).SharedBoardUtils) {
            return (globalThis as any).SharedBoardUtils;
        }
    } catch (e) { /* ignore */ }
    return null;
})();

function posToNotation(row: number, col: number): string {
    if (GameControllerSharedBoardUtils && typeof GameControllerSharedBoardUtils.posToNotation === 'function') {
        return GameControllerSharedBoardUtils.posToNotation(row, col);
    }
    const cols = 'abcdefgh';
    return cols[col] + (row + 1);
}

function initializeGame(): void {
    if (typeof (globalThis as any).createGameState === 'undefined') {
        console.error('[Game Controller] game-core-logic.js not loaded');
        return;
    }
    if (typeof (globalThis as any).processBombs === 'undefined') {
        console.error('[Game Controller] special-effects-handler.js not loaded');
        return;
    }
    if (typeof (globalThis as any).applyProtectionAfterMove === 'undefined') {
        console.error('[Game Controller] card-effects-applier.js not loaded');
        return;
    }
    if (typeof (globalThis as any).cpuMaybeUseCardWithPolicy === 'undefined') {
        console.error('[Game Controller] cpu-decision.js not loaded');
        return;
    }
    if (typeof (globalThis as any).executeMove === 'undefined') {
        console.error('[Game Controller] turn-manager.js not loaded');
        return;
    }
    
    console.log('[Game Controller] All modules loaded successfully');
    
    if (typeof (globalThis as any).gameState === 'undefined') {
        (globalThis as any).gameState = (globalThis as any).createGameState();
    }

    if (typeof (globalThis as any).CpuPolicy !== 'undefined' && typeof (globalThis as any).CpuPolicy.loadPolicyForLevel === 'function') {
        (globalThis as any).CpuPolicy.loadPolicyForLevel(1)
            .then((policy: any) => {
                (globalThis as any).mccfrPolicy = policy;
                console.log('[Game Controller] MCCFR policy loaded');
            })
            .catch((err: any) => {
                console.warn('[Game Controller] Failed to load MCCFR policy:', err);
            });
    }
}

const GameControllerSlim = {
    initializeGame,
    posToNotation,
    CARD_TYPE_BY_ID
};

export = GameControllerSlim;
