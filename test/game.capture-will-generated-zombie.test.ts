const Cards = require('../game/logic/cards');
const Zombie = require('../game/logic/cards/zombie_will');
const CaptureSource = require('../game/logic/cards-internal/capture-source');

function fixture(regenRemaining = 1) {
    const state = Cards.createCardState({ shuffle: a => a, random: () => 0.5 }, { plainReversi: true });
    const game = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: -1, turnNumber: 92, consecutivePasses: 0 };
    game.board[4][6] = 1;
    game.board[3][3] = -1;
    const data = { ...Zombie.createZombieMarkerData('black'), regenRemaining };
    Cards.addMarker(state, 'specialStone', 4, 6, 'black', data);
    Cards.addCardToHand(state, 'white', 'capture_01');
    state.charge.white = 99;
    return { state, game };
}

describe('capture generated zombie stones without source metadata', () => {
    test.each([0, 1])('capturing an infected zombie with %i revivals restores its source card and clears selection', (remaining) => {
        const { state, game } = fixture(remaining);
        expect(Cards.getCaptureWillTargets(state, game, 'white')).toEqual([{ row: 4, col: 6 }]);
        expect(CaptureSource.resolveCaptureSourceInfo(state.markers[0])).toMatchObject({
            sourceCardId: 'zombie_will_01', sourceCardType: 'ZOMBIE_WILL'
        });
        expect(Cards.applyCardUsage(state, game, 'white', 'capture_01')).toBe(true);
        expect(Cards.applyCaptureWill(state, game, 'white', 4, 6)).toMatchObject({
            applied: true, capturedCardId: 'zombie_will_01'
        });
        expect(state.pendingEffectByPlayer.white).toBeNull();
        expect(state.hands.white).toEqual(['zombie_will_01']);
        expect(game.board[4][6]).toBe(0);
        expect(state.markers.some(m => m.row === 4 && m.col === 6)).toBe(false);
    });

    test('a marker whose source cannot be restored is not offered or usable as the only target', () => {
        const { state, game } = fixture();
        state.markers[0].data.sourceType = '__missing_source_card__';
        expect(CaptureSource.resolveCaptureSourceInfo(state.markers[0])).toBeNull();
        expect(Cards.getCaptureWillTargets(state, game, 'white')).toEqual([]);
        expect(Cards.applyCardUsage(state, game, 'white', 'capture_01')).toBe(false);
        expect(state.hands.white).toEqual(['capture_01']);
    });
});

export {};
