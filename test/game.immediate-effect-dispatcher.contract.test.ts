import * as ImmediateEffectDispatcher from '../game/turn/immediate-effect-dispatcher';

function createPrng(value = 0) {
  return { random: () => value };
}

function createContext(overrides: any = {}) {
  const events: any[] = [];
  const calls: any[] = [];
  const CardLogic = {
    processUltimateDestroyGodEffectsAtAnchor: (...args: any[]) => {
      calls.push({ name: 'processUltimateDestroyGodEffectsAtAnchor', args });
      return { destroyed: [{ row: 3, col: 4 }] };
    },
    processDestroyDragonEffectsAtAnchor: (...args: any[]) => {
      calls.push({ name: 'processDestroyDragonEffectsAtAnchor', args });
      return { destroyed: [{ row: 4, col: 3 }], expired: [] };
    },
    processSniperWillEffectsAtTurnStartAnchor: (...args: any[]) => {
      calls.push({ name: 'processSniperWillEffectsAtTurnStartAnchor', args });
      return { destroyed: [{ row: 2, col: 3 }], expired: [] };
    }
  };
  const randomSource = createPrng(0.25);
  return {
    ctx: {
      CardLogic,
      cardState: {},
      gameState: { board: [] },
      playerKey: 'black',
      events,
      row: 3,
      col: 3,
      typeKey: 'ULTIMATE_DESTROY_GOD',
      randomSource,
      source: 'theory_spawn',
      ...overrides
    },
    calls,
    events,
    randomSource
  };
}

describe('ImmediateEffectDispatcher context contract', () => {
  test('passes randomSource to ULTIMATE_DESTROY_GOD immediate effects', () => {
    const { ctx, calls, events, randomSource } = createContext();

    ImmediateEffectDispatcher.resolveImmediateEffects(ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('processUltimateDestroyGodEffectsAtAnchor');
    expect(calls[0].args.slice(2, 5)).toEqual(['black', 3, 3]);
    expect(calls[0].args[5]).toMatchObject({
      decrementRemainingOwnerTurns: false,
      randomSource
    });
    expect(events).toContainEqual({
      type: 'udg_destroyed_immediate',
      details: [{ row: 3, col: 4 }]
    });
  });

  test('passes both random and randomSource to legacy option-shaped destroy effects', () => {
    const { ctx, calls, randomSource } = createContext({ typeKey: 'DESTROY_DRAGON' });

    ImmediateEffectDispatcher.resolveImmediateEffects(ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('processDestroyDragonEffectsAtAnchor');
    expect(calls[0].args[5]).toMatchObject({
      decrementRemainingOwnerTurns: false,
      random: randomSource,
      randomSource
    });
  });

  test('fails at dispatcher boundary when randomSource is missing', () => {
    const { ctx } = createContext({ randomSource: null });

    expect(() => ImmediateEffectDispatcher.resolveImmediateEffects(ctx)).toThrow(
      'ImmediateEffectDispatcher requires an injected deterministic PRNG.'
    );
  });
});
