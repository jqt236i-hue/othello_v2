"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
function createBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(0));
}
function createBaseCardState(markers) {
    return {
        markers: Array.isArray(markers) ? markers : [],
        pendingEffectByPlayer: { black: null, white: null },
        boardBonusByCell: {},
        boardBonusConsumedByCell: {},
        presentationEvents: [],
        _presentationEventsPersist: []
    };
}
function createSnapshot(stateVersion, board, markers) {
    return {
        stateVersion,
        _meta: {
            authority: 'server',
            version: stateVersion,
            projectedForSeat: null,
            turnStartReconciled: true
        },
        gameState: {
            currentPlayer: 1,
            turnNumber: stateVersion,
            board
        },
        cardState: createBaseCardState(markers)
    };
}
function createPlaybackMove(fromRow, fromCol, toRow, toCol, reason) {
    return [{
            type: 'move',
            phase: 1,
            targets: [{
                    from: { r: fromRow, col: fromCol },
                    to: { r: toRow, col: toCol },
                    reason
                }]
        }];
}
describe('Network snapshot hyperactive source-empty handling', () => {
    let dom;
    let diff;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.HTMLElement = dom.window.HTMLElement;
        global.boardEl = document.getElementById('board');
        global.BLACK = 1;
        global.WHITE = -1;
        global.EMPTY = 0;
        global.handleCellClick = () => { };
        global.getPlayerKey = (player) => (player === global.BLACK ? 'black' : 'white');
        global.getLegalMoves = () => [];
        global.CardLogic = {
            getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
            getSelectableTargets: () => []
        };
        global.gameState = {
            currentPlayer: global.BLACK,
            turnNumber: 1,
            board: createBoard()
        };
        global.cardState = createBaseCardState([]);
        diff = require('../ui/diff-renderer');
        global.emitCardStateChange = jest.fn();
        global.emitGameStateChange = jest.fn();
        global.renderCardUI = jest.fn();
        global.emitBoardUpdate = jest.fn(() => {
            diff.renderBoardDiff(global.boardEl);
        });
        global.BoardOps = {
            emitPresentationEvent: jest.fn((cardStateRef, ev) => {
                if (!cardStateRef || typeof cardStateRef !== 'object')
                    return;
                if (!Array.isArray(cardStateRef.presentationEvents))
                    cardStateRef.presentationEvents = [];
                cardStateRef.presentationEvents.push(ev);
            })
        };
        window.DISABLE_ANIMATIONS = false;
    });
    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.boardEl;
        delete global.BLACK;
        delete global.WHITE;
        delete global.EMPTY;
        delete global.handleCellClick;
        delete global.getPlayerKey;
        delete global.getLegalMoves;
        delete global.CardLogic;
        delete global.gameState;
        delete global.cardState;
        delete global.emitCardStateChange;
        delete global.emitGameStateChange;
        delete global.emitBoardUpdate;
        delete global.renderCardUI;
        delete global.BoardOps;
        if (dom && dom.window && typeof dom.window.close === 'function') {
            dom.window.close();
        }
    });
    test('network snapshot keeps inherited hyperactive move source from destroy-fading when source is already empty', () => {
        const beforeBoard = createBoard();
        beforeBoard[3][3] = global.BLACK;
        global.gameState.board = beforeBoard;
        global.cardState = createBaseCardState([
            {
                kind: 'specialStone',
                row: 3,
                col: 3,
                owner: 'black',
                data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 9, flipEvadeRemaining: 1 }
            }
        ]);
        diff.renderBoardDiff(global.boardEl);
        import { createNetworkSnapshotController } from '../ui/network/snapshot.js';
        const controllerState = { stateVersion: 1, lastResultVersionShown: null, resultShownForUnversioned: false };
        const controller = (0, snapshot_js_1.createNetworkSnapshotController)({
            getState: () => controllerState,
            emitCardStateChange: global.emitCardStateChange,
            emitGameStateChange: global.emitGameStateChange,
            emitBoardUpdate: global.emitBoardUpdate,
            renderCardUI: global.renderCardUI
        });
        const afterBoard = createBoard();
        afterBoard[4][3] = global.BLACK;
        const applied = controller.applySnapshot(createSnapshot(2, afterBoard, [
            {
                kind: 'specialStone',
                row: 4,
                col: 3,
                owner: 'black',
                data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 9, flipEvadeRemaining: 1 }
            }
        ]), {
            playbackEvents: createPlaybackMove(3, 3, 4, 3, 'inherited_hyperactive_step_move')
        });
        expect(applied).toBe(true);
        const sourceCell = global.boardEl.querySelector('.cell[data-row="3"][data-col="3"]');
        const destCell = global.boardEl.querySelector('.cell[data-row="4"][data-col="3"]');
        expect(sourceCell).toBeTruthy();
        expect(sourceCell.classList.contains('has-disc')).toBe(false);
        expect(sourceCell.querySelector('.disc')).toBeNull();
        expect(destCell.querySelector('.disc')).toBeTruthy();
        expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(global.cardState, expect.objectContaining({
            type: 'PLAYBACK_EVENTS',
            meta: expect.objectContaining({ source: 'network_snapshot' })
        }));
    });
    test.each([
        {
            name: 'base hyperactive',
            markerType: 'HYPERACTIVE',
            source: { row: 3, col: 3 },
            dest: { row: 4, col: 3 },
            reason: 'hyperactive_move',
            markerData: { remainingOwnerTurns: 8, flipEvadeRemaining: 1 }
        },
        {
            name: 'escape hyperactive',
            markerType: 'ESCAPE_HYPERACTIVE',
            source: { row: 4, col: 4 },
            dest: { row: 5, col: 5 },
            reason: 'escape_hyperactive_move',
            markerData: { remainingOwnerTurns: 8, flipEvadeRemaining: 1 }
        },
        {
            name: 'extreme hyperactive',
            markerType: 'EXTREME_HYPERACTIVE',
            source: { row: 2, col: 2 },
            dest: { row: 4, col: 2 },
            reason: 'extreme_hyperactive_move',
            markerData: { remainingOwnerTurns: 8, flipEvadeRemaining: 2 }
        }
    ])('network snapshot keeps $name move source from destroy-fading when source is already empty', ({ markerType, source, dest, reason, markerData }) => {
        const beforeBoard = createBoard();
        beforeBoard[source.row][source.col] = global.BLACK;
        global.gameState.board = beforeBoard;
        global.cardState = createBaseCardState([
            {
                kind: 'specialStone',
                row: source.row,
                col: source.col,
                owner: 'black',
                data: Object.assign({ type: markerType }, markerData)
            }
        ]);
        diff.renderBoardDiff(global.boardEl);
        import { createNetworkSnapshotController } from '../ui/network/snapshot.js';
        const controllerState = { stateVersion: 1, lastResultVersionShown: null, resultShownForUnversioned: false };
        const controller = (0, snapshot_js_2.createNetworkSnapshotController)({
            getState: () => controllerState,
            emitCardStateChange: global.emitCardStateChange,
            emitGameStateChange: global.emitGameStateChange,
            emitBoardUpdate: global.emitBoardUpdate,
            renderCardUI: global.renderCardUI
        });
        const afterBoard = createBoard();
        afterBoard[dest.row][dest.col] = global.BLACK;
        const applied = controller.applySnapshot(createSnapshot(2, afterBoard, [
            {
                kind: 'specialStone',
                row: dest.row,
                col: dest.col,
                owner: 'black',
                data: Object.assign({ type: markerType }, markerData)
            }
        ]), {
            playbackEvents: createPlaybackMove(source.row, source.col, dest.row, dest.col, reason)
        });
        expect(applied).toBe(true);
        const sourceCell = global.boardEl.querySelector(`.cell[data-row="${source.row}"][data-col="${source.col}"]`);
        const destCell = global.boardEl.querySelector(`.cell[data-row="${dest.row}"][data-col="${dest.col}"]`);
        expect(sourceCell).toBeTruthy();
        expect(sourceCell.classList.contains('has-disc')).toBe(false);
        expect(sourceCell.querySelector('.disc')).toBeNull();
        expect(destCell.querySelector('.disc')).toBeTruthy();
        expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(global.cardState, expect.objectContaining({
            type: 'PLAYBACK_EVENTS',
            meta: expect.objectContaining({ source: 'network_snapshot' })
        }));
    });
    test.each([
        {
            name: 'ultimate hyperactive',
            markerType: 'ULTIMATE_HYPERACTIVE',
            reason: 'ultimate_hyperactive_step_move'
        },
        {
            name: 'ultimate reverse dragon',
            markerType: 'DRAGON',
            reason: 'ultimate_reverse_dragon_move'
        },
        {
            name: 'ultimate destroy god',
            markerType: 'ULTIMATE_DESTROY_GOD',
            reason: 'ultimate_destroy_god_move'
        }
    ])('network snapshot keeps $name move source from destroy-fading when source is already empty', ({ markerType, reason }) => {
        const beforeBoard = createBoard();
        beforeBoard[2][2] = global.BLACK;
        global.gameState.board = beforeBoard;
        global.cardState = createBaseCardState([
            {
                kind: 'specialStone',
                row: 2,
                col: 2,
                owner: 'black',
                data: { type: markerType, remainingOwnerTurns: 10, flipEvadeRemaining: 3 }
            }
        ]);
        diff.renderBoardDiff(global.boardEl);
        import { createNetworkSnapshotController } from '../ui/network/snapshot.js';
        const controllerState = { stateVersion: 1, lastResultVersionShown: null, resultShownForUnversioned: false };
        const controller = (0, snapshot_js_3.createNetworkSnapshotController)({
            getState: () => controllerState,
            emitCardStateChange: global.emitCardStateChange,
            emitGameStateChange: global.emitGameStateChange,
            emitBoardUpdate: global.emitBoardUpdate,
            renderCardUI: global.renderCardUI
        });
        const afterBoard = createBoard();
        afterBoard[2][5] = global.BLACK;
        const applied = controller.applySnapshot(createSnapshot(2, afterBoard, [
            {
                kind: 'specialStone',
                row: 2,
                col: 5,
                owner: 'black',
                data: { type: markerType, remainingOwnerTurns: 10, flipEvadeRemaining: 3 }
            }
        ]), {
            playbackEvents: createPlaybackMove(2, 2, 2, 5, reason)
        });
        expect(applied).toBe(true);
        const sourceCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="2"]');
        const destCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="5"]');
        expect(sourceCell).toBeTruthy();
        expect(sourceCell.classList.contains('has-disc')).toBe(false);
        expect(sourceCell.querySelector('.disc')).toBeNull();
        expect(destCell.querySelector('.disc')).toBeTruthy();
        expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(global.cardState, expect.objectContaining({
            type: 'PLAYBACK_EVENTS',
            meta: expect.objectContaining({ source: 'network_snapshot' })
        }));
    });
    test('self snapshot shadow playback keeps inherited hyperactive source from split-like fallback rendering', () => {
        const beforeBoard = createBoard();
        beforeBoard[3][3] = global.BLACK;
        global.gameState.board = beforeBoard;
        global.cardState = createBaseCardState([
            {
                kind: 'specialStone',
                row: 3,
                col: 3,
                owner: 'black',
                data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 9, flipEvadeRemaining: 1 }
            }
        ]);
        diff.renderBoardDiff(global.boardEl);
        import { createNetworkSnapshotController } from '../ui/network/snapshot.js';
        const controllerState = { stateVersion: 1, lastResultVersionShown: null, resultShownForUnversioned: false };
        const controller = (0, snapshot_js_4.createNetworkSnapshotController)({
            getState: () => controllerState,
            emitCardStateChange: global.emitCardStateChange,
            emitGameStateChange: global.emitGameStateChange,
            emitBoardUpdate: global.emitBoardUpdate,
            renderCardUI: global.renderCardUI
        });
        const afterBoard = createBoard();
        afterBoard[4][3] = global.BLACK;
        const applied = controller.applySnapshot(createSnapshot(2, afterBoard, [
            {
                kind: 'specialStone',
                row: 4,
                col: 3,
                owner: 'black',
                data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 9, flipEvadeRemaining: 1 }
            }
        ]), {
            shadowPlaybackEvents: createPlaybackMove(3, 3, 4, 3, 'inherited_hyperactive_step_move')
        });
        expect(applied).toBe(true);
        const sourceCell = global.boardEl.querySelector('.cell[data-row="3"][data-col="3"]');
        const destCell = global.boardEl.querySelector('.cell[data-row="4"][data-col="3"]');
        expect(sourceCell).toBeTruthy();
        expect(sourceCell.classList.contains('has-disc')).toBe(false);
        expect(sourceCell.querySelector('.disc')).toBeNull();
        expect(destCell.querySelector('.disc')).toBeTruthy();
        expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(global.cardState, expect.objectContaining({
            type: 'PLAYBACK_EVENTS',
            meta: expect.objectContaining({
                source: 'self_snapshot_sync',
                suppressPlayback: true
            })
        }));
    });
});
//# sourceMappingURL=ui.network-snapshot.hyperactive-source-empty.test.js.map