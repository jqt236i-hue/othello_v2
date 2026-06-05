import * as EvasionStatus from '../shared/evasion-status';

describe('shared evasion status profiles', () => {
  test.each([
    ['HYPERACTIVE', 1, undefined, undefined, 'HYPERACTIVE', 'hyperactive_flip_evade_move', false, false],
    ['ESCAPE_HYPERACTIVE', 1, undefined, undefined, 'ESCAPE_HYPERACTIVE', 'escape_hyperactive_flip_evade_move', false, false],
    ['EXTREME_HYPERACTIVE', 3, 1, 3, 'EXTREME_HYPERACTIVE_WILL', 'extreme_hyperactive_flip_evade_move', false, false],
    ['ULTIMATE_HYPERACTIVE', 3, 1, 3, 'ULTIMATE_HYPERACTIVE_GOD', 'ultimate_hyperactive_flip_evade_move', true, false],
    ['AFTERIMAGE_WILL', 3, 3, undefined, 'AFTERIMAGE_WILL', 'afterimage_will_flip_evade_move', false, true],
    ['WILL_HUNTER_KING', 2, 2, undefined, 'WILL_HUNTER_KING', 'will_hunter_king_flip_evade_move', false, false]
  ])(
    '%s profile exposes shared defaults and flip metadata',
    (type, flipDefault, destroyDefault, visualFlipDefault, flipCause, flipMoveReason, requiresActiveDuration, pruneWhenBothDepleted) => {
      const profile = EvasionStatus.getEvasionProfile(type);
      expect(profile).toBeTruthy();
      expect(profile.flipDefault).toBe(flipDefault);
      expect(profile.destroyDefault).toBe(destroyDefault);
      expect(profile.visualFlipDefault).toBe(visualFlipDefault);
      expect(profile.flipCause).toBe(flipCause);
      expect(profile.flipMoveReason).toBe(flipMoveReason);
      expect(!!profile.requiresActiveDuration).toBe(requiresActiveDuration);
      expect(!!profile.pruneWhenBothDepleted).toBe(pruneWhenBothDepleted);
    }
  );

  test('flip/destroy counter readers fall back to profile defaults by mode', () => {
    expect(EvasionStatus.readFlipEvadeRemaining({ type: 'WILL_HUNTER_KING' })).toBe(2);
    expect(EvasionStatus.readDestroyEvadeRemaining({ type: 'WILL_HUNTER_KING' })).toBe(2);
    expect(EvasionStatus.readFlipEvadeRemaining({ type: 'WILL_HUNTER_KING' }, { mode: 'visual' })).toBeNull();
    expect(EvasionStatus.readFlipEvadeRemaining({ type: 'EXTREME_HYPERACTIVE' }, { mode: 'visual' })).toBe(3);
  });

  test('flip evasion availability respects active duration and instant-placement-only markers', () => {
    expect(EvasionStatus.canUseFlipEvade({ type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 0, flipEvadeRemaining: 3 })).toBe(false);
    expect(EvasionStatus.canUseFlipEvade({ type: 'HYPERACTIVE', instantPlacementOnly: true, flipEvadeRemaining: 1 })).toBe(false);
    expect(EvasionStatus.canUseFlipEvade({ type: 'AFTERIMAGE_WILL' })).toBe(true);
  });

  test('counter consumption uses profile defaults when marker data omitted them', () => {
    const afterimage = { type: 'AFTERIMAGE_WILL' };
    expect(EvasionStatus.consumeDestroyEvade(afterimage)).toBe(2);
    expect(afterimage.destroyEvadeRemaining).toBe(2);

  });

  test('only prune profiles configured to disappear after both counters are depleted', () => {
    expect(EvasionStatus.shouldPruneEvasionMarker({ type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 0, destroyEvadeRemaining: 0 })).toBe(true);
    expect(EvasionStatus.shouldPruneEvasionMarker({ type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 0, destroyEvadeRemaining: 1 })).toBe(false);
    expect(EvasionStatus.shouldPruneEvasionMarker({ type: 'WILL_HUNTER_KING', flipEvadeRemaining: 0, destroyEvadeRemaining: 0 })).toBe(false);
  });
});
