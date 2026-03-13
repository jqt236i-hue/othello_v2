const PendingTargetSelector = require('../game/turn-handlers/pending-target-selector');

describe('pending-target-selector', () => {
  test('choosePendingTargetWithPolicy selects the highest score target', () => {
    const targets = [
      { row: 4, col: 4 },
      { row: 1, col: 6 },
      { row: 2, col: 3 }
    ];

    const selected = PendingTargetSelector.choosePendingTargetWithPolicy({
      targets,
      scoreTarget: (target) => {
        if (target.row === 1 && target.col === 6) return 75;
        if (target.row === 2 && target.col === 3) return 110;
        return 40;
      }
    });

    expect(selected).toEqual({ row: 2, col: 3 });
  });

  test('choosePendingTargetWithPolicy breaks score ties by row then col', () => {
    const targets = [
      { row: 5, col: 5 },
      { row: 2, col: 4 },
      { row: 2, col: 1 }
    ];

    const selected = PendingTargetSelector.choosePendingTargetWithPolicy({
      targets,
      scoreTarget: () => 50
    });

    expect(selected).toEqual({ row: 2, col: 1 });
  });

  test('choosePendingTargetWithPolicy falls back to first valid target when scorer is absent', () => {
    const targets = [
      { row: 3, col: 2 },
      { row: 1, col: 1 }
    ];

    const selected = PendingTargetSelector.choosePendingTargetWithPolicy({ targets });

    expect(selected).toEqual({ row: 3, col: 2 });
  });
});