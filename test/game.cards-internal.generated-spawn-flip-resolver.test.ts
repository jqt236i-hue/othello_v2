import { createGeneratedSpawnFlipResolver } from '../game/logic/cards-internal/generated-spawn-flip-resolver';

describe('generated spawn and evasion flip resolver', () => {
  test('installs non-enumerable resolvers that preserve generated-spawn result metadata', () => {
    const resolveGeneratedFlipBatch = jest.fn(() => [{ row: 1, col: 2 }]);
    const clearHyperactiveAtPositions = jest.fn();
    const resolver = createGeneratedSpawnFlipResolver({
      cardSpawnAndFlipModule: { resolveGeneratedFlipBatch },
      cardHyperactiveModule: {},
      black: 1,
      white: -1,
      BoardOpsModule: { id: 'board-ops' },
      getCardContext: jest.fn(),
      getFlipsWithContext: jest.fn(),
      clearBombAt: jest.fn(),
      clearHyperactiveAtPositions,
      defaultPrng: { id: 'default-prng' },
      isBlockedCell: jest.fn(),
      destroyAt: jest.fn()
    });
    const cardState: any = { visible: true };

    expect(resolver.ensureGeneratedSpawnFlipResolver(cardState)).toBe(cardState);
    expect(Object.keys(cardState)).toEqual(['visible']);
    const result = cardState._generatedSpawnFlipResolver(
      cardState,
      { board: [] },
      [{ row: 3, col: 4, ownerKey: 'white', cause: 'CARD', reason: 'spawn' }]
    );

    expect(resolveGeneratedFlipBatch).toHaveBeenCalledWith(
      cardState,
      { board: [] },
      'white',
      -1,
      [{ row: 3, col: 4 }],
      expect.objectContaining({ changeCause: 'CARD', changeReason: 'spawn_flip' })
    );
    expect(clearHyperactiveAtPositions).toHaveBeenCalledWith(cardState, [{ row: 1, col: 2 }]);
    expect(result).toEqual([{
      ownerKey: 'white',
      cause: 'CARD',
      reason: 'spawn',
      spawned: [{ row: 3, col: 4 }],
      flipped: [{ row: 1, col: 2 }]
    }]);
  });

  test('forwards evasion movement with the existing fallback defaults and event metadata', () => {
    const resolveEvasionMoveFlips = jest.fn(() => ({ ownerKey: 'black', flipped: [], moved: [], destroyed: [] }));
    const defaultPrng = { id: 'default-prng' };
    const resolver = createGeneratedSpawnFlipResolver({
      cardSpawnAndFlipModule: {},
      cardHyperactiveModule: { resolveEvasionMoveFlips },
      defaultPrng,
      clearHyperactiveAtPositions: jest.fn(),
      isBlockedCell: jest.fn(),
      destroyAt: jest.fn(),
      getCardContext: jest.fn(),
      getFlipsWithContext: jest.fn()
    });
    const cardState: any = {};

    resolver.ensureGeneratedSpawnFlipResolver(cardState);
    expect(cardState._evasionMoveFlipResolver(cardState, { board: [] }, {
      row: 5,
      col: 6,
      cause: 'MARKER',
      reason: 'Evasion_Move'
    })).toEqual({ ownerKey: 'black', flipped: [], moved: [], destroyed: [] });
    expect(resolveEvasionMoveFlips).toHaveBeenCalledWith(
      cardState,
      { board: [] },
      { row: 5, col: 6 },
      defaultPrng,
      expect.objectContaining({ defaultPrng }),
      { flipCause: 'MARKER', flipReason: 'evasion_move_flip' }
    );
  });
});
