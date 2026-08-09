export interface MatchRoomDeckRawProjectionFixture {
  name: string;
  roomDeck: unknown;
  initialDeckSizeByPlayer?: { black?: unknown; white?: unknown };
  initialDeckSize?: unknown;
  expectedWorker: unknown;
  expectedLocal: unknown;
}

export const MATCH_ROOM_DECK_RAW_PROJECTION_FIXTURES: MatchRoomDeckRawProjectionFixture[] = [
  {
    name: 'supported shared metadata normalizes scalar values',
    roomDeck: {
      mode: 'shared',
      source: 'room',
      deckCode: '  SHARED-CODE  ',
      deckSize: '7'
    },
    initialDeckSizeByPlayer: { black: 4, white: 5 },
    expectedWorker: {
      mode: 'shared',
      deckCode: 'SHARED-CODE',
      deckSize: 7,
      source: 'room'
    },
    expectedLocal: {
      mode: 'shared',
      deckCode: 'SHARED-CODE',
      deckSize: 7,
      source: 'room'
    }
  },
  {
    name: 'supported per-player metadata uses snapshot size fallback',
    roomDeck: {
      mode: 'perPlayer',
      source: 'room',
      deckCodeByPlayer: { black: '  BLACK-CODE  ' },
      deckSizeByPlayer: { black: '0', white: null }
    },
    initialDeckSizeByPlayer: { black: 9, white: 8 },
    expectedWorker: {
      mode: 'perPlayer',
      deckCode: '',
      deckSize: null,
      deckCodeByPlayer: { black: 'BLACK-CODE', white: '' },
      deckSizeByPlayer: { black: 0, white: 8 },
      source: 'room'
    },
    expectedLocal: {
      mode: 'perPlayer',
      deckCode: '',
      deckSize: null,
      deckCodeByPlayer: { black: 'BLACK-CODE', white: '' },
      deckSizeByPlayer: { black: 0, white: 8 },
      source: 'room'
    }
  },
  {
    name: 'empty metadata remains a local compatibility value',
    roomDeck: {},
    expectedWorker: null,
    expectedLocal: {
      mode: 'shared',
      deckCode: '',
      deckSize: null,
      source: 'room'
    }
  },
  {
    name: 'non-empty unknown mode is runtime-specific malformed compatibility',
    roomDeck: {
      mode: 'legacyCustom',
      source: ' legacy ',
      deckCode: '  LEGACY-CODE  ',
      deckSize: '5'
    },
    expectedWorker: {
      mode: 'shared',
      deckCode: 'LEGACY-CODE',
      deckSize: 5,
      source: 'legacy'
    },
    expectedLocal: {
      mode: 'legacyCustom',
      deckCode: 'LEGACY-CODE',
      deckSize: 5,
      source: ' legacy '
    }
  },
  {
    name: 'absent metadata and absent snapshot size project null',
    roomDeck: null,
    expectedWorker: null,
    expectedLocal: null
  }
];

export const MATCH_ROOM_DECK_PRIVATE_FIELDS = [
  'initialDeckSpec',
  'initialDeckSpecByPlayer',
  'initialDeckCardIdsByPlayer'
] as const;
