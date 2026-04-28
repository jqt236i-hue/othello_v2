"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
function flushAsync() {
    return Promise.resolve()
        .then(() => Promise.resolve())
        .then(() => new Promise((resolve) => setTimeout(resolve, 0)))
        .then(() => new Promise((resolve) => setTimeout(resolve, 0)));
}
function createBasePendingCardState() {
    return {
        selectedCardId: null,
        selectedCardOwnerKey: null,
        turnIndex: 0,
        charge: { black: 10, white: 10 },
        hands: { black: ['dummy_01'], white: ['enemy_card_a', 'enemy_card_b'] },
        hasUsedCardThisTurnByPlayer: { black: true, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        pendingEffectByPlayer: { black: null, white: null },
        lastUsedCardByPlayer: { black: null, white: null },
        markers: [],
        discard: []
    };
}
describe('network hand overlay authority gate', () => {
    let dom;
    let publishSnapshotMock;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <div id="card-detail-actions"></div>
        <button id="destroy-card-btn">破壊</button>
        <button id="use-card-btn">使用</button>
        <button id="toggle-card-detail-btn">詳細</button>
        <button id="pass-btn">パス</button>
        <button id="cancel-card-btn" style="display:none;">キャンセル</button>
        <div id="use-card-reason"></div>
        <div id="board-frame"></div>
      </body></html>
    `, { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.location = dom.window.location;
        global.localStorage = dom.window.localStorage;
        global.BLACK = 1;
        global.WHITE = -1;
        global.MATCH_MODE = 'network';
        global.DEBUG_HUMAN_VS_HUMAN = false;
        window.MATCH_MODE = 'network';
        window.DEBUG_UNLIMITED_USAGE = false;
        window.DEBUG_HUMAN_VS_HUMAN = false;
        window.AUTO_MODE_ACTIVE = false;
        global.gameState = {
            currentPlayer: global.BLACK,
            turnNumber: 3,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.cardState = createBasePendingCardState();
        global.isProcessing = false;
        global.isCardAnimating = false;
        global.CardLogic = {
            getCardDef: (id) => ({ id, name: `name_${id}`, desc: `desc_${id}`, cost: 2 })
        };
        global.getCardCostTier = jest.fn(() => 'mid');
        global.Core = { getLegalMoves: () => [] };
        global.SoundEngine = {
            init: jest.fn(),
            playEffectByKey: jest.fn()
        };
        global.renderCardUI = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.ensureCurrentPlayerCanActOrPass = jest.fn();
        global.addLog = jest.fn();
        global.waitForPlaybackIdle = jest.fn(() => Promise.resolve());
        globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;
        global.ActionManager = {
            ActionManager: {
                createAction: (type, player, extra) => ({ type, player, ...(extra || {}) }),
                recordAction: jest.fn(),
                incrementTurnIndex: jest.fn()
            }
        };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = {
            runTurnWithAdapter: jest.fn(() => ({
                ok: true,
                nextCardState: global.cardState,
                nextGameState: global.gameState,
                playbackEvents: []
            }))
        };
        publishSnapshotMock = jest.fn(() => Promise.resolve({ ok: true }));
        global.NetworkMatchClient = {
            isActive: () => true,
            publishSnapshot: publishSnapshotMock
        };
        window.NetworkMatchClient = global.NetworkMatchClient;
    });
    afterEach(() => {
        try {
            if (dom && dom.window && typeof dom.window.close === 'function')
                dom.window.close();
        }
        catch (e) {
            // ignore
        }
        delete global.window;
        delete global.document;
        delete global.location;
        delete global.localStorage;
        delete global.BLACK;
        delete global.WHITE;
        delete global.MATCH_MODE;
        delete global.DEBUG_HUMAN_VS_HUMAN;
        delete global.gameState;
        delete global.cardState;
        delete global.isProcessing;
        delete global.isCardAnimating;
        delete global.CardLogic;
        delete global.getCardCostTier;
        delete global.Core;
        delete global.SoundEngine;
        delete global.renderCardUI;
        delete global.emitBoardUpdate;
        delete global.ensureCurrentPlayerCanActOrPass;
        delete global.addLog;
        delete global.waitForPlaybackIdle;
        delete global.ActionManager;
        delete global.TurnPipeline;
        delete global.TurnPipelineUIAdapter;
        delete global.NetworkMatchClient;
        delete globalThis.waitForPlaybackIdle;
    });
    test('HEAVEN_BLESSING final selection appears only after authoritative pending arrives', async () => {
        require('../cards/card-interaction.js');
        window.updateCardDetailPanel();
        expect(document.querySelectorAll('.heaven-offer-card')).toHaveLength(0);
        expect(publishSnapshotMock).not.toHaveBeenCalled();
        global.cardState.pendingEffectByPlayer.black = {
            type: 'HEAVEN_BLESSING',
            stage: 'selectTarget',
            cardId: 'heaven_01',
            offers: ['offer_1', 'offer_2']
        };
        window.updateCardDetailPanel();
        const offers = document.querySelectorAll('.heaven-offer-card');
        expect(offers).toHaveLength(2);
        offers[1].click();
        const selectBtn = document.getElementById('heaven-blessing-select-btn');
        expect(selectBtn.disabled).toBe(false);
        selectBtn.click();
        await flushAsync();
        expect(publishSnapshotMock).toHaveBeenCalledTimes(1);
        expect(publishSnapshotMock.mock.calls[0][0]).toEqual(expect.objectContaining({
            playerKey: 'black',
            actionType: 'place',
            action: expect.objectContaining({
                heavenBlessingCardId: 'offer_2'
            })
        }));
    });
    test('CONDEMN_WILL final selection appears only after authoritative pending arrives', async () => {
        require('../cards/card-interaction.js');
        window.updateCardDetailPanel();
        expect(document.querySelectorAll('.heaven-offer-card')).toHaveLength(0);
        expect(publishSnapshotMock).not.toHaveBeenCalled();
        global.cardState.pendingEffectByPlayer.black = {
            type: 'CONDEMN_WILL',
            stage: 'selectTarget',
            cardId: 'condemn_01',
            offers: [
                { handIndex: 0, cardId: 'enemy_card_a' },
                { handIndex: 1, cardId: 'enemy_card_b' }
            ]
        };
        window.updateCardDetailPanel();
        const offers = document.querySelectorAll('.heaven-offer-card');
        expect(offers).toHaveLength(2);
        offers[1].click();
        const selectBtn = document.getElementById('heaven-blessing-select-btn');
        expect(selectBtn.disabled).toBe(false);
        selectBtn.click();
        await flushAsync();
        expect(publishSnapshotMock).toHaveBeenCalledTimes(1);
        expect(publishSnapshotMock.mock.calls[0][0]).toEqual(expect.objectContaining({
            playerKey: 'black',
            actionType: 'place',
            action: expect.objectContaining({
                condemnTargetIndex: 1
            })
        }));
    });
});
//# sourceMappingURL=ui.heaven-overlay-network-authority-gate.test.js.map