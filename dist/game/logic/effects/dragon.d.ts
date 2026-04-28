/**
 * @file dragon.ts
 * @description DRAGON effect helper - TypeScript module for browser and Node.js
 */
interface DragonDeps {
    BoardOps?: any;
    getCardContext?: (cardState: any) => any;
    moveCoexistingSpecialMarkers?: (cardState: any, anchorEntry: any, fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
    selectRandomEmptyBoardShapeDestination?: (cardState: any, gameState: any, fromRow: number, fromCol: number, randomSource: any) => {
        row: number;
        col: number;
    } | null;
    randomSource?: any;
}
interface DragonEffectResult {
    converted: {
        row: number;
        col: number;
    }[];
    destroyed: {
        row: number;
        col: number;
        owner: string;
        reason: string;
    }[];
    anchors: {
        row: number;
        col: number;
        remainingNow: number;
    }[];
}
interface DragonEffectAtAnchorResult {
    moved: {
        from: {
            row: number;
            col: number;
        };
        to: {
            row: number;
            col: number;
        };
    }[];
    converted: {
        row: number;
        col: number;
    }[];
    destroyed: {
        row: number;
        col: number;
        owner: string;
        reason: string;
    }[];
    anchors: {
        row: number;
        col: number;
        remainingNow: number;
    }[];
}
declare function processDragonEffects(cardState: any, gameState: any, playerKey: string, deps?: DragonDeps): DragonEffectResult;
declare function processDragonEffectsAtAnchor(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps?: DragonDeps): Omit<DragonEffectResult, 'anchors'>;
declare function processDragonEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps?: DragonDeps): DragonEffectAtAnchorResult;
declare const _default: {
    processDragonEffects: typeof processDragonEffects;
    processDragonEffectsAtAnchor: typeof processDragonEffectsAtAnchor;
    processDragonEffectsAtTurnStartAnchor: typeof processDragonEffectsAtTurnStartAnchor;
};
export = _default;
//# sourceMappingURL=dragon.d.ts.map