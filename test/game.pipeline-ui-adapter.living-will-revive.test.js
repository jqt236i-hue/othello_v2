const adapter = require('../game/turn/pipeline_ui_adapter');

function makeBoard(fill = 0) {
  return Array.from({ length: 8 }, () => Array(8).fill(fill));
}

describe('pipeline_ui_adapter living will revive playback', () => {
  test('maps flip-triggered living-will revive to a flip-back phase with matching sound timing', () => {
    const board = makeBoard(0);
    board[3][3] = 1;
    const pres = [
      {
        type: 'STATUS_REMOVED',
        row: 3,
        col: 3,
        reason: 'living_will_consumed',
        meta: { special: 'LIVING_WILL', owner: 'black', reason: 'living_will_consumed' }
      },
      {
        type: 'CHANGE',
        row: 3,
        col: 3,
        ownerBefore: 'white',
        ownerAfter: 'black',
        cause: 'LIVING_WILL',
        reason: 'living_will_restored',
        meta: {
          special: 'DRAGON',
          owner: 'black',
          timer: 5,
          livingWillRevived: true,
          revivedFromRow: 3,
          revivedFromCol: 3
        }
      }
    ];

    const playback = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board });
    const out = adapter.appendSoundEffectPlaybackEvents(playback, [], pres);
    const visuals = out.filter((ev) => ev && (ev.type === 'destroy' || ev.type === 'flip' || ev.type === 'spawn'));
    const reviveCue = out.find((ev) => (
      ev &&
      ev.type === 'sound_effect' &&
      ev.targets &&
      ev.targets[0] &&
      ev.targets[0].soundKey === 'living_will_restored'
    ));

    expect(visuals).toHaveLength(1);
    expect(visuals[0].type).toBe('flip');
    expect(visuals[0].targets[0]).toMatchObject({ r: 3, col: 3, cause: 'LIVING_WILL', reason: 'living_will_restored' });
    expect(visuals[0].targets[0].after).toMatchObject({ color: 1, special: 'DRAGON', timer: 5 });
    expect(reviveCue).toBeTruthy();
    expect(reviveCue.phase).toBe(visuals[0].phase);
  });

  test('drops living-will consume status_removed when the destroy event already handled the disappearance', () => {
    const board = makeBoard(0);
    board[2][2] = 1;
    const pres = [
      {
        type: 'DESTROY',
        row: 2,
        col: 2,
        ownerBefore: 'black',
        cause: 'SYSTEM',
        reason: 'unit_test_destroy',
        meta: { livingWillTriggered: true }
      },
      {
        type: 'STATUS_REMOVED',
        row: 2,
        col: 2,
        reason: 'living_will_consumed',
        meta: { special: 'LIVING_WILL', owner: 'black', reason: 'living_will_consumed' }
      },
      {
        type: 'SPAWN',
        row: 2,
        col: 2,
        ownerAfter: 'black',
        cause: 'LIVING_WILL',
        reason: 'living_will_restored',
        meta: {
          special: 'DRAGON',
          owner: 'black',
          timer: 4,
          livingWillRevived: true,
          revivedFromRow: 2,
          revivedFromCol: 2
        }
      }
    ];

    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board });
    const visuals = out.filter((ev) => ev && (ev.type === 'destroy' || ev.type === 'spawn' || ev.type === 'status_removed'));

    expect(visuals).toHaveLength(2);
    expect(visuals[0].type).toBe('destroy');
    expect(visuals[1].type).toBe('spawn');
    expect(visuals[1].phase).toBeGreaterThan(visuals[0].phase);
  });

  test('keeps the existing special visual when living will is applied on top of a special stone', () => {
    const board = makeBoard(0);
    board[4][4] = 1;
    const pres = [{
      type: 'STATUS_APPLIED',
      row: 4,
      col: 4,
      meta: { special: 'LIVING_WILL', owner: 'black' }
    }];
    const finalCardState = {
      markers: [
        {
          kind: 'specialStone',
          row: 4,
          col: 4,
          owner: 'black',
          data: { type: 'WORK', remainingOwnerTurns: 4 }
        },
        {
          kind: 'specialStone',
          row: 4,
          col: 4,
          owner: 'black',
          data: { type: 'LIVING_WILL', baseline: { owner: 'black', value: 1, markers: [] } }
        }
      ]
    };

    const out = adapter.mapToPlaybackEvents(pres, finalCardState, { board });
    const applied = out.find((ev) => ev && ev.type === 'status_applied');

    expect(applied).toBeTruthy();
    expect(applied.targets[0].after).toMatchObject({
      color: 1,
      special: 'WORK',
      timer: 4,
      owner: 'black',
      livingWillAura: true
    });
  });

  test('suppresses WORK removal bubble and keeps the revive-only special bubble', () => {
    const board = makeBoard(0);
    board[6][1] = -1;
    const pres = [
      {
        type: 'WORK_REMOVED',
        player: 'white',
        row: 6,
        col: 1,
        reason: 'captured_to_hand'
      },
      {
        type: 'SPAWN',
        row: 6,
        col: 1,
        ownerAfter: 'white',
        cause: 'LIVING_WILL',
        reason: 'living_will_restored',
        meta: {
          special: 'WORK',
          owner: 'white',
          livingWillRevived: true,
          revivedFromRow: 6,
          revivedFromCol: 1
        }
      },
      {
        type: 'SPECIAL_STONE_BUBBLE',
        special: 'WORK',
        scenario: 'living_will_restored',
        player: 'white',
        row: 6,
        col: 1,
        text: 'まだ稼げる！ ここから巻き返しや！',
        meta: { owner: 'white', reason: 'living_will_restored' }
      }
    ];

    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, { board });
    const bubbles = out.filter((ev) => ev && ev.type === 'observer_bubble');

    expect(bubbles).toHaveLength(1);
    expect(bubbles[0].rawType).toBe('SPECIAL_STONE_BUBBLE');
    expect(bubbles[0].targets[0]).toMatchObject({
      r: 6,
      col: 1,
      owner: 'white',
      special: 'WORK',
      scenario: 'living_will_restored',
      text: 'まだ稼げる！ ここから巻き返しや！'
    });
  });
});
