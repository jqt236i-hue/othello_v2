import deepClone from './deepClone.js';

export type MatchRoomDeckSeatKey = 'black' | 'white';
export type MatchRoomDeckMode = 'shared' | 'perPlayer';
export type MatchRoomDeckSpec = object;

export interface MatchRoomDeckSeatMap<T> {
    black: T;
    white: T;
}

export interface MatchRoomDeckMetadata {
    mode: MatchRoomDeckMode;
    source: string;
    deckCode: string;
    deckSize: number | null;
    deckCodeByPlayer: MatchRoomDeckSeatMap<string>;
    deckSizeByPlayer: MatchRoomDeckSeatMap<number | null>;
}

export interface MatchRoomDeckCustomSelectionSuccess {
    ok: true;
    hasCustomDeck: true;
    deckSpec: MatchRoomDeckSpec;
    deckCode: string;
    deckSize: number | null;
}

export interface MatchRoomDeckDefaultSelectionSuccess {
    ok: true;
    hasCustomDeck: false;
    deckSpec: null;
    deckCode: '';
    deckSize: null;
}

export type MatchRoomDeckSelectionSuccess =
    | MatchRoomDeckCustomSelectionSuccess
    | MatchRoomDeckDefaultSelectionSuccess;

export interface MatchRoomDeckSelectionState {
    initialDeckSpec: MatchRoomDeckSpec | null;
    initialDeckSpecByPlayer: MatchRoomDeckSeatMap<MatchRoomDeckSpec | null> | null;
    roomDeck: MatchRoomDeckMetadata | null;
}

export interface MatchRoomDeckSelectionPatch {
    initialDeckSpec: null;
    initialDeckSpecByPlayer: MatchRoomDeckSeatMap<MatchRoomDeckSpec | null> | null;
    roomDeck: MatchRoomDeckMetadata | null;
}

export interface MatchRoomDeckInitialSource {
    initialDeckCardIdsByPlayer: MatchRoomDeckSeatMap<readonly string[] | null>;
    initialDeckSpecByPlayer: MatchRoomDeckSeatMap<MatchRoomDeckSpec | null>;
    initialDeckSpec: MatchRoomDeckSpec | null;
}

export interface MatchRoomDeckInitialOptions {
    initialDeckCardIdsByPlayer?: MatchRoomDeckSeatMap<string[] | null>;
    initialDeckSpecByPlayer?: MatchRoomDeckSeatMap<MatchRoomDeckSpec | null>;
    initialDeckSpec?: MatchRoomDeckSpec;
    boardConfig?: unknown;
}

export interface MatchRoomDeckSnapshotSizeFacts {
    initialDeckSizeByPlayer: MatchRoomDeckSeatMap<number | null>;
    initialDeckSize: number | null;
}

export interface MatchRoomDeckPublicShared {
    mode: 'shared';
    deckSize: number | null;
    source: string;
}

export interface MatchRoomDeckPublicPerPlayer {
    mode: 'perPlayer';
    deckSize: number | null;
    deckSizeByPlayer: MatchRoomDeckSeatMap<number | null>;
    source: string;
}

export type MatchRoomDeckPublicMetadata = MatchRoomDeckPublicShared | MatchRoomDeckPublicPerPlayer;

function fail(message: string): never {
    throw new TypeError(`match-room-deck: ${message}`);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertSeatMap<T>(
    value: unknown,
    name: string,
    assertValue: (candidate: unknown, fieldName: string) => asserts candidate is T
): asserts value is MatchRoomDeckSeatMap<T> {
    if (!isObjectRecord(value)) fail(`${name} must be a seat map`);
    if (!Object.prototype.hasOwnProperty.call(value, 'black') || !Object.prototype.hasOwnProperty.call(value, 'white')) {
        fail(`${name} must contain black and white`);
    }
    assertValue(value.black, `${name}.black`);
    assertValue(value.white, `${name}.white`);
}

function assertNormalizedDeckSize(value: unknown, name: string): asserts value is number | null {
    if (value === null) return;
    if (!Number.isInteger(value) || Number(value) < 0) fail(`${name} must be a non-negative integer or null`);
}

function assertNormalizedDeckCode(value: unknown, name: string): asserts value is string {
    if (typeof value !== 'string') fail(`${name} must be a string`);
}

function assertNormalizedCardIds(value: unknown, name: string): asserts value is readonly string[] | null {
    if (value === null) return;
    if (!Array.isArray(value)) fail(`${name} must be an array or null`);
    for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
            fail(`${name}[${index}] must be present`);
        }
        const cardId = value[index];
        if (typeof cardId !== 'string' || !cardId || cardId !== cardId.trim()) {
            fail(`${name}[${index}] must be a non-empty normalized string`);
        }
    }
}

