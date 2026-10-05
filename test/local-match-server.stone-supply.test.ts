const {
  makeInitialSnapshot,
  buildInitialDeckSnapshotOptions
} = require('../scripts/local-match-server');

describe('local match server 持ち石ルール', () => {
  test('部屋設定が未指定なら持ち石ルール有効で初期 snapshot を作る', () => {
    const options = buildInitialDeckSnapshotOptions({});
    expect(options.stoneSupplyEnabled).toBe(true);
    const snapshot = makeInitialSnapshot(1, options);
    expect(snapshot.cardState.stoneSupply).toEqual({
      initial: 30,
      remainingByPlayer: { black: 30, white: 30 }
    });
  });

  test('部屋盤面サイズから持ち石数を決める', () => {
    const snapshot = makeInitialSnapshot(1, buildInitialDeckSnapshotOptions({ roomBoardConfig: { rows: 6, cols: 6 } }));
    expect(snapshot.cardState.stoneSupply.initial).toBe(16);
  });

  test('部屋作成で OFF にした場合は持ち石ルール無効', () => {
    const options = buildInitialDeckSnapshotOptions({ stoneSupplyEnabled: false });
    expect(options.stoneSupplyEnabled).toBe(false);
    expect(makeInitialSnapshot(1, options).cardState).not.toHaveProperty('stoneSupply');
  });
});
