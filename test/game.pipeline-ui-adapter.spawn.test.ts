import * as adapter from '../game/turn/pipeline_ui_adapter.js';

function mapPlaybackEvents(pres) {
  return adapter.mapToPlaybackEvents(
    pres,
    { markers: [] },
    { board: Array.from({ length: 8 }, () => Array(8).fill(0)) }
  );
}

describe('pipeline_ui_adapter spawn mapping', () => {
  test('uses manifestStone markers for placement after-state visuals', () => {
    const out = adapter.mapToPlaybackEvents(
      [{
        type: 'SPAWN',
        row: 2,
        col: 3,
        stoneId: 'theory-manifest-1',
        ownerAfter: 'black',
        cause: 'SYSTEM',
        reason: 'standard_place',
        meta: {}
      }],
      {
        markers: [{
          id: 9001,
          kind: 'manifestStone',
          row: 2,
          col: 3,
          owner: 'black',
          data: {
            type: 'THEORY_INCARNATION',
            remainingOwnerTurns: 4,
            visualEffectKey: 'theoryIncarnationStone'
          }
        }]
      },
      {
        board: Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => (row === 2 && col === 3 ? 1 : 0))
        )
      }
    );

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('spawn');
    expect(out[0].targets[0].after).toEqual(expect.objectContaining({
      color: 1,
      special: 'THEORY_INCARNATION',
      timer: 4,
      owner: 'black',
      manifestAura: { owner: 'black' }
    }));
  });

  test('maps SPAWN cause/reason to playback target for animation branching', () => {
    const pres = [{
      type: 'SPAWN',
      row: 3,
      col: 4,
      stoneId: 's12',
      ownerAfter: 'black',
      cause: 'BREEDING',
      reason: 'breeding_spawn_immediate',
      meta: {}
    }];

    const out = mapPlaybackEvents(pres);

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('spawn');
    expect(out[0].targets[0]).toMatchObject({
      r: 3,
      col: 4,
      stoneId: 's12',
      cause: 'BREEDING',
      reason: 'breeding_spawn_immediate'
    });
  });

  test('maps SPAWN metadata to playback event for placement highlight classification', () => {
    const out = mapPlaybackEvents([{
      type: 'SPAWN',
      row: 2,
      col: 3,
      stoneId: 's-place',
      ownerAfter: 'black',
      cause: 'SYSTEM',
      reason: 'standard_place',
      meta: { placementKind: 'normal_placement' }
    }]);

    expect(out).toHaveLength(1);
    expect(out[0].meta).toEqual(expect.objectContaining({
      placementKind: 'normal_placement'
    }));
  });

  test('maps theory incarnation SPAWN roulette metadata to dedicated playback event', () => {
    const out = mapPlaybackEvents([{
      type: 'SPAWN',
      row: 4,
      col: 6,
      stoneId: 'theory-spawn-1',
      ownerAfter: 'black',
      cause: 'THEORY_INCARNATION',
      reason: 'theory_incarnation_spawn',
      meta: {
        special: 'SNIPER',
        owner: 'black',
        sourceCardId: 'sniper_01',
        sourceCardType: 'SNIPER_WILL',
        theorySpawnRoulette: {
          durationMs: 2500,
          materializeMs: 2000,
          candidateCells: [{ row: 4, col: 4 }, { row: 4, col: 6 }],
          selectedCell: { row: 4, col: 6 },
          spawnedMarkerType: 'SNIPER',
          sourceCardId: 'sniper_01',
          sourceCardType: 'SNIPER_WILL'
        }
      }
    }]);

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: 'theory_incarnation_spawn_roulette',
      phase: 1,
      rawType: 'SPAWN',
      targets: [{
        r: 4,
        row: 4,
        col: 6,
        owner: 'black',
        player: 'black',
        ownerAfter: 'black',
        spawnedMarkerType: 'SNIPER',
        sourceCardId: 'sniper_01',
        sourceCardType: 'SNIPER_WILL',
        candidateCells: [{ row: 4, col: 4 }, { row: 4, col: 6 }],
        selectedCell: { row: 4, col: 6 },
        after: expect.objectContaining({
          color: 1,
          special: 'SNIPER',
          owner: 'black'
        })
      }]
    });
    expect(out[0].durationMs).toBe(2500);
    expect(out[0].materializeMs).toBe(2000);
  });

  test('keeps spawn-owned status metadata for non-visual consumers', () => {
    const out = mapPlaybackEvents([
      {
        type: 'SPAWN',
        row: 3,
        col: 5,
        stoneId: 'special-placement-1',
        ownerAfter: 'black',
        cause: 'SYSTEM',
        reason: 'standard_place',
        meta: { special: 'HYPERACTIVE', owner: 'black' }
      },
      {
        type: 'STATUS_APPLIED',
        row: 3,
        col: 5,
        meta: {
          special: 'HYPERACTIVE',
          owner: 'black',
          visualOwnedBySpawn: true
        }
      }
    ]);

    const spawn = out.find((event) => event && event.type === 'spawn');
    const status = out.find((event) => event && event.type === 'status_applied');

    expect(spawn?.targets?.[0]?.after).toEqual(expect.objectContaining({
      color: 1,
      special: 'HYPERACTIVE',
      owner: 'black'
    }));
    expect(status?.meta).toEqual(expect.objectContaining({
      special: 'HYPERACTIVE',
      visualOwnedBySpawn: true
    }));
  });

  test('plays chaos summon roulette after the card use animation phase', () => {
    const out = mapPlaybackEvents([
      {
        type: 'CARD_USED',
        player: 'black',
        cardId: 'chaos_summon_01',
        meta: { owner: 'black', cost: 15, name: '混沌召喚', cardType: 'CHAOS_SUMMON' }
      },
      {
        type: 'SPAWN',
        row: 2,
        col: 7,
        stoneId: 'chaos-spawn-1',
        ownerAfter: 'black',
        cause: 'CHAOS_SUMMON',
        reason: 'chaos_summon_spawn',
        meta: {
          special: 'PERMA_PROTECTED',
          owner: 'black',
          sourceCardId: 'perma_01',
          sourceCardType: 'PERMA_PROTECT_NEXT_STONE',
          theorySpawnRoulette: {
            durationMs: 2500,
            materializeMs: 700,
            candidateCells: [{ row: 2, col: 6 }, { row: 2, col: 7 }],
            selectedCell: { row: 2, col: 7 },
            spawnedMarkerType: 'PERMA_PROTECTED',
            sourceCardId: 'perma_01',
            sourceCardType: 'PERMA_PROTECT_NEXT_STONE'
          }
        }
      }
    ]);

    const cardUseEvents = out.filter((ev) => ev && ev.type === 'card_use_animation');
    const roulette = out.find((ev) => ev && ev.type === 'theory_incarnation_spawn_roulette');

    expect(cardUseEvents).toHaveLength(1);
    expect(roulette).toBeTruthy();
    expect(roulette.phase).toBeGreaterThan(cardUseEvents[0].phase);
  });

  test('keeps chaos summon card-use phase before raw-board roulette fallback', () => {
    const out = adapter.appendSoundEffectPlaybackEvents([
      {
        type: 'theory_incarnation_spawn_roulette',
        phase: 2,
        rawType: 'SPAWN',
        targets: [{
          row: 1,
          col: 7,
          cause: 'CHAOS_SUMMON',
          reason: 'chaos_summon_spawn',
          sourceCardType: 'SNIPER_WILL'
        }]
      },
      {
        type: 'status_applied',
        phase: 2,
        rawType: 'STATUS_APPLIED',
        targets: [{ r: 1, col: 7 }]
      },
      {
        type: 'card_use_animation',
        phase: 3,
        rawType: 'CARD_USED',
        targets: [{
          player: 'black',
          owner: 'black',
          cardId: 'chaos_summon_01',
          cardType: 'CHAOS_SUMMON',
          name: '混沌召喚'
        }]
      }
    ], [{
      type: 'SPAWN',
      row: 1,
      col: 7,
      cause: 'CHAOS_SUMMON',
      reason: 'chaos_summon_spawn'
    }], [{
      type: 'CARD_USED',
      player: 'black',
      cardId: 'chaos_summon_01',
      meta: { owner: 'black', cost: 15, name: '混沌召喚', cardType: 'CHAOS_SUMMON' }
    }]);

    const cardUse = out.find((ev) => ev && ev.type === 'card_use_animation');
    const roulette = out.find((ev) => ev && ev.type === 'theory_incarnation_spawn_roulette');
    const chaosSound = out.find((ev) => ev && ev.type === 'sound_effect' && ev.targets?.[0]?.soundKey === 'chaos_summon_spawn');

    expect(cardUse).toBeTruthy();
    expect(roulette).toBeTruthy();
    expect(cardUse.phase).toBeLessThan(roulette.phase);
    expect(chaosSound?.phase).toBe(roulette.phase);
  });

  test('does not run chaos summon status highlight in the roulette phase', () => {
    const out = adapter.appendSoundEffectPlaybackEvents([
      {
        type: 'theory_incarnation_spawn_roulette',
        phase: 2,
        rawType: 'SPAWN',
        targets: [{
          row: 1,
          col: 7,
          cause: 'CHAOS_SUMMON',
          reason: 'chaos_summon_spawn',
          sourceCardType: 'SNIPER_WILL'
        }]
      },
      {
        type: 'status_applied',
        phase: 2,
        rawType: 'STATUS_APPLIED',
        targets: [{ r: 1, row: 1, col: 7 }]
      },
      {
        type: 'card_use_animation',
        phase: 3,
        rawType: 'CARD_USED',
        targets: [{
          player: 'black',
          owner: 'black',
          cardId: 'chaos_summon_01',
          cardType: 'CHAOS_SUMMON',
          name: '混沌召喚'
        }]
      }
    ], [{
      type: 'SPAWN',
      row: 1,
      col: 7,
      cause: 'CHAOS_SUMMON',
      reason: 'chaos_summon_spawn'
    }, {
      type: 'STATUS_APPLIED',
      row: 1,
      col: 7,
      cause: 'CHAOS_SUMMON',
      reason: 'chaos_summon_spawn'
    }], [{
      type: 'CARD_USED',
      player: 'black',
      cardId: 'chaos_summon_01',
      meta: { owner: 'black', cost: 15, name: '混沌召喚', cardType: 'CHAOS_SUMMON' }
    }]);

    const roulette = out.find((ev) => ev && ev.type === 'theory_incarnation_spawn_roulette');
    const statusApplied = out.find((ev) => ev && ev.type === 'status_applied');

    expect(roulette).toBeTruthy();
    expect(statusApplied).toBeTruthy();
    expect(statusApplied.phase).toBeGreaterThan(roulette.phase);
  });

  test('gives Salvation Will spawns sequential phases so each stone appears one by one', () => {
    const out = mapPlaybackEvents([
      {
        type: 'SPAWN',
        row: 3,
        col: 2,
        stoneId: 'sv-1',
        ownerAfter: 'black',
        cause: 'SALVATION_WILL',
        reason: 'salvation_spawn',
        meta: { spawnIndex: 1 }
      },
      {
        type: 'SPAWN',
        row: 3,
        col: 3,
        stoneId: 'sv-2',
        ownerAfter: 'black',
        cause: 'SALVATION_WILL',
        reason: 'salvation_spawn',
        meta: { spawnIndex: 2 }
      },
      {
        type: 'SPAWN',
        row: 3,
        col: 4,
        stoneId: 'sv-3',
        ownerAfter: 'black',
        cause: 'SALVATION_WILL',
        reason: 'salvation_spawn',
        meta: { spawnIndex: 3 }
      }
    ]);

    const mapped = out.map((ev) => ({
      type: ev.type,
      phase: ev.phase,
      target: {
        r: ev.targets[0].r,
        col: ev.targets[0].col,
        stoneId: ev.targets[0].stoneId,
        cause: ev.targets[0].cause,
        reason: ev.targets[0].reason
      }
    }));
    // Each spawn must be in its own strictly sequential phase so stones appear one by one
    // after the card-use animation ends (spec §10.38).
    // With no preceding CARD_USED the phase counter starts at 1; spawnIndex>=1 now always
    // increments, so phases are 2, 3, 4.
    expect(mapped).toHaveLength(3);
    expect(mapped[0]).toEqual({ type: 'spawn', phase: 2, target: { r: 3, col: 2, stoneId: 'sv-1', cause: 'SALVATION_WILL', reason: 'salvation_spawn' } });
    expect(mapped[1]).toEqual({ type: 'spawn', phase: 3, target: { r: 3, col: 3, stoneId: 'sv-2', cause: 'SALVATION_WILL', reason: 'salvation_spawn' } });
    expect(mapped[2]).toEqual({ type: 'spawn', phase: 4, target: { r: 3, col: 4, stoneId: 'sv-3', cause: 'SALVATION_WILL', reason: 'salvation_spawn' } });
    // Phases must be strictly increasing (serial order guaranteed)
    expect(mapped[1].phase).toBeGreaterThan(mapped[0].phase);
    expect(mapped[2].phase).toBeGreaterThan(mapped[1].phase);
  });

  test('plays Stone Salvation God revive after the destroy phase', () => {
    const out = mapPlaybackEvents([
      {
        type: 'DESTROY',
        row: 1,
        col: 1,
        stoneId: 'old-1',
        ownerBefore: 'black',
        cause: 'METEOR_WILL',
        reason: 'meteor_cell_destroy',
        meta: {}
      },
      {
        type: 'SPAWN',
        row: 4,
        col: 4,
        stoneId: 'revive-1',
        ownerAfter: 'black',
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        meta: {
          sourceSpecial: 'STONE_SALVATION_GOD',
          revivedFromRow: 1,
          revivedFromCol: 1,
          destroyedOwner: 'white',
          revivedOwner: 'black'
        }
      }
    ]);

    const destroy = out.find((ev) => ev && ev.type === 'destroy');
    const spawn = out.find((ev) => ev && ev.type === 'spawn');

    expect(destroy).toBeTruthy();
    expect(spawn).toBeTruthy();
    expect(spawn.phase).toBeGreaterThan(destroy.phase);
    expect(spawn.targets[0]).toMatchObject({
      r: 4,
      col: 4,
      cause: 'STONE_SALVATION_GOD',
      reason: 'stone_salvation_god_revive',
      ownerAfter: 'black',
      destroyedOwner: 'white',
      revivedOwner: 'black'
    });
  });

  test('keeps super buoyancy collision and move together before Stone Salvation God revive', () => {
    const out = mapPlaybackEvents([
      {
        type: 'DESTROY',
        row: 2,
        col: 4,
        stoneId: 'hit-own',
        ownerBefore: 'black',
        cause: 'SUPER_BUOYANCY_WILL',
        reason: 'super_buoyancy_collision',
        meta: { collisionProgress: 0.5 }
      },
      {
        type: 'SPAWN',
        row: 6,
        col: 6,
        stoneId: 'revived',
        ownerAfter: 'black',
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        meta: {
          sourceSpecial: 'STONE_SALVATION_GOD',
          revivedFromRow: 2,
          revivedFromCol: 4
        }
      },
      {
        type: 'MOVE',
        prevRow: 4,
        prevCol: 4,
        row: 1,
        col: 4,
        stoneId: 'mover',
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'SUPER_BUOYANCY_WILL',
        reason: 'super_buoyancy_move'
      }
    ]);

    const destroy = out.find((ev) => ev && ev.type === 'destroy');
    const move = out.find((ev) => ev && ev.type === 'move');
    const spawn = out.find((ev) => ev && ev.type === 'spawn');

    expect(destroy).toBeTruthy();
    expect(move).toBeTruthy();
    expect(spawn).toBeTruthy();
    expect(move.phase).toBe(destroy.phase);
    expect(spawn.phase).toBeGreaterThan(move.phase);
  });

  test('defers interleaved Stone Salvation God revives until after the whole destroy batch', () => {
    const out = mapPlaybackEvents([
      {
        type: 'DESTROY',
        row: 1,
        col: 1,
        stoneId: 'bombed-1',
        ownerBefore: 'black',
        cause: 'TIME_BOMB',
        reason: 'time_bomb_explode',
        meta: {}
      },
      {
        type: 'SPAWN',
        row: 5,
        col: 5,
        stoneId: 'revive-1',
        ownerAfter: 'black',
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        meta: { sourceSpecial: 'STONE_SALVATION_GOD' }
      },
      {
        type: 'DESTROY',
        row: 1,
        col: 2,
        stoneId: 'bombed-2',
        ownerBefore: 'black',
        cause: 'TIME_BOMB',
        reason: 'time_bomb_explode',
        meta: {}
      },
      {
        type: 'SPAWN',
        row: 5,
        col: 6,
        stoneId: 'revive-2',
        ownerAfter: 'black',
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        meta: { sourceSpecial: 'STONE_SALVATION_GOD' }
      }
    ]);

    const destroys = out.filter((ev) => ev && ev.type === 'destroy');
    const spawns = out.filter((ev) => ev && ev.type === 'spawn');

    expect(destroys).toHaveLength(2);
    expect(spawns).toHaveLength(2);
    expect(destroys[0].phase).toBe(destroys[1].phase);
    expect(spawns[0].phase).toBeGreaterThan(destroys[0].phase);
    expect(spawns[1].phase).toBeGreaterThan(spawns[0].phase);
  });

  test('keeps delayed Stone Salvation God turn-start revive before later continuous destroy playback', () => {
    const out = mapPlaybackEvents([
      {
        type: 'SPAWN',
        row: 5,
        col: 5,
        stoneId: 'revived-a',
        ownerAfter: 'black',
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        meta: {
          sourceSpecial: 'STONE_SALVATION_GOD',
          revivedFromRow: 1,
          revivedFromCol: 1,
          sourceRow: 3,
          sourceCol: 3
        }
      },
      {
        type: 'DESTROY',
        row: 5,
        col: 5,
        stoneId: 'revived-a',
        ownerBefore: 'black',
        cause: 'TIME_BOMB',
        reason: 'bomb_explosion',
        meta: { sourceRow: 7, sourceCol: 7, projectileOwner: 'white', projectileStone: 'time_bomb' }
      },
      {
        type: 'SPAWN',
        row: 6,
        col: 6,
        stoneId: 'revived-b',
        ownerAfter: 'black',
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        meta: {
          sourceSpecial: 'STONE_SALVATION_GOD',
          revivedFromRow: 5,
          revivedFromCol: 5,
          sourceRow: 3,
          sourceCol: 3
        }
      }
    ]);

    const ordered = out
      .filter((ev) => ev && (ev.type === 'destroy' || ev.type === 'spawn'))
      .map((ev) => ({
        type: ev.type,
        phase: ev.phase,
        stoneId: ev.targets[0].stoneId,
        cause: ev.targets[0].cause
      }));

    expect(ordered.map((ev) => `${ev.type}:${ev.stoneId}`)).toEqual([
      'spawn:revived-a',
      'destroy:revived-a',
      'spawn:revived-b'
    ]);
    expect(ordered[1].phase).toBeGreaterThan(ordered[0].phase);
    expect(ordered[2].phase).toBeGreaterThan(ordered[1].phase);
  });

  test('keeps sniper shot projectile metadata before Stone Salvation God revive', () => {
    const out = mapPlaybackEvents([
      {
        type: 'DESTROY',
        row: 1,
        col: 1,
        stoneId: 'sniped',
        ownerBefore: 'black',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        meta: { sourceRow: 4, sourceCol: 4 }
      },
      {
        type: 'SPAWN',
        row: 5,
        col: 5,
        stoneId: 'revived',
        ownerAfter: 'black',
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        meta: { sourceSpecial: 'STONE_SALVATION_GOD' }
      }
    ]);

    const destroy = out.find((ev) => ev && ev.type === 'destroy');
    const spawn = out.find((ev) => ev && ev.type === 'spawn');

    expect(destroy).toBeTruthy();
    expect(spawn).toBeTruthy();
    expect(destroy.targets[0]).toMatchObject({
      cause: 'SNIPER_WILL',
      reason: 'sniper_shot',
      sourceRow: 4,
      sourceCol: 4
    });
    expect(spawn.phase).toBeGreaterThan(destroy.phase);
  });

  test('plays later turn-start sniper shots and Stone Salvation God revives per source anchor', () => {
    const out = mapPlaybackEvents([
      {
        type: 'DESTROY',
        row: 1,
        col: 1,
        stoneId: 'sniped-a',
        ownerBefore: 'black',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        meta: { sourceRow: 0, sourceCol: 0, projectileOwner: 'white' }
      },
      {
        type: 'SPAWN',
        row: 5,
        col: 5,
        stoneId: 'revived-a',
        ownerAfter: 'black',
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        meta: { sourceSpecial: 'STONE_SALVATION_GOD', revivedFromRow: 1, revivedFromCol: 1 }
      },
      {
        type: 'DESTROY',
        row: 2,
        col: 2,
        stoneId: 'sniped-b',
        ownerBefore: 'black',
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        meta: { sourceRow: 7, sourceCol: 7, projectileOwner: 'white' }
      },
      {
        type: 'SPAWN',
        row: 5,
        col: 6,
        stoneId: 'revived-b',
        ownerAfter: 'black',
        cause: 'STONE_SALVATION_GOD',
        reason: 'stone_salvation_god_revive',
        meta: { sourceSpecial: 'STONE_SALVATION_GOD', revivedFromRow: 2, revivedFromCol: 2 }
      }
    ]);

    const ordered = out
      .filter((ev) => ev && (ev.type === 'destroy' || ev.type === 'spawn'))
      .map((ev) => ({
        type: ev.type,
        phase: ev.phase,
        stoneId: ev.targets[0].stoneId,
        sourceRow: ev.targets[0].sourceRow,
        sourceCol: ev.targets[0].sourceCol,
        reason: ev.targets[0].reason
      }));

    expect(ordered.map((ev) => ev.stoneId)).toEqual(['sniped-a', 'revived-a', 'sniped-b', 'revived-b']);
    expect(ordered[1].phase).toBeGreaterThan(ordered[0].phase);
    expect(ordered[2].phase).toBeGreaterThan(ordered[1].phase);
    expect(ordered[3].phase).toBeGreaterThan(ordered[2].phase);
    expect(ordered[0]).toMatchObject({ sourceRow: 0, sourceCol: 0, reason: 'sniper_shot' });
    expect(ordered[2]).toMatchObject({ sourceRow: 7, sourceCol: 7, reason: 'sniper_shot' });
  });

  test('keeps breeding, clone, split, proliferation, and normal spawns on their current mapping', () => {
    const out = mapPlaybackEvents([
      {
        type: 'SPAWN',
        row: 1,
        col: 1,
        stoneId: 'breed-1',
        ownerAfter: 'black',
        cause: 'BREEDING',
        reason: 'breeding_spawn_immediate',
        meta: {}
      },
      {
        type: 'SPAWN',
        row: 1,
        col: 2,
        stoneId: 'clone-1',
        ownerAfter: 'black',
        cause: 'CLONE_WILL',
        reason: 'clone_spawn',
        meta: { fromRow: 4, fromCol: 4 }
      },
      {
        type: 'SPAWN',
        row: 1,
        col: 3,
        stoneId: 'prolif-1',
        ownerAfter: 'white',
        cause: 'PROLIFERATION_WILL',
        reason: 'proliferation_spawn',
        meta: { fromRow: 5, fromCol: 5 }
      },
      {
        type: 'SPAWN',
        row: 1,
        col: 4,
        stoneId: 'normal-1',
        ownerAfter: 'black',
        cause: 'SYSTEM',
        reason: 'standard_spawn',
        meta: {}
      }
    ]);

    expect(out.map((ev) => ({
      type: ev.type,
      phase: ev.phase,
      cause: ev.targets[0].cause,
      reason: ev.targets[0].reason,
      clone: !!ev.targets[0].clone
    }))).toEqual([
      {
        type: 'spawn',
        phase: 1,
        cause: 'BREEDING',
        reason: 'breeding_spawn_immediate',
        clone: false
      },
      {
        type: 'move',
        phase: 1,
        cause: 'CLONE_WILL',
        reason: 'clone_spawn',
        clone: true
      },
      {
        type: 'move',
        phase: 1,
        cause: 'PROLIFERATION_WILL',
        reason: 'proliferation_spawn',
        clone: true
      },
      {
        type: 'spawn',
        phase: 1,
        cause: 'SYSTEM',
        reason: 'standard_spawn',
        clone: false
      }
    ]);
  });

  test('SALVATION_WILL spawns all appear after card_use_animation phase (card-disappear timing, spec §10.38)', () => {
    // Simulate a realistic turn: CARD_USED followed by three SALVATION_WILL spawns.
    const out = mapPlaybackEvents([
      {
        type: 'CARD_USED',
        player: 'black',
        cardId: 'salvation_01',
        meta: { owner: 'black', cardType: 'SALVATION_WILL', cost: 10, name: '救済の意志',
                salvationWillResolved: true, spawnedCount: 3 }
      },
      {
        type: 'SPAWN',
        row: 2, col: 2,
        stoneId: 'sv-a',
        ownerAfter: 'black',
        cause: 'SALVATION_WILL',
        reason: 'salvation_spawn',
        meta: { spawnIndex: 1 }
      },
      {
        type: 'SPAWN',
        row: 4, col: 4,
        stoneId: 'sv-b',
        ownerAfter: 'black',
        cause: 'SALVATION_WILL',
        reason: 'salvation_spawn',
        meta: { spawnIndex: 2 }
      },
      {
        type: 'SPAWN',
        row: 6, col: 6,
        stoneId: 'sv-c',
        ownerAfter: 'black',
        cause: 'SALVATION_WILL',
        reason: 'salvation_spawn',
        meta: { spawnIndex: 3 }
      }
    ]);

    const cardUseEv = out.find((ev) => ev && ev.type === 'card_use_animation');
    const spawnEvs = out.filter((ev) => ev && ev.type === 'spawn' &&
      Array.isArray(ev.targets) && ev.targets[0] && ev.targets[0].cause === 'SALVATION_WILL');

    expect(cardUseEv).toBeTruthy();
    expect(spawnEvs).toHaveLength(3);

    // Every spawn must be in a phase strictly AFTER the card_use_animation (card-disappear timing).
    for (const spawnEv of spawnEvs) {
      expect(spawnEv.phase).toBeGreaterThan(cardUseEv.phase);
    }

    // Spawns must still be in strictly increasing sequential phases (one-by-one appearance).
    expect(spawnEvs[1].phase).toBeGreaterThan(spawnEvs[0].phase);
    expect(spawnEvs[2].phase).toBeGreaterThan(spawnEvs[1].phase);
  });
});
