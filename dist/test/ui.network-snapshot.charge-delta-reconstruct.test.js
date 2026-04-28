"use strict";
function createBaseCardState(options = {}) {
    const sourceCharge = (options.charge && typeof options.charge === 'object') ? options.charge : {};
    const sourceEvents = Array.isArray(options.chargeDeltaEvents) ? options.chargeDeltaEvents : [];
    return {
        selectedCardId: null,
        selectedCardOwnerKey: null,
        hands: { black: [], white: [] },
        charge: {
            black: Number.isFinite(Number(sourceCharge.black)) ? Number(sourceCharge.black) : 10,
            white: Number.isFinite(Number(sourceCharge.white)) ? Number(sourceCharge.white) : 10
        },
        chargeDeltaEvents: sourceEvents.map((event) => ({ ...event })),
        boardBonusByCell: {},
        boardBonusConsumedByCell: {},
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        lastUsedCardByPlayer: { black: null, white: null },
        markers: [],
        discard: [],
        turnIndex: Number.isFinite(Number(options.turnIndex)) ? Number(options.turnIndex) : 1,
        presentationEvents: [],
        _presentationEventsPersist: []
    };
}
function createSnapshot(stateVersion, options = {}) {
    const topLevelStateVersion = Number.isFinite(Number(options.topLevelStateVersion))
        ? Number(options.topLevelStateVersion)
        : stateVersion;
    const metaVersion = Number.isFinite(Number(options.metaVersion))
        ? Number(options.metaVersion)
        : stateVersion;
    return {
        stateVersion: topLevelStateVersion,
        _meta: {
            authority: 'server',
            version: metaVersion,
            projectedForSeat: Object.prototype.hasOwnProperty.call(options, 'projectedForSeat')
                ? options.projectedForSeat
                : null,
            turnStartReconciled: options.turnStartReconciled !== false
        },
        gameState: {
            currentPlayer: 1,
            turnNumber: stateVersion,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        },
        cardState: createBaseCardState(options)
    };
}
describe('network snapshot charge delta reconstruction', () => {
    beforeEach(() => {
        jest.resetModules();
        const initial = createSnapshot(10);
        global.gameState = initial.gameState;
        global.cardState = initial.cardState;
        global.__networkTransientChargeDeltaEvents = [];
        global.emitCardStateChange = jest.fn();
        global.emitGameStateChange = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.renderCardUI = jest.fn();
        global.VisualPlaybackActive = false;
        global.isProcessing = false;
        global.isCardAnimating = false;
    });
    afterEach(() => {
        delete global.gameState;
        delete global.cardState;
        delete global.__networkTransientChargeDeltaEvents;
        delete global.emitCardStateChange;
        delete global.emitGameStateChange;
        delete global.emitBoardUpdate;
        delete global.renderCardUI;
        delete global.VisualPlaybackActive;
        delete global.isProcessing;
        delete global.isCardAnimating;
    });
    function createController(stateObj) {
        import { createNetworkSnapshotController } from '../ui/network/snapshot.js';
        return (0, snapshot_js_1.createNetworkSnapshotController)({
            getState: () => stateObj,
            emitCardStateChange: global.emitCardStateChange,
            emitGameStateChange: global.emitGameStateChange,
            emitBoardUpdate: global.emitBoardUpdate,
            renderCardUI: global.renderCardUI
        });
    }
    test('reconstructs missing charge delta events for incremental snapshots', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        global.cardState.charge = { black: 5, white: 3 };
        const applied = ctrl.applySnapshot(createSnapshot(11, {
            charge: { black: 7, white: 1 },
            chargeDeltaEvents: []
        }), { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(global.cardState.chargeDeltaEvents).toEqual([]);
        expect(global.__networkTransientChargeDeltaEvents).toEqual([
            { seq: 1, player: 'black', before: 5, after: 7, delta: 2, reason: 'network_snapshot_charge_sync' },
            { seq: 2, player: 'white', before: 3, after: 1, delta: -2, reason: 'network_snapshot_charge_sync' }
        ]);
        expect(global.renderCardUI).toHaveBeenCalledTimes(1);
    });
    test('does not synthesize charge delta events for force-sync snapshots', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        global.cardState.charge = { black: 5, white: 3 };
        const applied = ctrl.applySnapshot(createSnapshot(11, {
            charge: { black: 7, white: 3 },
            chargeDeltaEvents: []
        }), { force: true });
        expect(applied).toBe(true);
        expect(global.cardState.chargeDeltaEvents).toEqual([]);
        expect(global.__networkTransientChargeDeltaEvents).toEqual([]);
    });
    test('keeps authoritative charge delta events without duplicating them', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        global.cardState.charge = { black: 5, white: 3 };
        const authoritativeEvents = [
            { seq: 7, player: 'black', before: 5, after: 8, delta: 3, reason: 'server_gain' }
        ];
        const applied = ctrl.applySnapshot(createSnapshot(11, {
            charge: { black: 8, white: 3 },
            chargeDeltaEvents: authoritativeEvents
        }), { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(global.cardState.chargeDeltaEvents).toEqual(authoritativeEvents);
        expect(global.__networkTransientChargeDeltaEvents).toEqual([]);
    });
    test('normalizes incoming snapshot charge totals before reconstructing delta events', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        global.cardState.charge = { black: 5, white: 3 };
        const snapshot = createSnapshot(11, {
            charge: { black: 7, white: 1 },
            chargeDeltaEvents: []
        });
        snapshot.cardState.charge.black = '7.9';
        snapshot.cardState.charge.white = 'oops';
        const applied = ctrl.applySnapshot(snapshot, { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(global.cardState.charge).toEqual({ black: 7, white: 0 });
        expect(global.__networkTransientChargeDeltaEvents).toEqual([
            { seq: 1, player: 'black', before: 5, after: 7, delta: 2, reason: 'network_snapshot_charge_sync' },
            { seq: 2, player: 'white', before: 3, after: 0, delta: -3, reason: 'network_snapshot_charge_sync' }
        ]);
    });
    test('normalizes authoritative charge delta events on snapshot apply', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        global.cardState.charge = { black: 5, white: 3 };
        const snapshot = createSnapshot(11, {
            charge: { black: 8, white: 4 },
            chargeDeltaEvents: []
        });
        snapshot.cardState.chargeDeltaEvents = [
            { seq: '7.9', player: -1, before: '1.2', after: '4.8', delta: '3.6', reason: 'server_gain' }
        ];
        const applied = ctrl.applySnapshot(snapshot, { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(global.cardState.chargeDeltaEvents).toEqual([
            { seq: 7, player: 'white', before: 1, after: 4, delta: 3, reason: 'server_gain' }
        ]);
        expect(global.__networkTransientChargeDeltaEvents).toEqual([]);
    });
    test('preserves normalized board popup metadata on authoritative charge events', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        global.cardState.charge = { black: 5, white: 3 };
        const snapshot = createSnapshot(11, {
            charge: { black: 8, white: 3 },
            chargeDeltaEvents: []
        });
        snapshot.cardState.chargeDeltaEvents = [
            {
                seq: '9',
                player: 'black',
                before: '5',
                after: '8',
                delta: '3',
                reason: 'placement_or_effect_gain',
                popupKind: 'board',
                anchorRow: '2.9',
                anchorCol: '4.1',
                sourceType: 'placement_flip_gain'
            }
        ];
        const applied = ctrl.applySnapshot(snapshot, { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(global.cardState.chargeDeltaEvents).toEqual([
            {
                seq: 9,
                player: 'black',
                before: 5,
                after: 8,
                delta: 3,
                reason: 'placement_or_effect_gain',
                popupKind: 'board',
                anchorRow: 2,
                anchorCol: 4,
                sourceType: 'placement_flip_gain'
            }
        ]);
    });
});
//# sourceMappingURL=ui.network-snapshot.charge-delta-reconstruct.test.js.map