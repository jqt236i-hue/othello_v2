"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-onnx-runtime.js'));
const SharedBoardUtils = require(path.resolve(__dirname, '..', 'shared', 'shared-board-utils.js'));
function createRightExpansionBoard(cells) {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    SharedBoardUtils.attachBoardShape(board, {
        boardExpansion: {
            active: true,
            side: 'right',
            row: Array.isArray(cells) && cells.length ? cells[0].row : 0,
            owner: 0,
            usedByPlayer: { black: false, white: false },
            cells: (cells || []).map((cell) => ({
                side: 'right',
                row: cell.row,
                col: 8,
                owner: cell.owner
            }))
        },
        cardState: null
    });
    return board;
}
describe('policy-onnx-runtime', () => {
    beforeEach(() => {
        global.ort = {
            Tensor: function Tensor(type, data, dims) {
                this.type = type;
                this.data = data;
                this.dims = dims;
            }
        };
        runtime.clearModel();
        runtime.configure({
            enabled: true,
            minLevel: 6,
            sourceUrl: 'data/models/policy-net.onnx',
            metaUrl: 'data/models/policy-net.onnx.meta.json'
        });
    });
    afterEach(() => {
        delete global.ort;
    });
    test('chooseMove returns null without loaded model', async () => {
        const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
            playerKey: 'white',
            level: 6,
            board: [[0]],
            legalMovesCount: 1
        });
        expect(selected).toBeNull();
    });
    test('chooseMove returns null on non-8x8 board even when model is loaded', async () => {
        const scores = new Float32Array(64);
        scores[0] = 5.0;
        runtime.__setLoadedForTest({
            run: jest.fn(async () => ({
                logits: { data: scores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            outputName: 'logits',
            inputDim: 70
        });
        const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
            playerKey: 'white',
            level: 6,
            board: Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => 0)),
            legalMovesCount: 1
        });
        expect(selected).toBeNull();
    });
    test('chooseMove selects move with highest logit among legal candidates', async () => {
        const scores = new Float32Array(64);
        scores[0] = 0.1; // (0,0)
        scores[9] = 3.2; // (1,1)
        scores[18] = 2.4; // (2,2)
        const session = {
            run: jest.fn(async () => ({
                logits: { data: scores }
            }))
        };
        runtime.__setLoadedForTest(session, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            outputName: 'logits',
            inputDim: 70
        });
        const candidates = [
            { row: 0, col: 0, flips: [] },
            { row: 1, col: 1, flips: [] },
            { row: 2, col: 2, flips: [] }
        ];
        const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
        const selected = await runtime.chooseMove(candidates, {
            playerKey: 'white',
            level: 6,
            board,
            legalMovesCount: candidates.length,
            deckCount: 30,
            ownDeckCount: 5,
            initialDeckSize: 30
        });
        expect(selected).toEqual(candidates[1]);
        const obs = session.run.mock.calls[0][0].obs.data;
        expect(obs[68]).toBeCloseTo(30 / 60, 6);
    });
    test('chooseMove uses own-deck ratio when model metadata requests it', async () => {
        const scores = new Float32Array(64);
        scores[0] = 4.5;
        const session = {
            run: jest.fn(async () => ({
                logits: { data: scores }
            }))
        };
        runtime.__setLoadedForTest(session, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            outputName: 'logits',
            inputDim: 70,
            deckCountFeature: 'own_deck_ratio_v1'
        });
        const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
            playerKey: 'white',
            level: 6,
            board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
            legalMovesCount: 1,
            deckCount: 30,
            ownDeckCount: 5,
            initialDeckSize: 30
        });
        expect(selected).toEqual({ row: 0, col: 0, flips: [] });
        const obs = session.run.mock.calls[0][0].obs.data;
        expect(obs[68]).toBeCloseTo(5 / 30, 6);
    });
    test('chooseMove supports padded 10x10 expansion indexes for new models', async () => {
        const scores = new Float32Array(100);
        scores[SharedBoardUtils.toPaddedBoardIndex(0, 0)] = 0.5;
        scores[SharedBoardUtils.toPaddedBoardIndex(0, 8)] = 4.4;
        const session = {
            run: jest.fn(async () => ({
                logits: { data: scores }
            }))
        };
        runtime.__setLoadedForTest(session, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            outputName: 'logits',
            inputDim: 116,
            baseInputDim: 116,
            outputDim: 100,
            paddedBoardMinCoord: -1,
            paddedBoardMaxCoord: 8,
            paddedBoardSize: 10,
            actionSpace: 'place_padded10+card_choice'
        });
        const board = createRightExpansionBoard([{ row: 0, owner: 0 }]);
        board[0][0] = -1;
        const candidates = [
            { row: 0, col: 0, flips: [] },
            { row: 0, col: 8, flips: [] }
        ];
        const selected = await runtime.chooseMove(candidates, {
            playerKey: 'white',
            level: 6,
            board,
            legalMovesCount: candidates.length
        });
        expect(selected).toEqual(candidates[1]);
        const obs = session.run.mock.calls[0][0].obs.data;
        expect(obs.length).toBe(116);
        expect(obs[0]).toBe(0);
        expect(obs[SharedBoardUtils.toPaddedBoardIndex(0, 0)]).toBe(1);
    });
    test('chooseMove returns null on custom boards when using legacy standard-8x8 model metadata', async () => {
        const session = {
            run: jest.fn(async () => ({
                logits: { data: new Float32Array(64) }
            }))
        };
        runtime.__setLoadedForTest(session, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            outputName: 'logits',
            inputDim: 70
        });
        const selected = await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
            playerKey: 'white',
            level: 6,
            board: Array.from({ length: 7 }, () => Array.from({ length: 9 }, () => 0)),
            legalMovesCount: 1
        });
        expect(selected).toBeNull();
        expect(session.run).not.toHaveBeenCalled();
    });
    test('chooseCard selects highest score among usable cards', async () => {
        const placeScores = new Float32Array(64);
        const cardScores = new Float32Array(3);
        cardScores[0] = 0.3; // card_a
        cardScores[1] = 2.7; // card_b
        cardScores[2] = 1.1; // card_c
        runtime.__setLoadedForTest({
            run: jest.fn(async () => ({
                place_logits: { data: placeScores },
                card_logits: { data: cardScores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            placeOutputName: 'place_logits',
            cardOutputName: 'card_logits',
            inputDim: 76,
            cardActionIds: ['card_a', 'card_b', 'card_c']
        });
        const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
        const selected = await runtime.chooseCard(['card_a', 'card_c', 'card_b'], {
            playerKey: 'white',
            level: 6,
            board,
            legalMovesCount: 4,
            handCardIds: ['card_a', 'card_b'],
            usableCardIds: ['card_a', 'card_c', 'card_b']
        });
        expect(selected).toBe('card_b');
    });
    test('chooseCard returns null when no-card score is highest', async () => {
        const placeScores = new Float32Array(64);
        const cardScores = new Float32Array(4);
        cardScores[0] = 3.5; // __no_card__
        cardScores[1] = 0.9; // card_a
        cardScores[2] = 1.8; // card_b
        cardScores[3] = 1.2; // card_c
        runtime.__setLoadedForTest({
            run: jest.fn(async () => ({
                place_logits: { data: placeScores },
                card_logits: { data: cardScores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            placeOutputName: 'place_logits',
            cardOutputName: 'card_logits',
            inputDim: 78,
            cardActionIds: ['__no_card__', 'card_a', 'card_b', 'card_c']
        });
        const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
        const selected = await runtime.chooseCard(['card_a', 'card_b', 'card_c'], {
            playerKey: 'white',
            level: 6,
            board,
            legalMovesCount: 4,
            handCardIds: ['card_a', 'card_b'],
            usableCardIds: ['card_a', 'card_b', 'card_c']
        });
        expect(selected).toBeNull();
    });
    test('chooseCard prefers hold when card/no-card confidence gap is too small in stable corner state', async () => {
        const placeScores = new Float32Array(64);
        const cardScores = new Float32Array(4);
        cardScores[0] = 2.0; // __no_card__
        cardScores[1] = 2.05; // card_a (small edge)
        cardScores[2] = 1.9; // card_b
        cardScores[3] = 1.7; // card_c
        runtime.__setLoadedForTest({
            run: jest.fn(async () => ({
                place_logits: { data: placeScores },
                card_logits: { data: cardScores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            placeOutputName: 'place_logits',
            cardOutputName: 'card_logits',
            inputDim: 78,
            cardActionIds: ['__no_card__', 'card_a', 'card_b', 'card_c']
        });
        const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
        board[0][0] = -1;
        const selected = await runtime.chooseCard(['card_a', 'card_b', 'card_c'], {
            playerKey: 'white',
            level: 6,
            board,
            legalMovesCount: 4,
            hasCornerMoveNow: 1,
            handCardIds: ['card_a', 'card_b'],
            usableCardIds: ['card_a', 'card_b', 'card_c']
        });
        expect(selected).toBeNull();
    });
    test('chooseCard allows small confidence edge in emergency with saturated hand', async () => {
        const placeScores = new Float32Array(64);
        const cardScores = new Float32Array(4);
        cardScores[0] = 2.0; // __no_card__
        cardScores[1] = 2.05; // card_a (small edge)
        cardScores[2] = 1.9; // card_b
        cardScores[3] = 1.7; // card_c
        runtime.__setLoadedForTest({
            run: jest.fn(async () => ({
                place_logits: { data: placeScores },
                card_logits: { data: cardScores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            placeOutputName: 'place_logits',
            cardOutputName: 'card_logits',
            inputDim: 78,
            cardActionIds: ['__no_card__', 'card_a', 'card_b', 'card_c']
        });
        const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
        const selected = await runtime.chooseCard(['card_a', 'card_b', 'card_c'], {
            playerKey: 'white',
            level: 6,
            board,
            legalMovesCount: 4,
            hasCornerMoveNow: 0,
            cornerEmergency: 1,
            handCardIds: ['x1', 'x2', 'x3', 'x4', 'card_a'],
            usableCardIds: ['card_a', 'card_b', 'card_c']
        });
        expect(selected).toBe('card_a');
    });
    test('chooseCard can use specialist card model when available', async () => {
        const placeScores = new Float32Array(64);
        const baseCardScores = new Float32Array(4);
        baseCardScores[0] = 3.0; // __no_card__
        baseCardScores[1] = 0.5; // card_a
        baseCardScores[2] = 0.6; // card_b
        baseCardScores[3] = 0.4; // card_c
        const specialistCardScores = new Float32Array(4);
        specialistCardScores[0] = 0.2; // __no_card__
        specialistCardScores[1] = 0.8; // card_a
        specialistCardScores[2] = 2.3; // card_b
        specialistCardScores[3] = 0.7; // card_c
        runtime.__setLoadedForTest({
            run: jest.fn(async () => ({
                place_logits: { data: placeScores },
                card_logits: { data: baseCardScores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            placeOutputName: 'place_logits',
            cardOutputName: 'card_logits',
            inputDim: 78,
            cardActionIds: ['__no_card__', 'card_a', 'card_b', 'card_c']
        });
        runtime.__setCardModelForTest({
            run: jest.fn(async () => ({
                card_logits: { data: specialistCardScores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            cardOutputName: 'card_logits',
            inputDim: 78,
            cardActionIds: ['__no_card__', 'card_a', 'card_b', 'card_c']
        });
        const selected = await runtime.chooseCard(['card_a', 'card_b', 'card_c'], {
            playerKey: 'white',
            level: 6,
            board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
            legalMovesCount: 3,
            handCardIds: ['card_a', 'card_b', 'card_c'],
            usableCardIds: ['card_a', 'card_b', 'card_c']
        });
        expect(selected).toBe('card_b');
    });
    test('choosePendingTarget selects highest score among legal targets', async () => {
        const targetScores = new Float32Array(64);
        targetScores[8] = 0.4; // (1,0)
        targetScores[27] = 2.9; // (3,3)
        targetScores[63] = 1.1; // (7,7)
        runtime.__setTargetModelForTest({
            run: jest.fn(async () => ({
                target_logits: { data: targetScores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            targetOutputName: 'target_logits',
            inputDim: 105,
            pendingTypes: ['DESTROY_ONE_STONE', 'TELEPORT_WILL']
        });
        const targets = [
            { row: 1, col: 0 },
            { row: 3, col: 3 },
            { row: 7, col: 7 }
        ];
        const selected = await runtime.choosePendingTarget(targets, {
            playerKey: 'white',
            level: 6,
            pendingType: 'TELEPORT_WILL',
            board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
            legalMovesCount: 3
        });
        expect(selected).toEqual(targets[1]);
        expect(runtime.getStatus().targetModelLoaded).toBe(true);
    });
    test('choosePendingTarget supports padded expansion targets for new models', async () => {
        const targetScores = new Float32Array(100);
        targetScores[SharedBoardUtils.toPaddedBoardIndex(1, 0)] = 0.4;
        targetScores[SharedBoardUtils.toPaddedBoardIndex(0, 8)] = 3.6;
        runtime.__setTargetModelForTest({
            run: jest.fn(async () => ({
                target_logits: { data: targetScores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            targetOutputName: 'target_logits',
            inputDim: 118,
            baseInputDim: 116,
            outputDim: 100,
            paddedBoardMinCoord: -1,
            paddedBoardMaxCoord: 8,
            paddedBoardSize: 10,
            actionSpace: 'pending_target_padded10',
            pendingTypes: ['DESTROY_ONE_STONE', 'TELEPORT_WILL']
        });
        const board = createRightExpansionBoard([{ row: 0, owner: 0 }]);
        const targets = [
            { row: 1, col: 0 },
            { row: 0, col: 8 }
        ];
        const selected = await runtime.choosePendingTarget(targets, {
            playerKey: 'white',
            level: 6,
            pendingType: 'TELEPORT_WILL',
            board,
            legalMovesCount: 2
        });
        expect(selected).toEqual(targets[1]);
    });
    test('evaluatePosition returns scalar value from value model', async () => {
        runtime.__setValueModelForTest({
            run: jest.fn(async () => ({
                value: { data: new Float32Array([0.625]) }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            valueOutputName: 'value',
            inputDim: 80
        });
        const value = await runtime.evaluatePosition({
            playerKey: 'white',
            level: 6,
            board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
            legalMovesCount: 4
        });
        expect(value).toBeCloseTo(0.625, 6);
        expect(runtime.getStatus().valueModelLoaded).toBe(true);
    });
    test('evaluatePosition accepts padded board features for new value models', async () => {
        const session = {
            run: jest.fn(async () => ({
                value: { data: new Float32Array([0.25]) }
            }))
        };
        runtime.__setValueModelForTest(session, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            valueOutputName: 'value',
            inputDim: 116,
            baseInputDim: 116,
            paddedBoardMinCoord: -1,
            paddedBoardMaxCoord: 8,
            paddedBoardSize: 10,
            actionSpace: 'position_value'
        });
        const board = createRightExpansionBoard([{ row: 0, owner: 0 }]);
        board[0][0] = -1;
        const value = await runtime.evaluatePosition({
            playerKey: 'white',
            level: 6,
            board,
            legalMovesCount: 2
        });
        expect(value).toBeCloseTo(0.25, 6);
        expect(session.run.mock.calls[0][0].obs.data.length).toBe(116);
    });
    test('getStatus exposes latency summaries after ONNX calls', async () => {
        const scores = new Float32Array(64);
        scores[0] = 1.25;
        runtime.__setLoadedForTest({
            run: jest.fn(async () => ({
                logits: { data: scores }
            }))
        }, {
            schemaVersion: runtime.MODEL_SCHEMA_VERSION,
            inputName: 'obs',
            outputName: 'logits',
            inputDim: 70
        });
        await runtime.chooseMove([{ row: 0, col: 0, flips: [] }], {
            playerKey: 'white',
            level: 6,
            board: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0)),
            legalMovesCount: 1
        });
        const status = runtime.getStatus();
        expect(status.latency).toBeTruthy();
        expect(status.latency.overall.count).toBe(1);
        expect(status.latency.perOperation.chooseMove.count).toBe(1);
        expect(status.latency.perOperation.chooseMove.totalMs).toBeGreaterThanOrEqual(0);
    });
});
//# sourceMappingURL=game.cpu-policy-onnx-runtime.test.js.map