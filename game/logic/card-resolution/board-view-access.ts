import type { CardState, GameState } from '../../../src/types';

type CardResolutionBoardView = {
    coordinates: Array<{ row: number; col: number }>;
    get: (row: number, col: number) => number | null;
    isPlayable: (row: number, col: number) => boolean;
};

const SharedBoardUtils: any = require('../../../shared/shared-board-utils');

function requireBoardKernel(): any {
    if (
        !SharedBoardUtils ||
        typeof SharedBoardUtils.createBoardContext !== 'function' ||
        typeof SharedBoardUtils.createBoardView !== 'function'
    ) {
        throw new Error('SharedBoardUtils BoardContext/BoardView APIs are required by card resolution');
    }
    return SharedBoardUtils;
}

const BoardKernel = requireBoardKernel();

function createCardResolutionBoardView(cardState: CardState | any, gameState: GameState | any): CardResolutionBoardView {
    const context = BoardKernel.createBoardContext(gameState, cardState == null ? null : cardState);
    const view = BoardKernel.createBoardView(context.gameState, {
        cardState: context.cardState,
        strict: false
    });
    if (
        !view ||
        !Array.isArray(view.coordinates) ||
        typeof view.get !== 'function' ||
        typeof view.isPlayable !== 'function'
    ) {
        throw new Error('SharedBoardUtils.createBoardView returned an invalid BoardView for card resolution');
    }
    return view;
}

export = {
    createCardResolutionBoardView
};
