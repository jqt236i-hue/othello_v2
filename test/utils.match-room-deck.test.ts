import {
  buildInitialDeckSnapshotOptions,
  buildRoomDeckSelectionPatch,
  cloneRoomDeckCardIdsByPlayer,
  cloneRoomDeckSpecByPlayer,
  createAllCardsRoomDeckMetadata,
  isAllCardsDeckRoom,
  MatchRoomDeckMetadata,
  normalizeRoomDeckSize,
  projectPublicRoomDeck
} from '../utils/match-room-deck';

function perPlayerMetadata(overrides: Partial<MatchRoomDeckMetadata> = {}): MatchRoomDeckMetadata {
  return {
    mode: 'perPlayer',
    source: 'room',
    deckCode: '',
    deckSize: null,
    deckCodeByPlayer: { black: '', white: '' },
    deckSizeByPlayer: { black: null, white: null },
    ...overrides
  };
}

describe('match-room-deck pure contract', () => {
  test('normalizes the existing scalar deck-size rule', () => {
    expect(normalizeRoomDeckSize(null)).toBeNull();
    expect(normalizeRoomDeckSize(undefined)).toBeNull();
    expect(normalizeRoomDeckSize('')).toBeNull();
    expect(normalizeRoomDeckSize(' 7.9 ')).toBe(7);
    expect(normalizeRoomDeckSize(-3.4)).toBe(0);
    expect(normalizeRoomDeckSize(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizeRoomDeckSize('not-a-number')).toBeNull();
  });

  test('clones normalized seat maps while preserving explicit empty values', () => {
    const cardIds = { black: [] as string[], white: ['card-a'] };
    const specs = { black: {}, white: { cards: [{ cardId: 'card-a', count: 1 }] } };
    const clonedCardIds = cloneRoomDeckCardIdsByPlayer(cardIds);
    const clonedSpecs = cloneRoomDeckSpecByPlayer(specs);

    expect(clonedCardIds).toEqual(cardIds);
    expect(clonedCardIds.black).not.toBe(cardIds.black);
    expect(clonedCardIds.white).not.toBe(cardIds.white);
    expect(clonedSpecs).toEqual(specs);
    expect(clonedSpecs.black).not.toBe(specs.black);
    expect(clonedSpecs.white).not.toBe(specs.white);
    expect(() => cloneRoomDeckCardIdsByPlayer({ black: [' card-a '], white: [] })).toThrow(TypeError);
    expect(cloneRoomDeckSpecByPlayer({ black: [], white: null })).toEqual({ black: [], white: null });
    expect(() => cloneRoomDeckSpecByPlayer({ black: undefined, white: null } as any)).toThrow(TypeError);
    expect(() => cloneRoomDeckSpecByPlayer({ black: 'not-a-spec', white: null } as any)).toThrow(TypeError);
  });

  test('builds all-cards metadata from explicit per-seat arrays including zero cards', () => {
    expect(createAllCardsRoomDeckMetadata({ black: [], white: ['card-a', 'card-b'] })).toEqual({
      mode: 'shared',
      source: 'allCards',
      deckCode: '',
      deckSize: 0,
      deckCodeByPlayer: { black: '', white: '' },
      deckSizeByPlayer: { black: 0, white: 2 }
    });
    expect(isAllCardsDeckRoom(false, ' allCards ')).toBe(true);
    expect(isAllCardsDeckRoom(true, null)).toBe(true);
    expect(isAllCardsDeckRoom(false, 'room')).toBe(false);
    expect(() => isAllCardsDeckRoom(false, 1 as any)).toThrow(TypeError);

    const sparseCardIds = new Array<string>(1);
    expect(() => createAllCardsRoomDeckMetadata({ black: sparseCardIds, white: [] })).toThrow(TypeError);
  });

  test('builds fresh initial options without collapsing empty arrays or empty specs', () => {
    const emptySpec = {};
    const sharedSpec = { cards: [{ cardId: 'shared', count: 1 }] };
    const boardConfig = { rows: 8, cols: 8 };
    const options = buildInitialDeckSnapshotOptions({
      initialDeckCardIdsByPlayer: { black: [], white: null },
      initialDeckSpecByPlayer: { black: emptySpec, white: null },
      initialDeckSpec: sharedSpec
    }, boardConfig);

    expect(options).toEqual({
      initialDeckCardIdsByPlayer: { black: [], white: null },
      initialDeckSpecByPlayer: { black: {}, white: null },
      boardConfig
    });
    expect(options.initialDeckCardIdsByPlayer.black).not.toBeNull();
    expect(options.initialDeckSpecByPlayer.black).not.toBe(emptySpec);
    expect(options).not.toHaveProperty('initialDeckSpec');

    const sharedOptions = buildInitialDeckSnapshotOptions({
      initialDeckCardIdsByPlayer: { black: null, white: null },
      initialDeckSpecByPlayer: { black: null, white: null },
      initialDeckSpec: sharedSpec
    }, null);
    expect(sharedOptions.initialDeckSpec).toEqual(sharedSpec);
    expect(sharedOptions.initialDeckSpec).not.toBe(sharedSpec);
  });

  test('calculates a complete immutable selection patch and preserves valid zero-card specs', () => {
    const sharedSpec = { cards: [{ cardId: 'old', count: 1 }] };
    const current = {
      initialDeckSpec: sharedSpec,
      initialDeckSpecByPlayer: null,
      roomDeck: perPlayerMetadata({
        deckCodeByPlayer: { black: '', white: 'WHITE' },
        deckSizeByPlayer: { black: null, white: 30 }
      })
    };
    const zeroSpec = {};
    const patch = buildRoomDeckSelectionPatch(current, 'black', {
      ok: true,
      hasCustomDeck: true,
      deckSpec: zeroSpec,
      deckCode: 'ZERO',
      deckSize: 0
    });

    expect(patch).toEqual({
      initialDeckSpec: null,
      initialDeckSpecByPlayer: {
        black: {},
        white: sharedSpec
      },
      roomDeck: {
        mode: 'perPlayer',
        source: 'room',
        deckCode: '',
        deckSize: null,
        deckCodeByPlayer: { black: 'ZERO', white: 'WHITE' },
        deckSizeByPlayer: { black: 0, white: 30 }
      }
    });
    expect(patch.initialDeckSpecByPlayer.black).not.toBe(zeroSpec);
    expect(patch.initialDeckSpecByPlayer.white).not.toBe(sharedSpec);
    expect(current.initialDeckSpec).toBe(sharedSpec);
    expect(current.roomDeck.deckCodeByPlayer.black).toBe('');
  });

  test('removing the last selection prunes both normalized metadata and seat specs', () => {
    const patch = buildRoomDeckSelectionPatch({
      initialDeckSpec: null,
      initialDeckSpecByPlayer: { black: { cards: [] }, white: null },
      roomDeck: perPlayerMetadata({
        deckCodeByPlayer: { black: 'BLACK', white: '' },
        deckSizeByPlayer: { black: 0, white: null }
      })
    }, 'black', {
      ok: true,
      hasCustomDeck: false,
      deckSpec: null,
      deckCode: '',
      deckSize: null
    });
    expect(patch).toEqual({
      initialDeckSpec: null,
      initialDeckSpecByPlayer: null,
      roomDeck: null
    });
  });

  test('projects shared and per-player public metadata using the existing fallback rules', () => {
    expect(projectPublicRoomDeck(null, {
      initialDeckSizeByPlayer: { black: null, white: 12 },
      initialDeckSize: 30
    })).toEqual({
      mode: 'shared',
      deckCode: '',
      deckSize: 30,
      source: 'room'
    });

    expect(projectPublicRoomDeck(perPlayerMetadata({
      deckCodeByPlayer: { black: 'SAME', white: 'SAME' },
      deckSizeByPlayer: { black: null, white: null },
      source: 'custom-source'
    }), {
      initialDeckSizeByPlayer: { black: 5, white: 5 },
      initialDeckSize: null
    })).toEqual({
      mode: 'perPlayer',
      deckCode: 'SAME',
      deckSize: 5,
      deckCodeByPlayer: { black: 'SAME', white: 'SAME' },
      deckSizeByPlayer: { black: 5, white: 5 },
      source: 'custom-source'
    });

    expect(projectPublicRoomDeck(perPlayerMetadata({
      deckCodeByPlayer: { black: 'BLACK', white: 'WHITE' }
    }), {
      initialDeckSizeByPlayer: { black: 4, white: 3 },
      initialDeckSize: 30
    })).toMatchObject({
      deckCode: '',
      deckSize: null,
      deckSizeByPlayer: { black: 4, white: 3 }
    });

    expect(projectPublicRoomDeck(null, {
      initialDeckSizeByPlayer: { black: null, white: null },
      initialDeckSize: null
    })).toBeNull();

    expect(projectPublicRoomDeck({
      mode: 'shared',
      source: 'room',
      deckCode: '',
      deckSize: null,
      deckCodeByPlayer: { black: '', white: '' },
      deckSizeByPlayer: { black: null, white: null }
    }, {
      initialDeckSizeByPlayer: { black: null, white: null },
      initialDeckSize: null
    })).toEqual({ mode: 'shared', deckCode: '', deckSize: null, source: 'room' });
  });

  test('throws for structurally invalid normalized DTOs instead of returning absence', () => {
    expect(() => buildInitialDeckSnapshotOptions({
      initialDeckCardIdsByPlayer: { black: null } as any,
      initialDeckSpecByPlayer: { black: null, white: null },
      initialDeckSpec: null
    }, null)).toThrow(TypeError);
    expect(() => buildRoomDeckSelectionPatch({
      initialDeckSpec: null,
      initialDeckSpecByPlayer: null,
      roomDeck: null
    }, 'black', {
      ok: true,
      hasCustomDeck: true,
      deckSpec: null,
      deckCode: '',
      deckSize: 0
    } as any)).toThrow(TypeError);
    expect(() => buildRoomDeckSelectionPatch({
      initialDeckSpec: null,
      initialDeckSpecByPlayer: null,
      roomDeck: null
    }, 'black', {
      ok: true,
      hasCustomDeck: true,
      deckSpec: {},
      deckCode: '',
      deckSize: null
    })).toThrow(TypeError);
    expect(() => buildRoomDeckSelectionPatch({
      initialDeckSpec: null,
      initialDeckSpecByPlayer: null,
      roomDeck: null
    }, 'black', {
      ok: true,
      hasCustomDeck: false,
      deckSpec: {},
      deckCode: 'CUSTOM',
      deckSize: 0
    } as any)).toThrow(TypeError);
    expect(() => projectPublicRoomDeck({
      ...perPlayerMetadata(),
      mode: 'legacy' as any
    }, {
      initialDeckSizeByPlayer: { black: null, white: null },
      initialDeckSize: null
    })).toThrow(TypeError);
    expect(() => projectPublicRoomDeck(null, {
      initialDeckSizeByPlayer: { black: -1, white: null },
      initialDeckSize: null
    })).toThrow(TypeError);
  });
});