function assertNormalizedDeckSpec(value: unknown, name: string): asserts value is MatchRoomDeckSpec | null {
    if (value === null) return;
    if (typeof value !== 'object') fail(`${name} must be an object, array, or null`);
}

function assertNormalizedDeckSpecValue(value: unknown, name: string): asserts value is MatchRoomDeckSpec | null {
    assertNormalizedDeckSpec(value, name);
}

function assertRoomDeckMetadata(value: unknown, name = 'metadata'): asserts value is MatchRoomDeckMetadata {
    if (!isObjectRecord(value)) fail(`${name} must be an object`);
    if (value.mode !== 'shared' && value.mode !== 'perPlayer') {
        fail(`${name}.mode must be shared or perPlayer`);
    }
    if (typeof value.source !== 'string') fail(`${name}.source must be a string`);
    assertNormalizedDeckCode(value.deckCode, `${name}.deckCode`);
    assertNormalizedDeckSize(value.deckSize, `${name}.deckSize`);
    assertSeatMap(value.deckCodeByPlayer, `${name}.deckCodeByPlayer`, assertNormalizedDeckCode);
    assertSeatMap(value.deckSizeByPlayer, `${name}.deckSizeByPlayer`, assertNormalizedDeckSize);
}

function cloneMetadata(metadata: MatchRoomDeckMetadata): MatchRoomDeckMetadata {
    return {
        mode: metadata.mode,
        source: metadata.source,
        deckCode: metadata.deckCode,
        deckSize: metadata.deckSize,
        deckCodeByPlayer: {
            black: metadata.deckCodeByPlayer.black,
            white: metadata.deckCodeByPlayer.white
        },
        deckSizeByPlayer: {
            black: metadata.deckSizeByPlayer.black,
            white: metadata.deckSizeByPlayer.white
        }
    };
}

function hasMetadataEntries(metadata: MatchRoomDeckMetadata): boolean {
    return !!(
        metadata.deckCode
        || metadata.deckSize !== null
        || metadata.deckCodeByPlayer.black
        || metadata.deckCodeByPlayer.white
        || metadata.deckSizeByPlayer.black !== null
        || metadata.deckSizeByPlayer.white !== null
    );
}

export function normalizeRoomDeckSize(value: unknown): number | null {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    return Number.isFinite(Number(value))
        ? Math.max(0, Math.trunc(Number(value)))
        : null;
}

/**
 * Applies the public room-deck envelope to values that may have come from an
 * older replay buffer or a generic response builder.  Unlike
 * `projectPublicRoomDeck`, this accepts a malformed legacy value so the final
 * public-payload boundary can still remove card sources without changing the
 * local compatibility mode label.
 */
export function sanitizePublicRoomDeck(value: unknown): Record<string, unknown> | null {
    if (!isObjectRecord(value)) return null;

    const mode = typeof value.mode === 'string' && value.mode
        ? value.mode
        : 'shared';
    const deckSize = normalizeRoomDeckSize(value.deckSize);
    const source = typeof value.source === 'string' && value.source
        ? value.source
        : 'room';

    if (mode === 'perPlayer') {
        const rawDeckSizeByPlayer = isObjectRecord(value.deckSizeByPlayer)
            ? value.deckSizeByPlayer
            : {};
        const deckSizeByPlayer = {
            black: normalizeRoomDeckSize(rawDeckSizeByPlayer.black),
            white: normalizeRoomDeckSize(rawDeckSizeByPlayer.white)
        };
        return {
            mode,
            deckSize: deckSize !== null
                ? deckSize
                : (deckSizeByPlayer.black === deckSizeByPlayer.white ? deckSizeByPlayer.black : null),
            deckSizeByPlayer,
            source
        };
    }

    return { mode, deckSize, source };
}

export function cloneRoomDeckCardIdsByPlayer(
    value: MatchRoomDeckSeatMap<readonly string[] | null>
): MatchRoomDeckSeatMap<string[] | null> {
    assertSeatMap(value, 'initialDeckCardIdsByPlayer', assertNormalizedCardIds);
    return {
        black: value.black === null ? null : value.black.slice(),
        white: value.white === null ? null : value.white.slice()
    };
}

