import { CardState, GameState } from '../../../src/types';

interface CardCellRemovalDeps {
    applyCellRemovalAt?(
        cardState: CardState,
        gameState: GameState,
        row: number,
        col: number,
        playerKey: string,
        cause: string,
        reason: string,
        options: any
    ): any;
    runCellRemovalBlock?(cardState: CardState, gameState: GameState, fn: () => any, meta?: any): any;
}

function applyHoleStyleCellRemoval(
    cardState: CardState,
    gameState: GameState,
    row: number,
    col: number,
    playerKey: string,
    cause: string,
    reason: string,
    deps: CardCellRemovalDeps,
    options: any = {}
): any {
    if (!deps || typeof deps.applyCellRemovalAt !== 'function') {
        return {
            applied: false,
            reason: 'cell_removal_dependency_missing',
            row,
            col,
            cause
        };
    }
    const removalOptions = Object.assign({
        removalPolicy: 'absolute_only',
        removalKind: 'meteor_hole'
    }, options || {});
    return deps.applyCellRemovalAt(cardState, gameState, row, col, playerKey, cause, reason, removalOptions);
}

function runHoleStyleCellRemovalBlock(
    cardState: CardState,
    gameState: GameState,
    deps: CardCellRemovalDeps,
    fn: () => any,
    meta: any = {}
): any {
    return deps && typeof deps.runCellRemovalBlock === 'function'
        ? deps.runCellRemovalBlock(cardState, gameState, fn, meta)
        : fn();
}

export = {
    applyHoleStyleCellRemoval,
    runHoleStyleCellRemovalBlock
};
