'use strict';

const { JSDOM } = require('jsdom');

function createBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function setupDom() {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.boardEl = document.getElementById('board');
    return dom;
}

function setupGlobals(options) {
    const currentPlayer = options.currentPlayer || 'white';
    const localPlayerKey = options.localPlayerKey || 'black';
    const fateMap = options.fateMap || { black: null, white: null };
    const isNetwork = options.isNetwork === true;
    const isHvH = options.isHvH === true;

    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;
    global.handleCellClick = jest.fn();
    global.getPlayerKey = (player) => (player === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = jest.fn(() => [{ row: 2, col: 3, flips: [[2, 4]] }]);
    global.applyStoneVisualEffect = jest.fn();
    global.updateOccupancyUI = jest.fn();
    global.renderCardUI = jest.fn();

    global.CardLogic = {
        getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
        getSelectableTargets: () => []
    };

    global.gameState = {
        currentPlayer: currentPlayer === 'white' ? global.WHITE : global.BLACK,
        board: createBoard()
    };

    global.cardState = {
        markers: [],
        pendingEffectByPlayer: { black: null, white: null },
        presentationEvents: [],
        _presentationEventsPersist: [],
        fateWillControllerByTurnOwner: fateMap
    };

    if (isNetwork) {
        window.MATCH_MODE = 'network';
    } else {
        delete window.MATCH_MODE;
    }
    window.LOCAL_PLAYER_KEY = localPlayerKey;
    window.__LOCAL_PLAYER_KEY = localPlayerKey;
    window.BOARD_VIEWER_KEY = localPlayerKey;
    window.DEBUG_HUMAN_VS_HUMAN = isHvH;
}

function cleanup(dom) {
    try {
        if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close();
    } catch (e) {
        // ignore
    }
    delete global.window;
    delete global.document;
    delete global.boardEl;
    delete global.BLACK;
    delete global.WHITE;
    delete global.EMPTY;
    delete global.handleCellClick;
    delete global.getPlayerKey;
    delete global.getLegalMoves;
    delete global.applyStoneVisualEffect;
    delete global.updateOccupancyUI;
    delete global.renderCardUI;
    delete global.CardLogic;
    delete global.gameState;
    delete global.cardState;
}

describe('FATE_WILL legal hints', () => {
    let dom;

    beforeEach(() => {
        jest.resetModules();
        dom = setupDom();
    });

    afterEach(() => {
        cleanup(dom);
    });

    test('local controller sees legal hints on victim turn', () => {
        setupGlobals({
            currentPlayer: 'white',
            localPlayerKey: 'black',
            fateMap: { black: null, white: 'black' }
        });
        const diffRenderer = require('../ui/diff-renderer');

        diffRenderer.renderBoardDiff(global.boardEl);

        const legalCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
        expect(global.getLegalMoves).toHaveBeenCalledTimes(1);
        expect(legalCell).toBeTruthy();
        expect(legalCell.classList.contains('legal')).toBe(true);
    });

    test('local victim does not see legal hints while being controlled', () => {
        setupGlobals({
            currentPlayer: 'black',
            localPlayerKey: 'black',
            fateMap: { black: 'white', white: null }
        });
        const diffRenderer = require('../ui/diff-renderer');

        diffRenderer.renderBoardDiff(global.boardEl);

        const legalCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
        expect(global.getLegalMoves).not.toHaveBeenCalled();
        expect(legalCell).toBeTruthy();
        expect(legalCell.classList.contains('legal')).toBe(false);
    });

    test('network controller sees legal hints on victim turn', () => {
        setupGlobals({
            currentPlayer: 'white',
            localPlayerKey: 'black',
            isNetwork: true,
            fateMap: { black: null, white: 'black' }
        });
        const diffRenderer = require('../ui/diff-renderer');

        diffRenderer.renderBoardDiff(global.boardEl);

        const legalCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
        expect(global.getLegalMoves).toHaveBeenCalledTimes(1);
        expect(legalCell).toBeTruthy();
        expect(legalCell.classList.contains('legal')).toBe(true);
    });

    test('network victim does not see legal hints while being controlled', () => {
        setupGlobals({
            currentPlayer: 'white',
            localPlayerKey: 'white',
            isNetwork: true,
            fateMap: { black: null, white: 'black' }
        });
        const diffRenderer = require('../ui/diff-renderer');

        diffRenderer.renderBoardDiff(global.boardEl);

        const legalCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
        expect(global.getLegalMoves).not.toHaveBeenCalled();
        expect(legalCell).toBeTruthy();
        expect(legalCell.classList.contains('legal')).toBe(false);
    });

    test('HvH white turn without FATE_WILL still shows legal hints', () => {
        setupGlobals({
            currentPlayer: 'white',
            localPlayerKey: 'black',
            isHvH: true,
            fateMap: { black: null, white: null }
        });
        const diffRenderer = require('../ui/diff-renderer');

        diffRenderer.renderBoardDiff(global.boardEl);

        const legalCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
        expect(global.getLegalMoves).toHaveBeenCalledTimes(1);
        expect(legalCell).toBeTruthy();
        expect(legalCell.classList.contains('legal')).toBe(true);
    });
});
