const adapter = require('../game/turn/pipeline_ui_adapter');
const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');

describe('pipeline_ui_adapter sound cue mapping', () => {
  test('trap_selected から trap_select の sound_effect を追加する', () => {
    const out = adapter.appendSoundEffectPlaybackEvents([], [{ type: 'trap_selected', applied: true }]);

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('sound_effect');
    expect(out[0].targets[0].soundKey).toBe('trap_select');
  });

  test('time_bomb_selected 成功時は TIME_BOMB の status_applied phase で trap_select を再生する', () => {
    const base = [{
      type: 'status_applied',
      phase: 8,
      targets: [{ r: 2, col: 2, after: { color: 1, special: 'TIME_BOMB', timer: 3 } }],
      meta: { special: 'TIME_BOMB', timer: 3 }
    }];
    const raw = [{ type: 'time_bomb_selected', applied: true, target: { row: 2, col: 2 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'trap_select');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(8);
  });

  test('time_bomb_selected が不成立なら trap_select を再生しない', () => {
    const base = [{
      type: 'status_applied',
      phase: 5,
      targets: [{ r: 4, col: 4, after: { color: 1, special: 'TIME_BOMB', timer: 3 } }],
      meta: { special: 'TIME_BOMB', timer: 3 }
    }];
    const raw = [{ type: 'time_bomb_selected', applied: false, target: { row: 4, col: 4 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'trap_select');

    expect(cue).toBeUndefined();
  });

  test('guard_selected 成功時は GUARD の status_applied phase で guard_select を再生する', () => {
    const base = [{
      type: 'status_applied',
      phase: 9,
      targets: [{ r: 3, col: 3, after: { color: 1, special: 'GUARD', timer: 3 } }],
      meta: { special: 'GUARD', timer: 3 }
    }];
    const raw = [{ type: 'guard_selected', applied: true, target: { row: 3, col: 3 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'guard_select');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(9);
  });

  test('guard_selected が不成立なら guard_select を再生しない', () => {
    const base = [{
      type: 'status_applied',
      phase: 5,
      targets: [{ r: 2, col: 4, after: { color: 1, special: 'GUARD', timer: 3 } }],
      meta: { special: 'GUARD', timer: 3 }
    }];
    const raw = [{ type: 'guard_selected', applied: false, target: { row: 2, col: 4 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'guard_select');

    expect(cue).toBeUndefined();
  });

  test('freeze_selected 成功時は FREEZE の status_applied phase で freeze_select を再生する', () => {
    const base = [{
      type: 'status_applied',
      phase: 11,
      targets: [{ r: 4, col: 6, after: { special: 'FREEZE', timer: 5 } }],
      meta: { special: 'FREEZE', timer: 5 }
    }];
    const raw = [{ type: 'freeze_selected', applied: true, target: { row: 4, col: 6 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'freeze_select');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(11);
  });

  test('freeze_selected が不成立なら freeze_select を再生しない', () => {
    const base = [{
      type: 'status_applied',
      phase: 6,
      targets: [{ r: 1, col: 7, after: { special: 'FREEZE', timer: 5 } }],
      meta: { special: 'FREEZE', timer: 5 }
    }];
    const raw = [{ type: 'freeze_selected', applied: false, target: { row: 1, col: 7 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'freeze_select');

    expect(cue).toBeUndefined();
  });

  test('trap_expired は trap_misfire を再生し special_expired/stone_destroy は追加しない', () => {
    const base = [{
      type: 'destroy',
      phase: 3,
      targets: [{ r: 2, col: 2, cause: 'TRAP_WILL', reason: 'trap_expired' }]
    }];
    const raw = [{ type: 'trap_expired', details: [{ row: 2, col: 2 }] }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const expiredCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'special_expired');
    const misfireCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'trap_misfire');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(misfireCue).toBeTruthy();
    expect(misfireCue.phase).toBe(3);
    expect(expiredCue).toBeUndefined();
    expect(stoneCue).toBeUndefined();
  });

  test('trap_disarmed は trap_misfire を再生し special_expired/stone_destroy は追加しない', () => {
    const base = [{
      type: 'destroy',
      phase: 4,
      targets: [{ r: 3, col: 3, cause: 'TRAP_WILL', reason: 'trap_disarmed' }]
    }];
    const raw = [{ type: 'trap_disarmed', details: [{ row: 3, col: 3 }] }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const misfireCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'trap_misfire');
    const expiredCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'special_expired');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(misfireCue).toBeTruthy();
    expect(misfireCue.phase).toBe(4);
    expect(expiredCue).toBeUndefined();
    expect(stoneCue).toBeUndefined();
  });

  test('trap_triggered は発動セルの flip phase で専用音を再生する', () => {
    const base = [{
      type: 'flip',
      phase: 6,
      targets: [{ r: 4, col: 4, ownerBefore: 'black', ownerAfter: 'white', cause: 'SYSTEM', reason: 'standard_flip' }]
    }];
    const raw = [{
      type: 'trap_triggered',
      details: [{ row: 4, col: 4, owner: 'black', victim: 'white', stolenCharge: 12, destroyedHandCount: 3 }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'trap_triggered');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(6);
  });

  test('trap_triggered で発動セルの flip が無い場合は fallback phase で再生する', () => {
    const base = [{
      type: 'flip',
      phase: 2,
      targets: [{ r: 1, col: 1, ownerBefore: 'black', ownerAfter: 'white', cause: 'SYSTEM', reason: 'standard_flip' }]
    }];
    const raw = [{
      type: 'trap_triggered',
      details: [{ row: 5, col: 5, owner: 'white', victim: 'black', stolenCharge: 8, destroyedHandCount: 2 }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'trap_triggered');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(3);
  });

  test('clone_selected の sound_effect を clone move の phase に合わせる', () => {
    const base = [{
      type: 'move',
      phase: 5,
      targets: [{ from: { r: 1, col: 1 }, to: { r: 2, col: 2 }, clone: true, cause: 'CLONE_WILL' }]
    }];
    const raw = [{ type: 'clone_selected', applied: true, details: [{ row: 2, col: 2 }] }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'clone_spawn');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(5);
  });

  test('split_selected の sound_effect も split move の phase に合わせる', () => {
    const base = [{
      type: 'move',
      phase: 6,
      targets: [{ from: { r: 2, col: 2 }, to: { r: 2, col: 3 }, clone: true, cause: 'SPLIT_WILL' }]
    }];
    const raw = [{ type: 'split_selected', applied: true, details: [{ row: 2, col: 3 }] }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'clone_spawn');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(6);
  });

  test('strong_wind_selected 成功時は strong wind move の phase で再生する', () => {
    const base = [{
      type: 'move',
      phase: 7,
      targets: [{ from: { r: 3, col: 3 }, to: { r: 3, col: 6 }, cause: 'STRONG_WIND_WILL', reason: 'strong_wind_move' }]
    }];
    const raw = [{ type: 'strong_wind_selected', applied: true, from: { row: 3, col: 3 }, to: { row: 3, col: 6 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'strong_wind_move');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(7);
  });

  test('strong_wind_selected が不成立なら strong_wind_move を再生しない', () => {
    const base = [{
      type: 'move',
      phase: 4,
      targets: [{ from: { r: 2, col: 2 }, to: { r: 2, col: 5 }, cause: 'STRONG_WIND_WILL', reason: 'strong_wind_move' }]
    }];
    const raw = [{ type: 'strong_wind_selected', applied: false, from: null, to: null }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'strong_wind_move');

    expect(cue).toBeUndefined();
  });

  test('teleport_selected 成功時は teleport move の phase で teleport_select を再生する', () => {
    const base = [{
      type: 'move',
      phase: 10,
      targets: [{ from: { r: 4, col: 4 }, to: { r: 2, col: 2 }, cause: 'TELEPORT_WILL', reason: 'teleport_move' }]
    }];
    const raw = [{ type: 'teleport_selected', applied: true, from: { row: 4, col: 4 }, to: { row: 2, col: 2 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'teleport_select');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(10);
  });

  test('teleport_selected が不成立なら teleport_select を再生しない', () => {
    const base = [{
      type: 'move',
      phase: 4,
      targets: [{ from: { r: 1, col: 1 }, to: { r: 5, col: 5 }, cause: 'TELEPORT_WILL', reason: 'teleport_move' }]
    }];
    const raw = [{ type: 'teleport_selected', applied: false, from: { row: 1, col: 1 }, to: { row: 5, col: 5 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'teleport_select');

    expect(cue).toBeUndefined();
  });

  test('マステレポート成功時も teleport move の phase で teleport_select を再生する', () => {
    const base = [{
      type: 'move',
      phase: 11,
      targets: [{ from: { r: 4, col: 4 }, to: { r: 2, col: 8 }, cause: 'CELL_TELEPORT_WILL', reason: 'teleport_move' }]
    }];
    const raw = [{
      type: 'teleport_selected',
      applied: true,
      cardType: 'CELL_TELEPORT_WILL',
      from: { row: 4, col: 4 },
      to: { row: 2, col: 8 },
      createdDestination: true
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'teleport_select');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(11);
  });

  test('super_buoyancy_selected 成功時は super move の phase で super_buoyancy_move を再生する', () => {
    const base = [{
      type: 'move',
      phase: 12,
      targets: [{ from: { r: 5, col: 3 }, to: { r: 1, col: 3 }, cause: 'SUPER_BUOYANCY_WILL', reason: 'super_buoyancy_move' }]
    }];
    const raw = [{ type: 'super_buoyancy_selected', applied: true, from: { row: 5, col: 3 }, to: { row: 1, col: 3 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'super_buoyancy_move');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(12);
  });

  test('super_gravity_selected 成功時は super move の phase で super_gravity_move を再生する', () => {
    const base = [{
      type: 'move',
      phase: 13,
      targets: [{ from: { r: 2, col: 4 }, to: { r: 6, col: 4 }, cause: 'SUPER_GRAVITY_WILL', reason: 'super_gravity_move' }]
    }];
    const raw = [{ type: 'super_gravity_selected', applied: true, from: { row: 2, col: 4 }, to: { row: 6, col: 4 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'super_gravity_move');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(13);
  });

  test('tempt_selected 成功時は tempt_applied の flip phase で誘惑音と card_effect_flip を再生する', () => {
    const base = [{
      type: 'flip',
      phase: 8,
      targets: [{ r: 4, col: 5, ownerBefore: 'white', ownerAfter: 'black', cause: 'TEMPT_WILL', reason: 'tempt_applied' }]
    }];
    const raw = [{ type: 'tempt_selected', applied: true, target: { row: 4, col: 5 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const temptCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'tempt_select');
    const flipCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_effect_flip');

    expect(temptCue).toBeTruthy();
    expect(temptCue.phase).toBe(8);
    expect(flipCue).toBeTruthy();
    expect(flipCue.phase).toBe(8);
  });

  test('tempt_selected が不成立なら誘惑音も card_effect_flip も再生しない', () => {
    const base = [{
      type: 'flip',
      phase: 4,
      targets: [{ r: 2, col: 2, ownerBefore: 'white', ownerAfter: 'black', cause: 'TEMPT_WILL', reason: 'tempt_applied' }]
    }];
    const raw = [{ type: 'tempt_selected', applied: false, target: { row: 2, col: 2 } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const temptCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'tempt_select');
    const flipCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_effect_flip');

    expect(temptCue).toBeUndefined();
    expect(flipCue).toBeUndefined();
  });

  test('dragon_converted_start は DRAGON 反転の flip phase で card_effect_flip を再生する', () => {
    const base = [{
      type: 'flip',
      phase: 12,
      targets: [{ r: 4, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'DRAGON', reason: 'dragon_convert' }]
    }];
    const raw = [{ type: 'dragon_converted_start', details: [{ row: 4, col: 4, ownerBefore: 'white', ownerAfter: 'black' }] }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_effect_flip');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(12);
  });

  test('dragon_converted 系で対応 flip が無い場合は fallback phase で card_effect_flip を再生する', () => {
    const base = [{
      type: 'log',
      phase: 4,
      rawType: 'WORK_INCOME',
      message: 'WORK_INCOME black +4'
    }];
    const raw = [
      { type: 'dragon_converted_start', details: [{ row: 1, col: 1 }] },
      { type: 'dragon_converted_immediate', details: [{ row: 2, col: 2 }] }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cues = out
      .filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_effect_flip')
      .map((ev) => ev.phase);

    expect(cues).toEqual([5, 6]);
  });

  test('chain_flipped は各連鎖リンクの flip phase で card_effect_flip を再生する', () => {
    const base = [
      {
        type: 'flip',
        phase: 7,
        targets: [{ r: 4, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL', reason: 'chain_flip', meta: { chainLink: 1 } }]
      },
      {
        type: 'flip',
        phase: 8,
        targets: [{ r: 5, col: 5, ownerBefore: 'white', ownerAfter: 'black', cause: 'CHAIN_WILL', reason: 'chain_flip', meta: { chainLink: 2 } }]
      }
    ];
    const raw = [{ type: 'chain_flipped', details: [{ row: 4, col: 4 }, { row: 5, col: 5 }] }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cues = out
      .filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_effect_flip')
      .map((ev) => ev.phase);

    expect(cues).toEqual([7, 8]);
  });

  test('chain_flipped で対応 flip が無い場合は fallback phase で card_effect_flip を再生する', () => {
    const base = [{
      type: 'log',
      phase: 3,
      rawType: 'TURN_INFO',
      message: 'TURN_INFO black'
    }];
    const raw = [{ type: 'chain_flipped', details: [{ row: 2, col: 2 }] }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_effect_flip');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(4);
  });

  test('card effect driven flip phases は taboo/regen/swap/breeding/hyperactive 系でも card_effect_flip を再生する', () => {
    const base = [
      {
        type: 'flip',
        phase: 5,
        targets: [{ r: 1, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'TABOO_REVERSE_WILL', reason: 'taboo_reverse_flip' }]
      },
      {
        type: 'flip',
        phase: 6,
        targets: [{ r: 2, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'REGEN', reason: 'regen_triggered' }]
      },
      {
        type: 'flip',
        phase: 7,
        targets: [{ r: 3, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'REGEN', reason: 'regen_capture_flip' }]
      },
      {
        type: 'flip',
        phase: 8,
        targets: [{ r: 4, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'SWAP', reason: 'swap_with_enemy_capture' }]
      },
      {
        type: 'flip',
        phase: 9,
        targets: [{ r: 5, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'BREEDING', reason: 'breeding_flip' }]
      },
      {
        type: 'flip',
        phase: 10,
        targets: [{ r: 6, col: 4, ownerBefore: 'white', ownerAfter: 'black', cause: 'HYPERACTIVE', reason: 'hyperactive_flip' }]
      },
      {
        type: 'flip',
        phase: 11,
        targets: [{ r: 6, col: 5, ownerBefore: 'white', ownerAfter: 'black', cause: 'ULTIMATE_HYPERACTIVE_GOD', reason: 'ultimate_hyperactive_flip' }]
      },
      {
        type: 'flip',
        phase: 12,
        targets: [{ r: 6, col: 6, ownerBefore: 'white', ownerAfter: 'black', cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_flip' }]
      }
    ];
    const raw = [
      { type: 'taboo_reverse_flipped', details: [{ row: 1, col: 4 }] },
      { type: 'regen_triggered', details: [{ row: 2, col: 4 }] },
      { type: 'regen_capture_flipped', details: [{ row: 3, col: 4 }] },
      { type: 'swap_selected', swapped: true, row: 4, col: 4 }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cues = out
      .filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_effect_flip')
      .map((ev) => ev.phase);

    expect(cues).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('condemn_selected 成功時は card_use_animation の phase で stone_destroy を再生する', () => {
    const base = [{
      type: 'card_use_animation',
      phase: 6,
      targets: [{ cardId: 'COND_WILL_001', owner: 'black' }]
    }];
    const raw = [{ type: 'condemn_selected', applied: true, targetCardId: 'ENEMY_CARD_1', destroyedCardId: 'ENEMY_CARD_1' }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(6);
  });

  test('通常カードの CARD_USED は card_use_animation の phase で card_use_button を再生する', () => {
    const base = [{
      type: 'card_use_animation',
      phase: 4,
      targets: [{ cardId: 'WORK_WILL_001', owner: 'black', cardType: 'WORK_WILL' }]
    }];
    const pres = [{
      type: 'CARD_USED',
      player: 'black',
      cardId: 'WORK_WILL_001',
      meta: { owner: 'black', cost: 5, name: '労働', cardType: 'WORK_WILL' }
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, [], pres);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_use_button');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(4);
  });

  test('宝箱の CARD_USED も card_use_animation の phase で card_use_button を再生する', () => {
    const base = [{
      type: 'card_use_animation',
      phase: 4,
      targets: [{ cardId: 'TREASURE_BOX_001', owner: 'black', cardType: 'TREASURE_BOX' }]
    }];
    const pres = [{
      type: 'CARD_USED',
      player: 'black',
      cardId: 'TREASURE_BOX_001',
      meta: { owner: 'black', cost: 8, name: '宝箱', cardType: 'TREASURE_BOX' }
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, [], pres);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_use_button');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(4);
  });

  test('sell_selected 成功時は hand_remove の phase で charge_gain_common を再生する', () => {
    const base = [{
      type: 'hand_remove',
      phase: 9,
      targets: [{ player: 'black', count: 1, reason: 'sell_card_will', cardId: 'WORK_WILL_001' }]
    }];
    const raw = [{
      type: 'sell_selected',
      applied: true,
      soldCardId: 'WORK_WILL_001',
      gained: 6
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'charge_gain_common');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(9);
  });

  test('corrosion_will_resolved は card_use_animation の phase で corrosion_tick を再生する', () => {
    const base = [{
      type: 'card_use_animation',
      phase: 14,
      targets: [{ cardId: 'CORROSION_WILL_001', owner: 'black' }]
    }];
    const raw = [{ type: 'corrosion_will_resolved', player: 'black', affectedCount: 3 }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'corrosion_tick');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(14);
  });

  test('condemn_selected が不成立なら stone_destroy を再生しない', () => {
    const base = [{
      type: 'card_use_animation',
      phase: 3,
      targets: [{ cardId: 'COND_WILL_001', owner: 'black' }]
    }];
    const raw = [{ type: 'condemn_selected', applied: false, targetCardId: 'ENEMY_CARD_1', destroyedCardId: 'ENEMY_CARD_1' }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(cue).toBeUndefined();
  });

  test('treasure_box_gain があるターンは treasure_gain を優先し charge_gain_common を同時再生しない', () => {
    const base = [
      {
        type: 'card_use_animation',
        phase: 5,
        targets: [{ cardId: 'TREASURE_BOX_001', owner: 'black' }]
      },
      {
        type: 'log',
        phase: 5,
        rawType: 'WORK_INCOME',
        message: 'WORK_INCOME black +4'
      }
    ];
    const raw = [{ type: 'treasure_box_gain', player: 'black', gained: 2 }];
    const pres = [{ type: 'WORK_INCOME', player: 'black', gained: 4, meta: {} }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw, pres);
    const treasureCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'treasure_gain');
    const sellCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'charge_gain_common');

    expect(treasureCue).toBeTruthy();
    expect(treasureCue.phase).toBe(6);
    expect(sellCue).toBeUndefined();
  });

  test('宝箱使用時は card_use_button と treasure_gain を順に再生する', () => {
    const base = [{
      type: 'card_use_animation',
      phase: 5,
      targets: [{ cardId: 'TREASURE_BOX_001', owner: 'black', cardType: 'TREASURE_BOX' }]
    }];
    const raw = [{ type: 'treasure_box_gain', player: 'black', gained: 2 }];
    const pres = [{
      type: 'CARD_USED',
      player: 'black',
      cardId: 'TREASURE_BOX_001',
      meta: { owner: 'black', cost: 8, name: '宝箱', cardType: 'TREASURE_BOX' }
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw, pres);
    const cardUseCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'card_use_button');
    const treasureCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'treasure_gain');

    expect(cardUseCue).toBeTruthy();
    expect(cardUseCue.phase).toBe(5);
    expect(treasureCue).toBeTruthy();
    expect(treasureCue.phase).toBe(6);
  });

  test('loss_will_resolved は card_use_animation に消失時 sound key を付与する', () => {
    const base = [
      {
        type: 'card_use_animation',
        phase: 5,
        targets: [{ cardId: 'loss_will_01', owner: 'black' }]
      },
      {
        type: 'status_removed',
        phase: 5,
        targets: [{ r: 3, col: 3 }],
        meta: { reason: 'loss_will_reset' }
      }
    ];
    const raw = [{ type: 'loss_will_resolved', player: 'black', removedCount: 3 }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw, []);
    const cardUseEv = out.find((ev) => ev && ev.type === 'card_use_animation');
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'loss_will_reset');
    const resetStatus = out.find((ev) => ev && ev.type === 'status_removed' && ev.meta && ev.meta.reason === 'loss_will_reset');

    expect(cardUseEv).toBeTruthy();
    expect(cardUseEv.targets[0].disappearSoundKey).toBe('loss_will_reset');
    expect(cardUseEv.targets[0].disappearPlaybackEvents).toEqual([
      expect.objectContaining({
        type: 'status_removed',
        meta: expect.objectContaining({ reason: 'loss_will_reset' })
      })
    ]);
    expect(cue).toBeUndefined();
    expect(resetStatus).toBeUndefined();
  });

  test('strong_will_promoted は status_applied の phase で進化音を再生する', () => {
    const base = [{
      type: 'status_applied',
      phase: 7,
      targets: [{ r: 2, col: 3 }],
      meta: { special: 'ABSOLUTE_PROTECTED', reason: 'strong_will_promoted', promotedFrom: 'PERMA_PROTECTED' }
    }];
    const pres = [{
      type: 'STATUS_APPLIED',
      row: 2,
      col: 3,
      reason: 'strong_will_promoted',
      meta: {
        special: 'ABSOLUTE_PROTECTED',
        owner: 'black',
        reason: 'strong_will_promoted',
        promotedFrom: 'PERMA_PROTECTED'
      }
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, [], pres);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'strong_will_promoted');

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(7);
  });





  test('金の意志の自己破壊は stone_destroy ではなく charge_gain_common を再生する', () => {
    const base = [{
      type: 'destroy',
      phase: 10,
      targets: [{ r: 2, col: 2, cause: 'SYSTEM', reason: 'gold_stone_sacrifice' }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const gainCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'charge_gain_common');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(gainCue).toBeTruthy();
    expect(gainCue.phase).toBe(10);
    expect(stoneCue).toBeUndefined();
  });

  test('銀の意志の自己破壊は stone_destroy ではなく charge_gain_common を再生する', () => {
    const base = [{
      type: 'destroy',
      phase: 11,
      targets: [{ r: 5, col: 5, cause: 'SYSTEM', reason: 'silver_stone_sacrifice' }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const gainCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'charge_gain_common');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(gainCue).toBeTruthy();
    expect(gainCue.phase).toBe(11);
    expect(stoneCue).toBeUndefined();
  });

  test('虹の意志の自己破壊は stone_destroy ではなく charge_gain_common を再生する', () => {
    const base = [{
      type: 'destroy',
      phase: 12,
      targets: [{ r: 4, col: 4, cause: 'SYSTEM', reason: 'rainbow_stone_sacrifice' }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const gainCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'charge_gain_common');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(gainCue).toBeTruthy();
    expect(gainCue.phase).toBe(12);
    expect(stoneCue).toBeUndefined();
  });

  test('水晶の意志の自己破壊は stone_destroy ではなく charge_gain_common を再生する', () => {
    const base = [{
      type: 'destroy',
      phase: 13,
      targets: [{ r: 1, col: 6, cause: 'SYSTEM', reason: 'crystal_stone_sacrifice' }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const gainCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'charge_gain_common');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(gainCue).toBeTruthy();
    expect(gainCue.phase).toBe(13);
    expect(stoneCue).toBeUndefined();
  });

  test('generic destroy は爆弾由来を除外し、通常破壊のみ stone_destroy を追加する', () => {
    const bombDestroy = [{
      type: 'destroy',
      phase: 2,
      targets: [{ r: 4, col: 4, cause: 'TIME_BOMB', reason: 'bomb_explode' }]
    }];
    const normalDestroy = [{
      type: 'destroy',
      phase: 4,
      targets: [{ r: 3, col: 3, cause: 'DESTROY_ONE_STONE', reason: 'destroy_selected' }]
    }];

    const outBomb = adapter.appendSoundEffectPlaybackEvents(bombDestroy, []);
    const outNormal = adapter.appendSoundEffectPlaybackEvents(normalDestroy, []);

    const bombCue = outBomb.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');
    const normalCue = outNormal.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(bombCue).toBeUndefined();
    expect(normalCue).toBeTruthy();
    expect(normalCue.phase).toBe(4);
  });

  test('持続ターン切れの anchor_expired は special_expired を再生し stone_destroy を追加しない', () => {
    const base = [{
      type: 'destroy',
      phase: 6,
      targets: [{ r: 1, col: 1, cause: 'SNIPER_WILL', reason: 'anchor_expired' }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const expiredCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'special_expired');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(expiredCue).toBeTruthy();
    expect(expiredCue.phase).toBe(6);
    expect(stoneCue).toBeUndefined();
  });

  test('ROBOT_VACUUM の anchor_expired でも special_expired を再生し stone_destroy を追加しない', () => {
    const base = [{
      type: 'destroy',
      phase: 7,
      targets: [{ r: 2, col: 2, cause: 'ROBOT_VACUUM', reason: 'anchor_expired' }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const expiredCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'special_expired');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(expiredCue).toBeTruthy();
    expect(expiredCue.phase).toBe(7);
    expect(stoneCue).toBeUndefined();
  });

  test('ROBOT_VACUUM の吸い込み破壊は robot_vacuum_suck だけを再生し stone_destroy は追加しない', () => {
    const base = [{
      type: 'destroy',
      phase: 8,
      targets: [{ r: 3, col: 5, cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_suck_start' }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const robotCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'robot_vacuum_suck');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(robotCue).toBeTruthy();
    expect(robotCue.phase).toBe(8);
    expect(stoneCue).toBeUndefined();
  });

  test('同じ phase に複数の吸い込み破壊があっても robot_vacuum_suck は1回だけ再生する', () => {
    const base = [
      {
        type: 'destroy',
        phase: 9,
        targets: [
          { r: 2, col: 4, cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_suck_start' },
          { r: 2, col: 5, cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_suck_immediate' }
        ]
      },
      {
        type: 'destroy',
        phase: 9,
        targets: [{ r: 4, col: 4, cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_suck_start' }]
      }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const robotCues = out.filter((ev) => (
      ev &&
      ev.type === 'sound_effect' &&
      ev.phase === 9 &&
      ev.targets &&
      ev.targets[0] &&
      ev.targets[0].soundKey === 'robot_vacuum_suck'
    ));
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(robotCues).toHaveLength(1);
    expect(stoneCue).toBeUndefined();
  });

  test('SNIPER_WILL の sniper_shot が複数ある場合は命中数ぶん stone_destroy を再生する', () => {
    const base = [
      {
        type: 'destroy',
        phase: 3,
        targets: [{ r: 1, col: 1, cause: 'SNIPER_WILL', reason: 'sniper_shot' }]
      },
      {
        type: 'destroy',
        phase: 4,
        targets: [{ r: 2, col: 2, cause: 'SNIPER_WILL', reason: 'sniper_shot' }]
      }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const stoneCues = out
      .filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy')
      .map((ev) => ev.phase)
      .sort((a, b) => a - b);

    expect(stoneCues).toEqual([3, 4]);
  });

  test('LIGHTNING_WILL の lightning_destroyed が複数ある場合は命中数ぶん stone_destroy を再生する', () => {
    const base = [
      {
        type: 'destroy',
        phase: 10,
        targets: [
          { r: 1, col: 1, cause: 'LIGHTNING_WILL', reason: 'lightning_destroyed' },
          { r: 2, col: 2, cause: 'LIGHTNING_WILL', reason: 'lightning_destroyed' }
        ]
      }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const stoneCues = out
      .filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy')
      .map((ev) => ev.phase)
      .sort((a, b) => a - b);

    expect(stoneCues).toEqual([10, 10]);
  });

  test('LIGHTNING_WILL の anchor_expired は special_expired を再生し stone_destroy を追加しない', () => {
    const base = [{
      type: 'destroy',
      phase: 12,
      targets: [{ r: 4, col: 4, cause: 'LIGHTNING_WILL', reason: 'anchor_expired' }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const expiredCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'special_expired');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(expiredCue).toBeTruthy();
    expect(expiredCue.phase).toBe(12);
    expect(stoneCue).toBeUndefined();
  });

  test('GHOST の duration_end は special_expired を再生し stone_destroy を追加しない', () => {
    const base = [{
      type: 'destroy',
      phase: 13,
      targets: [{
        r: 5,
        col: 5,
        cause: 'SYSTEM',
        reason: 'duration_end',
        meta: { special: 'GHOST' }
      }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const expiredCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'special_expired');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(expiredCue).toBeTruthy();
    expect(expiredCue.phase).toBe(13);
    expect(stoneCue).toBeUndefined();
  });

  test('CROSS_BOMB の爆発は destroy と同じ phase で bomb_explode を再生し、stone_destroy は再生しない', () => {
    const pres = [
      { type: 'SPAWN', row: 3, col: 3, stoneId: 's1', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_place' },
      { type: 'DESTROY', row: 3, col: 3, stoneId: 's1', ownerBefore: 'black', cause: 'CROSS_BOMB', reason: 'cross_bomb_explosion' }
    ];
    const base = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const out = adapter.appendSoundEffectPlaybackEvents(base, [{ type: 'placement_effects', effects: { crossBombExploded: true } }]);
    const destroy = out.find((ev) => ev && ev.type === 'destroy');
    const bombCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'bomb_explode');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(destroy).toBeTruthy();
    expect(bombCue).toBeTruthy();
    expect(bombCue.phase).toBe(destroy.phase);
    expect(stoneCue).toBeUndefined();
  });

  test('ESCAPE_HYPERACTIVE の移動不能爆発は destroy と同じ phase で bomb_explode を再生し、stone_destroy は再生しない', () => {
    const base = [{
      type: 'destroy',
      phase: 6,
      targets: [{ r: 4, col: 4, cause: 'ESCAPE_HYPERACTIVE', reason: 'escape_no_candidates_explosion' }]
    }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const bombCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'bomb_explode');
    const stoneCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'stone_destroy');

    expect(bombCue).toBeTruthy();
    expect(bombCue.phase).toBe(6);
    expect(stoneCue).toBeUndefined();
  });

  test('爆発 destroy が複数 phase に分かれる場合は phase ごとに bomb_explode を再生する', () => {
    const base = [
      { type: 'destroy', phase: 2, targets: [{ r: 1, col: 1, cause: 'TIME_BOMB', reason: 'bomb_explosion' }] },
      { type: 'destroy', phase: 5, targets: [{ r: 4, col: 4, cause: 'X_BOMB', reason: 'x_bomb_explosion' }] }
    ];
    const raw = [{ type: 'bombs_exploded', details: { exploded: [{ row: 1, col: 1 }] } }];

    const out = adapter.appendSoundEffectPlaybackEvents(base, raw);
    const bombCues = out
      .filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'bomb_explode')
      .map((ev) => ev.phase)
      .sort((a, b) => a - b);

    expect(bombCues).toEqual([2, 5]);
  });

  test('WORK_INCOME は charge_gain_common を同じ phase で再生する', () => {
    const pres = [
      { type: 'WORK_INCOME', player: 'black', gained: 4, meta: {} },
      { type: 'STATUS_TICK', row: 2, col: 2, meta: { special: 'WORK', timer: 3, owner: 'black' } }
    ];
    const base = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const out = adapter.appendSoundEffectPlaybackEvents(base, [], pres);
    const workIncomeLog = out.find((ev) => ev && ev.type === 'log' && ev.rawType === 'WORK_INCOME');
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'charge_gain_common');

    expect(workIncomeLog).toBeTruthy();
    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(workIncomeLog.phase);
  });

  test('WORK_INCOME が16獲得なら work_income_16 を同じ phase で再生する', () => {
    const pres = [
      { type: 'WORK_INCOME', player: 'black', gained: 16, meta: {} },
      { type: 'STATUS_TICK', row: 2, col: 2, meta: { special: 'WORK', timer: 0, owner: 'black' } }
    ];
    const base = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const out = adapter.appendSoundEffectPlaybackEvents(base, [], pres);
    const workIncomeLog = out.find((ev) => ev && ev.type === 'log' && ev.rawType === 'WORK_INCOME');
    const specialCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'work_income_16');
    const normalCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'charge_gain_common');

    expect(workIncomeLog).toBeTruthy();
    expect(specialCue).toBeTruthy();
    expect(specialCue.phase).toBe(workIncomeLog.phase);
    expect(normalCue).toBeUndefined();
  });

  test('WORK_REMOVED（反転/破壊起因）では work_removed を同じ phase で再生する', () => {
    const pres = [{
      type: 'WORK_REMOVED',
      row: 3,
      col: 3,
      ownerBefore: 'white',
      ownerAfter: 'black',
      cause: 'TEMPT_WILL',
      removed: true,
      meta: {}
    }];
    const base = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const out = adapter.appendSoundEffectPlaybackEvents(base, [{ type: 'tempt_selected', player: 'black', applied: true }], pres);
    const removedLog = out.find((ev) => ev && ev.type === 'log' && ev.rawType === 'WORK_REMOVED');
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'work_removed');

    expect(removedLog).toBeTruthy();
    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(removedLog.phase);
  });

  test('WORK_INCOME の removed=true（持続ターン切れ）では work_removed を再生しない', () => {
    const pres = [{ type: 'WORK_INCOME', player: 'black', gained: 16, removed: true, meta: {} }];
    const base = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const out = adapter.appendSoundEffectPlaybackEvents(base, [], pres);
    const removedCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'work_removed');
    const incomeCue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'work_income_16');

    expect(removedCue).toBeUndefined();
    expect(incomeCue).toBeTruthy();
  });

  test('WORK_INCOME の gained が0以下なら charge_gain_common を再生しない', () => {
    const pres = [{ type: 'WORK_INCOME', player: 'black', gained: 0, meta: {} }];
    const base = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const out = adapter.appendSoundEffectPlaybackEvents(base, [], pres);
    const cue = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'charge_gain_common');

    expect(cue).toBeUndefined();
  });

  test('多動系は移動1回ごとに hyperactive_move を追加する（瞬間/究極含む）', () => {
    const base = [
      {
        type: 'move',
        phase: 2,
        targets: [{ from: { r: 1, col: 1 }, to: { r: 1, col: 2 }, cause: 'HYPERACTIVE', reason: 'hyperactive_move' }]
      },
      {
        type: 'move',
        phase: 3,
        targets: [{ from: { r: 2, col: 2 }, to: { r: 2, col: 3 }, cause: 'HYPERACTIVE', reason: 'hyperactive_move' }]
      },
      {
        type: 'move',
        phase: 4,
        targets: [{ from: { r: 3, col: 3 }, to: { r: 4, col: 3 }, cause: 'ULTIMATE_HYPERACTIVE_GOD', reason: 'ultimate_hyperactive_step_move' }]
      }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const cues = out.filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'hyperactive_move');

    expect(cues).toHaveLength(3);
    expect(cues.map((ev) => ev.phase)).toEqual([2, 3, 4]);
  });

  test('AFTERIMAGE_WILL の反転回避 move にも hyperactive_move を追加する', () => {
    const base = [
      {
        type: 'move',
        phase: 6,
        targets: [{
          from: { r: 4, col: 4 },
          to: { r: 3, col: 3 },
          cause: 'AFTERIMAGE_WILL',
          reason: 'afterimage_will_flip_evade_move'
        }]
      }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const cue = out.find((ev) =>
      ev &&
      ev.type === 'sound_effect' &&
      ev.targets &&
      ev.targets[0] &&
      ev.targets[0].soundKey === 'hyperactive_move'
    );

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(6);
  });

  test('destroy_evade_move にも hyperactive_move を追加する', () => {
    const base = [
      {
        type: 'move',
        phase: 7,
        targets: [{
          from: { r: 2, col: 2 },
          to: { r: 2, col: 3 },
          cause: 'DESTROY_EVADE',
          reason: 'destroy_evade_move',
          meta: { special: 'WILL_HUNTER_KING' }
        }]
      }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const cue = out.find((ev) =>
      ev &&
      ev.type === 'sound_effect' &&
      ev.targets &&
      ev.targets[0] &&
      ev.targets[0].soundKey === 'hyperactive_move'
    );

    expect(cue).toBeTruthy();
    expect(cue.phase).toBe(7);
  });

  test('究極反転龍 / 究極破壊神の owner-turn move には専用 SE を追加する', () => {
    const base = [
      {
        type: 'move',
        phase: 2,
        targets: [{ from: { r: 4, col: 4 }, to: { r: 0, col: 0 }, cause: 'ULTIMATE_REVERSE_DRAGON', reason: 'ultimate_reverse_dragon_move' }]
      },
      {
        type: 'move',
        phase: 5,
        targets: [{ from: { r: 3, col: 3 }, to: { r: 7, col: 7 }, cause: 'ULTIMATE_DESTROY_GOD', reason: 'ultimate_destroy_god_move' }]
      }
    ];

    const out = adapter.appendSoundEffectPlaybackEvents(base, []);
    const anchorCues = out.filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'ultimate_anchor_move');
    const hyperactiveCues = out.filter((ev) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'hyperactive_move');

    expect(anchorCues).toHaveLength(2);
    expect(anchorCues.map((ev) => ev.phase)).toEqual([2, 5]);
    expect(hyperactiveCues).toHaveLength(0);
  });
});
