const CardRegen = require('../game/logic/cards/regen');

describe('regen consume visual event', () => {
  test('removes consumed regen marker immediately and emits STATUS_REMOVED', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = -1; // flipped against black owner

    const cardState = {
      markers: [
        { kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'REGEN', regenRemaining: 1 } }
      ],
      presentationEvents: []
    };
    const gameState = { board };

    const BoardOps = {
      changeAt: (cs, gs, r, c, ownerKey) => {
        gs.board[r][c] = ownerKey === 'black' ? 1 : -1;
      },
      emitPresentationEvent: (cs, ev) => {
        cs.presentationEvents.push(ev);
      }
    };

    const removeMarkersAt = (cs, r, c, criteria) => {
      cs.markers = (cs.markers || []).filter(m => !(
        m &&
        m.kind === criteria.kind &&
        m.row === r &&
        m.col === c &&
        m.data &&
        m.data.type === criteria.type
      ));
    };

    const res = CardRegen.applyRegenAfterFlips(
      cardState,
      gameState,
      [{ row: 3, col: 3 }],
      'white',
      false,
      { BoardOps, removeMarkersAt, getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }), clearBombAt: () => {} }
    );

    expect(res.regened).toHaveLength(1);
    expect(gameState.board[3][3]).toBe(1);
    expect(cardState.markers.some(m => m && m.row === 3 && m.col === 3 && m.data && m.data.type === 'REGEN')).toBe(false);
    expect(cardState.presentationEvents.some(ev => ev && ev.type === 'STATUS_REMOVED' && ev.meta && ev.meta.reason === 'regen_consumed')).toBe(true);
  });
});
