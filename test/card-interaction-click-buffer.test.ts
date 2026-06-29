import * as ClickBuffer from '../cards/card-interaction-click-buffer';

function createDeps(rootRef: any) {
  return {
    getUiRootRef: () => rootRef,
    normalizeOwnerKey: (ownerKey: any) => (String(ownerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black')
  };
}

describe('card interaction click buffer', () => {
  test('captures same-seat board click during server-authored card use', () => {
    const rootRef: any = {};
    const deps = createDeps(rootRef);

    ClickBuffer.beginServerAuthoredCardUseClickBuffer('black', 'black', 'work_01', deps);

    expect(rootRef.__captureServerAuthoredCardUseBoardClick(2, 3, 'black')).toBe(true);
    expect(rootRef.__serverAuthoredCardUseClickBuffer.click).toEqual({
      row: 2,
      col: 3,
      playerKey: 'black'
    });
  });

  test('captures controlled-turn owner click during FATE_WILL server-authored card use', () => {
    const rootRef: any = {};
    const deps = createDeps(rootRef);

    // black controls white's turn, so turn-manager reports board clicks as white.
    ClickBuffer.beginServerAuthoredCardUseClickBuffer('black', 'white', 'gravity_01', deps);

    expect(rootRef.__captureServerAuthoredCardUseBoardClick(4, 5, 'white')).toBe(true);
    expect(rootRef.__serverAuthoredCardUseClickBuffer.click).toEqual({
      row: 4,
      col: 5,
      playerKey: 'white'
    });

    expect(ClickBuffer.consumeServerAuthoredCardUseClickBuffer('black', 'white', 'gravity_01', deps)).toEqual({
      row: 4,
      col: 5,
      playerKey: 'white'
    });
  });
});