export function cloneRoomDeckSpecByPlayer(
    value: MatchRoomDeckSeatMap<MatchRoomDeckSpec | null>
): MatchRoomDeckSeatMap<MatchRoomDeckSpec | null> {
    assertSeatMap(value, 'initialDeckSpecByPlayer', assertNormalizedDeckSpecValue);
    return {
        black: value.black === null ? null : deepClone(value.black),
        white: value.white === null ? null : deepClone(value.white)
    };
}

export function createAllCardsRoomDeckMetadata(
    cardIdsByPlayer: MatchRoomDeckSeatMap<readonly string[]>
): MatchRoomDeckMetadata {
    const assertCards = (value: unknown, name: string): asserts value is readonly string[] => {
        assertNormalizedCardIds(value, name);
        if (value === null) fail(`${name} must be an array`);
    };
    assertSeatMap(cardIdsByPlayer, 'cardIdsByPlayer', assertCards);
    return {
        mode: 'shared',
        source: 'allCards',
        deckCode: '',
        deckSize: cardIdsByPlayer.black.length,
        deckCodeByPlayer: { black: '', white: '' },
        deckSizeByPlayer: {
            black: cardIdsByPlayer.black.length,
            white: cardIdsByPlayer.white.length
        }
    };
}

export function isAllCardsDeckRoom(allCardsDeckEnabled: boolean, roomDeckSource: string | null): boolean {
    if (typeof allCardsDeckEnabled !== 'boolean') fail('allCardsDeckEnabled must be boolean');
    if (roomDeckSource !== null && typeof roomDeckSource !== 'string') {
        fail('roomDeckSource must be a string or null');
    }
    return allCardsDeckEnabled || String(roomDeckSource || '').trim() === 'allCards';
}

export function buildInitialDeckSnapshotOptions(
    source: MatchRoomDeckInitialSource,
    boardConfig: unknown | null
): MatchRoomDeckInitialOptions {
    if (!isObjectRecord(source)) fail('initial source must be an object');
    assertSeatMap(source.initialDeckCardIdsByPlayer, 'initialDeckCardIdsByPlayer', assertNormalizedCardIds);
    assertSeatMap(source.initialDeckSpecByPlayer, 'initialDeckSpecByPlayer', assertNormalizedDeckSpecValue);
    assertNormalizedDeckSpec(source.initialDeckSpec, 'initialDeckSpec');
    if (boardConfig !== null && !isObjectRecord(boardConfig)) fail('boardConfig must be an object or null');

    const options: MatchRoomDeckInitialOptions = {};
    const cardIdsByPlayer = cloneRoomDeckCardIdsByPlayer(source.initialDeckCardIdsByPlayer);
    if (cardIdsByPlayer.black !== null || cardIdsByPlayer.white !== null) {
        options.initialDeckCardIdsByPlayer = cardIdsByPlayer;
    }

    const specByPlayer = cloneRoomDeckSpecByPlayer(source.initialDeckSpecByPlayer);
    if (specByPlayer.black !== null || specByPlayer.white !== null) {
        options.initialDeckSpecByPlayer = specByPlayer;
    } else if (source.initialDeckSpec !== null) {
        options.initialDeckSpec = deepClone(source.initialDeckSpec);
    }

    if (boardConfig !== null) options.boardConfig = boardConfig;
    return options;
}

