import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as CpuDecision from '../game/cpu-decision.js';
import { buildCardDecisionContext } from '../src/engine/selfplay-runner.js';
import { applyProtectionAfterMove } from '../game/card-effects/placement.js';
import * as adapter from '../game/turn/pipeline_ui_adapter.js';

function createPrng(randomValue = 0.5) {
    return {
        shuffle: (arr) => arr,
        random: () => randomValue
    };
}

function createStates(randomValue = 0.5) {
    const cardState = CardLogic.createCardState(createPrng(randomValue));
    const gameState = {
        board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
        currentPlayer: Core.BLACK,
        turnNumber: 1,
        consecutivePasses: 0
    };
    return { cardState, gameState };
}

describe('UDR and Crystal regressions', () => {
    beforeEach(() => {
        global.BLACK = Core.BLACK;
        global.WHITE = Core.WHITE;
        global.EMPTY = Core.EMPTY;
        global.CoreLogic = Core;
        global.CardLogic = CardLogic;
        global.cardState = {
            pendingEffectByPlayer: {
                black: { type: 'FREE_PLACEMENT' },
                white: null
            }
        };
        global.getFlips = (state, row, col, player, protection, perma) => Core.getFlipsWithContext(state, row, col, player, {
            protectedStones: protection || [],
            permaProtectedStones: perma || []
        });
        global.emitLogAdded = jest.fn();
        global.isDebugLogAvailable = jest.fn(() => false);
        global.debugLog = jest.fn();
        global.getPlayerName = jest.fn((player) => player === Core.BLACK ? '黒' : '白');
        global.getPlayerKey = jest.fn((player) => player === Core.BLACK ? 'black' : 'white');
        global.getPlayerDisplayName = jest.fn((player) => player === Core.BLACK ? '黒' : '白');
        global.LOG_MESSAGES = require('../game/log-messages');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete global.BLACK;
        delete global.WHITE;
        delete global.EMPTY;
        delete global.CoreLogic;
        delete global.CardLogic;
        delete global.getFlips;
        delete global.emitLogAdded;
        delete global.isDebugLogAvailable;
        delete global.debugLog;
        delete global.getPlayerName;
        delete global.getPlayerKey;
        delete global.getPlayerDisplayName;
        delete global.LOG_MESSAGES;
        delete global.gameState;
        delete global.cardState;
    });

    test('ULTIMATE_REVERSE_DRAGON placement grants immediate charge and event in addition to board conversion', () => {
        const { cardState, gameState } = createStates();
        const events = [];
        cardState.pendingEffectByPlayer.black = {
            type: 'ULTIMATE_REVERSE_DRAGON',
            stage: null,
            cardId: 'ultimate_reverse_dragon_01'
        };

        gameState.board[3][3] = Core.WHITE;
        gameState.board[4][5] = Core.WHITE;
        gameState.board[5][4] = Core.WHITE;
        gameState.board[5][5] = Core.WHITE;
        cardState.markers.push({
            id: 901,
            kind: 'specialStone',
            row: 5,
            col: 5,
            owner: 'white',
            data: { type: 'FREEZE', remainingOwnerTurns: 2 }
        });

        TurnPipelinePhases.applyActionPhase(
            CardLogic,
            Core,
            cardState,
            gameState,
            'black',
            { type: 'place', row: 4, col: 4 },
            events,
            createPrng(),
            BoardOps
        );

        expect(gameState.board[4][4]).toBe(Core.BLACK);
        expect(gameState.board[3][3]).toBe(Core.BLACK);
        expect(gameState.board[4][5]).toBe(Core.BLACK);
        expect(gameState.board[5][4]).toBe(Core.BLACK);
        expect(gameState.board[5][5]).toBe(Core.WHITE);
        expect(cardState.charge.black).toBe(3);

        const dragonEvent = events.find((ev) => ev && ev.type === 'dragon_converted_immediate');
        expect(dragonEvent).toBeTruthy();
        expect(Array.isArray(dragonEvent.details)).toBe(true);
        expect(dragonEvent.details).toHaveLength(3);
        expect(dragonEvent.details.map((detail) => `${detail.row},${detail.col}`).sort()).toEqual([
            '3,3',
            '4,5',
            '5,4'
        ]);
    });

    test('ULTIMATE_REVERSE_DRAGON owner turn start moves first and flips around the new anchor', () => {
        const { cardState, gameState } = createStates(0);
        const events = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                gameState.board[row][col] = Core.WHITE;
            }
        }
        gameState.board[4][4] = Core.BLACK;
        gameState.board[0][0] = Core.EMPTY;
        cardState.markers.push({
            id: 902,
            kind: 'specialStone',
            row: 4,
            col: 4,
            owner: 'black',
            data: { type: 'DRAGON', remainingOwnerTurns: 5 }
        });

        TurnPipelinePhases.applyTurnStartPhase(
            CardLogic,
            Core,
            cardState,
            gameState,
            'black',
            events,
            createPrng(0),
            BoardOps
        );

        expect(gameState.board[4][4]).toBe(Core.EMPTY);
        expect(gameState.board[0][0]).toBe(Core.BLACK);
        expect(gameState.board[0][1]).toBe(Core.BLACK);
        expect(gameState.board[1][0]).toBe(Core.BLACK);
        expect(gameState.board[1][1]).toBe(Core.BLACK);
        expect(gameState.board[4][5]).toBe(Core.WHITE);
        const marker = cardState.markers.find((m) => m && m.id === 902);
        expect(marker).toBeTruthy();
        expect(marker.row).toBe(0);
        expect(marker.col).toBe(0);
        expect(marker.data.remainingOwnerTurns).toBe(4);

        const moveEvent = events.find((ev) => ev && ev.type === 'dragon_moved_start');
        expect(moveEvent).toBeTruthy();
        expect(moveEvent.details).toEqual([
            {
                from: { row: 4, col: 4 },
                to: { row: 0, col: 0 }
            }
        ]);
        const convertEvent = events.find((ev) => ev && ev.type === 'dragon_converted_start');
        expect(convertEvent).toBeTruthy();
        expect(convertEvent.details.map((detail) => `${detail.row},${detail.col}`).sort()).toEqual([
            '0,1',
            '1,0',
            '1,1'
        ]);

        const presentationEvents = CardLogic.flushPresentationEvents(cardState) || [];
        const movePresentation = presentationEvents.find((ev) => (
            ev &&
            ev.type === 'MOVE' &&
            ev.prevRow === 4 &&
            ev.prevCol === 4 &&
            ev.row === 0 &&
            ev.col === 0 &&
            ev.cause === 'ULTIMATE_REVERSE_DRAGON' &&
            ev.reason === 'ultimate_reverse_dragon_move'
        ));
        expect(movePresentation).toBeTruthy();
    });

    test('selfplay runner passes the same Crystal evaluation metrics as the in-game CPU context', () => {
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.board[3][3] = Core.BLACK;
        gameState.board[3][4] = Core.WHITE;
        gameState.board[4][3] = Core.WHITE;
        gameState.board[4][4] = Core.BLACK;

        const cardState = CardLogic.createCardState(createPrng());
        cardState.boardBonusByCell = { '2,4': 3, '5,4': 1 };
        cardState.hands.black = ['crystal_stone'];
        cardState.charge.black = 8;
        cardState.charge.white = 6;

        const legalMoves = [
            { row: 2, col: 4, flips: [{ row: 3, col: 4 }] },
            { row: 5, col: 4, flips: [{ row: 4, col: 4 }, { row: 4, col: 3 }] }
        ];

        global.gameState = gameState;
        global.cardState = cardState;

        const liveContext = CpuDecision.buildCardUseDecisionContext('black', 6, legalMoves.length, legalMoves, ['crystal_stone']);
        const selfplayContext = buildCardDecisionContext(gameState, cardState, 'black', legalMoves.length, legalMoves, ['crystal_stone']);

        expect(selfplayContext).toEqual(expect.objectContaining({
            maxLegalFlips: liveContext.maxLegalFlips,
            avgLegalFlips: liveContext.avgLegalFlips,
            maxLegalGain: liveContext.maxLegalGain,
            maxLegalBoardBonus: liveContext.maxLegalBoardBonus
        }));
    });

    test('Crystal zero-gain placement log does not imply a number-cell bonus was gained', () => {
        applyProtectionAfterMove(
            { row: 2, col: 3, player: Core.BLACK },
            { }
        );

        expect(global.emitLogAdded).not.toHaveBeenCalled();
    });

    test('Crystal zero-gain pipeline summary does not imply a number-cell bonus was gained', () => {
        const logs = adapter.mapEffectLogsFromPipeline([
            { type: 'placement_effects', effects: {} }
        ], [], 'black');

        expect(logs).toEqual([]);
    });
});
