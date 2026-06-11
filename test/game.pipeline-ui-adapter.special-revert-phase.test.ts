import * as adapter from '../game/turn/pipeline_ui_adapter.js';

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

describe('pipeline_ui_adapter duration-end revert phasing', () => {
  test('duration-end status_removed runs after the preceding effect phase', () => {
    const board = createBoard();
    board[3][4] = 1;
    const pres = [
      {
        type: 'MOVE',
        prevRow: 3,
        prevCol: 3,
        row: 3,
        col: 4,
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'ROBOT_VACUUM',
        reason: 'robot_vacuum_move_start'
      },
      {
        type: 'STATUS_REMOVED',
        row: 3,
        col: 4,
        player: 'black',
        meta: { special: 'ROBOT_VACUUM', reason: 'anchor_expired', owner: 'black' }
      }
    ];

    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board });
    const moveEv = out.find((ev) => ev && ev.type === 'move');
    const revertEv = out.find((ev) => ev && ev.type === 'status_removed');

    expect(moveEv).toBeTruthy();
    expect(revertEv).toBeTruthy();
    expect(revertEv.phase).toBeGreaterThan(moveEv.phase);
    expect(revertEv.targets[0].after).toMatchObject({ color: 1, special: null });
  });

  test('duration-end WORK_REMOVED shares the delayed revert phase after income resolves', () => {
    const board = createBoard();
    board[2][2] = 1;
    const pres = [
      { type: 'WORK_INCOME', player: 'black', row: 2, col: 2, gained: 4, incomeStep: 4 },
      {
        type: 'STATUS_REMOVED',
        row: 2,
        col: 2,
        player: 'black',
        meta: { special: 'WORK', reason: 'duration_end', owner: 'black' }
      },
      { type: 'WORK_REMOVED', player: 'black', row: 2, col: 2, reason: 'duration_end', removed: true }
    ];

    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board });
    const incomeEv = out.find((ev) => ev && ev.rawType === 'WORK_INCOME');
    const revertEv = out.find((ev) => ev && ev.type === 'status_removed' && ev.meta && ev.meta.special === 'WORK');
    const workRemovedEv = out.find((ev) => ev && ev.rawType === 'WORK_REMOVED');

    expect(incomeEv).toBeTruthy();
    expect(revertEv).toBeTruthy();
    expect(workRemovedEv).toBeTruthy();
    expect(revertEv.phase).toBeGreaterThan(incomeEv.phase);
    expect(workRemovedEv.phase).toBe(revertEv.phase);
  });

  test('special_reverted sound uses the same delayed phase as the revert event', () => {
    const board = createBoard();
    board[4][4] = 1;
    const pres = [
      {
        type: 'DESTROY',
        row: 5,
        col: 4,
        ownerBefore: 'white',
        cause: 'LIGHTNING_WILL',
        reason: 'lightning_strike_start',
        meta: { sourceRow: 4, sourceCol: 4, destroyed: true }
      },
      {
        type: 'STATUS_REMOVED',
        row: 4,
        col: 4,
        player: 'black',
        meta: { special: 'LIGHTNING', reason: 'anchor_expired', owner: 'black' }
      }
    ];

    const base = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board });
    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const destroyEv = base.find((ev) => ev && ev.type === 'destroy');
    const revertEv = base.find((ev) => ev && ev.type === 'status_removed');
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'special_reverted');

    expect(destroyEv).toBeTruthy();
    expect(revertEv).toBeTruthy();
    expect(cue).toBeTruthy();
    expect(revertEv.phase).toBeGreaterThan(destroyEv.phase);
    expect(cue.phase).toBe(revertEv.phase);
  });

  test('顕現石の duration_end は manifest_ending になり special_reverted を出さない', () => {
    const board = createBoard();
    board[1][2] = 1;
    const pres = [
      {
        type: 'STATUS_REMOVED',
        row: 1,
        col: 2,
        player: 'black',
        meta: {
          special: 'OBSERVER_WILL',
          reason: 'duration_end',
          owner: 'black',
          manifestAura: { owner: 'black' }
        }
      }
    ];

    const base = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board });
    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const manifestEnding = base.find((ev) => ev && ev.type === 'manifest_ending');
    const plainStatusRemoved = base.find((ev) => ev && ev.type === 'status_removed');
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'special_reverted');

    expect(manifestEnding).toBeTruthy();
    expect(plainStatusRemoved).toBeFalsy();
    expect(manifestEnding.targets[0].after).toMatchObject({ color: 1, special: null, owner: 'black' });
    expect(manifestEnding.targets[0].after.manifestAura).toBeUndefined();
    expect(cue).toBeFalsy();
  });
});