export function buildRoomDeckSelectionPatch(
    current: MatchRoomDeckSelectionState,
    seatKey: MatchRoomDeckSeatKey,
    selection: MatchRoomDeckSelectionSuccess
): MatchRoomDeckSelectionPatch {
    if (!isObjectRecord(current)) fail('selection state must be an object');
    if (seatKey !== 'black' && seatKey !== 'white') fail('seatKey must be black or white');
    assertNormalizedDeckSpec(current.initialDeckSpec, 'current.initialDeckSpec');
    if (current.initialDeckSpecByPlayer !== null) {
        assertSeatMap(
            current.initialDeckSpecByPlayer,
            'current.initialDeckSpecByPlayer',
            assertNormalizedDeckSpecValue
        );
    }
    if (current.roomDeck !== null) assertRoomDeckMetadata(current.roomDeck, 'current.roomDeck');
    if (!isObjectRecord(selection) || selection.ok !== true) fail('selection must be a successful DTO');
    if (typeof selection.hasCustomDeck !== 'boolean') fail('selection.hasCustomDeck must be boolean');
    assertNormalizedDeckCode(selection.deckCode, 'selection.deckCode');
    assertNormalizedDeckSize(selection.deckSize, 'selection.deckSize');
    assertNormalizedDeckSpec(selection.deckSpec, 'selection.deckSpec');
    if (selection.hasCustomDeck) {
        if (selection.deckSpec === null) fail('custom selection requires deckSpec');
        if (!selection.deckCode || selection.deckCode !== selection.deckCode.trim()) {
            fail('custom selection requires a normalized non-empty deckCode');
        }
    } else if (selection.deckSpec !== null || selection.deckCode !== '' || selection.deckSize !== null) {
        fail('default selection must not contain custom deck fields');
    }

    let initialDeckSpecByPlayer: MatchRoomDeckSeatMap<MatchRoomDeckSpec | null>;
    if (current.initialDeckSpecByPlayer !== null) {
        initialDeckSpecByPlayer = cloneRoomDeckSpecByPlayer(current.initialDeckSpecByPlayer);
    } else if (current.initialDeckSpec !== null) {
        initialDeckSpecByPlayer = {
            black: deepClone(current.initialDeckSpec),
            white: deepClone(current.initialDeckSpec)
        };
    } else {
        initialDeckSpecByPlayer = { black: null, white: null };
    }
    initialDeckSpecByPlayer[seatKey] = selection.hasCustomDeck
        ? deepClone(selection.deckSpec)
        : null;

    const metadata = current.roomDeck === null
        ? {
            mode: 'perPlayer' as const,
            source: 'room',
            deckCode: '',
            deckSize: null,
            deckCodeByPlayer: { black: '', white: '' },
            deckSizeByPlayer: { black: null, white: null }
        }
        : cloneMetadata(current.roomDeck);
    metadata.mode = 'perPlayer';
    metadata.source = 'room';
    metadata.deckCode = '';
    metadata.deckSize = null;
    metadata.deckCodeByPlayer[seatKey] = selection.hasCustomDeck ? selection.deckCode : '';
    metadata.deckSizeByPlayer[seatKey] = selection.hasCustomDeck ? selection.deckSize : null;

    return {
        initialDeckSpec: null,
        initialDeckSpecByPlayer: (
            initialDeckSpecByPlayer.black !== null || initialDeckSpecByPlayer.white !== null
        ) ? initialDeckSpecByPlayer : null,
        roomDeck: hasMetadataEntries(metadata) ? metadata : null
    };
}

export function projectPublicRoomDeck(
    metadata: MatchRoomDeckMetadata | null,
    snapshotSizes: MatchRoomDeckSnapshotSizeFacts
): MatchRoomDeckPublicMetadata | null {
    if (metadata !== null) assertRoomDeckMetadata(metadata);
    if (!isObjectRecord(snapshotSizes)) fail('snapshotSizes must be an object');
    assertSeatMap(
        snapshotSizes.initialDeckSizeByPlayer,
        'snapshotSizes.initialDeckSizeByPlayer',
        assertNormalizedDeckSize
    );
    assertNormalizedDeckSize(snapshotSizes.initialDeckSize, 'snapshotSizes.initialDeckSize');

    const snapshotDeckSizes = snapshotSizes.initialDeckSizeByPlayer;
    const snapshotDeckSize = snapshotDeckSizes.black !== null
        ? snapshotDeckSizes.black
        : snapshotSizes.initialDeckSize;

    if (metadata && metadata.mode === 'perPlayer') {
        const deckSizeByPlayer = {
            black: metadata.deckSizeByPlayer.black !== null
                ? metadata.deckSizeByPlayer.black
                : snapshotDeckSizes.black,
            white: metadata.deckSizeByPlayer.white !== null
                ? metadata.deckSizeByPlayer.white
                : snapshotDeckSizes.white
        };
        const sharedDeckSize = deckSizeByPlayer.black === deckSizeByPlayer.white
            ? deckSizeByPlayer.black
            : null;
        return {
            mode: 'perPlayer',
            deckSize: sharedDeckSize,
            deckSizeByPlayer,
            source: metadata.source
        };
    }

    if (!metadata && snapshotDeckSize === null) return null;
    return {
        mode: 'shared',
        deckSize: metadata && metadata.deckSize !== null ? metadata.deckSize : snapshotDeckSize,
        source: metadata ? metadata.source : 'room'
    };
}
