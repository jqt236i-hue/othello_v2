"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
describe('animation-engine playback-state integration', () => {
    beforeEach(() => {
        jest.resetModules();
        global.window = {
            __telemetry__: { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }
        };
        global.document = {
            getElementById: () => ({
                classList: { add() { }, remove() { } },
                querySelector: () => null,
                getBoundingClientRect: () => ({})
            })
        };
        global.emitBoardUpdate = jest.fn();
    });
    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.emitBoardUpdate;
    });
    test('watchdog clears playback through PlaybackStateManager', async () => {
        const playbackStateMock = {
            abortPlayback: jest.fn(),
            setSuppressNextDiffFlip: jest.fn()
        };
        jest.doMock('../ui/playback-state-manager', () => playbackStateMock);
        import * as engine from '../ui/animation-engine.js';
        await engine.handleWatchdog();
        expect(playbackStateMock.abortPlayback).toHaveBeenCalledTimes(1);
        expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
    });
    test('abortAndSync delegates playback abort to PlaybackStateManager when available', () => {
        const playbackStateMock = {
            abortPlayback: jest.fn()
        };
        jest.doMock('../ui/playback-state-manager', () => playbackStateMock);
        import * as engine from '../ui/animation-engine.js';
        engine.abortAndSync();
        expect(playbackStateMock.abortPlayback).toHaveBeenCalledTimes(1);
        expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
    });
    test('external abort prevents a late finalize from clearing a newer playback lock', async () => {
        jest.unmock('../ui/playback-state-manager');
        import * as manager from '../ui/playback-state-manager.js';
        import * as engine from '../ui/animation-engine.js';
        let resolveFirstPhase = null;
        let resolveSecondPhase = null;
        const executePhaseSpy = jest.spyOn(engine, 'executePhase')
            .mockImplementationOnce(() => new Promise((resolve) => {
            resolveFirstPhase = resolve;
        }))
            .mockImplementationOnce(() => new Promise((resolve) => {
            resolveSecondPhase = resolve;
        }));
        const firstPlayPromise = engine.play([{ type: 'move', phase: 1, targets: [] }]);
        await Promise.resolve();
        await Promise.resolve();
        manager.abortPlayback();
        const secondPlayPromise = engine.play([{ type: 'move', phase: 1, targets: [] }]);
        await Promise.resolve();
        await Promise.resolve();
        expect(typeof resolveFirstPhase).toBe('function');
        expect(typeof resolveSecondPhase).toBe('function');
        expect(manager.getPlaybackActive()).toBe(true);
        resolveFirstPhase();
        await Promise.resolve();
        await Promise.resolve();
        expect(manager.getPlaybackActive()).toBe(true);
        resolveSecondPhase();
        await secondPlayPromise;
        await firstPlayPromise;
        expect(engine.isPlaying).toBe(false);
        expect(manager.getPlaybackActive()).toBe(false);
        executePhaseSpy.mockRestore();
    });
    test('cell teleport playback arms board update context to suppress expansion reveal sound', async () => {
        const dom = new jsdom_1.JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.window.__telemetry__ = { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 };
        global.window.DISABLE_ANIMATIONS = true;
        global.emitBoardUpdate = jest.fn();
        const playbackStateMock = {
            setInteractionLock: jest.fn(),
            armBoardUpdateContext: jest.fn()
        };
        jest.doMock('../ui/playback-state-manager', () => playbackStateMock);
        const board = document.getElementById('board');
        const fromCell = document.createElement('div');
        fromCell.className = 'cell has-disc';
        fromCell.dataset.row = '0';
        fromCell.dataset.col = '0';
        const toCell = document.createElement('div');
        toCell.className = 'cell';
        toCell.dataset.row = '0';
        toCell.dataset.col = '1';
        const disc = document.createElement('div');
        disc.className = 'disc black';
        fromCell.appendChild(disc);
        board.appendChild(fromCell);
        board.appendChild(toCell);
        import * as engine from '../ui/animation-engine.js';
        await engine.play([
            {
                type: 'move',
                phase: 1,
                targets: [{
                        from: { row: 0, col: 0 },
                        to: { row: 0, col: 1 },
                        cause: 'CELL_TELEPORT_WILL',
                        reason: 'teleport_move',
                        ownerAfter: 'black',
                        after: { color: 1, special: null, timer: null }
                    }]
            }
        ]);
        expect(playbackStateMock.armBoardUpdateContext).toHaveBeenCalledWith(expect.objectContaining({
            suppressBoardExpansionRevealSound: true,
            source: 'animation-engine',
            reason: 'post_playback_sync'
        }));
        dom.window.close();
    });
});
//# sourceMappingURL=ui.animation-engine.playback-state.test.js.map