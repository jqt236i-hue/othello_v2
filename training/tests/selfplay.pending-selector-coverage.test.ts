const {
    decideAction,
    listSelfplayPendingTargetSelectorNames
} = require('../src/engine/selfplay-runner');
const Core = require('../game/logic/core.js');
const CardLogic = require('../game/logic/cards.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');
const SeededPRNG = require('../game/schema/prng.js');
const PendingSelectionRegistry = require('../../game/logic/cards-internal/pending-selection-registry');
const SelfplayBootstrapHelpers = require('../../src/engine/selfplay-bootstrap-helpers');
const deepClone = require('../../utils/deepClone');
const TurnPipelinePhases = require('../../game/turn/turn_pipeline_phases.js');

type Stone = [number, number, 1 | -1];

/** 指定盤面で黒がカードを使い、対象選択待ちになった状態を作る。 */
function useCardOnBoard(cardId: string, stones: Stone[], prepare?: (cardState: any) => void) {
    const prng = SeededPRNG.createPRNG(11);
    const cardState = CardLogic.initGame(prng, { stoneSupplyEnabled: true }).cardState;
    const gameState = Core.createGameState();
    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            gameState.board[row][col] = 0;
            cardState.stoneIdMap[row][col] = null;
        }
    }
    stones.forEach(([row, col, value], index) => {
        gameState.board[row][col] = value;
        cardState.stoneIdMap[row][col] = `s${index + 1}`;
    });
    cardState._nextStoneId = stones.length + 1;
    cardState.boardBonusByCell = {};
    cardState.hands.black = [cardId];
    cardState.charge.black = 99;
    gameState.currentPlayer = Core.BLACK;
    if (prepare) prepare(cardState);
    const used = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', {
        type: 'use_card', useCardId: cardId, actionId: 'test-use', turnIndex: 0
    }, prng, { currentStateVersion: 0 });
    expect(used.ok).toBe(true);
    return { used, prng };
}

function applySelfplayPendingDecision(used: any, prng: any) {
    const decision = decideAction(used.gameState, used.cardState, 'black', prng, {}, null);
    const applied = TurnPipeline.applyTurnSafe(used.cardState, used.gameState, 'black', {
        ...decision.action, actionId: 'test-select', turnIndex: used.nextStateVersion
    }, prng, { currentStateVersion: used.nextStateVersion, skipTurnStart: true });
    return { decision, applied };
}

describe('selfplay pending target selector coverage', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('every registry policyMethod has a selfplay selector', () => {
        const registry = PendingSelectionRegistry.getPendingSelectionRegistry();
        const required = Array.from(new Set(Object.values(registry)
            .map((entry: any) => entry && entry.action && entry.action.policyMethod)
            .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0)))
            .sort();
        const available = new Set(listSelfplayPendingTargetSelectorNames());
        expect(required.filter((name) => !available.has(name))).toEqual([]);
        expect(required).toEqual(expect.arrayContaining(['chooseReverseWillTarget', 'chooseReincarnationTarget']));
    });

    // 以前は対象選択が cancel_card になり、使用→キャンセルが上限手数まで繰り返された（seed 2000 / 2001）。
    test('REVERSE_WILL pending selects a stone that flips opponent stones', () => {
        const { used, prng } = useCardOnBoard('reverse_will_01', [
            [2, 2, 1], [2, 3, -1], [2, 4, -1], [2, 5, 1],
            [4, 1, -1], [4, 2, 1], [4, 3, -1],
            [5, 5, 1], [5, 6, -1]
        ]);
        expect(used.cardState.pendingEffectByPlayer.black.type).toBe('REVERSE_WILL');
        const { decision, applied } = applySelfplayPendingDecision(used, prng);
        expect(decision.action.type).toBe('place');
        expect([{ row: 2, col: 2 }, { row: 2, col: 5 }]).toContainEqual(decision.action.reverseWillTarget);
        expect(applied.ok).toBe(true);
        expect(applied.cardState.pendingEffectByPlayer.black).toBeNull();
        expect(applied.gameState.board[2][3]).toBe(Core.BLACK);
        expect(applied.gameState.board[2][4]).toBe(Core.BLACK);
    });

    // 以前は seed 2004 で同様のキャンセルループが起きた。
    test('REINCARNATION_WILL pending selects an own special stone', () => {
        const { used, prng } = useCardOnBoard('reincarnation_will_01', [
            [3, 3, 1], [3, 4, -1], [4, 3, -1], [4, 4, 1], [0, 0, 1]
        ], (cardState) => {
            CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'WORK' });
        });
        expect(used.cardState.pendingEffectByPlayer.black.type).toBe('REINCARNATION_WILL');
        const { decision, applied } = applySelfplayPendingDecision(used, prng);
        expect(decision.action).toEqual({ type: 'place', reincarnationTarget: { row: 0, col: 0 } });
        expect(applied.ok).toBe(true);
        expect(applied.cardState.pendingEffectByPlayer.black).toBeNull();
    });

    test('stoneSupplyEnabled option creates the rulebook 7.3 supply only when requested', () => {
        const helpers = SelfplayBootstrapHelpers.createSelfplayBootstrapHelpers({
            SeededPRNG,
            deepClone,
            TurnPipelinePhases,
            CardLogic,
            Core
        });
        const on = helpers.createInitialState(7, { stoneSupplyEnabled: true });
        const off = helpers.createInitialState(7, {});
        expect(on.cardState.stoneSupply).toEqual({ initial: 30, remainingByPlayer: { black: 30, white: 30 } });
        expect(off.cardState.stoneSupply).toBeUndefined();
        // 持ち石の有無は山札・乱数消費を変えない。
        expect(on.cardState.decks).toEqual(off.cardState.decks);
        expect(on.prng.getState()).toEqual(off.prng.getState());
    });
});
