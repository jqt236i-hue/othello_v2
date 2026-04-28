export function processBreedingEffects(cardState: any, gameState: any, playerKey: any, prng: any, deps?: {}): {
    spawned: any[];
    destroyed: any[];
    flipped: any[];
    anchors: any[];
};
export function processBreedingEffectsAtAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps?: {}): {
    spawned: any[];
    destroyed: any[];
    flipped: any[];
};
export function processBreedingEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps?: {}): {
    spawned: any[];
    destroyed: any[];
    flipped: any[];
    anchors: any[];
};
export function spawnAndFlipBatch(cardState: any, gameState: any, playerKey: any, player: any, targets: any, cause: any, reason: any, anchorPos: any, deps: any): {
    spawned: {
        row: any;
        col: any;
        anchorRow: any;
        anchorCol: any;
        stoneId: any;
    }[];
    flipped: {
        row: any;
        col: any;
    }[];
};
//# sourceMappingURL=breeding.d.ts.map