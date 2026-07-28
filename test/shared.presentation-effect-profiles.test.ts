import * as profiles from '../shared/presentation-effect-profiles.js';

describe('PresentationEffectProfiles', () => {
  test('matches cause/reason profiles with single or multiple causes', () => {
    expect(profiles.matchesCauseReasonProfile(
      { cause: 'DESTROY_DRAGON', reason: 'destroy_dragon_breath_turn_start' },
      profiles.SPECIAL_DESTROY_TARGET_PROFILES.destroyDragonBreath
    )).toBe(true);

    expect(profiles.matchesCauseReasonProfile(
      { cause: 'SNIPER_WILL', reason: 'destroy_dragon_breath_turn_start' },
      profiles.SPECIAL_DESTROY_TARGET_PROFILES.destroyDragonBreath
    )).toBe(false);
  });

  test('spawn profile matching honors optional spawn intent when present', () => {
    const profile = {
      cause: 'SALVATION_WILL',
      reasonPrefix: 'salvation_spawn',
      spawnIntent: 'salvation_spawn'
    };

    expect(profiles.isSpawnEventLike({
      cause: 'SALVATION_WILL',
      reason: 'salvation_spawn_0',
      meta: { spawnIntent: 'salvation_spawn' }
    }, profile)).toBe(true);

    expect(profiles.isSpawnEventLike({
      cause: 'SALVATION_WILL',
      reason: 'salvation_spawn_0',
      meta: { spawnIntent: 'normal_spawn' }
    }, profile)).toBe(false);
  });

  test('support troops will is treated as a positive normal spawn profile', () => {
    const profile = profiles.POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS.find((one) => one && one.cause === 'SUPPORT_TROOPS_WILL');
    expect(profile).toEqual(expect.objectContaining({
      cause: 'SUPPORT_TROOPS_WILL',
      reasonPrefix: 'support_troops_will_spawn',
      spawnIntent: 'normal_spawn'
    }));

    expect(profiles.matchesSpawnProfileTarget({
      cause: 'SUPPORT_TROOPS_WILL',
      reason: 'support_troops_will_spawn',
      meta: { spawnIntent: 'normal_spawn' }
    }, 'SUPPORT_TROOPS_WILL', 'support_troops_will_spawn', profile)).toBe(true);
  });

  test.each([
    ['SNIPER_WILL', 'sniper_shot'],
    ['DESTROY_DRAGON_WILL', 'destroy_dragon_breath'],
    ['ULTIMATE_DESTROY_GOD', 'udg_destroyed'],
    ['LIGHTNING_WILL', 'lightning_destroyed'],
    ['METEOR_GOD', 'meteor_god_cell_destroy'],
    ['WILL_HUNTER_KING', 'will_hunter_king_slash'],
    ['ROBOT_VACUUM', 'robot_vacuum_suck'],
    ['GLUTTONOUS_WILL', 'gluttonous_eat'],
    ['SUPER_BUOYANCY_WILL', 'super_buoyancy_collision'],
    ['SUPER_GRAVITY_WILL', 'super_gravity_collision'],
    ['SUPER_ATTRACTION_WILL', 'super_attraction_collision']
  ])('classifies non-generic DESTROY presentation %s/%s', (cause, reason) => {
    expect(profiles.isNonGenericDestroyTarget({ cause, reason })).toBe(true);
  });

  test('keeps ordinary DESTROY targets on the generic fade profile', () => {
    expect(profiles.isNonGenericDestroyTarget({
      cause: 'DESTROY_ONE_STONE',
      reason: 'destroy_selected'
    })).toBe(false);
  });

  test('classifies only canonical FIRE_WILL scorch status as the flame beam trajectory', () => {
    const target = {
      cause: 'FIRE_WILL',
      reason: 'scorched_cell_applied',
      meta: {
        special: 'SCORCHED_CELL',
        cause: 'FIRE_WILL',
        reason: 'scorched_cell_applied',
        sourceTrajectoryProfile: 'fireWillFlameBeam'
      }
    };
    expect(profiles.getBoardSourceTrajectoryProfileKey('status_applied', target)).toBe('fireWillFlameBeam');
    expect(profiles.getBoardSourceTrajectoryProfileKey('destroy', target)).toBeNull();
    expect(profiles.getBoardSourceTrajectoryProfileKey(
      'status_applied',
      { ...target, meta: { ...target.meta, special: 'POISON_CELL' } }
    )).toBeNull();
  });

  test('classifies only canonical GRASS_WILL seed status as the grass beam trajectory', () => {
    const target = {
      cause: 'GRASS_WILL',
      reason: 'grass_seeded',
      meta: {
        special: 'SEED',
        cause: 'GRASS_WILL',
        reason: 'grass_seeded',
        sourceTrajectoryProfile: 'grassWillSeedBeam'
      }
    };
    expect(profiles.getBoardSourceTrajectoryProfileKey('status_applied', target)).toBe('grassWillSeedBeam');
    expect(profiles.getBoardSourceTrajectoryProfileKey('destroy', target)).toBeNull();
    expect(profiles.getBoardSourceTrajectoryProfileKey(
      'status_applied',
      { ...target, meta: { ...target.meta, special: 'SCORCHED_CELL' } }
    )).toBeNull();
  });

  test('classifies only canonical WATER_WILL healing status as the water beam trajectory', () => {
    const target = {
      cause: 'WATER_WILL',
      reason: 'healing_cell_applied',
      meta: {
        special: 'HEALING_CELL',
        cause: 'WATER_WILL',
        reason: 'healing_cell_applied',
        sourceTrajectoryProfile: 'waterWillHealingBeam'
      }
    };
    expect(profiles.getBoardSourceTrajectoryProfileKey('status_applied', target)).toBe('waterWillHealingBeam');
    expect(profiles.getBoardSourceTrajectoryProfileKey('destroy', target)).toBeNull();
    expect(profiles.getBoardSourceTrajectoryProfileKey(
      'status_applied',
      { ...target, meta: { ...target.meta, special: 'SCORCHED_CELL' } }
    )).toBeNull();
  });

  test('equality will is treated as a positive normal spawn profile', () => {
    const profile = profiles.POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS.find((one) => one && one.cause === 'EQUALITY_WILL');
    expect(profile).toEqual(expect.objectContaining({
      cause: 'EQUALITY_WILL',
      reasonPrefix: 'equality_will_spawn',
      spawnIntent: 'normal_spawn'
    }));

    expect(profiles.matchesSpawnProfileTarget({
      cause: 'EQUALITY_WILL',
      reason: 'equality_will_spawn',
      meta: { spawnIntent: 'normal_spawn' }
    }, 'EQUALITY_WILL', 'equality_will_spawn', profile)).toBe(true);
  });

  test('card-effect spawn playback profiles centralize cause and reason matching', () => {
    expect(profiles.CARD_EFFECT_SPAWN_PLAYBACK_PROFILES).toEqual([
      { spawnIntent: 'normal_spawn', cause: 'REINFORCEMENT_WILL', reasonPrefix: 'reinforcement_will_spawn' },
      { spawnIntent: 'normal_spawn', cause: 'SUPPORT_TROOPS_WILL', reasonPrefix: 'support_troops_will_spawn' },
      { spawnIntent: 'salvation_spawn', cause: 'SALVATION_WILL', reasonPrefix: 'salvation_spawn' },
      { spawnIntent: 'salvation_spawn', cause: 'STONE_SALVATION_GOD', reasonPrefix: 'stone_salvation_god_revive' }
    ]);

    const reinforcementProfile = profiles.CARD_EFFECT_SPAWN_PLAYBACK_PROFILES[0];
    expect(profiles.isSpawnEventLike({
      cause: 'REINFORCEMENT_WILL',
      reason: 'reinforcement_will_spawn_0',
      meta: { spawnIntent: 'normal_spawn' }
    }, reinforcementProfile)).toBe(true);
  });

  test('inferSpawnIntent preserves board ops spawn intent mappings and fallback', () => {
    expect(profiles.inferSpawnIntent('CLONE_WILL', 'clone_spawn')).toBe('clone_spawn');
    expect(profiles.inferSpawnIntent('BREEDING', 'breeding_spawn_immediate')).toBe('breeding_spawn');
    expect(profiles.inferSpawnIntent('PROLIFERATION_WILL', 'proliferation_spawn')).toBe('proliferation_spawn');
    expect(profiles.inferSpawnIntent('SALVATION_WILL', 'salvation_spawn')).toBe('salvation_spawn');
    expect(profiles.inferSpawnIntent('STONE_SALVATION_GOD', 'stone_salvation_god_revive')).toBe('salvation_spawn');
    expect(profiles.inferSpawnIntent('LIVING_WILL', 'living_will_restored')).toBe('restore_spawn');
    expect(profiles.inferSpawnIntent('EQUALITY_WILL', 'not_a_reason')).toBe(null);
    expect(profiles.inferSpawnIntent('REINFORCEMENT_WILL', 'also_not_a_spawn_reason')).toBe('normal_spawn');
    expect(profiles.inferSpawnIntent('SUPPORT_TROOPS_WILL', 'support_troops_will_spawn')).toBe('normal_spawn');
    expect(profiles.inferSpawnIntent('SYSTEM', 'standard_spawn')).toBe('normal_spawn');
    expect(profiles.inferSpawnIntent('SEED_WILL', 'seed_sprout')).toBe('normal_spawn');
    expect(profiles.inferSpawnIntent('GRASS_WILL', 'seed_sprout')).toBe('normal_spawn');
  });
});
