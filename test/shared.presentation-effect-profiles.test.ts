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

  test('inferSpawnIntent preserves board ops spawn intent mappings and fallback', () => {
    expect(profiles.inferSpawnIntent('CLONE_WILL', 'clone_spawn')).toBe('clone_spawn');
    expect(profiles.inferSpawnIntent('BREEDING', 'breeding_spawn_immediate')).toBe('breeding_spawn');
    expect(profiles.inferSpawnIntent('PROLIFERATION_WILL', 'proliferation_spawn')).toBe('proliferation_spawn');
    expect(profiles.inferSpawnIntent('SALVATION_WILL', 'salvation_spawn')).toBe('salvation_spawn');
    expect(profiles.inferSpawnIntent('STONE_SALVATION_GOD', 'stone_salvation_god_revive')).toBe('salvation_spawn');
    expect(profiles.inferSpawnIntent('LIVING_WILL', 'living_will_restored')).toBe('restore_spawn');
    expect(profiles.inferSpawnIntent('EQUALITY_WILL', 'not_a_spawn_reason')).toBe('normal_spawn');
    expect(profiles.inferSpawnIntent('REINFORCEMENT_WILL', 'also_not_a_spawn_reason')).toBe('normal_spawn');
    expect(profiles.inferSpawnIntent('SUPPORT_TROOPS_WILL', 'support_troops_will_spawn')).toBe('normal_spawn');
    expect(profiles.inferSpawnIntent('SYSTEM', 'standard_spawn')).toBe('normal_spawn');
    expect(profiles.inferSpawnIntent('SEED_WILL', 'seed_sprout')).toBe(null);
  });
});
