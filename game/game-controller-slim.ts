
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function requireGameControllerSlimModuleOrNull(id: string): any {
    try {
        return _require(id);
    } catch (e) { /* ignore */ }
    return null;
}

const SharedConstants = requireGameControllerSlimModuleOrNull('../shared-constants');
const CARD_DEFS = (SharedConstants && Array.isArray(SharedConstants.CARD_DEFS))
    ? SharedConstants.CARD_DEFS
    : [];
const CARD_TYPE_BY_ID = CARD_DEFS.reduce((acc: any, c: any) => {
    acc[c.id] = c.type;
    return acc;
}, {});

const GameControllerSharedBoardUtils = requireGameControllerSlimModuleOrNull('../shared/shared-board-utils');

function posToNotation(row: number, col: number): string {
    if (GameControllerSharedBoardUtils && typeof GameControllerSharedBoardUtils.posToNotation === 'function') {
        return GameControllerSharedBoardUtils.posToNotation(row, col);
    }
    const cols = 'abcdefgh';
    return cols[col] + (row + 1);
}

function initializeGame(runtime: any): void {
    const root = runtime && typeof runtime === 'object' ? runtime : null;
    if (!root || typeof root.createGameState !== 'function') {
        console.error('[Game Controller] game-core-logic.js not loaded');
        return;
    }
    if (typeof root.processBombs !== 'function') {
        console.error('[Game Controller] special-effects-handler.js not loaded');
        return;
    }
    if (typeof root.applyProtectionAfterMove !== 'function') {
        console.error('[Game Controller] card-effects-applier.js not loaded');
        return;
    }
    if (typeof root.cpuMaybeUseCardWithPolicy !== 'function') {
        console.error('[Game Controller] cpu-decision.js not loaded');
        return;
    }
    if (typeof root.executeMove !== 'function') {
        console.error('[Game Controller] turn-manager.js not loaded');
        return;
    }
    
    console.log('[Game Controller] All modules loaded successfully');
    
    if (typeof root.gameState === 'undefined') {
        root.gameState = root.createGameState();
    }

    if (root.CpuPolicy && typeof root.CpuPolicy.loadPolicyForLevel === 'function') {
        root.CpuPolicy.loadPolicyForLevel(1)
            .then((policy: any) => {
                root.mccfrPolicy = policy;
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
