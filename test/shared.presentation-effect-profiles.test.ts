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
});
